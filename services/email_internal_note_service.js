import striptags from 'striptags';
import { EmailInternalNote } from '../model/email_internal_note.js';
import { Email } from '../model/email.js';
import { sanitizeEmailHtml } from '../modules/email_html_sanitizer.js';
import { emitToTenant } from '../modules/socket.js';
import { getEmailThread } from './email_ingest_service.js';
import * as audit from './audit_service.js';

function stringifyObjectId(value) {
	return value?._id?.toString?.() || value?.toString?.() || '';
}

function normalizeContent(data = {}) {
	const content = sanitizeEmailHtml(data.content || data.body_html || '').html;
	const textContent = String(data.text_content || data.body_text || striptags(content || '') || '').trim();
	if (!content && !textContent) throw new Error('Note content is required');
	return {
		content,
		text_content: textContent,
	};
}

function normalizeParentNoteId(value) {
	const parentNoteId = stringifyObjectId(value).trim();
	return parentNoteId || null;
}

function buildEventPayload(note, threadSourceIds = [], clientRequestId = '', options = {}) {
	const payload = {
		_id: stringifyObjectId(note),
		source_email: stringifyObjectId(note?.source_email),
		parent_note: normalizeParentNoteId(note?.parent_note),
		thread_source_ids: threadSourceIds,
	};
	if (options.includeNote && note) payload.note = publicNote(note);
	if (clientRequestId) payload.client_request_id = clientRequestId;
	return payload;
}

function publicNote(note) {
	const obj = typeof note?.toObject === 'function' ? note.toObject() : { ...(note || {}) };
	return {
		...obj,
		_id: stringifyObjectId(obj._id || note),
		source_email: stringifyObjectId(obj.source_email),
		parent_note: normalizeParentNoteId(obj.parent_note),
		project: stringifyObjectId(obj.project),
		owner: obj.owner && typeof obj.owner === 'object'
			? { ...obj.owner, _id: stringifyObjectId(obj.owner._id || obj.owner) }
			: stringifyObjectId(obj.owner),
	};
}

async function getSourceEmail(hostId, emailId) {
	return Email.findOne({ _id: emailId, host_id: hostId, in_trash: { $ne: true } }).lean();
}

async function getThreadSourceIds(hostId, emailId) {
	const thread = await getEmailThread(hostId, emailId, { order: 'asc' }).catch(() => []);
	return [...new Set(thread.map((email) => stringifyObjectId(email._id)).filter(Boolean))];
}

async function getThreadContext(hostId, emailId) {
	const sourceIds = await getThreadSourceIds(hostId, emailId);
	if (!sourceIds.length) return null;
	return { sourceIds };
}

async function validateParentNote(hostId, sourceIds, parentNoteId) {
	if (!parentNoteId) return null;
	const parentNote = await EmailInternalNote.findOne({
		_id: parentNoteId,
		host_id: hostId,
		source_email: { $in: sourceIds },
	}).lean();
	if (!parentNote) throw new Error('Parent note not found in this email thread');
	return parentNote._id;
}

export async function listEmailInternalNotes(hostId, emailId) {
	const threadContext = await getThreadContext(hostId, emailId);
	if (!threadContext) return null;
	return EmailInternalNote.find({
		host_id: hostId,
		source_email: { $in: threadContext.sourceIds },
	})
		.populate('owner', 'name email')
		.sort({ createdAt: 1 })
		.lean();
}

export async function createEmailInternalNote(userId, hostId, emailId, data = {}, ctx = {}) {
	const email = await getSourceEmail(hostId, emailId);
	if (!email) return null;
	const threadContext = await getThreadContext(hostId, emailId);
	if (!threadContext) return null;
	const normalized = normalizeContent(data);
	const clientRequestId = String(data.client_request_id || '').trim();
	const parentNote = await validateParentNote(hostId, threadContext.sourceIds, normalizeParentNoteId(data.parent_note));
	const note = await EmailInternalNote.create({
		source_email: email._id,
		project: email.project,
		owner: userId,
		parent_note: parentNote,
		host_id: hostId,
		...normalized,
	});
	await note.populate('owner', 'name email');

	emitToTenant(hostId, 'email-internal-note:created', buildEventPayload(note, threadContext.sourceIds, clientRequestId, { includeNote: true }));
	audit.log({
		action: 'create',
		resource: 'email_internal_note',
		resource_id: note._id.toString(),
		user_id: userId,
		host_id: hostId,
		details: { source_email: stringifyObjectId(email._id), parent_note: normalizeParentNoteId(parentNote) },
		...ctx,
	});

	return note;
}

export async function updateEmailInternalNote(hostId, emailId, noteId, data = {}, ctx = {}) {
	const threadContext = await getThreadContext(hostId, emailId);
	if (!threadContext) return null;
	const normalized = normalizeContent(data);
	const clientRequestId = String(data.client_request_id || '').trim();
	const before = ctx.user_id ? await EmailInternalNote.findOne({
		_id: noteId,
		host_id: hostId,
		source_email: { $in: threadContext.sourceIds },
	}).lean() : null;
	const note = await EmailInternalNote.findOneAndUpdate(
		{
			_id: noteId,
			host_id: hostId,
			source_email: { $in: threadContext.sourceIds },
		},
		{ $set: normalized },
		{ returnDocument: 'after' },
	).populate('owner', 'name email');

	if (note) {
		emitToTenant(hostId, 'email-internal-note:updated', buildEventPayload(note, threadContext.sourceIds, clientRequestId, { includeNote: true }));
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, note);
			audit.log({ action: 'update', resource: 'email_internal_note', resource_id: noteId, host_id: hostId, details, ...ctx });
		}
	}

	return note;
}

export async function deleteEmailInternalNote(hostId, emailId, noteId, ctx = {}, clientRequestId = '') {
	const threadContext = await getThreadContext(hostId, emailId);
	if (!threadContext) return null;
	const replyCount = await EmailInternalNote.countDocuments({
		host_id: hostId,
		parent_note: noteId,
	});
	if (replyCount > 0) throw new Error('Cannot delete an internal note with replies');
	const note = await EmailInternalNote.findOneAndDelete({
		_id: noteId,
		host_id: hostId,
		source_email: { $in: threadContext.sourceIds },
	});

	if (note) {
		emitToTenant(hostId, 'email-internal-note:deleted', buildEventPayload(note, threadContext.sourceIds, clientRequestId));
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'email_internal_note', resource_id: noteId, host_id: hostId, ...ctx });
	}

	return note;
}
