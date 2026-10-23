import mongoose from '../model/mongoose.js';
import { Tenant } from '../modules/tenancy.js';
import { bulkIndexDocuments, exportTrashDocuments, removeDocumentsBySourceIds } from '../modules/typesense.js';
import { removeLinksForItems } from './graph_service.js';
import { TRASH_MODEL_MAP } from './trash_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('trash-reconciliation');
export const DEFAULT_TRASH_RECONCILIATION_BATCH_SIZE = 250;

function splitBatches(values, batchSize) {
	const batches = [];
	for (let index = 0; index < values.length; index += batchSize) batches.push(values.slice(index, index + batchSize));
	return batches;
}

function sourceId(doc) {
	return String(doc?.source_id || doc?.id || '').trim();
}

function mongoId(doc) {
	return String(doc?._id || '').trim();
}

function unixSeconds(value) {
	const time = value ? new Date(value).getTime() : 0;
	return Number.isFinite(time) && time > 0 ? Math.floor(time / 1000) : 0;
}

function stateMatches(mongoDoc, anchor) {
	if (mongoDoc?.in_trash !== true || anchor?.in_trash !== true) return false;
	return unixSeconds(mongoDoc.trashed_at) === Number(anchor.trashed_at || 0);
}

function summarizeError(type, operation, err, count = 0) {
	return { type, operation, count, message: err?.message || String(err) };
}

function exportedSources(docs) {
	const sources = new Map();
	for (const doc of docs || []) {
		const id = sourceId(doc);
		if (!id) continue;
		if (!sources.has(id)) sources.set(id, { hasAnchor: false, anchor: null });
		if (Number(doc.chunk_index) === 0) sources.set(id, { hasAnchor: true, anchor: doc });
	}
	return sources;
}

async function readByIds(model, hostId, ids, batchSize, isValidId) {
	const docs = [];
	const validIds = ids.filter((id) => isValidId(id));
	for (const batch of splitBatches(validIds, batchSize)) {
		for (const id of batch) {
			const row = await model.findOneAndUpdate({ _id: id, host_id: hostId }, { $inc: { __v: 0 } }, { timestamps: false, returnDocument: 'after' }).lean();
			if (row) docs.push(row);
		}
	}
	return docs;
}

async function readTrash(model, hostId, batchSize, isValidId) {
	const candidates = await model.find({ host_id: hostId, in_trash: true }).lean();
	return (await readByIds(model, hostId, candidates.map(mongoId), batchSize, isValidId)).filter((doc) => doc.in_trash === true);
}

function emptyTypeSummary(type, tsType) {
	return {
		type,
		ts_type: tsType,
		exported_sources: 0,
		mongo_trash: 0,
		valid: 0,
		orphans: 0,
		stale_state: 0,
		missing_anchor: 0,
		deleted: 0,
		reindexed: 0,
		graph_cleaned: 0,
		errors: [],
	};
}

async function reconcileType(hostId, type, entry, options) {
	const { model, tsType } = entry;
	const { dryRun, batchSize, exportDocuments, removeSearchDocuments, indexDocuments, removeGraphLinks, isValidId } = options;
	const summary = emptyTypeSummary(type, tsType);
	let exported;
	try {
		exported = await exportDocuments(hostId, tsType);
	} catch (err) {
		summary.errors.push(summarizeError(type, 'export', err));
		return summary;
	}

	const sources = exportedSources(exported);
	const sourceIds = [...sources.keys()];
	const invalidIds = sourceIds.filter((id) => !isValidId(id));
	const invalidIdSet = new Set(invalidIds);
	const [indexedMongoDocs, mongoTrashDocs] = await Promise.all([
		readByIds(model, hostId, sourceIds, batchSize, isValidId),
		readTrash(model, hostId, batchSize, isValidId),
	]);
	const mongoById = new Map(indexedMongoDocs.map((doc) => [mongoId(doc), doc]));
	for (const doc of mongoTrashDocs) mongoById.set(mongoId(doc), doc);

	const orphanIds = [...invalidIds];
	const staleDocs = [];
	const missingAnchorDocs = [];
	let valid = 0;
	for (const [id, indexedState] of sources) {
		if (invalidIdSet.has(id)) continue;
		const mongoDoc = mongoById.get(id);
		if (!mongoDoc) {
			orphanIds.push(id);
			continue;
		}
		if (!indexedState.hasAnchor) {
			missingAnchorDocs.push(mongoDoc);
			continue;
		}
		if (!stateMatches(mongoDoc, indexedState.anchor)) {
			staleDocs.push(mongoDoc);
			continue;
		}
		valid++;
	}
	for (const mongoDoc of mongoTrashDocs) {
		const id = mongoId(mongoDoc);
		if (!sources.has(id)) missingAnchorDocs.push(mongoDoc);
	}

	const reindexById = new Map([...staleDocs, ...missingAnchorDocs].map((doc) => [mongoId(doc), doc]));
	const uniqueOrphanIds = [...new Set(orphanIds)];
	summary.exported_sources = sourceIds.length;
	summary.mongo_trash = mongoTrashDocs.length;
	summary.valid = valid;
	summary.orphans = uniqueOrphanIds.length;
	summary.stale_state = staleDocs.length;
	summary.missing_anchor = new Set(missingAnchorDocs.map(mongoId)).size;
	if (dryRun) return summary;

	for (const batch of splitBatches(uniqueOrphanIds, batchSize)) {
		let graphCleaned = false;
		try {
			await removeGraphLinks(hostId, batch);
			summary.graph_cleaned += batch.length;
			graphCleaned = true;
		} catch (err) {
			summary.errors.push(summarizeError(type, 'delete_orphan_graph_links', err, batch.length));
		}
		if (!graphCleaned) continue;
		try {
			await removeSearchDocuments(hostId, tsType, batch);
			summary.deleted += batch.length;
		} catch (err) {
			summary.errors.push(summarizeError(type, 'delete_orphans', err, batch.length));
		}
	}

	for (const docs of splitBatches([...reindexById.values()], batchSize)) {
		try {
			const pendingIds = docs.map(mongoId);
			await model.updateMany({ _id: { $in: pendingIds }, host_id: hostId }, { $set: { is_indexed: false } }, { timestamps: false });
			const results = await indexDocuments(hostId, tsType, docs);
			const successIds = results.filter((result) => result?.success).map((result) => result.id);
			summary.reindexed += successIds.length;
			if (successIds.length) await model.updateMany({ _id: { $in: successIds }, host_id: hostId }, { $set: { is_indexed: true } }, { timestamps: false });
			for (const result of results.filter((item) => !item?.success)) summary.errors.push(summarizeError(type, 'reindex', new Error(result?.error || 'Typesense import failed'), 1));
		} catch (err) {
			summary.errors.push(summarizeError(type, 'reindex', err, docs.length));
		}
	}
	return summary;
}

export async function reconcileTrashForTenant(hostId, {
	dryRun = true,
	batchSize = DEFAULT_TRASH_RECONCILIATION_BATCH_SIZE,
	models = TRASH_MODEL_MAP,
	exportDocuments = exportTrashDocuments,
	removeSearchDocuments = removeDocumentsBySourceIds,
	indexDocuments = bulkIndexDocuments,
	removeGraphLinks = removeLinksForItems,
	isValidId = mongoose.isObjectIdOrHexString,
} = {}) {
	if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > DEFAULT_TRASH_RECONCILIATION_BATCH_SIZE) throw new Error(`batchSize must be an integer from 1 to ${DEFAULT_TRASH_RECONCILIATION_BATCH_SIZE}`);
	const startedAt = new Date();
	const summary = { host_id: hostId, dry_run: dryRun, batch_size: batchSize, started_at: startedAt.toISOString(), types: {}, errors: [] };
	for (const [type, entry] of Object.entries(models)) {
		try {
			summary.types[type] = await reconcileType(hostId, type, entry, { dryRun, batchSize, exportDocuments, removeSearchDocuments, indexDocuments, removeGraphLinks, isValidId });
		} catch (err) {
			const failed = emptyTypeSummary(type, entry.tsType);
			failed.errors.push(summarizeError(type, 'reconcile', err));
			summary.types[type] = failed;
		}
	}
	const values = Object.values(summary.types);
	summary.totals = {
		exported_sources: values.reduce((sum, value) => sum + value.exported_sources, 0),
		mongo_trash: values.reduce((sum, value) => sum + value.mongo_trash, 0),
		valid: values.reduce((sum, value) => sum + value.valid, 0),
		orphans: values.reduce((sum, value) => sum + value.orphans, 0),
		stale_state: values.reduce((sum, value) => sum + value.stale_state, 0),
		missing_anchor: values.reduce((sum, value) => sum + value.missing_anchor, 0),
		deleted: values.reduce((sum, value) => sum + value.deleted, 0),
		reindexed: values.reduce((sum, value) => sum + value.reindexed, 0),
		graph_cleaned: values.reduce((sum, value) => sum + value.graph_cleaned, 0),
		errors: values.reduce((sum, value) => sum + value.errors.length, 0),
	};
	summary.completed_at = new Date().toISOString();
	return summary;
}

export async function reconcileActiveTrashTenants({ tenantModel = Tenant, reconcileTenant = reconcileTrashForTenant, ...options } = {}) {
	const tenants = await tenantModel.find({ is_active: { $ne: false } }).select('host_id').lean();
	const summaries = [];
	for (const tenant of tenants) {
		if (!tenant.host_id) continue;
		try {
			summaries.push(await reconcileTenant(tenant.host_id, options));
		} catch (err) {
			log.error({ err, host_id: tenant.host_id }, 'Trash reconciliation tenant error');
			summaries.push({ host_id: tenant.host_id, dry_run: options.dryRun !== false, errors: [{ operation: 'tenant', message: err?.message || String(err) }] });
		}
	}
	return summaries;
}
