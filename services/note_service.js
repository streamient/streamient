import { attachItemHtml } from '../modules/item_html.js';
import { requireActiveProject, acquireProjectWrite } from './project_service.js';
import { Note } from '../model/note.js';
import { searchCollection, indexDocument, removeDocument } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { createLogger } from '../modules/logger.js';
import { syncStreamientItem } from './obsidian_sync_service.js';

const log = createLogger('note');

export async function createNote(userId, host_id, data, ctx = {}) {
	ctx.signal?.throwIfAborted();
	await ctx.assertOwnership?.();
	const { projectId: project, release } = await acquireProjectWrite(host_id, data.project);
	let note;
	try {
		const persist = async (session) => {
			ctx.signal?.throwIfAborted();
			if (!session) await ctx.assertOwnership?.();
			const payload = { ...(ctx.idempotency_id ? { _id: ctx.idempotency_id } : {}), title: data.title, content: data.content || '', text_content: data.text_content || '', tags: data.tags || [], project, owner: userId, host_id, is_indexed: false };
			if (ctx.idempotency_id) return Note.findOneAndUpdate({ _id: ctx.idempotency_id, host_id, project }, { $setOnInsert: { ...payload, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, returnDocument: 'after', session, timestamps: false }).lean();
			if (session) return (await Note.create([payload], { session }))[0];
			return Note.create(payload);
		};
		note = ctx.withOwnership ? await ctx.withOwnership(persist) : await persist();
	} finally {
		await release();
	}
	ctx.signal?.throwIfAborted();
	await ctx.assertOwnership?.();

	emitToTenant(host_id, 'note:created', attachItemHtml('note', note));
	invalidateGraphCache(host_id).catch(() => {});
	audit.log({ action: 'create', resource: 'note', resource_id: note._id.toString(), user_id: userId, host_id, ...ctx });
	await syncStreamientItem('note', note._id, host_id, { item: note }).catch((err) => log.error({ err, note_id: note._id }, 'Obsidian note export deferred'));
	return attachItemHtml('note', note);
}

export async function listNotes(host_id, projectId, { page = 1, limit = 50, offset } = {}) {
	const start = offset === undefined ? (page - 1) * limit : Number(offset);
	if (!Number.isSafeInteger(start) || start < 0) throw Object.assign(new Error('offset must be a nonnegative integer'), { status: 400 });
	const query = { host_id, in_trash: { $ne: true } };
	if (projectId) query.project = projectId;

	const docs = await Note.find(query)
		.select('-content')
		.sort({ updatedAt: -1 })
		.skip(start)
		.limit(limit);
	return docs.map((doc) => attachItemHtml('note', doc));
}

export async function getNote(host_id, noteId) {
	return attachItemHtml('note', await Note.findOne({ _id: noteId, host_id }));
}

export async function updateNote(host_id, noteId, data, ctx = {}) {
	const linked = await Note.findOne({ _id: noteId, host_id }).select('obsidian_source project').lean();
	if (!linked) return null;
	await requireActiveProject(host_id, data.project !== undefined ? data.project : linked.project);
	if (linked?.obsidian_source?.file_id && data.content !== undefined && data.markdown_content === undefined) {
		const err = new Error('Obsidian-synced notes must be edited as Markdown');
		err.status = 409;
		err.code = 'markdown_required';
		throw err;
	}
	if (linked?.obsidian_source?.file_id && data.markdown_content !== undefined) {
		await syncStreamientItem('note', noteId, host_id, { markdown: String(data.markdown_content) });
		return getNote(host_id, noteId);
	}
	const update = {};
	if (data.title !== undefined) update.title = data.title;
	if (data.content !== undefined) update.content = data.content;
	if (data.text_content !== undefined) update.text_content = data.text_content;
	if (data.tags !== undefined) update.tags = data.tags;
	if (data.project !== undefined) update.project = data.project;
	update.is_indexed = false;

	const before = ctx.user_id ? await Note.findOne({ _id: noteId, host_id }).lean() : null;

	// A move must hold the destination project's write lease across the update.
	const release = data.project !== undefined ? (await acquireProjectWrite(host_id, data.project)).release : null;
	let note;
	try {
		note = await Note.findOneAndUpdate(
			{ _id: noteId, host_id, ...(ctx.expected_updated_at ? { updatedAt: new Date(ctx.expected_updated_at), in_trash: { $ne: true } } : {}) },
			{ $set: update },
			{ returnDocument: 'after' },
		);
	} finally {
		if (release) await release();
	}

	let syncWarning;
	if (note) {
		removeDocument(host_id, 'notes', noteId).catch((err) => log.error({ err }, 'Typesense remove error'));
		emitToTenant(host_id, 'note:updated', attachItemHtml('note', note));
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, note);
			audit.log({ action: 'update', resource: 'note', resource_id: noteId, host_id, details, ...ctx });
		}
		await syncStreamientItem('note', noteId, host_id, { item: note }).catch((err) => { log.error({ err, item_id: note._id }, 'Obsidian export deferred after saved update'); syncWarning = 'The item was saved; Obsidian sync is pending.'; });
	}

	const result = attachItemHtml('note', note);
	if (syncWarning && result) result.sync_warning = syncWarning;
	return result;
}

export async function deleteNote(host_id, noteId, ctx = {}) {
	const note = await Note.findOneAndUpdate(
		{ _id: noteId, host_id, in_trash: { $ne: true }, ...(ctx.expected_updated_at ? { updatedAt: new Date(ctx.expected_updated_at) } : {}) },
		{ $set: { in_trash: true, trashed_at: new Date(), is_indexed: false } },
		{ returnDocument: 'after' },
	);
	let syncWarning;
	if (note) {
		indexDocument(host_id, 'notes', note).catch((err) => log.error({ err }, 'Typesense trash index error'));
		removeLinksForItem(host_id, noteId).catch((err) => log.error({ err }, 'Remove links error'));
		emitToTenant(host_id, 'note:deleted', { _id: note._id, project: note.project, updatedAt: note.updatedAt, in_trash: true });
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'note', resource_id: noteId, host_id, ...ctx });
		await syncStreamientItem('note', noteId, host_id, { item: note }).catch((err) => { log.error({ err, item_id: note._id }, 'Obsidian trash export deferred after saved deletion'); syncWarning = 'The item was moved to trash; Obsidian sync is pending.'; });
	}
	const result = attachItemHtml('note', note);
	if (syncWarning && result) result.sync_warning = syncWarning;
	return result;
}

export async function searchNotes(host_id, query, options = {}) {
	return searchCollection(host_id, 'notes', query, {
		queryBy: 'embedding',
		...options,
	});
}

export async function countNotes(host_id) {
	return Note.countDocuments({ host_id, in_trash: { $ne: true } });
}
