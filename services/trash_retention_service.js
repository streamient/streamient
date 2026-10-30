import { removeDocumentsBySourceIds } from '../modules/typesense.js';
import { removeLinksForItems } from './graph_service.js';
import { TRASH_MODEL_MAP } from './trash_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('trash-retention');
const DAY_MS = 24 * 60 * 60 * 1000;
export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_BATCH_SIZE = 500;

export function buildTrashRetentionQuery(type, cutoff) {
	if (type === 'emails') {
		return {
			$or: [
				{ in_trash: true, trashed_at: { $lte: cutoff } },
				{ in_trash: { $ne: true }, mailbox: 'spam', updatedAt: { $lte: cutoff } },
			],
		};
	}
	return { in_trash: true, trashed_at: { $lte: cutoff } };
}

function stringValue(value) {
	return value?.toString ? value.toString() : String(value || '');
}

function groupIdsByHost(docs) {
	const grouped = new Map();
	for (const doc of docs) {
		const id = stringValue(doc._id);
		const hostId = stringValue(doc.host_id);
		if (!id || !hostId) continue;
		if (!grouped.has(hostId)) grouped.set(hostId, []);
		grouped.get(hostId).push(id);
	}
	return grouped;
}

async function cleanupReferences(type, tsType, docs, removeSearchDocuments, removeGraphLinks, errors) {
	for (const [hostId, ids] of groupIdsByHost(docs)) {
		try {
			await removeGraphLinks(hostId, ids);
		} catch (err) {
			errors.push({ type, operation: 'graph_cleanup', host_id: hostId, count: ids.length, message: err?.message || String(err) });
			log.error({ err, type, host_id: hostId, count: ids.length }, 'Trash retention graph cleanup error');
		}
		try {
			await removeSearchDocuments(hostId, tsType, ids);
		} catch (err) {
			errors.push({ type, operation: 'typesense_cleanup', host_id: hostId, count: ids.length, message: err?.message || String(err) });
			log.error({ err, type, host_id: hostId, count: ids.length }, 'Trash retention Typesense cleanup error');
		}
	}
}

async function runTypeRetention(type, entry, options) {
	const { model, tsType } = entry;
	const { cutoff, batchSize, removeSearchDocuments, removeGraphLinks } = options;
	const query = buildTrashRetentionQuery(type, cutoff);
	const summary = { deleted: 0, batches: 0, errors: [] };

	while (true) {
		const docs = await model.find(query).select('_id host_id').limit(batchSize).lean();
		if (!docs.length) break;
		const deletedDocs = [];
		for (const doc of docs) {
			const deleted = await model.findOneAndDelete({ $and: [query, { _id: doc._id, host_id: doc.host_id }] }).lean();
			if (deleted) deletedDocs.push(deleted);
		}
		const deletedInBatch = deletedDocs.length;
		summary.deleted += deletedInBatch;
		summary.batches++;
		await cleanupReferences(type, tsType, deletedDocs, removeSearchDocuments, removeGraphLinks, summary.errors);
		if (deletedInBatch === 0 || docs.length < batchSize) break;
	}
	return summary;
}

export async function runTrashRetentionCleanup({
	now = new Date(),
	models = TRASH_MODEL_MAP,
	removeSearchDocuments = removeDocumentsBySourceIds,
	removeGraphLinks = removeLinksForItems,
	batchSize = TRASH_RETENTION_BATCH_SIZE,
} = {}) {
	const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);
	const summary = { cutoff, deleted: 0, types: {}, errors: [] };
	for (const [type, entry] of Object.entries(models)) {
		try {
			summary.types[type] = await runTypeRetention(type, entry, { cutoff, batchSize, removeSearchDocuments, removeGraphLinks });
			summary.deleted += summary.types[type].deleted;
			summary.errors.push(...summary.types[type].errors);
		} catch (err) {
			const error = { type, operation: 'retention', message: err?.message || String(err) };
			summary.types[type] = { deleted: 0, batches: 0, errors: [error] };
			summary.errors.push(error);
			log.error({ err, type }, 'Trash retention type error');
		}
	}
	return summary;
}

export async function runEmailRetentionCleanup({ emailModel, ...options } = {}) {
	const models = { emails: { model: emailModel || TRASH_MODEL_MAP.emails.model, tsType: 'emails' } };
	const summary = await runTrashRetentionCleanup({ ...options, models });
	return { deleted: summary.deleted, cutoff: summary.cutoff, errors: summary.errors };
}
