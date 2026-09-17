import { Note } from '../model/note.js';
import { searchCollection, indexDocument, removeDocument } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { createLogger } from '../modules/logger.js';
import { syncStreamientItem } from './obsidian_sync_service.js';

const log = createLogger('note');

export async function createNote(userId, host_id, data, ctx = {}) {
	const note = await Note.create({
		title: data.title,
		content: data.content || '',
		text_content: data.text_content || '',
		tags: data.tags || [],
		project: data.project,
		owner: userId,
		host_id,
	});

	emitToTenant(host_id, 'note:created', note);
	invalidateGraphCache(host_id).catch(() => {});
	audit.log({ action: 'create', resource: 'note', resource_id: note._id.toString(), user_id: userId, host_id, ...ctx });
	await syncStreamientItem('note', note._id, host_id).catch((err) => log.error({ err, note_id: note._id }, 'Obsidian note export deferred'));
	return note;
}

export async function listNotes(host_id, projectId, { page = 1, limit = 50 } = {}) {
	const query = { host_id, in_trash: { $ne: true } };
	if (projectId) query.project = projectId;

	return Note.find(query)
		.select('-content')
		.sort({ updatedAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit);
}

export async function getNote(host_id, noteId) {
	return Note.findOne({ _id: noteId, host_id });
}

export async function updateNote(host_id, noteId, data, ctx = {}) {
	const linked = await Note.findOne({ _id: noteId, host_id }).select('obsidian_source').lean();
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

	const note = await Note.findOneAndUpdate(
		{ _id: noteId, host_id, ...(ctx.expected_updated_at ? { updatedAt: new Date(ctx.expected_updated_at), in_trash: { $ne: true } } : {}) },
		{ $set: update },
		{ returnDocument: 'after' },
	);

	if (note) {
		removeDocument(host_id, 'notes', noteId).catch((err) => log.error({ err }, 'Typesense remove error'));
		emitToTenant(host_id, 'note:updated', note);
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, note);
			audit.log({ action: 'update', resource: 'note', resource_id: noteId, host_id, details, ...ctx });
		}
		await syncStreamientItem('note', noteId, host_id);
	}

	return note;
}

export async function deleteNote(host_id, noteId, ctx = {}) {
	const note = await Note.findOneAndUpdate(
		{ _id: noteId, host_id, in_trash: { $ne: true }, ...(ctx.expected_updated_at ? { updatedAt: new Date(ctx.expected_updated_at) } : {}) },
		{ $set: { in_trash: true, trashed_at: new Date(), is_indexed: false } },
		{ returnDocument: 'after' },
	);
	if (note) {
		indexDocument(host_id, 'notes', note).catch((err) => log.error({ err }, 'Typesense trash index error'));
		removeLinksForItem(host_id, noteId).catch((err) => log.error({ err }, 'Remove links error'));
		emitToTenant(host_id, 'note:deleted', { _id: noteId });
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'note', resource_id: noteId, host_id, ...ctx });
		await syncStreamientItem('note', noteId, host_id);
	}
	return note;
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
