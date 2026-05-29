import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { indexDocument, removeDocument } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { removeLinksForItem } from './graph_service.js';
import { indexEmailNow, removeEmailFromIndexNow } from './email_index_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('trash');

const MODEL_MAP = {
	notes: { model: Note, tsType: 'notes' },
	memories: { model: Memory, tsType: 'memory' },
	urls: { model: Url, tsType: 'urls' },
	emails: { model: Email, tsType: 'emails' },
};

function getModelEntry(type) {
	const entry = MODEL_MAP[type];
	if (!entry) throw new Error(`Invalid trash type: ${type}`);
	return entry;
}

export async function listTrash(host_id, { type, page = 1, limit = 50 } = {}) {
	const types = type ? [type] : Object.keys(MODEL_MAP);
	const skip = (page - 1) * limit;

	const queries = types.map((t) => {
		const { model } = getModelEntry(t);
		return model
			.find({ host_id, in_trash: true })
			.select('-content -text_content')
			.sort({ trashed_at: -1 })
			.lean()
			.then((docs) => docs.map((d) => ({ ...d, _type: t })));
	});

	const results = (await Promise.all(queries)).flat();
	results.sort((a, b) => new Date(b.trashed_at) - new Date(a.trashed_at));

	return {
		items: results.slice(skip, skip + limit),
		total: results.length,
	};
}

export async function restoreItem(host_id, type, id) {
	const { model, tsType } = getModelEntry(type);

	const doc = await model.findOneAndUpdate(
		{ _id: id, host_id, in_trash: true },
		{ $set: type === 'emails' ? { in_trash: false, is_indexed: false } : { in_trash: false }, $unset: { trashed_at: '' } },
		{ returnDocument: 'after' },
	);

	if (doc) {
		if (type === 'emails') {
			await indexEmailNow(host_id, doc);
		} else {
			indexDocument(host_id, tsType, doc).catch((err) => log.error({ err }, 'Typesense index error'));
		}
		const eventType = type === 'memories' ? 'memory' : type.slice(0, -1);
		emitToTenant(host_id, `${eventType}:created`, doc);
	}

	return doc;
}

export async function permanentDelete(host_id, type, id) {
	const { model, tsType } = getModelEntry(type);

	const doc = await model.findOneAndDelete({ _id: id, host_id, in_trash: true });
	if (doc) {
		if (type === 'emails') {
			await removeEmailFromIndexNow(host_id, id);
		} else {
			removeDocument(host_id, tsType, id).catch((err) => log.error({ err }, 'Typesense remove error'));
		}
		removeLinksForItem(host_id, id).catch((err) => log.error({ err }, 'Graph link cleanup error'));
	}
	return doc;
}

export async function batchRestore(host_id, items) {
	const results = await Promise.all(
		items.map(({ type, id }) => restoreItem(host_id, type, id)),
	);
	emitToTenant(host_id, 'counts:refresh');
	return results.filter(Boolean);
}

export async function batchPermanentDelete(host_id, items) {
	const results = await Promise.all(
		items.map(({ type, id }) => permanentDelete(host_id, type, id)),
	);
	return results.filter(Boolean);
}

export async function emptyTrash(host_id) {
	const deletions = Object.entries(MODEL_MAP).map(async ([, { model, tsType }]) => {
		const docs = await model.find({ host_id, in_trash: true }).select('_id').lean();
		const ids = docs.map((d) => d._id.toString());

		await model.deleteMany({ host_id, in_trash: true });

		for (const id of ids) {
			removeDocument(host_id, tsType, id).catch((err) => log.error({ err }, 'Typesense remove error'));
		}

		return ids.length;
	});

	const counts = await Promise.all(deletions);
	return { deleted: counts.reduce((a, b) => a + b, 0) };
}

export async function getTrashCount(host_id) {
	const counts = await Promise.all(
		Object.values(MODEL_MAP).map(({ model }) =>
			model.countDocuments({ host_id, in_trash: true }),
		),
	);
	return counts.reduce((a, b) => a + b, 0);
}
