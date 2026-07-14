import { GraphLink } from '../model/graph_link.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { searchCollection, listDocuments } from '../modules/typesense.js';
import { cacheGet, cacheSet, cacheInvalidate } from '../modules/redis.js';
import * as audit from './audit_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('graph');

const MODEL_MAP = {
	notes: Note,
	memory: Memory,
	urls: Url,
	emails: Email,
};

const MAX_NODES = 500;
const SEMANTIC_THRESHOLD = 0.7;
const CACHE_TTL = 300; // 5 minutes

// ---- Link CRUD ----

export async function createLink(userId, hostId, data, ctx = {}) {
	// Validate source and target exist
	const sourceModel = MODEL_MAP[data.source_type];
	const targetModel = MODEL_MAP[data.target_type];
	if (!sourceModel || !targetModel) throw new Error('Invalid item type');

	const [source, target] = await Promise.all([
		sourceModel.findOne({ _id: data.source_id, host_id: hostId }).select('_id').lean(),
		targetModel.findOne({ _id: data.target_id, host_id: hostId }).select('_id').lean(),
	]);

	if (!source) throw new Error('Source item not found');
	if (!target) throw new Error('Target item not found');

	const link = await GraphLink.create({
		source_id: data.source_id,
		source_type: data.source_type,
		target_id: data.target_id,
		target_type: data.target_type,
		label: data.label || '',
		owner: userId,
		host_id: hostId,
	});

	invalidateGraphCache(hostId).catch(() => {});
	audit.log({ action: 'create', resource: 'link', resource_id: link._id.toString(), user_id: userId, host_id: hostId, ...ctx });
	return link;
}

export async function deleteLink(hostId, linkId, ctx = {}) {
	const link = await GraphLink.findOneAndDelete({ _id: linkId, host_id: hostId });
	if (link) {
		invalidateGraphCache(hostId).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'link', resource_id: linkId, host_id: hostId, ...ctx });
	}
	return link;
}

export async function getLinksForItem(hostId, itemId) {
	return GraphLink.find({
		host_id: hostId,
		$or: [{ source_id: itemId }, { target_id: itemId }],
	}).lean();
}

export async function getConnectionsForItem(hostId, itemId) {
	// 1. Get manual links
	const manualLinks = await getLinksForItem(hostId, itemId);
	const manualIds = new Set();
	manualIds.add(itemId);
	for (const l of manualLinks) {
		manualIds.add(l.source_id.toString());
		manualIds.add(l.target_id.toString());
	}

	// 2. Find the item and its tags
	let item = null;
	let itemType = null;
	for (const [type, Model] of Object.entries(MODEL_MAP)) {
		item = await Model.findOne({ _id: itemId, host_id: hostId }).select('tags').lean();
		if (item) { itemType = type; break; }
	}

	// 3. Find tag-based connections (items sharing tags, excluding manual links)
	const tagConnections = [];
	if (item?.tags?.length) {
		const tagQuery = { host_id: hostId, tags: { $in: item.tags }, _id: { $ne: itemId }, in_trash: { $ne: true } };
		const [notes, memories, urls] = await Promise.all([
			Note.find(tagQuery).select('title tags').limit(50).lean(),
			Memory.find(tagQuery).select('title tags').limit(50).lean(),
			Url.find(tagQuery).select('title url tags').limit(50).lean(),
		]);
		for (const n of notes) {
			if (manualIds.has(n._id.toString())) continue;
			const shared = n.tags.filter(t => item.tags.includes(t));
			tagConnections.push({ id: n._id.toString(), type: 'notes', title: n.title, shared_tags: shared });
		}
		for (const m of memories) {
			if (manualIds.has(m._id.toString())) continue;
			const shared = m.tags.filter(t => item.tags.includes(t));
			tagConnections.push({ id: m._id.toString(), type: 'memory', title: m.title, shared_tags: shared });
		}
		for (const u of urls) {
			if (manualIds.has(u._id.toString())) continue;
			const shared = u.tags.filter(t => item.tags.includes(t));
			tagConnections.push({ id: u._id.toString(), type: 'urls', title: u.title || u.url, shared_tags: shared });
		}
	}

	return { links: manualLinks, tag_connections: tagConnections };
}

export async function removeLinksForItems(hostId, itemIds) {
	const ids = [...new Set((itemIds || []).map((itemId) => itemId?.toString ? itemId.toString() : String(itemId || '')).filter(Boolean))];
	if (!ids.length) return { acknowledged: true, deletedCount: 0 };

	const result = await GraphLink.deleteMany({
		host_id: hostId,
		$or: [{ source_id: { $in: ids } }, { target_id: { $in: ids } }],
	});
	if (result.deletedCount > 0) {
		invalidateGraphCache(hostId).catch(() => {});
	}
	return result;
}

export async function removeLinksForItem(hostId, itemId) {
	return removeLinksForItems(hostId, [itemId]);
}

// ---- Graph Data Assembly ----

export async function getGraphData(hostId, options = {}) {
	const { projectId, includeTags = true, includeSemantic = false, semanticThreshold = SEMANTIC_THRESHOLD } = options;

	// Step A: Fetch all non-trashed items as nodes from Typesense (minimal fields)
	const filter = projectId ? `project_id:=${projectId}` : undefined;
	const listOpts = {
		perPage: MAX_NODES,
		filter_by: filter,
		include_fields: 'id,title,tags,project_id,created_at',
	};
	const urlListOpts = {
		perPage: MAX_NODES,
		filter_by: filter,
		include_fields: 'id,title,url,tags,project_id,created_at',
	};

	const [notesRes, memoriesRes, urlsRes] = await Promise.all([
		listDocuments(hostId, 'notes', listOpts).catch((e) => { log.error({ err: e, collection: 'notes' }, 'Graph listDocuments failed'); return { hits: [] }; }),
		listDocuments(hostId, 'memory', listOpts).catch((e) => { log.error({ err: e, collection: 'memory' }, 'Graph listDocuments failed'); return { hits: [] }; }),
		listDocuments(hostId, 'urls', urlListOpts).catch((e) => { log.error({ err: e, collection: 'urls' }, 'Graph listDocuments failed'); return { hits: [] }; }),
	]);

	const nodes = [];
	for (const hit of notesRes.hits || []) {
		const d = hit.document;
		nodes.push({ id: d.id, name: d.title, type: 'notes', tags: d.tags || [], project_id: d.project_id, created_at: d.created_at });
	}
	for (const hit of memoriesRes.hits || []) {
		const d = hit.document;
		nodes.push({ id: d.id, name: d.title, type: 'memory', tags: d.tags || [], project_id: d.project_id, created_at: d.created_at });
	}
	for (const hit of urlsRes.hits || []) {
		const d = hit.document;
		nodes.push({ id: d.id, name: d.title || d.url, type: 'urls', tags: d.tags || [], project_id: d.project_id, created_at: d.created_at });
	}

	// Cap total nodes
	if (nodes.length > MAX_NODES) nodes.length = MAX_NODES;

	const nodeIds = new Set(nodes.map((n) => n.id));

	// Step B: Manual links
	const linkQuery = { host_id: hostId };
	const links = await GraphLink.find(linkQuery).lean();
	const edges = [];
	for (const l of links) {
		const sid = l.source_id.toString();
		const tid = l.target_id.toString();
		if (nodeIds.has(sid) && nodeIds.has(tid)) {
			edges.push({
				id: l._id.toString(),
				source: sid,
				target: tid,
				source_type: l.source_type,
				target_type: l.target_type,
				label: l.label || '',
				edge_type: 'manual',
			});
		}
	}

	// Step C: Tag-based edges
	if (includeTags && nodes.length > 0) {
		const cacheKey = `graph:tags:${hostId}:${projectId || 'all'}`;
		let tagEdges = await cacheGet(cacheKey);
		if (!tagEdges) {
			tagEdges = computeTagEdges(nodes);
			await cacheSet(cacheKey, tagEdges, CACHE_TTL);
		}
		edges.push(...tagEdges);
	}

	// Step D: Semantic similarity edges
	if (includeSemantic && nodes.length > 0) {
		const cacheKey = `graph:semantic:${hostId}:${projectId || 'all'}`;
		let semanticEdges = await cacheGet(cacheKey);
		if (!semanticEdges) {
			semanticEdges = await computeSemanticEdges(hostId, nodes, semanticThreshold);
			await cacheSet(cacheKey, semanticEdges, CACHE_TTL);
		}
		edges.push(...semanticEdges);
	}

	return { nodes, edges: edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)) };
}

// ---- Tag edge computation ----

function computeTagEdges(nodes) {
	const tagMap = new Map(); // tag -> [nodeId, ...]
	for (const node of nodes) {
		for (const tag of node.tags) {
			if (!tag) continue;
			if (!tagMap.has(tag)) tagMap.set(tag, []);
			tagMap.get(tag).push(node.id);
		}
	}

	const edges = [];
	const seen = new Set();
	for (const [tag, ids] of tagMap) {
		if (ids.length < 2) continue;
		// Connect pairs (limit to avoid explosion)
		const maxPairs = Math.min(ids.length, 20);
		for (let i = 0; i < maxPairs; i++) {
			for (let j = i + 1; j < maxPairs; j++) {
				const key = `${ids[i]}-${ids[j]}`;
				if (seen.has(key)) continue;
				seen.add(key);
				edges.push({
					source: ids[i],
					target: ids[j],
					label: tag,
					edge_type: 'tag',
				});
			}
		}
	}

	return edges;
}

// ---- Semantic similarity computation ----

async function computeSemanticEdges(hostId, nodes, threshold) {
	const edges = [];
	const seen = new Set();
	const nodeIds = new Set(nodes.map((n) => n.id));

	// Sample up to 50 nodes for semantic search to avoid excessive queries
	const sample = nodes.length > 50 ? nodes.slice(0, 50) : nodes;

	const supportedTypes = new Set(['notes', 'memory', 'urls']);

	for (const node of sample) {
		if (!supportedTypes.has(node.type)) continue;

		try {
			const results = await searchCollection(hostId, node.type, node.name, {
				queryBy: 'embedding',
				perPage: 4,
				include_fields: 'id',
			});

			for (const hit of (results.hits || [])) {
				const targetId = hit.document.id;
				if (targetId === node.id) continue;
				if (!nodeIds.has(targetId)) continue;

				// Embedding-only search returns vector_distance (0 = identical,
				// up to 2 for cosine). Convert to a 0..1 similarity score.
				const score = hit.vector_distance != null
					? 1 - hit.vector_distance
					: (hit.text_match_info?.score || hit.hybrid_search_info?.rank_fusion_score || 0);
				if (score < threshold) continue;

				const key = [node.id, targetId].sort().join('-');
				if (seen.has(key)) continue;
				seen.add(key);

				edges.push({
					source: node.id,
					target: targetId,
					label: `similarity`,
					edge_type: 'semantic',
					score,
				});
			}
		} catch {
			// Collection may not exist
		}
	}

	return edges;
}

// ---- Cache invalidation ----

export async function invalidateGraphCache(hostId) {
	await cacheInvalidate(`graph:*:${hostId}:*`);
}
