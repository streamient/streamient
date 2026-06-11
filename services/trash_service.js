import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { bulkIndexDocuments, bulkRemoveDocuments, listDocuments } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { removeLinksForItem } from './graph_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('trash');

const MODEL_MAP = {
	notes: { model: Note, tsType: 'notes' },
	memories: { model: Memory, tsType: 'memory' },
	urls: { model: Url, tsType: 'urls' },
	emails: { model: Email, tsType: 'emails' },
};
const TRASH_INCLUDE_FIELDS = {
	notes: 'id,source_id,title,project_id,in_trash,trashed_at,created_at,updated_at',
	memories: 'id,source_id,title,source,project_id,in_trash,trashed_at,created_at,updated_at',
	urls: 'id,source_id,title,url,description,project_id,in_trash,trashed_at,created_at,updated_at',
	emails: 'id,source_id,subject,from,mailbox,project_id,in_trash,trashed_at,created_at,updated_at',
};

function eventTypeForTrashType(type) {
	return type === 'memories' ? 'memory' : type.slice(0, -1);
}

function getModelEntry(type) {
	const entry = MODEL_MAP[type];
	if (!entry) throw new Error(`Invalid trash type: ${type}`);
	return entry;
}

function groupTrashItems(items) {
	const grouped = new Map();
	for (const item of items || []) {
		if (!item?.type || !item?.id) continue;
		if (!grouped.has(item.type)) grouped.set(item.type, []);
		grouped.get(item.type).push(item.id);
	}
	return grouped;
}

function dateFromTypesenseSeconds(value) {
	const number = Number(value || 0);
	if (!Number.isFinite(number) || number <= 0) return null;
	return new Date(number * 1000).toISOString();
}

function trashTimestamp(item) {
	const value = item?.trashed_at;
	const time = value ? new Date(value).getTime() : 0;
	return Number.isFinite(time) ? time : 0;
}

function trashHitToItem(type, hit) {
	const doc = hit?.document || {};
	const id = String(doc.source_id || doc.id || '').trim();
	return {
		...doc,
		_id: id,
		id,
		_type: type,
		project: doc.project_id || '',
		trashed_at: dateFromTypesenseSeconds(doc.trashed_at),
		createdAt: dateFromTypesenseSeconds(doc.created_at),
		updatedAt: dateFromTypesenseSeconds(doc.updated_at),
	};
}

async function listTrashType(host_id, type, limit, deps = {}) {
	const { tsType } = getModelEntry(type);
	const listFn = deps.listDocuments || listDocuments;
	const result = await listFn(host_id, tsType, {
		perPage: limit,
		filter_by: 'in_trash:=true',
		sort_by: 'trashed_at:desc',
		include_fields: TRASH_INCLUDE_FIELDS[type],
	});
	return {
		items: (result.hits || []).map((hit) => trashHitToItem(type, hit)),
		total: Number(result.found || 0),
	};
}

async function markIndexed(model, host_id, ids) {
	const uniqueIds = [...new Set(ids.map((id) => String(id || '')).filter(Boolean))];
	if (!uniqueIds.length) return;
	await model.updateMany({ _id: { $in: uniqueIds }, host_id }, { $set: { is_indexed: true } }, { timestamps: false });
}

async function restoreItemsByType(host_id, type, ids, deps = {}) {
	const { model, tsType } = getModelEntry(type);
	const bulkIndexFn = deps.bulkIndexDocuments || bulkIndexDocuments;
	const docs = [];

	for (const id of [...new Set(ids.map((value) => String(value || '')).filter(Boolean))]) {
		const doc = await model.findOneAndUpdate(
			{ _id: id, host_id, in_trash: true },
			{ $set: { in_trash: false, is_indexed: false }, $unset: { trashed_at: '' } },
			{ returnDocument: 'after' },
		);
		if (doc) docs.push(doc);
	}

	if (docs.length) {
		const results = await bulkIndexFn(host_id, tsType, docs);
		const successIds = results.filter((result) => result.success).map((result) => result.id);
		await markIndexed(model, host_id, successIds);
		const failed = results.filter((result) => !result.success);
		if (failed.length) log.error({ failed, type, host_id }, 'Typesense bulk restore index error');
		for (const doc of docs) {
			emitToTenant(host_id, `${eventTypeForTrashType(type)}:created`, doc);
		}
	}

	return docs;
}

async function permanentDeleteItemsByType(host_id, type, ids, deps = {}) {
	const { model, tsType } = getModelEntry(type);
	const bulkRemoveFn = deps.bulkRemoveDocuments || bulkRemoveDocuments;
	const docs = [];
	const uniqueIds = [...new Set(ids.map((value) => String(value || '')).filter(Boolean))];

	for (const id of uniqueIds) {
		const doc = await model.findOneAndDelete({ _id: id, host_id, in_trash: true });
		if (doc) docs.push(doc);
	}

	const deletedIds = docs.map((doc) => doc._id?.toString?.() || String(doc._id || ''));
	if (deletedIds.length) {
		await bulkRemoveFn(host_id, tsType, deletedIds);
		await Promise.all(
			deletedIds.map((id) => removeLinksForItem(host_id, id).catch((err) => log.error({ err }, 'Graph link cleanup error'))),
		);
		for (const id of deletedIds) {
			emitToTenant(host_id, `${eventTypeForTrashType(type)}:deleted`, { _id: id });
		}
	}

	return docs;
}

export async function listTrash(host_id, { type, page = 1, limit = 50 } = {}, deps = {}) {
	const types = type ? [type] : Object.keys(MODEL_MAP);
	const skip = (page - 1) * limit;
	const fetchLimit = skip + limit;

	const results = await Promise.all(types.map((t) => listTrashType(host_id, t, fetchLimit, deps)));
	const items = results.flatMap((result) => result.items);
	items.sort((a, b) => trashTimestamp(b) - trashTimestamp(a));

	return {
		items: items.slice(skip, skip + limit),
		total: results.reduce((sum, result) => sum + result.total, 0),
	};
}

export async function restoreItem(host_id, type, id, deps = {}) {
	const docs = await restoreItemsByType(host_id, type, [id], deps);
	return docs[0] || null;
}

export async function permanentDelete(host_id, type, id, deps = {}) {
	const docs = await permanentDeleteItemsByType(host_id, type, [id], deps);
	return docs[0] || null;
}

export async function batchRestore(host_id, items, deps = {}) {
	const results = [];
	for (const [type, ids] of groupTrashItems(items).entries()) {
		results.push(...await restoreItemsByType(host_id, type, ids, deps));
	}
	emitToTenant(host_id, 'counts:refresh');
	return results;
}

export async function batchPermanentDelete(host_id, items, deps = {}) {
	const results = [];
	for (const [type, ids] of groupTrashItems(items).entries()) {
		results.push(...await permanentDeleteItemsByType(host_id, type, ids, deps));
	}
	return results;
}

export async function emptyTrash(host_id, deps = {}) {
	const bulkRemoveFn = deps.bulkRemoveDocuments || bulkRemoveDocuments;
	const deletions = Object.entries(MODEL_MAP).map(async ([type, { model, tsType }]) => {
		const docs = await model.find({ host_id, in_trash: true }).select('_id').lean();
		const ids = docs.map((d) => d._id.toString());

		await model.deleteMany({ host_id, in_trash: true });

		if (ids.length) await bulkRemoveFn(host_id, tsType, ids);
		for (const id of ids) {
			emitToTenant(host_id, `${eventTypeForTrashType(type)}:deleted`, { _id: id });
		}

		return ids.length;
	});

	const counts = await Promise.all(deletions);
	return { deleted: counts.reduce((a, b) => a + b, 0) };
}

export async function getTrashCount(host_id, deps = {}) {
	const listFn = deps.listDocuments || listDocuments;
	const counts = await Promise.all(Object.keys(MODEL_MAP).map(async (type) => {
		const { tsType } = getModelEntry(type);
		const result = await listFn(host_id, tsType, {
			perPage: 1,
			filter_by: 'in_trash:=true',
			include_fields: 'id,source_id',
		});
		return Number(result.found || 0);
	}));
	return counts.reduce((a, b) => a + b, 0);
}
