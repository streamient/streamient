import mongoose from '../model/mongoose.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { bulkIndexDocuments, bulkRemoveDocuments, exportTrashDocuments, listTrashDocuments, removeDocumentsByFilter } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { removeLinksForItems } from './graph_service.js';
import { createLogger } from '../modules/logger.js';
import { syncStreamientItem } from './obsidian_sync_service.js';

const log = createLogger('trash');

export const TRASH_MODEL_MAP = {
	notes: { model: Note, tsType: 'notes' },
	memories: { model: Memory, tsType: 'memory' },
	urls: { model: Url, tsType: 'urls' },
	emails: { model: Email, tsType: 'emails' },
};
const TRASH_INCLUDE_FIELDS = {
	notes: 'id,source_id,title,project_id,in_trash,trashed_at,created_at,updated_at',
	memories: 'id,source_id,title,source,project_id,in_trash,trashed_at,created_at,updated_at',
	urls: 'id,source_id,title,url,description,tags,project_id,in_trash,trashed_at,created_at,updated_at',
	emails: 'id,source_id,subject,from,mailbox,project_id,in_trash,trashed_at,created_at,updated_at',
};

function eventTypeForTrashType(type) {
	return type === 'memories' ? 'memory' : type.slice(0, -1);
}

function getModelEntry(type) {
	const entry = TRASH_MODEL_MAP[type];
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

function trashTypeForUnionDocument(doc, requestedTypes) {
	if (requestedTypes.length === 1) return requestedTypes[0];
	if (Object.hasOwn(doc, 'subject')) return 'emails';
	if (Object.hasOwn(doc, 'url')) return 'urls';
	if (Object.hasOwn(doc, 'source')) return 'memories';
	return 'notes';
}

function uniqueIds(ids) {
	return [...new Set((ids || []).map((value) => String(value || '')).filter(Boolean))];
}

async function findPrimaryLean(model, query, fields = '') {
	try {
		let mongoQuery = model.findOne(query);
		if (fields) mongoQuery = mongoQuery.select(fields);
		return await mongoQuery.read('primary').lean();
	} catch (err) {
		if (err?.name === 'CastError') return null;
		throw err;
	}
}

async function findExistingPrimary(model, host_id, ids, batchSize = 250) {
	const validIds = uniqueIds(ids).filter((id) => mongoose.isObjectIdOrHexString(id));
	const existing = [];
	for (let index = 0; index < validIds.length; index += batchSize) {
		const batch = validIds.slice(index, index + batchSize);
		const docs = await model.find({ _id: { $in: batch }, host_id }).read('primary').lean();
		existing.push(...docs);
	}
	return existing;
}

async function cleanupGraphLinks(host_id, ids) {
	const values = uniqueIds(ids);
	if (!values.length) return;
	await removeLinksForItems(host_id, values);
}

async function markIndexed(model, host_id, ids) {
	const uniqueIds = [...new Set(ids.map((id) => String(id || '')).filter(Boolean))];
	if (!uniqueIds.length) return;
	await model.updateMany({ _id: { $in: uniqueIds }, host_id }, { $set: { is_indexed: true } }, { timestamps: false });
}

async function markIndexPending(model, host_id, docs) {
	const ids = uniqueIds(docs.map((doc) => doc?._id));
	if (!ids.length) return;
	await model.updateMany({ _id: { $in: ids }, host_id }, { $set: { is_indexed: false } }, { timestamps: false });
}

async function restoreItemsByType(host_id, type, ids, deps = {}) {
	const { model, tsType } = getModelEntry(type);
	const bulkIndexFn = deps.bulkIndexDocuments || bulkIndexDocuments;
	const bulkRemoveFn = deps.bulkRemoveDocuments || bulkRemoveDocuments;
	const removeGraphLinks = deps.removeGraphLinks || cleanupGraphLinks;
	const docs = [];
	const currentDocs = [];
	const missingIds = [];

	for (const id of uniqueIds(ids)) {
		let doc;
		try {
			doc = await model.findOneAndUpdate(
				{ _id: id, host_id, in_trash: true },
				{ $set: { in_trash: false, is_indexed: false }, $unset: { trashed_at: '' } },
				{ returnDocument: 'after' },
			);
		} catch (err) {
			if (err?.name !== 'CastError') throw err;
			doc = null;
		}
		if (doc) {
			docs.push(doc);
			continue;
		}
		const current = await findPrimaryLean(model, { _id: id, host_id });
		if (current) currentDocs.push(current);
		else missingIds.push(id);
	}

	const indexDocs = [...docs, ...currentDocs];
	if (indexDocs.length) {
		await markIndexPending(model, host_id, indexDocs);
		const results = await bulkIndexFn(host_id, tsType, indexDocs);
		const successIds = results.filter((result) => result.success).map((result) => result.id);
		await markIndexed(model, host_id, successIds);
		const failed = results.filter((result) => !result.success);
		if (failed.length) log.error({ failed, type, host_id }, 'Typesense bulk restore index error');
		for (const doc of docs) {
			emitToTenant(host_id, `${eventTypeForTrashType(type)}:created`, doc);
			if (type === 'notes' && doc.obsidian_source?.file_id) await syncStreamientItem('note', doc._id, host_id, { item: doc });
			if (type === 'memories' && doc.obsidian_source?.file_id) await syncStreamientItem('memory', doc._id, host_id, { item: doc });
			if (type === 'urls' && doc.obsidian_source?.file_id) await syncStreamientItem('url', doc._id, host_id, { item: doc });
		}
	}
	if (missingIds.length) {
		await removeGraphLinks(host_id, missingIds);
		await bulkRemoveFn(host_id, tsType, missingIds);
	}

	return { docs, currentIds: currentDocs.map((doc) => String(doc._id)), missingIds };
}

async function permanentDeleteItemsByType(host_id, type, ids, deps = {}) {
	const { model, tsType } = getModelEntry(type);
	const bulkRemoveFn = deps.bulkRemoveDocuments || bulkRemoveDocuments;
	const bulkIndexFn = deps.bulkIndexDocuments || bulkIndexDocuments;
	const removeGraphLinks = deps.removeGraphLinks || cleanupGraphLinks;
	const docs = [];
	const currentDocs = [];
	const missingIds = [];
	const requestedIds = uniqueIds(ids);

	for (const id of requestedIds) {
		let doc;
		try {
			doc = await model.findOneAndDelete({ _id: id, host_id, in_trash: true });
		} catch (err) {
			if (err?.name !== 'CastError') throw err;
			doc = null;
		}
		if (doc) {
			docs.push(doc);
			continue;
		}
		const current = await findPrimaryLean(model, { _id: id, host_id });
		if (current) currentDocs.push(current);
		else missingIds.push(id);
	}

	const deletedIds = docs.map((doc) => doc._id?.toString?.() || String(doc._id || ''));
	await removeGraphLinks(host_id, [...deletedIds, ...missingIds]);
	await bulkRemoveFn(host_id, tsType, requestedIds);
	if (currentDocs.length) {
		await markIndexPending(model, host_id, currentDocs);
		const results = await bulkIndexFn(host_id, tsType, currentDocs, { removeExisting: false });
		const successIds = results.filter((result) => result.success).map((result) => result.id);
		await markIndexed(model, host_id, successIds);
		const failed = results.filter((result) => !result.success);
		if (failed.length) log.error({ failed, type, host_id }, 'Typesense stale trash repair error');
	}
	for (const id of [...deletedIds, ...missingIds]) {
		emitToTenant(host_id, `${eventTypeForTrashType(type)}:deleted`, { _id: id });
	}

	const deletedSet = new Set(deletedIds);
	const currentSet = new Set(currentDocs.map((doc) => String(doc._id)));
	return requestedIds.map((id) => ({ id, deleted: deletedSet.has(id), missing: missingIds.includes(id), repaired: currentSet.has(id) }));
}

export async function listTrash(host_id, { type, page = 1, limit = 50, offset } = {}, deps = {}) {
	const types = type ? [type] : Object.keys(TRASH_MODEL_MAP);
	const safePage = Math.max(1, Number(page) || 1);
	const safeLimit = Math.min(250, Math.max(1, Number(limit) || 50));
	const safeOffset = Number.isSafeInteger(Number(offset)) && Number(offset) >= 0 ? Number(offset) : null;
	const listFn = deps.listTrashDocuments || listTrashDocuments;
	const typeByTsType = new Map(types.map((trashType) => [getModelEntry(trashType).tsType, trashType]));
	const includeFields = Object.fromEntries(types.map((trashType) => [getModelEntry(trashType).tsType, TRASH_INCLUDE_FIELDS[trashType]]));
	const result = await listFn(host_id, [...typeByTsType.keys()], { union: true, page: safePage, perPage: safeLimit, offset: safeOffset, sort_by: 'trashed_at:desc', include_fields: includeFields });
	const items = (result.hits || []).map((hit) => trashHitToItem(trashTypeForUnionDocument(hit?.document || {}, types), hit));

	return {
		items,
		total: Number(result.found || 0),
	};
}

export async function restoreItem(host_id, type, id, deps = {}) {
	const outcome = await restoreItemsByType(host_id, type, [id], deps);
	if (outcome.docs[0]) return outcome.docs[0];
	const err = new Error(outcome.missingIds.length ? 'Item no longer exists' : 'Item is no longer in trash');
	err.code = 'TRASH_ITEM_NOT_FOUND';
	err.stale = true;
	throw err;
}

export async function permanentDelete(host_id, type, id, deps = {}) {
	const results = await permanentDeleteItemsByType(host_id, type, [id], deps);
	return results[0];
}

export async function batchRestore(host_id, items, deps = {}) {
	const results = [];
	for (const [type, ids] of groupTrashItems(items).entries()) {
		const outcome = await restoreItemsByType(host_id, type, ids, deps);
		results.push(...outcome.docs);
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
	const exportFn = deps.exportTrashDocuments || exportTrashDocuments;
	const removeByFilterFn = deps.removeDocumentsByFilter || removeDocumentsByFilter;
	const bulkIndexFn = deps.bulkIndexDocuments || bulkIndexDocuments;
	const removeGraphLinks = deps.removeGraphLinks || cleanupGraphLinks;
	let deleted = 0;

	for (const [type, { model, tsType }] of Object.entries(TRASH_MODEL_MAP)) {
		const indexedDocs = await exportFn(host_id, tsType);
		const indexedIds = uniqueIds(indexedDocs.map((doc) => doc.source_id || doc.id));
		const mongoDocs = await model.find({ host_id, in_trash: true }).select('_id').read('primary').lean();
		const mongoIds = uniqueIds(mongoDocs.map((doc) => doc._id));
		await model.deleteMany({ host_id, in_trash: true });

		const candidateIds = uniqueIds([...indexedIds, ...mongoIds]);
		const remainingDocs = await findExistingPrimary(model, host_id, candidateIds);
		const remainingIds = new Set(remainingDocs.map((doc) => String(doc._id)));
		const absentIds = candidateIds.filter((id) => !remainingIds.has(id));
		await removeGraphLinks(host_id, absentIds);
		await removeByFilterFn(host_id, tsType, 'in_trash:=true', { batch_size: 250 });
		if (remainingDocs.length) {
			await markIndexPending(model, host_id, remainingDocs);
			const results = await bulkIndexFn(host_id, tsType, remainingDocs, { removeExisting: false });
			await markIndexed(model, host_id, results.filter((result) => result.success).map((result) => result.id));
		}
		for (const id of absentIds) emitToTenant(host_id, `${eventTypeForTrashType(type)}:deleted`, { _id: id });
		deleted += absentIds.length;
	}

	return { deleted };
}

export async function getTrashCount(host_id, deps = {}) {
	const listFn = deps.listTrashDocuments || listTrashDocuments;
	const tsTypes = Object.values(TRASH_MODEL_MAP).map((entry) => entry.tsType);
	const results = await listFn(host_id, tsTypes, { perPage: 1, include_fields: 'id,source_id' });
	return Object.values(results).reduce((sum, result) => sum + Number(result.found || 0), 0);
}
