import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import striptags from 'striptags';
import { simpleParser } from 'mailparser';

import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailLabel } from '../model/email_label.js';
import { GraphLink } from '../model/graph_link.js';
import { extractText } from './import_service.js';
import { detectFileType } from '../modules/file_detect.js';
import { searchCollection, searchAll, removeDocument } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { getConnectionsForItem, invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { chatCompletion } from '../modules/llm_client.js';
import { getAiInstructions } from './byo_ai_service.js';

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const DEFAULT_EMAIL_LABELS = [
	{ slug: 'waiting', name: 'Waiting', color: '#0d6efd' },
	{ slug: 'triaged', name: 'Triaged', color: '#198754' },
	{ slug: 'human-do', name: 'Human do', color: '#fd7e14' },
	{ slug: 'reply-required', name: 'Reply required', color: '#dc3545' },
	{ slug: 'no-action', name: 'No action', color: '#6c757d' },
	{ slug: 'spam', name: 'Spam', color: '#212529' },
];
const SYSTEM_LABEL_SLUGS = DEFAULT_EMAIL_LABELS.map((label) => label.slug);
const PRIMARY_TRIAGE_LABELS = ['waiting', 'human-do', 'reply-required', 'no-action', 'spam'];
const TRIAGE_ACTIONS = PRIMARY_TRIAGE_LABELS;
const MAILBOX_ACTIONS = ['none', 'keep-inbox', 'archive', 'spam'];
const LINKABLE_CONTEXT_TYPES = ['notes', 'memory', 'urls', 'emails'];
const DEFAULT_EMAIL_TRIAGE_INSTRUCTIONS = [
	'Classify email by the next operational action.',
	'Use reply-required when a human should answer the sender.',
	'Use human-do when work is required outside a reply.',
	'Use waiting when the team is blocked on someone else.',
	'Use no-action for receipts, notifications, confirmations, and FYI messages.',
	'Use spam only for unwanted or suspicious messages.',
	'Create draft_reply only for reply-required emails. Never send emails.',
].join(' ');
const DEFAULT_EMAIL_AI_INSTRUCTIONS = [
	'Answer as an email assistant for the selected message.',
	'Use only the provided email context unless the user asks for general guidance.',
	'Be concise and call out uncertainty when the email context is insufficient.',
].join(' ');

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
			.map((v) => extractEmailAddress(v))
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
	if (['inbox', 'archived', 'sent', 'spam'].includes(mailbox)) return mailbox;
	return 'inbox';
}

function parseBooleanFilter(value) {
	if (value === true || value === 'true' || value === '1') return true;
	if (value === false || value === 'false' || value === '0') return false;
	return null;
}

function normalizeTriaged(value, fallback = false) {
	const parsed = parseBooleanFilter(value);
	if (parsed !== null) return parsed;
	return fallback;
}

function normalizeBodyText(parsed) {
	const text = String(parsed?.text || '').trim();
	if (text) return text;
	const html = String(parsed?.html || '').trim();
	if (!html) return '';
	return striptags(html, [], ' ').replace(/\s+/g, ' ').trim();
}

function normalizeForwardedBodyText(parsed) {
	const text = String(parsed?.text || parsed?.text_content || parsed?.body_text || '').trim();
	if (text) return text;
	const html = String(parsed?.html || parsed?.html_content || parsed?.body_html || '').trim();
	if (!html) return '';
	return striptags(html, [], ' ').replace(/\s+/g, ' ').trim();
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
		to: normalizeRecipientList(parsed.to || getParsedHeaderValue(parsed, 'to') || parsed.recipients || parsed.recipient || parsed.rcpt_to || parsed.rcptTo || parsed.session?.recipient || parsed.envelope?.to || parsed.envelope?.recipient),
		cc: normalizeRecipientList(parsed.cc || getParsedHeaderValue(parsed, 'cc')),
		bcc: normalizeRecipientList(parsed.bcc || getParsedHeaderValue(parsed, 'bcc')),
		subject: String(parsed.subject || getParsedHeaderValue(parsed, 'subject') || '').trim(),
		text_content: normalizeForwardedBodyText(parsed),
		attachment_text_content: '',
		raw_hash: parsed.raw_hash || '',
	};
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

async function persistEmail(userId, host_id, normalized, data, ctx = {}) {
	if (!normalized.subject && !normalized.text_content && !normalized.attachment_text_content) {
		throw new Error('Email content is empty after normalization');
	}

	const payload = {
		...normalized,
		source: data.source === 'emailforwarding' ? 'emailforwarding' : 'api',
		mailbox: normalizeMailbox(data.mailbox),
		labels: normalizeLabels(data.labels),
		triaged: normalizeTriaged(data.triaged, Boolean(data.triaged_at)),
			triaged_at: data.triaged_at || null,
			triage_summary: String(data.triage_summary || ''),
			triage_reason: String(data.triage_reason || ''),
			triage_primary_action: normalizePrimaryAction(data.triage_primary_action),
			triage_confidence: data.triage_confidence === undefined ? null : Number(data.triage_confidence),
			triage_action_points: normalizeActionPoints(data.triage_action_points || []),
			triage_related_context: normalizeRelatedContext(data.triage_related_context || []),
			triage_mailbox_action: MAILBOX_ACTIONS.includes(data.triage_mailbox_action) ? data.triage_mailbox_action : 'none',
			triage_status: data.triage_status || '',
			triage_error: String(data.triage_error || ''),
			triage_run_id: String(data.triage_run_id || ''),
			project: data.project,
		owner: userId,
		host_id,
		is_indexed: false,
		in_trash: false,
		trashed_at: null,
	};

	let email;
	if (normalized.message_id) {
		const existing = await Email.findOne({ message_id: normalized.message_id });
		if (existing && existing.host_id !== host_id) {
			throw new Error('Email message already exists');
		}
		if (existing) {
			email = await Email.findOneAndUpdate(
				{ _id: existing._id, host_id },
				{ $set: payload },
				{ returnDocument: 'after' },
			);
		} else {
			email = await Email.create(payload);
		}
	} else {
		email = await Email.create(payload);
	}

	await createEmailThreadLinks(email, userId, host_id, { skipSideEffects: ctx.skipSideEffects });
	if (!ctx.skipSideEffects) {
		emitToTenant(host_id, 'email:created', email);
		invalidateGraphCache(host_id).catch(() => {});
		audit.log({ action: 'create', resource: 'email', resource_id: email._id.toString(), user_id: userId, host_id, ...ctx });
		removeDocument(host_id, 'emails', email._id.toString()).catch((err) => console.error('Typesense remove error:', err.message));
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

export async function ensureDefaultEmailLabels(host_id) {
	const ops = DEFAULT_EMAIL_LABELS.map((label) => ({
		updateOne: {
			filter: { host_id, slug: label.slug },
			update: {
				$setOnInsert: {
					...label,
					host_id,
					is_system: true,
					is_active: true,
				},
			},
			upsert: true,
		},
	}));

	if (ops.length) await EmailLabel.bulkWrite(ops, { ordered: false });
	return EmailLabel.find({ host_id, is_active: { $ne: false } }).sort({ is_system: -1, name: 1 }).lean();
}

function buildEmailListQuery(host_id, projectId, filters = {}) {
	const query = { host_id, in_trash: false };
	if (projectId) query.project = projectId;
	if (filters.mailbox === 'trash') {
		query.in_trash = true;
		delete query.mailbox;
	} else if (filters.mailbox) {
		query.mailbox = normalizeMailbox(filters.mailbox);
	}
	if (filters.label) query.labels = normalizeSlug(filters.label);
	const triaged = parseBooleanFilter(filters.triaged);
	if (triaged === true) {
		query.triaged = true;
	} else if (triaged === false) {
		query.triaged = false;
	}
	return query;
}

export async function listEmails(host_id, projectId, { page = 1, limit = 50, mailbox, label, triaged } = {}) {
	const query = buildEmailListQuery(host_id, projectId, { mailbox, label, triaged });

	return Email.find(query)
		.sort({ updatedAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit);
}

export async function listEmailLabels(host_id, filters = {}) {
	const labels = await ensureDefaultEmailLabels(host_id);
	const projectId = filters.project || null;
	const baseQuery = { host_id, in_trash: false, ...(projectId ? { project: projectId } : {}) };

	const [mailboxCounts, labelCounts] = await Promise.all([
		Promise.all([
			Email.countDocuments(buildEmailListQuery(host_id, projectId, { mailbox: 'inbox', triaged: false })),
			Email.countDocuments(buildEmailListQuery(host_id, projectId, { mailbox: 'archived' })),
			Email.countDocuments(buildEmailListQuery(host_id, projectId, { mailbox: 'sent' })),
			Email.countDocuments(buildEmailListQuery(host_id, projectId, { mailbox: 'spam' })),
			EmailDraft.countDocuments({ host_id, status: { $ne: 'discarded' }, ...(projectId ? { project: projectId } : {}) }),
			Email.countDocuments({ host_id, in_trash: true, ...(projectId ? { project: projectId } : {}) }),
		]),
		Promise.all(labels.map(async (label) => ({
			slug: label.slug,
			count: await Email.countDocuments({ ...baseQuery, labels: label.slug }),
		}))),
	]);

	const labelCountMap = Object.fromEntries(labelCounts.map((item) => [item.slug, item.count]));
	return {
		mailboxes: [
				{ slug: 'inbox', name: 'Inbox', count: mailboxCounts[0] },
				{ slug: 'archived', name: 'Archived', count: mailboxCounts[1] },
				{ slug: 'sent', name: 'Sent', count: mailboxCounts[2] },
				{ slug: 'spam', name: 'Spam', count: mailboxCounts[3] },
				{ slug: 'drafts', name: 'Drafts', count: mailboxCounts[4] },
				{ slug: 'trash', name: 'Trash', count: mailboxCounts[5] },
			],
		labels: labels.map((label) => ({
			_id: label._id,
			slug: label.slug,
			name: label.name,
			color: label.color,
			is_system: label.is_system,
			count: labelCountMap[label.slug] || 0,
		})),
	};
}

export async function getEmail(host_id, emailId) {
	return Email.findOne({ _id: emailId, host_id });
}

export async function updateEmail(host_id, emailId, data, ctx = {}) {
	const update = {};
	if (data.subject !== undefined) update.subject = data.subject;
	if (data.text_content !== undefined) update.text_content = data.text_content;
	if (data.from !== undefined) update.from = normalizeRecipientList(data.from);
	if (data.to !== undefined) update.to = normalizeRecipientList(data.to);
	if (data.cc !== undefined) update.cc = normalizeRecipientList(data.cc);
	if (data.bcc !== undefined) update.bcc = normalizeRecipientList(data.bcc);
	if (data.project !== undefined) update.project = data.project;
	if (data.mailbox !== undefined) update.mailbox = normalizeMailbox(data.mailbox);
	if (data.labels !== undefined) update.labels = normalizeLabels(data.labels);
	if (data.triaged !== undefined) update.triaged = normalizeTriaged(data.triaged);
	if (data.triaged_at !== undefined) {
		update.triaged_at = data.triaged_at;
		if (data.triaged === undefined) update.triaged = Boolean(data.triaged_at);
	}
	if (data.triage_summary !== undefined) update.triage_summary = String(data.triage_summary || '');
	if (data.triage_reason !== undefined) update.triage_reason = String(data.triage_reason || '');
	if (data.triage_primary_action !== undefined) update.triage_primary_action = normalizePrimaryAction(data.triage_primary_action);
	if (data.triage_confidence !== undefined) update.triage_confidence = clampConfidence(data.triage_confidence);
	if (data.triage_action_points !== undefined) update.triage_action_points = normalizeActionPoints(data.triage_action_points);
	if (data.triage_related_context !== undefined) update.triage_related_context = normalizeRelatedContext(data.triage_related_context);
	if (data.triage_mailbox_action !== undefined) update.triage_mailbox_action = normalizeMailboxAction(data.triage_mailbox_action, update.triage_primary_action);
	if (data.triage_status !== undefined) update.triage_status = String(data.triage_status || '');
	if (data.triage_error !== undefined) update.triage_error = String(data.triage_error || '');
	update.is_indexed = false;

	const before = ctx.user_id ? await Email.findOne({ _id: emailId, host_id }).lean() : null;
	const email = await Email.findOneAndUpdate(
		{ _id: emailId, host_id },
		{ $set: update },
		{ returnDocument: 'after' },
	);

	if (email) {
		removeDocument(host_id, 'emails', emailId).catch((err) => console.error('Typesense remove error:', err.message));
		emitToTenant(host_id, 'email:updated', email);
		invalidateGraphCache(host_id).catch(() => {});
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
		{ $set: { in_trash: true, trashed_at: new Date() } },
		{ returnDocument: 'after' },
	);
	if (email) {
		removeDocument(host_id, 'emails', emailId).catch((err) => console.error('Typesense remove error:', err.message));
		removeLinksForItem(host_id, emailId).catch((err) => console.error('Remove links error:', err.message));
		emitToTenant(host_id, 'email:deleted', { _id: emailId });
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'email', resource_id: emailId, host_id, ...ctx });
	}
	return email;
}

export async function searchEmails(host_id, query, options = {}) {
	return searchCollection(host_id, 'emails', query, {
		queryBy: 'subject,text_content,attachment_text_content,from,to,cc,bcc,embedding',
		...options,
	});
}

function buildEmailContext(email) {
	const body = [email.text_content, email.attachment_text_content].filter(Boolean).join('\n\n').slice(0, 12000);
	return [
		`Subject: ${email.subject || '(No subject)'}`,
		`From: ${(email.from || []).join(', ') || '(unknown)'}`,
		`To: ${(email.to || []).join(', ') || '(unknown)'}`,
		email.cc?.length ? `Cc: ${email.cc.join(', ')}` : '',
		email.labels?.length ? `Labels: ${email.labels.join(', ')}` : '',
		email.triage_summary ? `Triage summary: ${email.triage_summary}` : '',
		email.triage_reason ? `Triage reason: ${email.triage_reason}` : '',
		`Body:\n${body || '(empty)'}`,
	].filter(Boolean).join('\n\n');
}

export async function askEmailAi(host_id, emailId, query, options = {}) {
	const prompt = String(query || '').trim();
	if (!prompt) throw new Error('query required');

	const email = await Email.findOne({ _id: emailId, host_id, in_trash: false }).lean();
	if (!email) return null;

	const completionFn = options.completionFn || chatCompletion;
	const instructions = await getAiInstructions(host_id);
	const content = await completionFn({
		hostId: host_id,
		scope: 'email',
		maxTokens: 1200,
		messages: [
			{
				role: 'system',
				content: [
					DEFAULT_EMAIL_AI_INSTRUCTIONS,
					instructions.global ? `Global instructions:\n${instructions.global}` : '',
					instructions.email ? `Email AI instructions:\n${instructions.email}` : '',
				].filter(Boolean).join('\n\n'),
			},
			{
				role: 'user',
				content: [
					`Email context:\n${buildEmailContext(email)}`,
					`User request:\n${prompt}`,
				].join('\n\n'),
			},
		],
	});

	return { answer: String(content || '').trim() };
}

export async function countEmails(host_id) {
	return Email.countDocuments({ host_id, in_trash: false });
}

export async function backfillEmailTriageState() {
	const [mailboxResult, trashResult, triagedTrueResult, triagedFalseResult] = await Promise.all([
		Email.updateMany(
			{ mailbox: { $exists: false } },
			{ $set: { mailbox: 'inbox' } },
			{ timestamps: false },
		),
		Email.updateMany(
			{ in_trash: { $exists: false } },
			{ $set: { in_trash: false } },
			{ timestamps: false },
		),
		Email.updateMany(
			{ triaged: { $exists: false }, triaged_at: { $type: 'date' } },
			{ $set: { triaged: true } },
			{ timestamps: false },
		),
		Email.updateMany(
			{ triaged: { $exists: false }, $or: [{ triaged_at: null }, { triaged_at: { $exists: false } }] },
			{ $set: { triaged: false } },
			{ timestamps: false },
		),
	]);

	const modified = [mailboxResult, trashResult, triagedTrueResult, triagedFalseResult]
		.reduce((sum, result) => sum + (result?.modifiedCount || 0), 0);
	if (modified > 0) console.log(`Email triage state backfilled: ${modified} updates`);

	return {
		mailbox: mailboxResult?.modifiedCount || 0,
		in_trash: trashResult?.modifiedCount || 0,
		triaged_true: triagedTrueResult?.modifiedCount || 0,
		triaged_false: triagedFalseResult?.modifiedCount || 0,
	};
}

function extractJsonObject(text) {
	const raw = String(text || '').trim();
	if (!raw) throw new Error('Triage response was empty');
	const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) return fenced[1].trim();
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start >= 0 && end > start) return raw.slice(start, end + 1);
	return raw;
}

export function parseTriageResult(text) {
	let parsed;
	try {
		parsed = JSON.parse(extractJsonObject(text));
	} catch {
		throw new Error('Triage response was not valid JSON');
	}

	const primaryAction = normalizePrimaryAction(parsed.primary_action);
	if (!primaryAction) throw new Error('Triage response primary_action was invalid');
	const labels = normalizeLabels(parsed.labels || []);
	const validLabels = labels.filter((label) => SYSTEM_LABEL_SLUGS.includes(label));
	if (!validLabels.includes(primaryAction)) validLabels.push(primaryAction);
	if (!validLabels.includes('triaged')) validLabels.push('triaged');

	return {
		primary_action: primaryAction,
		labels: [...new Set(validLabels)],
		summary: String(parsed.summary || '').trim().slice(0, 500),
		reason: String(parsed.reason || '').trim().slice(0, 1000),
		confidence: clampConfidence(parsed.confidence),
		action_points: normalizeActionPoints(parsed.action_points || []),
		related_context: normalizeRelatedContext(parsed.related_context || []),
		draft_reply: normalizeDraftReply(parsed.draft_reply, primaryAction),
		mailbox_action: normalizeMailboxAction(parsed.mailbox_action, primaryAction),
	};
}

function normalizePrimaryAction(value) {
	const action = normalizeSlug(value);
	return TRIAGE_ACTIONS.includes(action) ? action : '';
}

function clampConfidence(value) {
	const number = Number(value);
	if (!Number.isFinite(number)) return 0;
	if (number < 0) return 0;
	if (number > 1) return 1;
	return number;
}

function normalizeMailboxAction(value, primaryAction = '') {
	const normalized = normalizeSlug(value);
	if (normalized === 'archived') return 'archive';
	if (MAILBOX_ACTIONS.includes(normalized)) return normalized;
	if (primaryAction === 'no-action') return 'archive';
	if (primaryAction === 'spam') return 'spam';
	return 'keep-inbox';
}

function normalizeActionPoints(items = []) {
	if (!Array.isArray(items)) return [];
	return items
		.map((item) => {
			if (typeof item === 'string') {
				return { text: item.trim().slice(0, 300), type: '', due_at: null };
			}
			if (!item || typeof item !== 'object') return null;
			const dueAt = item.due_at ? new Date(item.due_at) : null;
			return {
				text: String(item.text || item.title || '').trim().slice(0, 300),
				type: normalizeSlug(item.type || item.kind || '').slice(0, 50),
				due_at: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
			};
		})
		.filter((item) => item?.text)
		.slice(0, 10);
}

function normalizeContextType(value) {
	const type = normalizeSlug(value);
	if (type === 'url') return 'urls';
	if (type === 'note') return 'notes';
	if (type === 'email') return 'emails';
	if (type === 'page') return 'pages';
	return ['notes', 'memory', 'urls', 'emails', 'pages'].includes(type) ? type : '';
}

function normalizeRelatedContext(items = []) {
	if (!Array.isArray(items)) return [];
	return items
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const itemType = normalizeContextType(item.item_type || item.type || item._type);
			const itemId = String(item.item_id || item.id || item.source_id || item._id || '').trim();
			return {
				item_id: itemId,
				item_type: itemType,
				title: String(item.title || item.name || '').trim().slice(0, 200),
				reason: String(item.reason || item.summary || '').trim().slice(0, 300),
			};
		})
		.filter((item) => item.item_id && item.item_type)
		.slice(0, 8);
}

function normalizeDraftReply(value, primaryAction) {
	if (primaryAction !== 'reply-required' || !value || typeof value !== 'object') return null;
	const bodyText = String(value.body_text || value.text || value.body || '').trim();
	const bodyHtml = String(value.body_html || value.html || '').trim();
	if (!bodyText && !bodyHtml) return null;
	return {
		to: normalizeRecipientList(value.to || []),
		cc: normalizeRecipientList(value.cc || []),
		bcc: normalizeRecipientList(value.bcc || []),
		subject: String(value.subject || '').trim().slice(0, 300),
		body_text: bodyText.slice(0, 12000),
		body_html: bodyHtml.slice(0, 20000),
	};
}

function triageSearchQuery(email) {
	return [
		email.subject || '',
		(email.from || []).join(' '),
		(email.to || []).join(' '),
		String(email.text_content || '').slice(0, 800),
	].filter(Boolean).join('\n').slice(0, 1600) || '*';
}

function resultDocument(hit) {
	return hit?.document || hit || {};
}

function contextTitle(type, doc) {
	if (type === 'emails') return doc.subject || '(No subject)';
	if (type === 'urls' || type === 'pages') return doc.title || doc.url || '(Untitled)';
	return doc.title || '(Untitled)';
}

function contextExcerpt(type, doc) {
	if (type === 'memory') return doc.content || '';
	if (type === 'urls' || type === 'pages') return doc.description || doc.text_content || '';
	if (type === 'emails') return doc.triage_summary || doc.text_content || '';
	return doc.text_content || doc.content || '';
}

function flattenKnowledgeResults(results, currentEmailId) {
	const items = [];
	for (const [type, result] of Object.entries(results || {})) {
		for (const hit of result?.hits || []) {
			const doc = resultDocument(hit);
			const id = String(doc.source_id || doc.id || doc._id || '').trim();
			if (!id || (type === 'emails' && id === currentEmailId)) continue;
			items.push({
				item_id: id,
				item_type: normalizeContextType(type),
				title: contextTitle(type, doc),
				excerpt: String(contextExcerpt(type, doc) || '').slice(0, 500),
			});
		}
	}
	return items.slice(0, 12);
}

function formatTriageContext(context = {}) {
	const lines = [];
	if (context.thread?.length) {
		lines.push('THREAD EMAILS:');
		for (const item of context.thread.slice(0, 5)) {
			lines.push(`- [emails:${item.item_id}] ${item.title}: ${item.excerpt}`);
		}
	}
	if (context.knowledge?.length) {
		lines.push('ALL-PROJECT KNOWLEDGE SEARCH:');
		for (const item of context.knowledge.slice(0, 10)) {
			lines.push(`- [${item.item_type}:${item.item_id}] ${item.title}: ${item.excerpt}`);
		}
	}
	if (context.graph_connections?.length) {
		lines.push('GRAPH CONNECTIONS:');
		for (const item of context.graph_connections.slice(0, 8)) {
			lines.push(`- [${item.item_type}:${item.item_id}] ${item.title}: ${item.reason || ''}`);
		}
	}
	return lines.join('\n').slice(0, 8000);
}

export async function buildTriageContext(host_id, email, options = {}) {
	const currentEmailId = email._id?.toString();
	const searchKnowledgeFn = options.searchKnowledgeFn || ((hostId, query, searchOptions) => searchAll(hostId, query, searchOptions));
	const getConnectionsFn = options.getConnectionsFn || getConnectionsForItem;
	const getThreadFn = options.getThreadFn || getEmailThread;
	const [knowledgeResults, thread, graph] = await Promise.all([
		searchKnowledgeFn(host_id, triageSearchQuery(email), {
			perPage: 4,
			includeEmails: true,
			group: true,
			exclude_fields: 'embedding',
		}).catch(() => ({})),
		getThreadFn(host_id, currentEmailId).catch(() => []),
		getConnectionsFn(host_id, currentEmailId).catch(() => ({ links: [], tag_connections: [] })),
	]);

	const threadItems = (thread || [])
		.filter((item) => item?._id?.toString() !== currentEmailId)
		.map((item) => ({
			item_id: item._id.toString(),
			item_type: 'emails',
			title: item.subject || '(No subject)',
			excerpt: String(item.triage_summary || item.text_content || '').slice(0, 500),
		}))
		.slice(0, 6);

	const graphItems = [
		...(graph?.links || []).map((link) => {
			const sourceId = link.source_id?.toString();
			const isSource = sourceId === currentEmailId;
			return {
				item_id: (isSource ? link.target_id : link.source_id)?.toString() || '',
				item_type: isSource ? link.target_type : link.source_type,
				title: link.label || 'Linked item',
				reason: link.label || '',
			};
		}),
		...(graph?.tag_connections || []).map((item) => ({
			item_id: item.id,
			item_type: item.type,
			title: item.title,
			reason: item.shared_tags?.length ? `Shared tags: ${item.shared_tags.join(', ')}` : '',
		})),
	].filter((item) => item.item_id && item.item_id !== currentEmailId);

	const knowledge = flattenKnowledgeResults(knowledgeResults, currentEmailId);
	return {
		knowledge,
		prior_emails: knowledge.filter((item) => item.item_type === 'emails'),
		thread: threadItems,
		graph_connections: normalizeRelatedContext(graphItems),
	};
}

function buildTriagePrompt(email, instructions, context) {
	return [
		'Classify and triage this email for an email command center.',
		'Return JSON only. Do not include markdown.',
		'Required shape: {"primary_action":"reply-required","labels":["reply-required"],"summary":"short summary","reason":"short reason","confidence":0.8,"action_points":[{"text":"what to do","type":"reply"}],"related_context":[{"item_type":"notes","item_id":"id","title":"title","reason":"why relevant"}],"draft_reply":{"to":["sender@example.com"],"cc":[],"bcc":[],"subject":"Re: subject","body_text":"draft"},"mailbox_action":"keep-inbox"}.',
		`Allowed labels: ${SYSTEM_LABEL_SLUGS.join(', ')}.`,
		`primary_action must be exactly one of ${TRIAGE_ACTIONS.join(', ')}.`,
		'Always include exactly one best action label from reply-required, human-do, waiting, no-action, spam.',
		'Do not include triaged; it will be added automatically.',
		'Use draft_reply only when primary_action is reply-required. Never send email.',
		'Use related_context only for context IDs shown below.',
		'Use mailbox_action archive for no-action, spam for spam, and keep-inbox otherwise unless custom instructions clearly require a different internal move.',
		`Default triage instructions:\n${DEFAULT_EMAIL_TRIAGE_INSTRUCTIONS}`,
		instructions.global ? `Global instructions:\n${instructions.global}` : '',
		instructions.email ? `Email instructions:\n${instructions.email}` : '',
		instructions.email_triage ? `Email triage instructions:\n${instructions.email_triage}` : '',
		`Email context:\n${buildEmailContext(email).slice(0, 10000)}`,
		`Retrieved Kumbukum context:\n${formatTriageContext(context) || 'No related context found.'}`,
	].filter(Boolean).join('\n\n');
}

async function createTriageLinks(host_id, userId, email, relatedContext, options = {}) {
	let linked = 0;
	const emailId = email._id.toString();
	for (const item of relatedContext || []) {
		if (!LINKABLE_CONTEXT_TYPES.includes(item.item_type)) continue;
		if (item.item_type === 'emails' && item.item_id === emailId) continue;
		try {
			const result = await GraphLink.updateOne(
				{
					host_id,
					source_id: email._id,
					source_type: 'emails',
					target_id: item.item_id,
					target_type: item.item_type,
				},
				{
					$setOnInsert: {
						source_id: email._id,
						source_type: 'emails',
						target_id: item.item_id,
						target_type: item.item_type,
						label: 'triage-context',
						owner: userId,
						host_id,
					},
				},
				{ upsert: true },
			);
			if (result.upsertedCount > 0) linked += 1;
		} catch {
			// Ignore stale or invalid AI-selected references.
		}
	}
	if (linked && !options.skipSideEffects) invalidateGraphCache(host_id).catch(() => {});
	return linked;
}

async function upsertTriageDraft(host_id, userId, email, triage) {
	if (triage.primary_action !== 'reply-required' || !triage.draft_reply) return null;
	const draft = triage.draft_reply;
	return EmailDraft.findOneAndUpdate(
		{ host_id, source_email: email._id, generated_by_triage: true },
		{
			$set: {
				from: (email.to || [])[0] || '',
				to: draft.to.length ? draft.to : (email.from || []),
				cc: draft.cc,
				bcc: draft.bcc,
				subject: draft.subject || `Re: ${email.subject || '(No subject)'}`,
				body_text: draft.body_text,
				body_html: draft.body_html,
				status: 'draft',
				confidence: triage.confidence,
				project: email.project,
				owner: userId || email.owner,
				host_id,
				generated_by_triage: true,
			},
		},
		{ upsert: true, returnDocument: 'after' },
	);
}

export async function triageInboxEmails(host_id, userId, options = {}) {
	await ensureDefaultEmailLabels(host_id);
	const limit = Math.min(parseInt(options.limit, 10) || 25, 100);
	const projectId = options.project || null;
	const query = buildEmailListQuery(host_id, projectId, { mailbox: 'inbox', triaged: false });
	const emails = await Email.find(query)
		.sort({ updatedAt: -1 })
		.limit(limit)
		.lean();

	const completionFn = options.completionFn || chatCompletion;
	const instructions = await getAiInstructions(host_id);
	const results = [];
	const errors = [];
	const runId = crypto.randomUUID();
	let drafted = 0;
	let linked = 0;
	let moved = 0;

	for (const email of emails) {
		try {
			const context = await buildTriageContext(host_id, email, options);
			const content = await completionFn({
				hostId: host_id,
				scope: 'email',
				maxTokens: 1800,
				messages: [
					{
						role: 'system',
						content: 'You are an email triage workflow engine. Return compact JSON only. Never send email.',
					},
					{
						role: 'user',
						content: buildTriagePrompt(email, instructions, context),
					},
				],
			});
			const triage = parseTriageResult(content);
			const labels = [...new Set([...(email.labels || []), ...triage.labels])];
			const targetMailbox = triage.mailbox_action === 'archive'
				? 'archived'
				: triage.mailbox_action === 'spam'
					? 'spam'
					: email.mailbox || 'inbox';
			const draft = await upsertTriageDraft(host_id, userId, email, triage);
			const linkedCount = await createTriageLinks(host_id, userId, email, triage.related_context, { skipSideEffects: options.skipSideEffects });
			const updated = await Email.findOneAndUpdate(
				{ _id: email._id, host_id },
				{
					$set: {
						mailbox: targetMailbox,
						labels,
						triaged: true,
						triaged_at: new Date(),
						triage_summary: triage.summary,
						triage_reason: triage.reason,
						triage_primary_action: triage.primary_action,
						triage_confidence: triage.confidence,
						triage_action_points: triage.action_points,
						triage_related_context: triage.related_context,
						triage_mailbox_action: triage.mailbox_action,
						triage_status: 'complete',
						triage_error: '',
						triage_run_id: runId,
						triage_draft_id: draft?._id || null,
						is_indexed: false,
					},
				},
				{ returnDocument: 'after' },
			);

			if (updated) {
				if (draft) drafted += 1;
				if (linkedCount) linked += linkedCount;
				if ((email.mailbox || 'inbox') !== updated.mailbox) moved += 1;
				if (!options.skipSideEffects) {
					removeDocument(host_id, 'emails', email._id.toString()).catch((err) => console.error('Typesense remove error:', err.message));
					emitToTenant(host_id, 'email:updated', updated);
				}
				results.push({
					email_id: email._id.toString(),
					action: updated.triage_primary_action,
					labels: updated.labels,
					summary: updated.triage_summary,
					confidence: updated.triage_confidence,
					draft_id: draft?._id?.toString() || null,
					context_refs: updated.triage_related_context || [],
					mailbox: updated.mailbox,
				});
			}
		} catch (err) {
			await Email.findOneAndUpdate(
				{ _id: email._id, host_id },
				{
					$set: {
						triage_status: 'failed',
						triage_error: err.message,
						triage_run_id: runId,
					},
				},
			).catch(() => {});
			errors.push({ email_id: email._id.toString(), error: err.message });
		}
	}

	if (results.length && !options.skipSideEffects) invalidateGraphCache(host_id).catch(() => {});
	if (results.length && userId && !options.skipSideEffects) {
		audit.log({
			action: 'update',
			resource: 'email',
				resource_id: 'triage-inbox',
				user_id: userId,
				host_id,
				details: { triaged: results.length, drafted, linked, moved, errors: errors.length },
				channel: options.ctx?.channel || 'web',
				ip: options.ctx?.ip,
				user_agent: options.ctx?.user_agent,
			});
		}

	return { processed: emails.length, triaged: results.length, drafted, linked, moved, errors, results };
}

export async function listEmailDrafts(host_id, { project, status, page = 1, limit = 50 } = {}) {
	const query = { host_id };
	if (project) query.project = project;
	if (status) query.status = status;
	else query.status = { $ne: 'discarded' };
	return EmailDraft.find(query)
		.sort({ updatedAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit)
		.lean();
}

export async function getEmailDraft(host_id, draftId) {
	return EmailDraft.findOne({ _id: draftId, host_id }).lean();
}

export async function updateEmailDraft(host_id, draftId, data, ctx = {}) {
	const update = {};
	if (data.to !== undefined) update.to = normalizeRecipientList(data.to);
	if (data.cc !== undefined) update.cc = normalizeRecipientList(data.cc);
	if (data.bcc !== undefined) update.bcc = normalizeRecipientList(data.bcc);
	if (data.subject !== undefined) update.subject = String(data.subject || '').trim();
	if (data.body_text !== undefined) update.body_text = String(data.body_text || '');
	if (data.body_html !== undefined) update.body_html = String(data.body_html || '');
	if (data.status !== undefined && ['draft', 'ready', 'discarded'].includes(data.status)) update.status = data.status;
	if (Object.keys(update).length === 0) return getEmailDraft(host_id, draftId);

	const before = ctx.user_id ? await EmailDraft.findOne({ _id: draftId, host_id }).lean() : null;
	const draft = await EmailDraft.findOneAndUpdate(
		{ _id: draftId, host_id },
		{ $set: update },
		{ returnDocument: 'after' },
	).lean();
	if (draft && ctx.user_id) {
		const details = audit.diffSnapshot(before, draft);
		audit.log({ action: 'update', resource: 'email_draft', resource_id: draftId, host_id, details, ...ctx });
	}
	return draft;
}

export async function getEmailThread(host_id, emailId) {
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

	return threadDocs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
