import striptags from 'striptags';
import { EmailInternalNote } from '../model/email_internal_note.js';
import { Email } from '../model/email.js';
import { sanitizeEmailHtml } from '../modules/email_html_sanitizer.js';
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

async function getSourceEmail(hostId, emailId) {
	return Email.findOne({ _id: emailId, host_id: hostId, in_trash: { $ne: true } }).lean();
}

async function getThreadSourceIds(hostId, emailId) {
	const thread = await getEmailThread(hostId, emailId, { order: 'asc' }).catch(() => []);
	return [...new Set(thread.map((email) => stringifyObjectId(email._id)).filter(Boolean))];
}

export async function listEmailInternalNotes(hostId, emailId) {
	const sourceIds = await getThreadSourceIds(hostId, emailId);
	if (!sourceIds.length) return null;
	return EmailInternalNote.find({
		host_id: hostId,
		source_email: { $in: sourceIds },
	})
		.populate('owner', 'name email')
		.sort({ createdAt: 1 })
		.lean();
}

export async function createEmailInternalNote(userId, hostId, emailId, data = {}, ctx = {}) {
	const email = await getSourceEmail(hostId, emailId);
	if (!email) return null;
	const normalized = normalizeContent(data);
	const note = await EmailInternalNote.create({
		source_email: email._id,
		project: email.project,
		owner: userId,
		host_id: hostId,
		...normalized,
	});

	audit.log({
		action: 'create',
		resource: 'email_internal_note',
		resource_id: note._id.toString(),
		user_id: userId,
		host_id: hostId,
		details: { source_email: stringifyObjectId(email._id) },
		...ctx,
	});

	return note.populate('owner', 'name email');
}
