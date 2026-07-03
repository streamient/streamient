import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import striptags from 'striptags';
import { simpleParser } from 'mailparser';

import { Email } from '../model/email.js';
import { GraphLink } from '../model/graph_link.js';
import { Project } from '../model/project.js';
import { extractText } from './import_service.js';
import { detectFileType } from '../modules/file_detect.js';
import { searchCollection } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { sanitizeEmailHtml } from '../modules/email_html_sanitizer.js';
import { indexEmailNow, indexEmailsNow } from './email_index_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('email-ingest');

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const EMAIL_DATE_SORT = { createdAt: -1, updatedAt: -1 };
const VALID_MAILBOXES = new Set(['inbox', 'archived', 'sent', 'spam']);

function emailIndexOptions(ctx = {}) {
	return {
		indexFn: ctx.indexEmailFn,
		indexManyFn: ctx.indexEmailsFn || ctx.indexEmailManyFn,
		removeFn: ctx.removeEmailIndexFn,
		removeManyFn: ctx.removeEmailIndexManyFn || ctx.removeEmailsIndexFn,
		updateFn: ctx.updateEmailIndexStateFn,
		updateManyFn: ctx.updateEmailIndexManyStateFn,
	};
}

function stringifyObjectId(value) {
	if (!value) return '';
	return value.toString ? value.toString() : String(value);
}

function canonicalMessageId(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';
	return raw.replace(/^<+|>+$/g, '').trim().toLowerCase();
}

function getHeaderValue(headers, name) {
	if (!headers) return '';
	const stripHeaderName = (line) => String(line || '').replace(new RegExp(`^${name}\\s*:\\s*`, 'i'), '').trim();
	if (typeof headers === 'string') {
		const lines = headers.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/g);
		const found = lines.find((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`));
		return stripHeaderName(found);
	}
	if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || '';
	const lowerName = name.toLowerCase();
	if (Array.isArray(headers)) {
		const found = headers.find((entry) => {
			const key = entry?.key || entry?.name || entry?.[0];
			return String(key || '').toLowerCase() === lowerName;
		});
		return found?.value || found?.[1] || stripHeaderName(found?.line) || '';
	}
	if (typeof headers === 'object') {
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === lowerName) return value;
		}
	}
	return '';
}

function getParsedHeaderValue(parsed, name) {
	return getHeaderValue(parsed?.headers, name) || getHeaderValue(parsed?.headerLines, name);
}

function parseReferences(value) {
	if (!value) return [];
	if (Array.isArray(value)) {
		return [...new Set(value.map(canonicalMessageId).filter(Boolean))];
	}
	const text = String(value);
	const matches = text.match(/<[^>]+>/g) || text.split(/[\s,]+/g);
	return [...new Set(matches.map(canonicalMessageId).filter(Boolean))];
}

function extractEmailAddress(value) {
	const text = String(value || '').trim();
	if (!text) return '';
	const bracketMatch = text.match(/<([^<>]+)>/);
	const address = bracketMatch ? bracketMatch[1] : text;
	const emailMatch = address.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
	return String(emailMatch ? emailMatch[0] : address).trim().toLowerCase();
}

function normalizeRecipientList(value) {
	if (!value) return [];
	if (Array.isArray(value)) {
		return value
			.flatMap((entry) => {
				if (typeof entry === 'string') return extractEmailAddress(entry);
				if (entry?.address) return extractEmailAddress(entry.address);
				if (typeof entry?.value === 'string') return extractEmailAddress(entry.value);
				if (entry?.email) return extractEmailAddress(entry.email);
				if (entry?.text) return extractEmailAddress(entry.text);
				if (Array.isArray(entry?.value)) {
					return entry.value
						.map((item) => extractEmailAddress(item?.address || item?.text || item))
						.filter(Boolean);
				}
				if (entry?.value?.address) return extractEmailAddress(entry.value.address);
				return '';
			})
			.filter(Boolean);
	}
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((item) => extractEmailAddress(item))
			.filter(Boolean);
	}
	if (value?.value && Array.isArray(value.value)) {
		return value.value
			.map((entry) => extractEmailAddress(entry?.address || entry?.text || entry))
			.filter(Boolean);
	}
	if (value?.address) return [extractEmailAddress(value.address)].filter(Boolean);
	return [];
}

function normalizeSlug(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[_\s]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function normalizeLabels(labels = []) {
	if (!Array.isArray(labels)) return [];
	return [...new Set(labels.map(normalizeSlug).filter(Boolean))];
}

function normalizeMailbox(mailbox) {
	const value = String(mailbox || '').trim().toLowerCase();
	return VALID_MAILBOXES.has(value) ? value : 'inbox';
}

function normalizeBodyText(parsed) {
	const text = String(parsed?.text || parsed?.text_content || parsed?.body_text || '').trim();
	if (text) return text;
	const html = String(parsed?.html || parsed?.html_content || parsed?.body_html || '').trim();
	if (!html) return '';
	return striptags(html, [], ' ').replace(/\s+/g, ' ').trim();
}

function normalizeHtmlContent(value) {
	const sanitized = sanitizeEmailHtml(value);
	return {
		html_content: sanitized.html,
		html_content_has_remote_images: sanitized.hasRemoteImages,
	};
}

function toBuffer(content, transferEncoding) {
	if (!content) return null;
	if (Buffer.isBuffer(content)) return content;
	if (typeof content === 'string') {
		const encoding = String(transferEncoding || '').toLowerCase();
		if (encoding === 'base64') return Buffer.from(content, 'base64');
		return Buffer.from(content, 'utf8');
	}
	return null;
}

async function extractAttachmentText(attachment) {
	const filename = attachment.filename || attachment.fileName || 'attachment.txt';
	const rawBuffer = toBuffer(
		attachment.content || attachment.contentBase64 || attachment.content_base64 || attachment.data,
		attachment.contentTransferEncoding || attachment.content_transfer_encoding || attachment.transferEncoding,
	);
	if (!rawBuffer || rawBuffer.length === 0) return '';
	if (rawBuffer.length > MAX_ATTACHMENT_SIZE) return '';

	const tmpPath = path.join(os.tmpdir(), `email-attachment-${crypto.randomUUID()}`);
	try {
		await fs.writeFile(tmpPath, rawBuffer);
		const detected = await detectFileType(tmpPath);
		const mimeType = attachment.contentType || attachment.content_type || detected.mimeType || 'text/plain';
		const { text } = await extractText(tmpPath, mimeType, filename);
		return (text || '').trim();
	} catch {
		return '';
	} finally {
		await fs.unlink(tmpPath).catch(() => {});
	}
}

async function extractAttachmentTextContent(attachments = []) {
	if (!Array.isArray(attachments) || attachments.length === 0) return '';
	const chunks = [];
	for (const attachment of attachments) {
		const text = await extractAttachmentText(attachment);
		if (text) chunks.push(text);
	}
	return chunks.join('\n\n').trim();
}

export async function parseEmailInput(data) {
	if (data?.raw_email) {
		const parsed = await simpleParser(data.raw_email);
		return {
			message_id: canonicalMessageId(parsed.messageId || getHeaderValue(parsed.headers, 'message-id')),
			references: parseReferences(parsed.references || getHeaderValue(parsed.headers, 'references')),
			in_reply_to: canonicalMessageId(parsed.inReplyTo || getHeaderValue(parsed.headers, 'in-reply-to')),
			from: normalizeRecipientList(parsed.from),
			to: normalizeRecipientList(parsed.to),
			cc: normalizeRecipientList(parsed.cc),
			bcc: normalizeRecipientList(parsed.bcc),
			subject: String(parsed.subject || '').trim(),
			text_content: normalizeBodyText(parsed),
			...normalizeHtmlContent(parsed.html),
			attachment_text_content: await extractAttachmentTextContent(parsed.attachments || []),
			raw_hash: crypto.createHash('sha256').update(data.raw_email).digest('hex'),
		};
	}

	const parsed = data?.parsed_email || data?.mailparser || data;
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Provide raw_email or parsed_email');
	}

	return {
		message_id: canonicalMessageId(parsed.messageId || parsed.message_id || getParsedHeaderValue(parsed, 'message-id')),
		references: parseReferences(parsed.references || getParsedHeaderValue(parsed, 'references')),
		in_reply_to: canonicalMessageId(parsed.inReplyTo || parsed.in_reply_to || getParsedHeaderValue(parsed, 'in-reply-to')),
		from: normalizeRecipientList(parsed.from || getParsedHeaderValue(parsed, 'from') || parsed.sender || parsed.session?.sender || parsed.envelope?.from || parsed.envelope?.sender),
		to: normalizeRecipientList(parsed.to || getParsedHeaderValue(parsed, 'to') || parsed.recipients || parsed.recipient || parsed.rcpt_to || parsed.rcptTo || parsed.session?.recipient || parsed.envelope?.to || parsed.envelope?.recipient),
		cc: normalizeRecipientList(parsed.cc || getParsedHeaderValue(parsed, 'cc')),
		bcc: normalizeRecipientList(parsed.bcc || getParsedHeaderValue(parsed, 'bcc')),
		subject: String(parsed.subject || '').trim(),
		text_content: normalizeBodyText(parsed),
		...normalizeHtmlContent(parsed.html || parsed.html_content || parsed.body_html),
		attachment_text_content: await extractAttachmentTextContent(parsed.attachments || []),
		raw_hash: parsed.raw_hash || '',
	};
}

export function parseForwardedEmailInput(data) {
	const parsed = data?.parsed_email || data?.mailparser || data;
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Provide forwarded email JSON');
	}

	return {
		message_id: canonicalMessageId(parsed.messageId || parsed.message_id || getParsedHeaderValue(parsed, 'message-id')),
		references: parseReferences(parsed.references || getParsedHeaderValue(parsed, 'references')),
		in_reply_to: canonicalMessageId(parsed.inReplyTo || parsed.in_reply_to || getParsedHeaderValue(parsed, 'in-reply-to')),
		from: normalizeRecipientList(parsed.from || getParsedHeaderValue(parsed, 'from') || parsed.sender || parsed.session?.sender || parsed.envelope?.from || parsed.envelope?.sender),
		to: normalizeRecipientList(getParsedHeaderValue(parsed, 'to') || parsed.to),
		cc: normalizeRecipientList(getParsedHeaderValue(parsed, 'cc') || parsed.cc),
		bcc: normalizeRecipientList(getParsedHeaderValue(parsed, 'bcc') || parsed.bcc),
		subject: String(parsed.subject || getParsedHeaderValue(parsed, 'subject') || '').trim(),
		text_content: normalizeBodyText(parsed),
		...normalizeHtmlContent(parsed.html || parsed.html_content || parsed.body_html),
		attachment_text_content: '',
		raw_hash: parsed.raw_hash || '',
	};
}

function normalizeEmailFilterInput(input) {
	if (Array.isArray(input)) return { from: input, subject: '' };
	if (input && typeof input === 'object') {
		return {
			from: Array.isArray(input.from) ? input.from : [input.from].filter(Boolean),
			subject: String(input.subject || ''),
		};
	}
	return { from: [], subject: '' };
}

export function matchesEmailFilter(filterText, fromAddresses = []) {
	const rules = String(filterText || '')
		.split(/[\n,]/)
		.map((rule) => rule.trim().toLowerCase())
		.filter(Boolean);
	if (!rules.length) return false;

	const input = normalizeEmailFilterInput(fromAddresses);
	const subject = input.subject.trim().toLowerCase();
	const exact = new Set();
	const domains = new Set();
	const localParts = new Set();
	const subjectParts = [];
	for (const rawRule of rules) {
		const subjectContainsMatch = rawRule.match(/^subject\s+contains\s*:\s*(.+)$/);
		const subjectMatch = rawRule.match(/^subject\s*:\s*(.+)$/);
		if (subjectContainsMatch || subjectMatch) {
			const value = String(subjectContainsMatch?.[1] || subjectMatch?.[1] || '').trim();
			if (value) subjectParts.push(value);
			continue;
		}

		const rule = rawRule.replace(/\*+$/, '');
		if (!rule) {
			continue;
		} else if (rule.endsWith('@')) {
			localParts.add(rule.slice(0, -1));
		} else if (rule.includes('@') && !rule.startsWith('@')) {
			exact.add(rule);
		} else {
			domains.add(rule.replace(/^@+/, ''));
		}
	}

	if (subject && subjectParts.some((part) => subject.includes(part))) return true;

	return (input.from || []).some((addr) => {
		const value = String(addr || '').trim().toLowerCase();
		if (!value) return false;
		if (exact.has(value)) return true;
		const atIndex = value.lastIndexOf('@');
		const local = atIndex === -1 ? value : value.slice(0, atIndex);
		const domain = atIndex === -1 ? '' : value.slice(atIndex + 1);
		if (local && localParts.has(local)) return true;
		return domain && domains.has(domain);
	});
}

function emailThreadIdentifiers(email = {}) {
	const ids = [];
	const add = (value) => {
		const id = canonicalMessageId(value);
		if (id && !ids.includes(id)) ids.push(id);
	};
	add(email.message_id);
	for (const ref of email.references || []) add(ref);
	add(email.in_reply_to);
	if (!ids.length) ids.push(String(email._id || email.id || ''));
	return ids.filter(Boolean);
}

function emailSortTime(email = {}) {
	const value = email.createdAt || email.updatedAt;
	const time = value ? new Date(value).getTime() : 0;
	return Number.isFinite(time) ? time : 0;
}

function groupEmailsByThread(emails = []) {
	const byIdentifier = new Map();
	const groups = [];

	for (const email of emails) {
		const identifiers = emailThreadIdentifiers(email);
		const matchedGroups = [...new Set(identifiers.map((id) => byIdentifier.get(id)).filter(Boolean))];
		let group;
		if (!matchedGroups.length) {
			group = { identifiers: new Set(), email };
			groups.push(group);
		} else {
			group = matchedGroups[0];
			for (const merged of matchedGroups.slice(1)) {
				if (merged === group) continue;
				for (const id of merged.identifiers) {
					group.identifiers.add(id);
					byIdentifier.set(id, group);
				}
				if (emailSortTime(merged.email) > emailSortTime(group.email)) group.email = merged.email;
				const index = groups.indexOf(merged);
				if (index !== -1) groups.splice(index, 1);
			}
			if (emailSortTime(email) > emailSortTime(group.email)) group.email = email;
		}
		for (const id of identifiers) {
			group.identifiers.add(id);
			byIdentifier.set(id, group);
		}
	}

	return groups;
}

function collapseEmailsByThread(emails = []) {
	return groupEmailsByThread(emails).map((group) => group.email).sort((a, b) => emailSortTime(b) - emailSortTime(a));
}

async function attachLatestThreadEmails(host_id, projectId, emails = []) {
	if (!emails.length) return [];
	const identifiers = [...new Set(emails.flatMap((email) => emailThreadIdentifiers(email)))].filter(Boolean);
	if (!identifiers.length) return emails;

	const relatedQuery = {
		host_id,
		in_trash: { $ne: true },
		$or: [
			{ message_id: { $in: identifiers } },
			{ references: { $in: identifiers } },
			{ in_reply_to: { $in: identifiers } },
		],
	};
	if (projectId) relatedQuery.project = projectId;
	const related = await Email.find(relatedQuery).sort(EMAIL_DATE_SORT).lean();
	const latestGroups = groupEmailsByThread([...emails, ...related]);
	const latestByIdentifier = new Map();
	for (const group of latestGroups) {
		for (const identifier of group.identifiers) latestByIdentifier.set(identifier, group.email);
	}

	return emails
		.map((email) => {
			const latest = emailThreadIdentifiers(email)
				.map((identifier) => latestByIdentifier.get(identifier))
				.filter(Boolean)
				.sort((a, b) => emailSortTime(b) - emailSortTime(a))[0] || email;
			return { ...email, thread_latest: latest };
		})
		.sort((a, b) => emailSortTime(b.thread_latest || b) - emailSortTime(a.thread_latest || a));
}

function buildEmailListQuery(host_id, projectId, filters = {}) {
	const query = { host_id, in_trash: false };
	if (projectId) query.project = projectId;
	if (filters.mailbox === 'trash') {
		query.in_trash = true;
	} else if (filters.mailbox) {
		query.mailbox = normalizeMailbox(filters.mailbox);
	}
	if (filters.label) query.labels = normalizeSlug(filters.label);
	return query;
}

async function resolveProjectId(host_id, data = {}) {
	if (data.project) return data.project;
	const project = await Project.findOne({ host_id, is_default: true, is_active: true }).select('_id').lean();
	if (project?._id) return project._id;
	throw new Error('project is required');
}

async function createEmailThreadLinks(email, userId, host_id, options = {}) {
	const referencedMessageIds = [...new Set([...(email.references || []), email.in_reply_to].map(canonicalMessageId).filter(Boolean))];
	if (referencedMessageIds.length === 0) return;

	const linkedEmails = await Email.find({
		host_id,
		in_trash: { $ne: true },
		message_id: { $in: referencedMessageIds },
		_id: { $ne: email._id },
	}).select('_id').lean();

	let created = false;
	for (const linkedEmail of linkedEmails) {
		const result = await GraphLink.updateOne(
			{
				host_id,
				source_id: linkedEmail._id,
				source_type: 'emails',
				target_id: email._id,
				target_type: 'emails',
			},
			{
				$setOnInsert: {
					source_id: linkedEmail._id,
					source_type: 'emails',
					target_id: email._id,
					target_type: 'emails',
					label: 'thread',
					owner: userId,
					host_id,
				},
			},
			{ upsert: true },
		);
		if (result.upsertedCount > 0) created = true;
	}

	if (created && !options.skipSideEffects) invalidateGraphCache(host_id).catch(() => {});
}

function emailPayloadObject(email) {
	if (!email) return {};
	return typeof email.toObject === 'function' ? email.toObject() : { ...email };
}

export async function buildEmailRealtimePayload(host_id, email, options = {}) {
	const payload = emailPayloadObject(email);
	const thread = Array.isArray(options.thread) ? options.thread : [];
	let threadDocs = thread.length ? thread : [];

	if (!threadDocs.length && payload._id && Email.db?.readyState === 1) {
		threadDocs = await getEmailThread(host_id, payload._id, { order: 'desc' }).catch(() => []);
	}
	if (!threadDocs.length) threadDocs = [payload];

	const threadIdentifiers = [];
	const threadSourceIds = [];
	for (const item of threadDocs) {
		for (const id of emailThreadIdentifiers(item)) {
			if (id && !threadIdentifiers.includes(id)) threadIdentifiers.push(id);
		}
		const sourceId = stringifyObjectId(item._id);
		if (sourceId && !threadSourceIds.includes(sourceId)) threadSourceIds.push(sourceId);
	}

	return {
		...payload,
		thread_identifiers: threadIdentifiers,
		thread_source_ids: threadSourceIds,
	};
}

export async function emitEmailCreatedOrUpdated(host_id, event, email, options = {}) {
	const payload = await buildEmailRealtimePayload(host_id, email, options);
	emitToTenant(host_id, event, payload);
	if (options.emitCounts !== false) emitToTenant(host_id, 'counts:refresh');
	return payload;
}

async function persistEmail(userId, host_id, normalized, data, ctx = {}) {
	if (!normalized.subject && !normalized.text_content && !normalized.html_content && !normalized.attachment_text_content) {
		throw new Error('Email content is empty after normalization');
	}

	const inTrash = Boolean(data.in_trash);
	const payload = {
		...normalized,
		source: data.source === 'emailforwarding' ? 'emailforwarding' : 'api',
		mailbox: normalizeMailbox(data.mailbox),
		labels: inTrash ? [] : normalizeLabels(data.labels),
		project: await resolveProjectId(host_id, data),
		owner: userId,
		host_id,
		is_indexed: false,
		in_trash: inTrash,
		trashed_at: inTrash ? (data.trashed_at || new Date()) : null,
	};

	let existing = null;
	if (normalized.message_id) existing = await Email.findOne({ message_id: normalized.message_id });
	if (!existing && normalized.raw_hash) existing = await Email.findOne({ raw_hash: normalized.raw_hash, host_id });
	if (existing && existing.host_id !== host_id) throw new Error('Email message already exists');

	let email;
	let created = false;
	if (existing) {
		email = await Email.findOneAndUpdate(
			{ _id: existing._id, host_id },
			{ $set: payload },
			{ returnDocument: 'after' },
		);
	} else {
		email = await Email.create(payload);
		created = true;
	}

	await createEmailThreadLinks(email, userId, host_id, { skipSideEffects: ctx.skipSideEffects });

	if (!ctx.skipSideEffects) {
		await indexEmailNow(host_id, email, emailIndexOptions(ctx));
		await emitEmailCreatedOrUpdated(host_id, created ? 'email:created' : 'email:updated', email);
		invalidateGraphCache(host_id).catch(() => {});
		audit.log({ action: created ? 'create' : 'update', resource: 'email', resource_id: email._id.toString(), user_id: userId, host_id, ...ctx });
	}

	return email;
}

export async function ingestEmail(userId, host_id, data, ctx = {}) {
	const normalized = await parseEmailInput(data);
	return persistEmail(userId, host_id, normalized, data, ctx);
}

export async function ingestForwardedEmail(userId, host_id, data, ctx = {}) {
	const normalized = parseForwardedEmailInput(data);
	return persistEmail(userId, host_id, normalized, { ...data, source: 'emailforwarding' }, ctx);
}

export async function applyProjectEmailFilterToInbox(host_id, projectId, ctx = {}) {
	const project = await Project.findOne({ _id: projectId, host_id }).select('_id email_filter').lean();
	if (!project) return null;

	const filterText = String(project.email_filter || '').trim();
	if (!filterText) {
		return {
			project: stringifyObjectId(project._id),
			filter_configured: false,
			processed: 0,
			matched: 0,
			moved: 0,
			email_ids: [],
		};
	}

	const candidates = await Email.find({
		host_id,
		project: project._id,
		mailbox: 'inbox',
		in_trash: { $ne: true },
	}).select('_id from subject').lean();
	const matched = candidates.filter((email) => matchesEmailFilter(filterText, {
		from: email.from || [],
		subject: email.subject || '',
	}));
	const ids = matched.map((email) => stringifyObjectId(email._id)).filter(Boolean);

	if (!ids.length) {
		return {
			project: stringifyObjectId(project._id),
			filter_configured: true,
			processed: candidates.length,
			matched: 0,
			moved: 0,
			email_ids: [],
		};
	}

	const result = await Email.updateMany(
		{ _id: { $in: ids }, host_id, project: project._id },
		{ $set: { in_trash: true, labels: [], trashed_at: new Date(), is_indexed: false } },
	);
	const moved = result?.modifiedCount ?? result?.nModified ?? ids.length;

	if (!ctx.skipSideEffects) {
		const updatedEmails = await Email.find({ _id: { $in: ids }, host_id, project: project._id }).lean();
		await indexEmailsNow(host_id, updatedEmails, emailIndexOptions(ctx));
		for (const email of updatedEmails) {
			await emitEmailCreatedOrUpdated(host_id, 'email:updated', email, { emitCounts: false, thread: [email] });
		}
		emitToTenant(host_id, 'counts:refresh', { project: stringifyObjectId(project._id) });
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) {
			audit.log({
				action: 'update',
				resource: 'email',
				resource_id: 'project-email-filter',
				host_id,
				details: { project: stringifyObjectId(project._id), processed: candidates.length, matched: ids.length, moved },
				...ctx,
			});
		}
	}

	return {
		project: stringifyObjectId(project._id),
		filter_configured: true,
		processed: candidates.length,
		matched: ids.length,
		moved,
		email_ids: ids,
	};
}

export async function listEmails(host_id, projectId, { page = 1, limit = 50, mailbox, label } = {}) {
	const safePage = Math.max(1, parseInt(page, 10) || 1);
	const safeLimit = Math.max(1, parseInt(limit, 10) || 50);
	const emails = await Email.find(buildEmailListQuery(host_id, projectId, { mailbox, label }))
		.sort(EMAIL_DATE_SORT)
		.lean();
	const collapsed = collapseEmailsByThread(emails);
	const withLatest = await attachLatestThreadEmails(host_id, projectId, collapsed);
	return withLatest.slice((safePage - 1) * safeLimit, safePage * safeLimit);
}

export async function listEmailIds(host_id, projectId, { mailbox, label } = {}) {
	const emails = await Email.find(buildEmailListQuery(host_id, projectId, { mailbox, label }))
		.select('_id message_id references in_reply_to createdAt updatedAt')
		.sort(EMAIL_DATE_SORT)
		.lean();
	return collapseEmailsByThread(emails).map((email) => stringifyObjectId(email._id)).filter(Boolean);
}

export async function getEmail(host_id, emailId) {
	return Email.findOne({ _id: emailId, host_id });
}

export async function updateEmail(host_id, emailId, data, ctx = {}) {
	const update = {};
	if (data.subject !== undefined) update.subject = String(data.subject || '').trim();
	if (data.text_content !== undefined) update.text_content = String(data.text_content || '');
	if (data.html_content !== undefined || data.html !== undefined || data.body_html !== undefined) {
		const sanitized = normalizeHtmlContent(data.html_content ?? data.html ?? data.body_html);
		update.html_content = sanitized.html_content;
		update.html_content_has_remote_images = sanitized.html_content_has_remote_images;
	}
	if (data.attachment_text_content !== undefined) update.attachment_text_content = String(data.attachment_text_content || '');
	if (data.message_id !== undefined) update.message_id = canonicalMessageId(data.message_id);
	if (data.references !== undefined) update.references = parseReferences(data.references);
	if (data.in_reply_to !== undefined) update.in_reply_to = canonicalMessageId(data.in_reply_to);
	if (data.from !== undefined) update.from = normalizeRecipientList(data.from);
	if (data.to !== undefined) update.to = normalizeRecipientList(data.to);
	if (data.cc !== undefined) update.cc = normalizeRecipientList(data.cc);
	if (data.bcc !== undefined) update.bcc = normalizeRecipientList(data.bcc);
	if (data.project !== undefined) update.project = data.project;
	if (data.mailbox !== undefined) update.mailbox = normalizeMailbox(data.mailbox);
	if (data.labels !== undefined) update.labels = normalizeLabels(data.labels);
	if (data.in_trash !== undefined) {
		update.in_trash = Boolean(data.in_trash);
		update.trashed_at = update.in_trash ? (data.trashed_at || new Date()) : null;
		if (update.in_trash) update.labels = [];
	}
	update.is_indexed = false;

	const before = ctx.user_id ? await Email.findOne({ _id: emailId, host_id }).lean() : null;
	const email = await Email.findOneAndUpdate(
		{ _id: emailId, host_id },
		{ $set: update },
		{ returnDocument: 'after' },
	);

	if (email) {
		await createEmailThreadLinks(email, email.owner, host_id, { skipSideEffects: ctx.skipSideEffects });
		if (!ctx.skipSideEffects) {
			await indexEmailNow(host_id, email, emailIndexOptions(ctx));
			await emitEmailCreatedOrUpdated(host_id, 'email:updated', email);
			invalidateGraphCache(host_id).catch(() => {});
		}
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, email);
			audit.log({ action: 'update', resource: 'email', resource_id: emailId, host_id, details, ...ctx });
		}
	}

	return email;
}

export async function deleteEmail(host_id, emailId, ctx = {}) {
	const email = await Email.findOneAndUpdate(
		{ _id: emailId, host_id, in_trash: { $ne: true } },
		{ $set: { in_trash: true, labels: [], trashed_at: new Date(), is_indexed: false } },
		{ returnDocument: 'after' },
	);
	if (email) {
		await indexEmailNow(host_id, email, emailIndexOptions(ctx));
		removeLinksForItem(host_id, emailId).catch((err) => log.error({ err, host_id, email_id: emailId }, 'Remove links error'));
		await emitEmailCreatedOrUpdated(host_id, 'email:updated', email);
		emitToTenant(host_id, 'counts:refresh');
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'email', resource_id: emailId, host_id, ...ctx });
	}
	return email;
}

export async function searchEmails(host_id, query, options = {}) {
	return searchCollection(host_id, 'emails', query, {
		queryBy: 'embedding',
		...options,
	});
}

export async function countEmails(host_id) {
	return Email.countDocuments({ host_id, in_trash: { $ne: true } });
}

function emailThreadSortTime(email = {}) {
	return emailSortTime(email);
}

export async function getEmailThread(host_id, emailId, { order = 'asc' } = {}) {
	const root = await Email.findOne({ _id: emailId, host_id, in_trash: { $ne: true } }).lean();
	if (!root) return [];

	const seenIds = new Set();
	const seenMessageIds = new Set();
	const queue = [];

	function enqueueMessageId(messageId) {
		const canonical = canonicalMessageId(messageId);
		if (!canonical || seenMessageIds.has(canonical)) return;
		seenMessageIds.add(canonical);
		queue.push(canonical);
	}

	enqueueMessageId(root.message_id);
	for (const ref of root.references || []) enqueueMessageId(ref);
	enqueueMessageId(root.in_reply_to);

	const threadDocs = [];
	if (!seenIds.has(root._id.toString())) {
		threadDocs.push(root);
		seenIds.add(root._id.toString());
	}

	while (queue.length > 0) {
		const currentMessageId = queue.shift();
		const linked = await Email.find({
			host_id,
			in_trash: { $ne: true },
			$or: [
				{ message_id: currentMessageId },
				{ references: currentMessageId },
				{ in_reply_to: currentMessageId },
			],
		}).lean();

		for (const doc of linked) {
			const docId = doc._id.toString();
			if (!seenIds.has(docId)) {
				seenIds.add(docId);
				threadDocs.push(doc);
			}
			enqueueMessageId(doc.message_id);
			for (const ref of doc.references || []) enqueueMessageId(ref);
			enqueueMessageId(doc.in_reply_to);
		}
	}

	return threadDocs.sort((a, b) => {
		const delta = emailThreadSortTime(a) - emailThreadSortTime(b);
		return order === 'desc' ? -delta : delta;
	});
}
