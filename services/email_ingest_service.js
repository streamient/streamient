import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import striptags from 'striptags';
import { simpleParser } from 'mailparser';

import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailIdentity } from '../model/email_identity.js';
import { EmailLabel } from '../model/email_label.js';
import { EmailTriageRun } from '../model/email_triage_run.js';
import { GraphLink } from '../model/graph_link.js';
import { Project } from '../model/project.js';
import { Tenant } from '../modules/tenancy.js';
import { extractText } from './import_service.js';
import { detectFileType } from '../modules/file_detect.js';
import { searchCollection, searchAll } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { getConnectionsForItem, invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { emailAiCompletion, emailTriageCompletion } from '../modules/llm_client.js';
import { getAiInstructions, getEmailSettings } from './byo_ai_service.js';
import { sanitizeEmailHtml } from '../modules/email_html_sanitizer.js';
import { indexEmailNow, removeEmailFromIndexNow } from './email_index_service.js';
import { enqueueDraftSync, enqueueEmailMailboxSync } from './email_action_sync_service.js';
import { createLogger } from '../modules/logger.js';
import config from '../config.js';

const log = createLogger('email-ingest');

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const DEFAULT_EMAIL_LABELS = [
	{ slug: 'reply-required', name: 'Review', color: '#dc3545' },
	{ slug: 'human-do', name: 'Human Do', color: '#fd7e14' },
	{ slug: 'waiting', name: 'Waiting', color: '#0d6efd' },
	{ slug: 'spam', name: 'Spam', color: '#212529' },
	{ slug: 'no-action', name: 'No action', color: '#6c757d' },
	{ slug: 'triaged', name: 'Done', color: '#198754' },
];
const SYSTEM_LABEL_SLUGS = DEFAULT_EMAIL_LABELS.map((label) => label.slug);
const DEFAULT_EMAIL_LABEL_ORDER = new Map(DEFAULT_EMAIL_LABELS.map((label, index) => [label.slug, index]));
const HIDDEN_EMAIL_LABEL_SLUGS = new Set(['triaged']);
const PRIMARY_TRIAGE_LABELS = ['reply-required', 'human-do', 'waiting', 'no-action', 'spam'];
const TRIAGE_ACTIONS = PRIMARY_TRIAGE_LABELS;
const MAX_DRAFT_RECIPIENTS = 10;
const MAILBOX_ACTIONS = ['none', 'keep-inbox', 'archive', 'spam'];
const TRIAGE_STATUSES = ['pending', 'complete', 'failed'];
const TRIAGE_STATUS_INCLUDES = ['email', 'draft'];
const LINKABLE_CONTEXT_TYPES = ['notes', 'memory', 'urls', 'emails'];
const TRIAGE_RUN_EVENT = 'email-triage:run-updated';
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
	'Use the selected email plus retrieved Kumbukum context. Retrieved context searches the current project first and falls back to all projects only when no current-project records are found.',
	'Be concise and call out uncertainty when the email context is insufficient.',
].join(' ');
const EMAIL_AI_LIST_LIMIT = 50;
const EMAIL_AI_COUNT_LIMIT = 5000;
const EMAIL_AI_INCLUDE_FIELDS = [
	'id',
	'source_id',
	'project_id',
	'subject',
	'from',
	'to',
	'cc',
	'bcc',
	'mailbox',
	'labels',
	'triaged',
	'triage_status',
	'triage_summary',
	'triage_primary_action',
	'triage_action_points',
	'message_id',
	'text_content',
	'attachment_text_content',
	'created_at',
	'updated_at',
].join(',');

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

const DRAFT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeDraftRecipientList(value, fieldName) {
	const recipients = [...new Set(normalizeRecipientList(value))];
	const invalid = recipients.filter((recipient) => !DRAFT_EMAIL_RE.test(recipient));
	if (invalid.length) throw new Error(`${fieldName} contains invalid email address`);
	if (recipients.length > MAX_DRAFT_RECIPIENTS) throw new Error(`${fieldName} cannot contain more than ${MAX_DRAFT_RECIPIENTS} addresses`);
	return recipients;
}

function normalizeDraftFrom(value) {
	const from = extractEmailAddress(value);
	if (from && !DRAFT_EMAIL_RE.test(from)) throw new Error('from contains invalid email address');
	return from;
}

async function listProjectEmailIdentities(host_id, projectId) {
	if (!projectId) return [];
	return EmailIdentity.find({ host_id, project: projectId }).select('_id name email signature').sort({ email: 1 }).lean();
}

async function resolveDraftFrom(host_id, projectId, requestedFrom, fallbackFrom) {
	const identities = await listProjectEmailIdentities(host_id, projectId);
	const requested = normalizeDraftFrom(requestedFrom);
	const fallback = normalizeDraftFrom(fallbackFrom);

	if (!identities.length) return requested || fallback || '';

	const emails = new Set(identities.map((identity) => normalizeDraftFrom(identity.email)).filter(Boolean));
	if (requested) {
		if (!emails.has(requested)) throw new Error('from must match a configured outbound email address');
		return requested;
	}
	if (fallback && emails.has(fallback)) return fallback;
	return normalizeDraftFrom(identities[0].email);
}

function normalizeDraftHtml(value) {
	return sanitizeEmailHtml(value).html.slice(0, 20000);
}

function textFromDraftHtml(value) {
	return striptags(String(value || ''))
		.replace(/\u00a0/g, ' ')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
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

function parseCsvFilter(value) {
	if (!value) return [];
	const items = Array.isArray(value) ? value : String(value).split(',');
	return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizeTriageStatus(value) {
	const status = normalizeSlug(value);
	return TRIAGE_STATUSES.includes(status) ? status : '';
}

function parseTriageStatusIncludes(value) {
	return new Set(parseCsvFilter(value).map(normalizeSlug).filter((item) => TRIAGE_STATUS_INCLUDES.includes(item)));
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
		log.debug({ bytes: data.raw_email.length, attachments: (parsed.attachments || []).length, has_html: !!parsed.html }, 'Parsed raw email');
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

		const rule = rawRule.replace(/\*+$/, ''); // allow trailing wildcard, e.g. "noreply@*"
		if (!rule) {
			continue;
		} else if (rule.endsWith('@')) {
			localParts.add(rule.slice(0, -1)); // local-part only, any domain (e.g. "noreply@")
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

function splitEmailFilterRules(filterText) {
	return String(filterText || '')
		.split(/[\n,]/)
		.map((rule) => rule.trim())
		.filter(Boolean);
}

function buildSpamGuardCompareFilter(host_id, spamGuard) {
	if (spamGuard) return { host_id, 'settings.email.spam_guard': spamGuard };
	return {
		host_id,
		$or: [
			{ 'settings.email.spam_guard': '' },
			{ 'settings.email.spam_guard': { $exists: false } },
		],
	};
}

async function updateSpamGuardRules(host_id, transformRules, fallbackResult) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const tenant = await Tenant.findOne({ host_id }).select('settings.email.spam_guard').lean();
		const currentSpamGuard = tenant?.settings?.email?.spam_guard || '';
		const existingRules = splitEmailFilterRules(currentSpamGuard);
		const result = transformRules(existingRules);
		const spamGuard = result.rules.join('\n');
		if (spamGuard === existingRules.join('\n')) return { ...result, spam_guard: spamGuard };

		const update = await Tenant.updateOne(buildSpamGuardCompareFilter(host_id, currentSpamGuard), { $set: { 'settings.email.spam_guard': spamGuard } });
		if ((update?.modifiedCount || update?.nModified || 0) > 0) return { ...result, spam_guard: spamGuard };
	}

	const tenant = await Tenant.findOne({ host_id }).select('settings.email.spam_guard').lean();
	return { ...fallbackResult, spam_guard: tenant?.settings?.email?.spam_guard || '' };
}

export async function addSendersToSpamGuard(host_id, fromAddresses = []) {
	const senders = normalizeRecipientList(fromAddresses);
	if (!senders.length) return { added: 0, spam_guard: '' };

	return updateSpamGuardRules(host_id, (existingRules) => {
		const seen = new Set(existingRules.map((rule) => rule.toLowerCase()));
		const additions = [];
		for (const sender of senders) {
			const normalized = String(sender || '').trim().toLowerCase();
			if (!normalized || seen.has(normalized)) continue;
			seen.add(normalized);
			additions.push(normalized);
		}

		return { rules: [...existingRules, ...additions], added: additions.length };
	}, { added: 0 });
}

export async function removeSendersFromSpamGuard(host_id, fromAddresses = []) {
	const senders = new Set(normalizeRecipientList(fromAddresses).map((sender) => String(sender || '').trim().toLowerCase()).filter(Boolean));
	if (!senders.size) return { removed: 0, spam_guard: '' };

	return updateSpamGuardRules(host_id, (existingRules) => {
		const remainingRules = existingRules.filter((rule) => !senders.has(rule.toLowerCase()));
		return { rules: remainingRules, removed: existingRules.length - remainingRules.length };
	}, { removed: 0 });
}

async function learnSpamGuardSenders(host_id, fromAddresses, source) {
	try {
		return await addSendersToSpamGuard(host_id, fromAddresses);
	} catch (err) {
		log.warn({ err, host_id, source }, 'Spam guard sender learning failed');
		return { added: 0, spam_guard: '' };
	}
}

async function forgetSpamGuardSenders(host_id, fromAddresses, source) {
	try {
		return await removeSendersFromSpamGuard(host_id, fromAddresses);
	} catch (err) {
		log.warn({ err, host_id, source }, 'Spam guard sender removal failed');
		return { removed: 0, spam_guard: '' };
	}
}

async function applyAccountSpamGuard(host_id, normalized, data = {}) {
	const mailbox = normalizeMailbox(data.mailbox);
	if (mailbox !== 'inbox') return data;

	const settings = await getEmailSettings(host_id);
	if (!matchesEmailFilter(settings.spam_guard, {
		from: normalized.from || [],
		subject: normalized.subject || '',
	})) {
		return data;
	}

	const labels = [...new Set([...normalizeLabels(data.labels || []), 'spam', 'triaged'])];
	return {
		...data,
		mailbox: 'spam',
		labels,
		triaged: true,
		triaged_at: data.triaged_at || new Date(),
		triage_summary: data.triage_summary || 'Matched account spam guard.',
		triage_reason: data.triage_reason || 'Sender or subject matched account spam guard.',
		triage_primary_action: 'spam',
		triage_mailbox_action: 'spam',
		triage_status: 'complete',
		triage_error: '',
		in_trash: false,
		trashed_at: null,
	};
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
		project: projectId,
		in_trash: { $ne: true },
		mailbox: 'inbox',
		triaged: false,
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
		{
			_id: { $in: ids },
			host_id,
			project: projectId,
			in_trash: { $ne: true },
			mailbox: 'inbox',
			triaged: false,
		},
		{
			$set: {
				in_trash: true,
				trashed_at: new Date(),
				is_indexed: false,
			},
		},
	);
	const moved = result?.modifiedCount ?? result?.nModified ?? ids.length;

	if (!ctx.skipSideEffects) {
		await Promise.all(ids.map(async (id) => {
			await removeEmailFromIndexNow(host_id, id, { removeFn: ctx.removeEmailIndexFn, updateFn: ctx.updateEmailIndexStateFn });
			removeLinksForItem(host_id, id).catch((err) => log.error({ err, host_id, email_id: id }, 'Remove links error'));
			emitToTenant(host_id, 'email:deleted', { _id: id });
		}));
		emitToTenant(host_id, 'counts:refresh');
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
		text_content: normalizeForwardedBodyText(parsed),
		...normalizeHtmlContent(parsed.html || parsed.html_content || parsed.body_html),
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
	emitToTenant(host_id, 'counts:refresh');
	return payload;
}

export async function maybeAutoTriageIncomingEmail(host_id, userId, email, options = {}) {
	if (!email || email.triaged) return null;
	if (email.in_trash) return null;
	if ((email.mailbox || 'inbox') !== 'inbox') return null;

	const settings = await getEmailSettings(host_id);
	if (!settings.auto_triage_incoming) return null;

	return triageInboxEmails(host_id, userId, {
		...(options.triageOptions || {}),
		email_id: email._id?.toString?.() || email._id,
		limit: 1,
		ctx: options.ctx,
	});
}

function resetArchivedTriageFields() {
	return {
		mailbox: 'archived',
		labels: [],
		triaged: false,
		triaged_at: null,
		triage_summary: '',
		triage_reason: '',
		triage_primary_action: '',
		triage_confidence: null,
		triage_action_points: [],
		triage_related_context: [],
		triage_mailbox_action: 'none',
		triage_status: '',
		triage_error: '',
		triage_run_id: '',
		triage_draft_id: null,
		in_trash: false,
		trashed_at: null,
		is_indexed: false,
	};
}

function shouldArchiveBccThreadEmail(email, selectedId) {
	if (!email || email.in_trash === true) return false;
	const id = stringifyObjectId(email._id);
	if (id && id === selectedId) return true;
	return (email.mailbox || 'inbox') !== 'sent' || email.source === 'emailforwarding';
}

async function archiveBccReplyThread(host_id, selectedEmail, options = {}) {
	const selectedId = stringifyObjectId(selectedEmail?._id);
	if (!selectedId) return null;

	const thread = await getEmailThread(host_id, selectedId, { order: 'desc' });
	const resetFields = resetArchivedTriageFields();
	const updatedById = new Map();
	const changedEmails = [];

	for (const email of thread) {
		const id = stringifyObjectId(email._id);
		if (!id || !shouldArchiveBccThreadEmail(email, selectedId)) continue;
		const updated = await Email.findOneAndUpdate(
			{
				_id: email._id,
				host_id,
				in_trash: { $ne: true },
				$or: [
					{ mailbox: { $ne: 'sent' } },
					{ source: 'emailforwarding' },
					{ _id: selectedEmail._id },
				],
			},
			{ $set: resetFields },
			{ returnDocument: 'after', timestamps: options.timestamps !== false },
		);
		if (updated) {
			updatedById.set(id, updated);
			changedEmails.push(updated);
		}
	}

	if (changedEmails.length) {
		const changedIds = changedEmails.map((email) => email._id);
		await Promise.all([
			EmailDraft.updateMany(
				{ host_id, source_email: { $in: changedIds }, generated_by_triage: true, status: { $ne: 'discarded' } },
				{ $set: { status: 'discarded' } },
			),
			GraphLink.deleteMany({ host_id, source_id: { $in: changedIds }, source_type: 'emails', label: 'triage-context' }),
		]);
	}

	const updatedThread = thread.map((email) => updatedById.get(stringifyObjectId(email._id)) || email);
	return {
		thread: updatedThread,
		changedEmails,
		selectedEmail: updatedById.get(selectedId) || selectedEmail,
	};
}

async function persistEmail(userId, host_id, normalized, data, ctx = {}) {
	if (!normalized.subject && !normalized.text_content && !normalized.html_content && !normalized.attachment_text_content) {
		throw new Error('Email content is empty after normalization');
	}

	const emailData = ctx.skipSideEffects && !ctx.applySpamGuard
		? data
		: await applyAccountSpamGuard(host_id, normalized, data);
	const payload = {
		...normalized,
		source: emailData.source === 'emailforwarding' ? 'emailforwarding' : 'api',
		mailbox: normalizeMailbox(emailData.mailbox),
		labels: normalizeLabels(emailData.labels),
		triaged: normalizeTriaged(emailData.triaged, Boolean(emailData.triaged_at)),
		triaged_at: emailData.triaged_at || null,
		triage_summary: String(emailData.triage_summary || ''),
		triage_reason: String(emailData.triage_reason || ''),
		triage_primary_action: normalizePrimaryAction(emailData.triage_primary_action),
		triage_confidence: emailData.triage_confidence === undefined ? null : Number(emailData.triage_confidence),
		triage_action_points: normalizeActionPoints(emailData.triage_action_points || []),
		triage_related_context: normalizeRelatedContext(emailData.triage_related_context || []),
		triage_mailbox_action: MAILBOX_ACTIONS.includes(emailData.triage_mailbox_action) ? emailData.triage_mailbox_action : 'none',
		triage_status: emailData.triage_status || '',
		triage_error: String(emailData.triage_error || ''),
		triage_run_id: String(emailData.triage_run_id || ''),
		project: emailData.project,
		owner: userId,
		host_id,
		is_indexed: false,
		in_trash: Boolean(emailData.in_trash),
		trashed_at: emailData.in_trash ? (emailData.trashed_at || new Date()) : null,
	};

	let email;
	let created = false;
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
			created = true;
		}
	} else {
		email = await Email.create(payload);
		created = true;
	}

	await createEmailThreadLinks(email, userId, host_id, { skipSideEffects: ctx.skipSideEffects });
	const bccReplyThreadUpdate = ctx.archiveBccReplyThread
		? await archiveBccReplyThread(host_id, email, { timestamps: !ctx.skipBackfillTimestamps })
		: null;
	if (bccReplyThreadUpdate?.selectedEmail) email = bccReplyThreadUpdate.selectedEmail;
	if (!ctx.skipSideEffects) {
		const changedEmails = bccReplyThreadUpdate?.changedEmails || [email];
		for (const changedEmail of changedEmails) {
			if (!changedEmail.in_trash) await indexEmailNow(host_id, changedEmail, { indexFn: ctx.indexEmailFn, updateFn: ctx.updateEmailIndexStateFn });
		}
		await emitEmailCreatedOrUpdated(host_id, created ? 'email:created' : 'email:updated', email, bccReplyThreadUpdate ? { thread: bccReplyThreadUpdate.thread } : {});
		invalidateGraphCache(host_id).catch(() => {});
		audit.log({ action: 'create', resource: 'email', resource_id: email._id.toString(), user_id: userId, host_id, ...ctx });
	}
	if (created && !ctx.skipSideEffects && !ctx.archiveBccReplyThread) {
		const autoTriage = maybeAutoTriageIncomingEmail(host_id, userId, email, {
			ctx,
			triageOptions: ctx.autoTriageOptions,
		}).catch((err) => {
			log.error({ err }, 'Incoming email auto-triage error');
			return null;
		});
		if (ctx.awaitAutoTriage) await autoTriage;
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
				$set: {
					name: label.name,
					color: label.color,
					is_system: true,
				},
				$setOnInsert: {
					slug: label.slug,
					host_id,
					is_active: true,
				},
			},
			upsert: true,
		},
	}));

	if (ops.length) await EmailLabel.bulkWrite(ops, { ordered: false });
	const labels = await EmailLabel.find({ host_id, is_active: { $ne: false } }).sort({ is_system: -1, name: 1 }).lean();
	return labels.sort((a, b) => {
		const aOrder = DEFAULT_EMAIL_LABEL_ORDER.has(a.slug) ? DEFAULT_EMAIL_LABEL_ORDER.get(a.slug) : Number.MAX_SAFE_INTEGER;
		const bOrder = DEFAULT_EMAIL_LABEL_ORDER.has(b.slug) ? DEFAULT_EMAIL_LABEL_ORDER.get(b.slug) : Number.MAX_SAFE_INTEGER;
		if (aOrder !== bOrder) return aOrder - bOrder;
		return String(a.name || '').localeCompare(String(b.name || ''));
	});
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

function emailSortTime(email = {}) {
	const value = email.createdAt || email.updatedAt;
	const time = value ? new Date(value).getTime() : 0;
	return Number.isFinite(time) ? time : 0;
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

function groupEmailsByThread(emails = []) {
	const byIdentifier = new Map();
	const groups = [];

	for (const email of emails) {
		const identifiers = emailThreadIdentifiers(email);
		const matchedGroups = [...new Set(identifiers.map((id) => byIdentifier.get(id)).filter((group) => group))];
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

	const relatedFindQuery = {
		host_id,
		in_trash: { $ne: true },
		$or: [
			{ message_id: { $in: identifiers } },
			{ references: { $in: identifiers } },
			{ in_reply_to: { $in: identifiers } },
		],
	};
	if (projectId) relatedFindQuery.project = projectId;
	const relatedQuery = Email.find(relatedFindQuery);
	let related = [];
	if (typeof relatedQuery.lean === 'function') {
		related = await relatedQuery.lean();
	} else if (typeof relatedQuery.sort === 'function') {
		related = await relatedQuery.sort({ updatedAt: -1 }).lean();
	} else if (typeof relatedQuery.select === 'function') {
		related = await relatedQuery.select('_id message_id references in_reply_to updatedAt createdAt').sort({ updatedAt: -1 }).lean();
	}
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

async function countEmailThreadsByQuery(query) {
	const emails = await Email.find(query).select('_id message_id references in_reply_to updatedAt createdAt').lean();
	return collapseEmailsByThread(emails).length;
}

export async function listEmails(host_id, projectId, { page = 1, limit = 50, mailbox, label, triaged } = {}) {
	const query = buildEmailListQuery(host_id, projectId, { mailbox, label, triaged });
	const safePage = Math.max(1, parseInt(page, 10) || 1);
	const safeLimit = Math.max(1, parseInt(limit, 10) || 50);

	const emails = await Email.find(query)
		.sort({ updatedAt: -1 })
		.lean();
	const collapsed = collapseEmailsByThread(emails);
	const withLatest = await attachLatestThreadEmails(host_id, projectId, collapsed);
	return withLatest.slice((safePage - 1) * safeLimit, safePage * safeLimit);
}

export async function listEmailIds(host_id, projectId, { mailbox, label, triaged } = {}) {
	const query = buildEmailListQuery(host_id, projectId, { mailbox, label, triaged });
	const emails = await Email.find(query)
		.select('_id message_id references in_reply_to updatedAt createdAt')
		.sort({ updatedAt: -1 })
		.lean();
	const collapsed = collapseEmailsByThread(emails);
	const withLatest = await attachLatestThreadEmails(host_id, projectId, collapsed);
	return withLatest.map((email) => email._id.toString());
}

function applyTriageStatusFilters(query, filters = {}) {
	const ids = parseCsvFilter(filters.ids);
	if (ids.length === 1) query._id = ids[0];
	if (ids.length > 1) query._id = { $in: ids };

	const messageIds = parseCsvFilter(filters.message_id).map(canonicalMessageId).filter(Boolean);
	if (messageIds.length === 1) query.message_id = messageIds[0];
	if (messageIds.length > 1) query.message_id = { $in: messageIds };

	const statuses = parseCsvFilter(filters.status || filters.triage_status).map(normalizeTriageStatus).filter(Boolean);
	if (statuses.length === 1) query.triage_status = statuses[0];
	if (statuses.length > 1) query.triage_status = { $in: statuses };

	const actions = parseCsvFilter(filters.primary_action || filters.triage_primary_action).map(normalizePrimaryAction).filter(Boolean);
	if (actions.length === 1) query.triage_primary_action = actions[0];
	if (actions.length > 1) query.triage_primary_action = { $in: actions };

	if (filters.run_id || filters.triage_run_id) query.triage_run_id = String(filters.run_id || filters.triage_run_id);
}

function stringifyObjectId(value) {
	if (!value) return null;
	return value.toString ? value.toString() : String(value);
}

function formatEmailTriageRun(run) {
	if (!run) return null;
	return {
		run_id: run.run_id || '',
		host_id: run.host_id || '',
		user_id: run.user_id || '',
		tenant_id: run.tenant_id || '',
		member_role: run.member_role || '',
		project: run.project || '',
		limit: run.limit || 0,
		status: run.status || 'queued',
		total: run.total || 0,
		processed: run.processed || 0,
		triaged: run.triaged || 0,
		drafted: run.drafted || 0,
		linked: run.linked || 0,
		moved: run.moved || 0,
		errors: run.errors || [],
		last_error: run.last_error || '',
		started_at: run.started_at || null,
		completed_at: run.completed_at || null,
		createdAt: run.createdAt || null,
		updatedAt: run.updatedAt || null,
	};
}

function emitEmailTriageRun(host_id, run) {
	const formatted = formatEmailTriageRun(run);
	if (formatted) emitToTenant(host_id, TRIAGE_RUN_EVENT, formatted);
	return formatted;
}

async function updateEmailTriageRun(host_id, runId, update) {
	const run = await EmailTriageRun.findOneAndUpdate(
		{ host_id, run_id: runId },
		update,
		{ returnDocument: 'after' },
	);
	return emitEmailTriageRun(host_id, run);
}

function formatEmailTriageStatus(email, { includeEmail = false, draft = undefined } = {}) {
	const status = {
		email_id: stringifyObjectId(email._id),
		message_id: email.message_id || '',
		subject: email.subject || '',
		from: email.from || [],
		to: email.to || [],
		project: stringifyObjectId(email.project),
		mailbox: email.mailbox || 'inbox',
		labels: email.labels || [],
		triaged: Boolean(email.triaged),
		triaged_at: email.triaged_at || null,
		triage_status: email.triage_status || '',
		triage_primary_action: email.triage_primary_action || '',
		triage_summary: email.triage_summary || '',
		triage_reason: email.triage_reason || '',
		triage_confidence: email.triage_confidence ?? null,
		triage_action_points: email.triage_action_points || [],
		triage_related_context: email.triage_related_context || [],
		triage_mailbox_action: email.triage_mailbox_action || 'none',
		triage_error: email.triage_error || '',
		triage_run_id: email.triage_run_id || '',
		triage_draft_id: stringifyObjectId(email.triage_draft_id),
		createdAt: email.createdAt || null,
		updatedAt: email.updatedAt || null,
	};

	if (includeEmail) status.email = email;
	if (draft !== undefined) status.draft = draft || null;
	return status;
}

async function formatEmailTriageStatuses(host_id, emails, includeValue) {
	const includes = parseTriageStatusIncludes(includeValue);
	const includeDraft = includes.has('draft');
	const draftMap = new Map();

	if (includeDraft) {
		const draftIds = emails.map((email) => stringifyObjectId(email.triage_draft_id)).filter(Boolean);
		if (draftIds.length) {
			const drafts = await EmailDraft.find({
				_id: { $in: draftIds },
				host_id,
				status: { $ne: 'discarded' },
			}).lean();
			for (const draft of drafts) draftMap.set(stringifyObjectId(draft._id), draft);
		}
	}

	return emails.map((email) => formatEmailTriageStatus(email, {
		includeEmail: includes.has('email'),
		draft: includeDraft ? (draftMap.get(stringifyObjectId(email.triage_draft_id)) || null) : undefined,
	}));
}

export async function listEmailTriageStatuses(host_id, {
	page = 1,
	limit = 50,
	project,
	mailbox,
	label,
	triaged,
	ids,
	message_id,
	status,
	triage_status,
	primary_action,
	triage_primary_action,
	run_id,
	triage_run_id,
	include,
} = {}) {
	const query = buildEmailListQuery(host_id, project, { mailbox, label, triaged });
	applyTriageStatusFilters(query, {
		ids,
		message_id,
		status,
		triage_status,
		primary_action,
		triage_primary_action,
		run_id,
		triage_run_id,
	});
	const emails = await Email.find(query)
		.sort({ updatedAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit)
		.lean();
	return formatEmailTriageStatuses(host_id, emails, include);
}

export async function getEmailTriageStatus(host_id, emailId, { include } = {}) {
	const email = await Email.findOne({ _id: emailId, host_id, in_trash: false }).lean();
	if (!email) return null;
	const statuses = await formatEmailTriageStatuses(host_id, [email], include);
	return statuses[0];
}

export async function getEmailTriageRun(host_id, runId) {
	const run = await EmailTriageRun.findOne({ host_id, run_id: String(runId || '') }).lean();
	return formatEmailTriageRun(run);
}

export async function listEmailLabels(host_id, filters = {}) {
	const labels = await ensureDefaultEmailLabels(host_id);
	const visibleLabels = labels.filter((label) => !HIDDEN_EMAIL_LABEL_SLUGS.has(label.slug));
	const projectId = filters.project || null;
	const baseQuery = { host_id, in_trash: false, ...(projectId ? { project: projectId } : {}) };

	const [mailboxCounts, labelCounts] = await Promise.all([
		Promise.all([
			countEmailThreadsByQuery(buildEmailListQuery(host_id, projectId, { mailbox: 'inbox', triaged: false })),
			countEmailThreadsByQuery(buildEmailListQuery(host_id, projectId, { mailbox: 'archived' })),
			countEmailThreadsByQuery(buildEmailListQuery(host_id, projectId, { mailbox: 'sent' })),
			countEmailThreadsByQuery(buildEmailListQuery(host_id, projectId, { mailbox: 'spam' })),
			EmailDraft.countDocuments({ host_id, status: { $nin: ['discarded', 'ready'] }, ...(projectId ? { project: projectId } : {}) }),
			countEmailThreadsByQuery({ host_id, in_trash: true, ...(projectId ? { project: projectId } : {}) }),
		]),
		Promise.all(visibleLabels.map(async (label) => ({
			slug: label.slug,
			count: await countEmailThreadsByQuery({ ...baseQuery, labels: label.slug }),
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
		labels: visibleLabels.map((label) => ({
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

async function updateRelatedThreadMailboxes(host_id, emailId, mailbox, selectedEmail) {
	const thread = await getEmailThread(host_id, emailId, { order: 'desc' });
	const selectedId = stringifyObjectId(selectedEmail?._id || emailId);
	const updatedById = new Map();
	const changedEmails = selectedEmail ? [selectedEmail] : [];
	if (selectedEmail) updatedById.set(selectedId, selectedEmail);
	const related = thread.filter((email) => {
		const id = stringifyObjectId(email._id);
		if (!id || id === selectedId) return false;
		if (email.in_trash === true) return false;
		if ((email.mailbox || 'inbox') === 'sent') return false;
		return (email.mailbox || 'inbox') !== mailbox;
	});

	for (const email of related) {
		const updated = await Email.findOneAndUpdate(
			{ _id: email._id, host_id, in_trash: { $ne: true }, mailbox: { $ne: 'sent' } },
			{ $set: { mailbox, is_indexed: false } },
			{ returnDocument: 'after' },
		);
		if (updated) {
			updatedById.set(stringifyObjectId(updated._id), updated);
			changedEmails.push(updated);
		}
	}

	return {
		thread: thread.map((email) => updatedById.get(stringifyObjectId(email._id)) || email),
		changedEmails,
	};
}

export async function updateEmail(host_id, emailId, data, ctx = {}) {
	const update = {};
	if (data.subject !== undefined) update.subject = data.subject;
	if (data.text_content !== undefined) update.text_content = data.text_content;
	if (data.html_content !== undefined || data.html !== undefined || data.body_html !== undefined) {
		const sanitized = normalizeHtmlContent(data.html_content ?? data.html ?? data.body_html);
		update.html_content = sanitized.html_content;
		update.html_content_has_remote_images = sanitized.html_content_has_remote_images;
	}
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

	const hasMailboxUpdate = data.mailbox !== undefined;
	const before = (ctx.user_id || hasMailboxUpdate) ? await Email.findOne({ _id: emailId, host_id }).lean() : null;
	if (hasMailboxUpdate && (before?.mailbox || 'inbox') === 'sent') delete update.mailbox;
	const shouldUpdateThreadMailbox = update.mailbox !== undefined;
	const email = await Email.findOneAndUpdate(
		{ _id: emailId, host_id },
		{ $set: update },
		{ returnDocument: 'after' },
	);

	if (email) {
		if (hasMailboxUpdate && update.mailbox === 'spam' && (before?.mailbox || 'inbox') !== 'sent') {
			await learnSpamGuardSenders(host_id, email.from || [], 'manual-spam');
			await enqueueEmailMailboxSync(host_id, email, 'spam', ctx);
		}
		if (hasMailboxUpdate && update.mailbox !== undefined && update.mailbox !== 'spam' && (before?.mailbox || 'inbox') === 'spam') {
			await forgetSpamGuardSenders(host_id, email.from || [], 'manual-not-spam');
		}
		const threadUpdate = shouldUpdateThreadMailbox ? await updateRelatedThreadMailboxes(host_id, emailId, update.mailbox, email) : null;
		const changedEmails = threadUpdate?.changedEmails || [email];

		if (!ctx.skipSideEffects) {
			for (const changedEmail of changedEmails) {
				await indexEmailNow(host_id, changedEmail, { indexFn: ctx.indexEmailFn, updateFn: ctx.updateEmailIndexStateFn });
			}
			await emitEmailCreatedOrUpdated(host_id, 'email:updated', email, threadUpdate ? { thread: threadUpdate.thread } : {});
			invalidateGraphCache(host_id).catch(() => {});
		}
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, email);
			audit.log({ action: 'update', resource: 'email', resource_id: emailId, host_id, details, ...ctx });
		}
	}

	return email;
}

export async function resetEmailTriage(host_id, emailId, ctx = {}) {
	const before = ctx.user_id ? await Email.findOne({ _id: emailId, host_id }).lean() : null;
	const email = await Email.findOneAndUpdate(
		{ _id: emailId, host_id },
		{
			$set: {
				mailbox: 'inbox',
				labels: [],
				triaged: false,
				triaged_at: null,
				triage_summary: '',
				triage_reason: '',
				triage_primary_action: '',
				triage_confidence: null,
				triage_action_points: [],
				triage_related_context: [],
				triage_mailbox_action: 'none',
				triage_status: '',
				triage_error: '',
				triage_run_id: '',
				triage_draft_id: null,
				in_trash: false,
				trashed_at: null,
				is_indexed: false,
			},
		},
		{ returnDocument: 'after' },
	);

	if (email) {
		await Promise.all([
			EmailDraft.updateMany(
				{ host_id, source_email: email._id, generated_by_triage: true, status: { $ne: 'discarded' } },
				{ $set: { status: 'discarded' } },
			),
			GraphLink.deleteMany({ host_id, source_id: email._id, source_type: 'emails', label: 'triage-context' }),
		]);
		if (!ctx.skipSideEffects) {
			await indexEmailNow(host_id, email, { indexFn: ctx.indexEmailFn, updateFn: ctx.updateEmailIndexStateFn });
			await emitEmailCreatedOrUpdated(host_id, 'email:updated', email);
			invalidateGraphCache(host_id).catch(() => {});
		}
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, email);
			audit.log({ action: 'update', resource: 'email', resource_id: emailId, host_id, details: { ...details, reset_triage: true }, ...ctx });
		}
	}

	return email;
}

export async function deleteEmail(host_id, emailId, ctx = {}) {
	const email = await Email.findOneAndUpdate(
		{ _id: emailId, host_id, in_trash: { $ne: true } },
		{ $set: { in_trash: true, trashed_at: new Date(), is_indexed: false } },
		{ returnDocument: 'after' },
	);
	if (email) {
		await removeEmailFromIndexNow(host_id, emailId, { removeFn: ctx.removeEmailIndexFn, updateFn: ctx.updateEmailIndexStateFn });
		removeLinksForItem(host_id, emailId).catch((err) => log.error({ err, host_id, email_id: emailId }, 'Remove links error'));
		emitToTenant(host_id, 'email:deleted', { _id: emailId });
		emitToTenant(host_id, 'counts:refresh');
		invalidateGraphCache(host_id).catch(() => {});
		await enqueueEmailMailboxSync(host_id, email, 'trash', ctx);
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'email', resource_id: emailId, host_id, ...ctx });
	}
	return email;
}

export async function emptySpam(host_id, ctx = {}) {
	const query = { host_id, mailbox: 'spam', in_trash: { $ne: true } };
	const emails = await Email.find(query).select('_id').lean();
	const ids = emails.map((email) => email._id?.toString ? email._id.toString() : String(email._id || '')).filter(Boolean);

	if (!ids.length) return { deleted: 0 };

	const result = await Email.deleteMany({ _id: { $in: ids }, host_id, mailbox: 'spam', in_trash: { $ne: true } });
	const deleted = result?.deletedCount ?? ids.length;

	await Promise.all(ids.map(async (id) => {
		await Promise.all([
			removeEmailFromIndexNow(host_id, id, { removeFn: ctx.removeEmailIndexFn, updateFn: ctx.updateEmailIndexStateFn }),
			removeLinksForItem(host_id, id).catch((err) => log.error({ err, host_id, email_id: id }, 'Remove links error')),
		]);
		emitToTenant(host_id, 'email:deleted', { _id: id });
	}));
	emitToTenant(host_id, 'counts:refresh');
	invalidateGraphCache(host_id).catch(() => {});
	if (ctx.user_id) audit.log({ action: 'delete', resource: 'email', resource_id: 'spam', host_id, details: { bulk: true, mailbox: 'spam', deleted }, ...ctx });

	return { deleted };
}

export async function searchEmails(host_id, query, options = {}) {
	return searchCollection(host_id, 'emails', query, {
		queryBy: 'embedding',
		...options,
	});
}

function exactTypesenseValue(value) {
	return '`' + String(value || '').replace(/`/g, '\\`') + '`';
}

function collectFromEmailSuggestions(result, query, limit) {
	const needle = String(query || '').trim().toLowerCase();
	const addresses = [];
	const seen = new Set();
	for (const hit of result?.hits || []) {
		const doc = hit.document || {};
		const candidates = doc.participant_emails?.length
			? doc.participant_emails
			: [
				...(doc.from_emails || []), ...(doc.from || []),
				...(doc.to_emails || []), ...(doc.to || []),
				...(doc.cc_emails || []), ...(doc.cc || []),
				...(doc.bcc_emails || []), ...(doc.bcc || []),
			];
		for (const address of normalizeRecipientList(candidates)) {
			if (needle && !address.includes(needle)) continue;
			if (seen.has(address)) continue;
			seen.add(address);
			addresses.push(address);
			if (addresses.length >= limit) return addresses;
		}
	}
	return addresses;
}

export async function suggestFromEmailAddresses(host_id, { query = '', project = '', limit = 10, searchFn = searchCollection } = {}) {
	const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 25);
	const q = String(query || '').trim().toLowerCase();
	const searchQuery = q || '*';

	async function runSearch(projectId) {
		return searchFn(host_id, 'emails', searchQuery, {
			queryBy: 'participant_emails,from,to,cc,bcc',
			perPage: 50,
			group: false,
			include_fields: 'participant_emails,from_emails,to_emails,cc_emails,bcc_emails,from,to,cc,bcc,project_id,updated_at',
			exclude_fields: 'embedding',
			filter_by: projectId ? `project_id:=${exactTypesenseValue(projectId)}` : undefined,
			extra: { sort_by: 'updated_at:desc', prefix: true },
		});
	}

	if (project) {
		const projectResult = await runSearch(String(project));
		const projectAddresses = collectFromEmailSuggestions(projectResult, q, cappedLimit);
		if (projectAddresses.length) return { addresses: projectAddresses, scope: 'project' };
	}

	const tenantResult = await runSearch('');
	return {
		addresses: collectFromEmailSuggestions(tenantResult, q, cappedLimit),
		scope: 'tenant',
	};
}

function normalizeEmailAiScope(scope = {}) {
	const mailbox = String(scope.mailbox || '').trim().toLowerCase();
	const normalized = {
		project: String(scope.project || scope.project_id || '').trim(),
		mailbox: ['inbox', 'archived', 'sent', 'spam', 'trash', 'drafts'].includes(mailbox) ? mailbox : '',
		label: String(scope.label || '').trim(),
		triaged: parseBooleanFilter(scope.triaged),
	};
	if (normalized.label) normalized.mailbox = '';
	return normalized;
}

function findEmailAddressNearWord(query, word) {
	const pattern = new RegExp(`\\b${word}[:\\s]+([^\\s,;]+@[^\\s,;]+)`, 'i');
	const match = String(query || '').match(pattern);
	return extractEmailAddress(match?.[1] || '');
}

function findEmailAiStatus(query) {
	const lower = String(query || '').toLowerCase();
	const pairs = [
		['reply-required', /\breply[-\s]?required\b|\breview\b/],
		['human-do', /\bhuman[-\s]?do\b|\bto[-\s]?do\b|\baction required\b/],
		['waiting', /\bwaiting\b/],
		['no-action', /\bno[-\s]?action\b|\bfyi\b/],
		['spam', /\bspam\b/],
	];
	return pairs.find(([, pattern]) => pattern.test(lower))?.[0] || '';
}

function findEmailAiMailbox(query) {
	const lower = String(query || '').toLowerCase();
	if (/\btrash(ed)?\b/.test(lower)) return 'trash';
	if (/\barchive(d)?\b/.test(lower)) return 'archived';
	if (/\bsent\b/.test(lower)) return 'sent';
	if (/\bspam\b/.test(lower)) return 'spam';
	if (/\binbox\b/.test(lower)) return 'inbox';
	return '';
}

function normalizeEmailAiSearchText(query, intent) {
	let text = String(query || '');
	for (const address of intent.email_addresses || []) {
		text = text.replace(new RegExp(address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
	}
	text = text
		.replace(/\b(show|find|search|list|get|give|display|me|all|emails?|messages?|from|to|cc|bcc|about|with|containing|that|mention|mentions|how many|count|number of|total|summari[sz]e|summary|this mailbox|this view|in this view)\b/gi, ' ')
		.replace(/\b(are|is|was|were|be|in|the|a|an|current)\b/gi, ' ')
		.replace(/[?!.,;:]+/g, ' ')
		.replace(/\breply[-\s]?required\b|\bhuman[-\s]?do\b|\bno[-\s]?action\b|\bwaiting\b|\bspam\b|\binbox\b|\barchive(d)?\b|\bsent\b|\btrash(ed)?\b/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text;
}

export function parseEmailAiQuery(query = '') {
	const raw = String(query || '').trim();
	const lower = raw.toLowerCase();
	const scopedViewRequest = /\b(this|current)\s+(mailbox|view)\b/i.test(raw);
	const emailAddresses = [...new Set((raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(extractEmailAddress).filter(Boolean))];
	const from = findEmailAddressNearWord(raw, 'from');
	const to = findEmailAddressNearWord(raw, 'to');
	const cc = findEmailAddressNearWord(raw, 'cc');
	const bcc = findEmailAddressNearWord(raw, 'bcc');
	const mode = /\b(how many|count|number of|total)\b/i.test(raw)
		? 'count'
		: (/\b(summari[sz]e|summary|recap)\b/i.test(raw) ? 'summary' : 'list');
	const intent = {
		mode,
		email_addresses: emailAddresses,
		from_email: from,
		to_email: to,
		cc_email: cc,
		bcc_email: bcc,
		participant_email: !from && !to && !cc && !bcc && emailAddresses.length ? emailAddresses[0] : '',
		status: findEmailAiStatus(raw),
		mailbox: findEmailAiMailbox(raw),
		explicit_all: /\b(all emails|all messages|every email|every message|across all emails|across every email)\b/i.test(raw),
	};
	intent.search_text = normalizeEmailAiSearchText(raw, intent);
	if (!intent.search_text && !intent.from_email && !intent.to_email && !intent.cc_email && !intent.bcc_email && !intent.participant_email && !intent.status && !intent.mailbox) {
		intent.search_text = lower.includes('recent') || scopedViewRequest ? '' : raw;
	}
	return intent;
}

export function buildEmailAiTypesenseFilter(scope = {}, intent = {}) {
	const normalizedScope = normalizeEmailAiScope(scope);
	const parts = [];
	if (normalizedScope.project) parts.push(`project_id:=${exactTypesenseValue(normalizedScope.project)}`);

	const scopedMailbox = intent.explicit_all ? '' : normalizedScope.mailbox;
	const scopedLabel = intent.explicit_all ? '' : normalizedScope.label;
	const scopedTriaged = intent.explicit_all ? null : normalizedScope.triaged;
	const mailbox = intent.mailbox || scopedMailbox;

	if (mailbox && mailbox !== 'drafts') {
		if (mailbox === 'trash') {
			parts.push('in_trash:=true');
		} else {
			parts.push(`mailbox:=${exactTypesenseValue(mailbox)}`);
		}
	}
	if (scopedLabel) parts.push(`labels:=${exactTypesenseValue(scopedLabel)}`);
	if (scopedTriaged !== null) parts.push(`triaged:=${scopedTriaged ? 'true' : 'false'}`);

	if (intent.status) {
		const status = exactTypesenseValue(intent.status);
		parts.push(`(labels:=${status} || triage_primary_action:=${status})`);
	}
	if (intent.from_email) parts.push(`from_emails:=${exactTypesenseValue(intent.from_email)}`);
	if (intent.to_email) parts.push(`to_emails:=${exactTypesenseValue(intent.to_email)}`);
	if (intent.cc_email) parts.push(`cc_emails:=${exactTypesenseValue(intent.cc_email)}`);
	if (intent.bcc_email) parts.push(`bcc_emails:=${exactTypesenseValue(intent.bcc_email)}`);
	if (intent.participant_email) parts.push(`participant_emails:=${exactTypesenseValue(intent.participant_email)}`);

	return parts.join(' && ');
}

function emailFromTypesenseDocument(document = {}) {
	const updatedAt = document.updated_at ? new Date(document.updated_at * 1000).toISOString() : null;
	const createdAt = document.created_at ? new Date(document.created_at * 1000).toISOString() : null;
	const actionPoints = (document.triage_action_points || []).map((item) => (typeof item === 'string' ? { text: item } : item));
	return {
		_id: document.source_id || document.id,
		id: document.source_id || document.id,
		project: document.project_id || '',
		subject: document.subject || '',
		from: document.from || [],
		to: document.to || [],
		cc: document.cc || [],
		bcc: document.bcc || [],
		mailbox: document.mailbox || 'inbox',
		labels: document.labels || [],
		triaged: Boolean(document.triaged),
		triage_status: document.triage_status || '',
		triage_summary: document.triage_summary || '',
		triage_primary_action: document.triage_primary_action || '',
		triage_action_points: actionPoints,
		message_id: document.message_id || '',
		text_content: document.text_content || '',
		attachment_text_content: document.attachment_text_content || '',
		createdAt,
		updatedAt,
	};
}

async function collectEmailAiTypesenseHits(host_id, query, filterBy, { limit, searchFn = searchCollection } = {}) {
	const all = [];
	const seen = new Set();
	let page = 1;
	while (all.length < limit) {
		const perPage = Math.min(250, limit - all.length);
		const result = await searchFn(host_id, 'emails', query || '*', {
			queryBy: query && query !== '*' ? 'embedding' : 'subject',
			perPage,
			page,
			filter_by: filterBy || undefined,
			include_fields: EMAIL_AI_INCLUDE_FIELDS,
			exclude_fields: 'embedding',
			extra: { sort_by: 'updated_at:desc' },
		});
		const hits = result?.hits || [];
		if (!hits.length) break;
		for (const hit of hits) {
			const document = hit.document || {};
			const id = document.source_id || document.id;
			if (!id || seen.has(id)) continue;
			seen.add(id);
			all.push(hit);
			if (all.length >= limit) break;
		}
		if (hits.length < perPage) break;
		page += 1;
	}
	return all;
}

function buildEmailAiAnswer({ mode, count, emails, query }) {
	if (mode === 'count') {
		return count === 1 ? 'I found 1 matching email.' : `I found ${count} matching emails.`;
	}
	if (!emails.length) return 'I found no matching emails.';
	const shown = emails.length === 1 ? '1 email' : `${emails.length} emails`;
	return `Showing ${shown} matching "${query}".`;
}

function cleanMailboxSummaryText(value, maxLength = 300) {
	return String(value || '')
		.replace(/\*\*/g, '')
		.replace(/^[-*]\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength);
}

function parseMailboxSummaryJson(content) {
	const raw = String(content || '').trim();
	const withoutFence = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
	const start = withoutFence.indexOf('{');
	const end = withoutFence.lastIndexOf('}');
	if (start === -1 || end <= start) return null;
	try {
		return JSON.parse(withoutFence.slice(start, end + 1));
	} catch {
		return null;
	}
}

function normalizeMailboxSummary(parsed, fallbackText = '') {
	if (!parsed || typeof parsed !== 'object') {
		const overview = cleanMailboxSummaryText(fallbackText, 500);
		return overview ? { overview, groups: [], next_steps: [] } : null;
	}

	const groups = Array.isArray(parsed.groups)
		? parsed.groups.slice(0, 4).map((group) => ({
			title: cleanMailboxSummaryText(group?.title, 80) || 'Other',
			items: Array.isArray(group?.items)
				? group.items.slice(0, 6).map((item) => ({
					subject: cleanMailboxSummaryText(item?.subject, 120),
					from: cleanMailboxSummaryText(item?.from, 120),
					summary: cleanMailboxSummaryText(item?.summary, 240),
					status: cleanMailboxSummaryText(item?.status, 120),
				})).filter((item) => item.subject || item.summary)
				: [],
		})).filter((group) => group.items.length)
		: [];

	const nextSteps = Array.isArray(parsed.next_steps)
		? parsed.next_steps.slice(0, 5).map((step) => cleanMailboxSummaryText(step, 180)).filter(Boolean)
		: [];
	const overview = cleanMailboxSummaryText(parsed.overview || fallbackText, 500);
	return overview || groups.length || nextSteps.length
		? { overview, groups, next_steps: nextSteps }
		: null;
}

async function summarizeEmailAiResults(host_id, prompt, emails, completionFn = emailAiCompletion) {
	const instructions = await getAiInstructions(host_id);
	const context = emails.slice(0, 20).map((email, index) => [
		`Email ${index + 1}`,
		`Subject: ${email.subject || '(No subject)'}`,
		`From: ${(email.from || []).join(', ') || '(unknown)'}`,
		email.triage_summary ? `Triage summary: ${email.triage_summary}` : '',
		`Excerpt: ${(email.text_content || email.attachment_text_content || '').slice(0, 800)}`,
	].filter(Boolean).join('\n')).join('\n\n');
	const content = await completionFn({
		hostId: host_id,
		scope: 'email',
		maxTokens: 900,
		messages: [
			{
				role: 'system',
				content: [
					'Answer as an email assistant summarizing a set of matched emails.',
					'Return only valid JSON, no Markdown, no bullet characters, no code fence.',
					'Use this shape: {"overview":"one concise sentence","groups":[{"title":"Needs attention","items":[{"subject":"email subject","from":"sender or sender domain","summary":"one concise sentence","status":"what matters or no action needed"}]}],"next_steps":["short action"]}.',
					'Group similar emails together. Prefer groups like Needs attention, Informational, Receipts, Releases, Tests, or Security. Keep item summaries short and useful.',
					'Use only the provided email list.',
					instructions.global ? `Global instructions:\n${instructions.global}` : '',
					instructions.email ? `Email AI instructions:\n${instructions.email}` : '',
				].filter(Boolean).join('\n\n'),
			},
			{ role: 'user', content: `Matched emails:\n${context || '(none)'}\n\nUser request:\n${prompt}` },
		],
	});
	const raw = String(content || '').trim();
	const summary = normalizeMailboxSummary(parseMailboxSummaryJson(raw), raw);
	return {
		answer: summary?.overview || cleanMailboxSummaryText(raw, 500) || 'I found matching emails, but could not summarize them.',
		summary,
	};
}

export async function askEmailListAi(host_id, query, scope = {}, options = {}) {
	const prompt = String(query || '').trim();
	if (!prompt) throw new Error('query required');
	const normalizedScope = normalizeEmailAiScope(scope);
	if (normalizedScope.mailbox === 'drafts') {
		return { answer: 'Email AI searches emails, not drafts.', count: 0, emails: [], mode: 'list', scope: normalizedScope };
	}

	const intent = parseEmailAiQuery(prompt);
	const searchQuery = intent.search_text ? intent.search_text : '*';
	const limit = intent.mode === 'count' ? EMAIL_AI_COUNT_LIMIT : EMAIL_AI_LIST_LIMIT;
	const searchFn = options.searchFn || searchCollection;
	let effectiveScope = normalizedScope;
	let contextScope = normalizedScope.project ? 'project' : 'all-projects';
	let filterBy = buildEmailAiTypesenseFilter(effectiveScope, intent);
	let hits = await collectEmailAiTypesenseHits(host_id, searchQuery, filterBy, {
		limit,
		searchFn,
	});
	if (intent.mode === 'summary' && normalizedScope.project && !hits.length) {
		effectiveScope = { ...normalizedScope, project: '' };
		contextScope = 'all-projects';
		filterBy = buildEmailAiTypesenseFilter(effectiveScope, intent);
		hits = await collectEmailAiTypesenseHits(host_id, searchQuery, filterBy, {
			limit,
			searchFn,
		});
	}
	const emails = hits.map((hit) => emailFromTypesenseDocument(hit.document || {}));
	const count = intent.mode === 'count' ? emails.length : emails.length;
	const mode = intent.mode === 'summary' ? 'summary' : (intent.mode === 'count' ? 'count' : (searchQuery === '*' ? 'list' : 'search'));
	let summary = null;
	let answer;
	if (intent.mode === 'summary' && emails.length) {
		const summaryResult = await summarizeEmailAiResults(host_id, prompt, emails, options.completionFn || emailAiCompletion);
		summary = summaryResult.summary;
		answer = summaryResult.answer;
	} else {
		answer = buildEmailAiAnswer({ mode, count, emails, query: prompt });
	}

	return {
		answer,
		count,
		emails: intent.mode === 'count' ? [] : emails,
		mode,
		scope: effectiveScope,
		context_scope: contextScope,
		summary,
	};
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

	const completionFn = options.completionFn || emailAiCompletion;
	const instructions = await getAiInstructions(host_id);
	const context = await buildEmailKnowledgeContext(host_id, email, {
		...options,
		query: emailAiContextSearchQuery(email, prompt),
	});
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
					`Retrieved Kumbukum context:\n${formatEmailKnowledgeContext(context) || 'No related context found.'}`,
					`User request:\n${prompt}`,
				].join('\n\n'),
			},
		],
	});

	return { answer: String(content || '').trim(), context_scope: context.context_scope };
}

export async function summarizeEmail(host_id, emailId, ctx = {}, options = {}) {
	const email = await Email.findOne({ _id: emailId, host_id, in_trash: false }).lean();
	if (!email) return null;

	const instructions = await getAiInstructions(host_id);
	const completionFn = options.completionFn || emailAiCompletion;
	const content = await completionFn({
		hostId: host_id,
		scope: 'email',
		maxTokens: 400,
		messages: [
			{
				role: 'system',
				content: [
					'Summarize the selected email in one or two concise sentences. Return only the summary text.',
					instructions.global ? `Global instructions:\n${instructions.global}` : '',
					instructions.email ? `Email AI instructions:\n${instructions.email}` : '',
				].filter(Boolean).join('\n\n'),
			},
			{ role: 'user', content: `Email context:\n${buildEmailContext(email)}` },
		],
	});
	const summary = String(content || '')
		.trim()
		.replace(/^summary\s*:\s*/i, '')
		.slice(0, 500);
	if (!summary) throw new Error('Email summary was empty');

	const updated = await updateEmail(host_id, emailId, { triage_summary: summary }, ctx);
	return { summary, email: updated };
}

export function parseEmailReplySuggestionsResult(text) {
	let parsed;
	try {
		parsed = JSON.parse(extractJsonObject(text));
	} catch {
		throw new Error('Reply suggestions response was not valid JSON');
	}

	const items = Array.isArray(parsed) ? parsed : parsed.replies;
	if (!Array.isArray(items)) throw new Error('Reply suggestions response must include replies');

	return items
		.map((item, index) => {
			if (typeof item === 'string') {
				return {
					title: `Reply ${index + 1}`,
					body_text: item.trim().slice(0, 12000),
				};
			}
			if (!item || typeof item !== 'object') return null;
			return {
				title: String(item.title || `Reply ${index + 1}`).trim().slice(0, 120),
				body_text: String(item.body_text || item.text || item.body || '').trim().slice(0, 12000),
			};
		})
		.filter((item) => item?.body_text)
		.slice(0, 2);
}

export async function suggestEmailReplies(host_id, emailId, options = {}) {
	const email = await Email.findOne({ _id: emailId, host_id, in_trash: false }).lean();
	if (!email) return null;

	const instructions = await getAiInstructions(host_id);
	const completionFn = options.completionFn || emailAiCompletion;
	const context = await buildEmailKnowledgeContext(host_id, email, options);
	const content = await completionFn({
		hostId: host_id,
		scope: 'email',
		maxTokens: 1400,
		messages: [
			{
				role: 'system',
				content: [
					'You write practical email replies. Return compact JSON only. Never send email.',
					instructions.global ? `Global instructions:\n${instructions.global}` : '',
					instructions.email ? `Email AI instructions:\n${instructions.email}` : '',
				].filter(Boolean).join('\n\n'),
			},
			{
				role: 'user',
				content: [
					'Create exactly two different reply options for this email.',
					'Return shape: {"replies":[{"title":"short label","body_text":"plain text reply"},{"title":"short label","body_text":"plain text reply"}]}.',
					'Keep each reply concise and ready to use.',
					`Email context:\n${buildEmailContext(email)}`,
					`Retrieved Kumbukum context:\n${formatEmailKnowledgeContext(context) || 'No related context found.'}`,
				].join('\n\n'),
			},
		],
	});
	const replies = parseEmailReplySuggestionsResult(content);
	if (!replies.length) throw new Error('No reply suggestions returned');
	return { replies, context_scope: context.context_scope };
}

async function resolveDraftReplyTargetEmail(host_id, email) {
	if (!email?._id) return email;
	const thread = await getEmailThread(host_id, email._id, { order: 'desc' });
	return thread.find((item) => (item.mailbox || 'inbox') !== 'sent') || email;
}

export async function useEmailReplySuggestion(host_id, emailId, data = {}, ctx = {}) {
	const email = await Email.findOne({ _id: emailId, host_id, in_trash: false }).lean();
	if (!email) return null;
	const replyTargetEmail = await resolveDraftReplyTargetEmail(host_id, email);

	const bodyHtml = data.body_html !== undefined || data.html !== undefined ? normalizeDraftHtml(data.body_html ?? data.html) : '';
	const bodyText = String(data.body_text || data.text || data.body || textFromDraftHtml(bodyHtml)).trim().slice(0, 12000);
	const subject = String(data.subject || '').trim().slice(0, 300) || `Re: ${replyTargetEmail.subject || '(No subject)'}`;
	const from = await resolveDraftFrom(host_id, replyTargetEmail.project, data.from, (replyTargetEmail.to || [])[0] || '');
	const to = data.to !== undefined ? normalizeDraftRecipientList(data.to, 'to') : normalizeDraftRecipientList(replyTargetEmail.from || [], 'to');
	const cc = data.cc !== undefined ? normalizeDraftRecipientList(data.cc, 'cc') : [];
	const bcc = data.bcc !== undefined ? normalizeDraftRecipientList(data.bcc, 'bcc') : [];
	const before = ctx.user_id
		? await EmailDraft.findOne({ source_email: replyTargetEmail._id, host_id, generated_by_triage: false, status: { $ne: 'discarded' } }).sort({ updatedAt: -1 }).lean()
		: null;
	const draft = await EmailDraft.findOneAndUpdate(
		{ source_email: replyTargetEmail._id, host_id, generated_by_triage: false, status: { $ne: 'discarded' } },
		{
			$set: {
				from,
				to,
				cc,
				bcc,
				subject,
				body_text: bodyText,
				body_html: bodyHtml,
				status: 'draft',
				confidence: null,
				project: replyTargetEmail.project,
				owner: ctx.user_id || replyTargetEmail.owner,
				host_id,
				generated_by_triage: false,
			},
		},
		{ upsert: true, sort: { updatedAt: -1 }, returnDocument: 'after' },
	);

	if (draft && ctx.user_id) {
		const details = audit.diffSnapshot(before, draft);
		audit.log({ action: 'update', resource: 'email_draft', resource_id: draft._id.toString(), host_id, details: { ...details, source: 'reply_suggestion' }, ...ctx });
	}
	await enqueueDraftSync(host_id, draft, 'draft.upsert', ctx);
	return draft;
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
	if (modified > 0) log.info({ updates: modified }, 'Email triage state backfilled');

	return {
		mailbox: mailboxResult?.modifiedCount || 0,
		in_trash: trashResult?.modifiedCount || 0,
		triaged_true: triagedTrueResult?.modifiedCount || 0,
		triaged_false: triagedFalseResult?.modifiedCount || 0,
	};
}

export async function backfillForwardedSentReplies() {
	const forwardDomain = String(config.emailForwardDomain || '').trim().replace(/^@+/, '').toLowerCase();
	if (!forwardDomain) return { sent_replies: 0 };

	const identities = await EmailIdentity.find({}).select('host_id project email').lean();
	let modified = 0;
	const seen = new Set();

	for (const identity of identities) {
		const projectId = identity.project?.toString ? identity.project.toString() : String(identity.project || '');
		const emailAddress = String(identity.email || '').trim().toLowerCase();
		if (!projectId || !emailAddress) continue;

		const forwardAddress = `${projectId}@${forwardDomain}`;
		const candidates = await Email.find(
			{
				host_id: identity.host_id,
				project: identity.project,
				source: 'emailforwarding',
				from: emailAddress,
				in_trash: { $ne: true },
				to: { $ne: forwardAddress },
				cc: { $ne: forwardAddress },
				mailbox: { $in: ['inbox', 'sent', 'archived'] },
				$or: [
					{ in_reply_to: { $type: 'string', $ne: '' } },
					{ references: { $exists: true, $not: { $size: 0 } } },
				],
			},
		).select('_id').lean();

		for (const candidate of candidates) {
			const id = stringifyObjectId(candidate._id);
			if (!id || seen.has(id)) continue;
			seen.add(id);
			const result = await archiveBccReplyThread(identity.host_id, candidate, { timestamps: false });
			for (const changedEmail of result?.changedEmails || []) {
				const changedId = stringifyObjectId(changedEmail._id);
				if (changedId) seen.add(changedId);
			}
			modified += result?.changedEmails?.length || 0;
		}
	}

	if (modified > 0) log.info({ updates: modified }, 'Forwarded BCC reply threads backfilled');
	return { sent_replies: modified };
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

function emailAiContextSearchQuery(email, prompt = '') {
	return [
		String(prompt || '').trim(),
		triageSearchQuery(email),
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

function currentProjectIdForEmailContext(email = {}, options = {}) {
	if (String(options.context_scope || options.contextScope || '').trim() === 'all-projects' || options.all_projects === true) {
		return '';
	}
	return stringifyObjectId(options.project || options.project_id || email.project?._id || email.project) || '';
}

async function buildEmailKnowledgeContext(host_id, email, options = {}) {
	const currentEmailId = stringifyObjectId(email?._id);
	const projectId = currentProjectIdForEmailContext(email, options);
	const query = String(options.query || triageSearchQuery(email)).trim() || '*';
	const searchKnowledgeFn = options.searchKnowledgeFn || ((hostId, searchQuery, searchOptions) => searchAll(hostId, searchQuery, searchOptions));
	const searchOptions = {
		perPage: options.perPage || 4,
		includeEmails: true,
		group: true,
		exclude_fields: 'embedding',
	};

	async function runSearch(scopedProjectId) {
		const scopedOptions = { ...searchOptions };
		if (scopedProjectId) scopedOptions.projectId = scopedProjectId;
		const results = await searchKnowledgeFn(host_id, query, scopedOptions);
		return {
			results,
			knowledge: flattenKnowledgeResults(results, currentEmailId),
		};
	}

	if (projectId) {
		const scoped = await runSearch(projectId).catch(() => ({ results: {}, knowledge: [] }));
		if (scoped.knowledge.length) {
			return {
				...scoped,
				context_scope: 'project',
				context_project_id: projectId,
				searched_project_first: true,
			};
		}
	}

	const fallback = await runSearch('').catch(() => ({ results: {}, knowledge: [] }));
	return {
		...fallback,
		context_scope: 'all-projects',
		context_project_id: projectId,
		searched_project_first: Boolean(projectId),
	};
}

function formatEmailKnowledgeContext(context = {}) {
	const lines = [];
	if (context.knowledge?.length) {
		const label = context.context_scope === 'project'
			? 'CURRENT-PROJECT KNOWLEDGE SEARCH'
			: 'ALL-PROJECT KNOWLEDGE SEARCH';
		lines.push(`${label}:`);
		for (const item of context.knowledge.slice(0, 10)) {
			lines.push(`- [${item.item_type}:${item.item_id}] ${item.title}: ${item.excerpt}`);
		}
	}
	return lines.join('\n').slice(0, 6000);
}

function formatTriageContext(context = {}) {
	const lines = [];
	if (context.thread?.length) {
		lines.push('THREAD EMAILS:');
		for (const item of context.thread.slice(0, 5)) {
			lines.push(`- [emails:${item.item_id}] ${item.title}: ${item.excerpt}`);
		}
	}
	const knowledgeText = formatEmailKnowledgeContext(context);
	if (knowledgeText) lines.push(knowledgeText);
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
	const getConnectionsFn = options.getConnectionsFn || getConnectionsForItem;
	const getThreadFn = options.getThreadFn || getEmailThread;
	const [knowledgeContext, thread, graph] = await Promise.all([
		buildEmailKnowledgeContext(host_id, email, options),
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

	return {
		knowledge: knowledgeContext.knowledge,
		prior_emails: knowledgeContext.knowledge.filter((item) => item.item_type === 'emails'),
		thread: threadItems,
		graph_connections: normalizeRelatedContext(graphItems),
		context_scope: knowledgeContext.context_scope,
		context_project_id: knowledgeContext.context_project_id,
		searched_project_first: knowledgeContext.searched_project_first,
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

async function runQueuedEmailTriage(host_id, userId, runId, options = {}) {
	await updateEmailTriageRun(host_id, runId, {
		$set: {
			status: 'running',
			started_at: new Date(),
			last_error: '',
		},
	});
	log.info({ host_id, user_id: userId, run_id: runId, project: options.project || '', limit: options.limit }, 'Email inbox triage run started');

	try {
		const result = await triageInboxEmails(host_id, userId, {
			...options,
			run_id: runId,
			onProgress: async (progress) => {
				await updateEmailTriageRun(host_id, runId, {
					$set: {
						status: 'running',
						total: progress.total,
						processed: progress.processed,
						triaged: progress.triaged,
						drafted: progress.drafted,
						linked: progress.linked,
						moved: progress.moved,
						errors: progress.errors,
					},
				});
			},
		});
		await updateEmailTriageRun(host_id, runId, {
			$set: {
				status: 'completed',
				total: result.processed,
				processed: result.processed,
				triaged: result.triaged,
				drafted: result.drafted,
				linked: result.linked,
				moved: result.moved,
				errors: result.errors,
				completed_at: new Date(),
				last_error: '',
			},
		});
		log.info({ host_id, user_id: userId, run_id: runId, processed: result.processed, triaged: result.triaged, errors: result.errors.length }, 'Email inbox triage run completed');
	} catch (err) {
		await updateEmailTriageRun(host_id, runId, {
			$set: {
				status: 'failed',
				last_error: err.message || String(err),
				completed_at: new Date(),
			},
		}).catch(() => {});
		log.error({ err, host_id, user_id: userId, run_id: runId }, 'Email inbox triage run failed');
	}
}

export async function startEmailTriageRun(host_id, userId, options = {}) {
	const limit = Math.min(parseInt(options.limit, 10) || 25, 100);
	const projectId = options.project || null;
	const runId = String(options.run_id || '').trim() || crypto.randomUUID();
	const query = buildEmailListQuery(host_id, projectId, { mailbox: 'inbox', triaged: false });
	const total = Math.min(await Email.countDocuments(query), limit);
	const run = await EmailTriageRun.create({
		run_id: runId,
		host_id,
		user_id: userId ? String(userId) : '',
		tenant_id: options.tenant_id ? String(options.tenant_id) : '',
		member_role: options.member_role ? String(options.member_role) : '',
		project: projectId ? String(projectId) : '',
		limit,
		status: 'queued',
		total,
		processed: 0,
		triaged: 0,
		drafted: 0,
		linked: 0,
		moved: 0,
		errors: [],
	});
	const formatted = emitEmailTriageRun(host_id, run);
	log.info({ host_id, user_id: userId, run_id: runId, project: projectId || '', limit, total, member_role: options.member_role || '' }, 'Email inbox triage run queued');

	setImmediate(() => {
		runQueuedEmailTriage(host_id, userId, runId, {
			project: projectId,
			limit,
			ctx: options.ctx,
			skipSideEffects: options.skipSideEffects,
			completionFn: options.completionFn,
			searchKnowledgeFn: options.searchKnowledgeFn,
			getThreadFn: options.getThreadFn,
			getConnectionsFn: options.getConnectionsFn,
			indexEmailFn: options.indexEmailFn,
			updateEmailIndexStateFn: options.updateEmailIndexStateFn,
		}).catch((err) => {
			log.error({ err, host_id, user_id: userId, run_id: runId }, 'Email inbox triage background dispatch failed');
		});
	});

	return formatted;
}

export async function triageInboxEmails(host_id, userId, options = {}) {
	await ensureDefaultEmailLabels(host_id);
	const limit = Math.min(parseInt(options.limit, 10) || 25, 100);
	const projectId = options.project || null;
	const query = buildEmailListQuery(host_id, projectId, { mailbox: 'inbox', triaged: false });
	if (options.email_id) query._id = options.email_id;
	const emails = await Email.find(query)
		.sort({ updatedAt: -1 })
		.limit(limit)
		.lean();

	const completionFn = options.completionFn || emailTriageCompletion;
	const instructions = await getAiInstructions(host_id);
	const results = [];
	const errors = [];
	const runId = String(options.run_id || '').trim() || crypto.randomUUID();
	let drafted = 0;
	let linked = 0;
	let moved = 0;

	async function notifyProgress() {
		if (typeof options.onProgress !== 'function') return;
		try {
			await options.onProgress({
				run_id: runId,
				total: emails.length,
				processed: results.length + errors.length,
				triaged: results.length,
				drafted,
				linked,
				moved,
				errors,
			});
		} catch (err) {
			log.warn({ err, host_id, run_id: runId }, 'Email triage progress callback failed');
		}
	}

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
				if (triage.primary_action === 'spam' || targetMailbox === 'spam') {
					await learnSpamGuardSenders(host_id, email.from || [], 'triage-spam');
					await enqueueEmailMailboxSync(host_id, updated, 'spam', options);
				}
				if (draft) drafted += 1;
				if (draft) await enqueueDraftSync(host_id, draft, 'draft.upsert', options);
				if (linkedCount) linked += linkedCount;
				if ((email.mailbox || 'inbox') !== updated.mailbox) moved += 1;
				if (!options.skipSideEffects) {
					await indexEmailNow(host_id, updated, { indexFn: options.indexEmailFn, updateFn: options.updateEmailIndexStateFn });
					await emitEmailCreatedOrUpdated(host_id, 'email:updated', updated);
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
			const failed = await Email.findOneAndUpdate(
				{ _id: email._id, host_id },
				{
					$set: {
						triage_status: 'failed',
						triage_error: err.message,
						triage_run_id: runId,
						is_indexed: false,
					},
				},
				{ returnDocument: 'after' },
			).catch(() => null);
			if (failed && !options.skipSideEffects) {
				await indexEmailNow(host_id, failed, { indexFn: options.indexEmailFn, updateFn: options.updateEmailIndexStateFn });
				await emitEmailCreatedOrUpdated(host_id, 'email:updated', failed);
			}
			errors.push({ email_id: email._id.toString(), error: err.message });
		}
		await notifyProgress();
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

	return { run_id: runId, processed: emails.length, triaged: results.length, drafted, linked, moved, errors, results };
}

export async function listEmailDrafts(host_id, { project, status, page = 1, limit = 50 } = {}) {
	const query = { host_id };
	if (project) query.project = project;
	if (status) query.status = status;
	else query.status = { $nin: ['discarded', 'ready'] };
	return EmailDraft.find(query)
		.sort({ updatedAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit)
		.lean();
}

export async function listEmailDraftIds(host_id, { project, status } = {}) {
	const query = { host_id };
	if (project) query.project = project;
	if (status) query.status = status;
	else query.status = { $nin: ['discarded', 'ready'] };
	const docs = await EmailDraft.find(query).select('_id').sort({ updatedAt: -1 }).lean();
	return docs.map((doc) => doc._id.toString());
}

export async function getEmailDraft(host_id, draftId) {
	return EmailDraft.findOne({ _id: draftId, host_id }).lean();
}

export async function updateEmailDraft(host_id, draftId, data, ctx = {}) {
	const update = {};
	const before = await EmailDraft.findOne({ _id: draftId, host_id }).lean();
	if (!before) return null;
	if (data.from !== undefined || !before.from) {
		const nextFrom = await resolveDraftFrom(host_id, before.project, data.from, before.from);
		if (nextFrom !== before.from) update.from = nextFrom;
	}
	if (data.to !== undefined) update.to = normalizeDraftRecipientList(data.to, 'to');
	if (data.cc !== undefined) update.cc = normalizeDraftRecipientList(data.cc, 'cc');
	if (data.bcc !== undefined) update.bcc = normalizeDraftRecipientList(data.bcc, 'bcc');
	if (data.subject !== undefined) update.subject = String(data.subject || '').trim();
	if (data.body_text !== undefined) update.body_text = String(data.body_text || '');
	if (data.body_html !== undefined) {
		update.body_html = normalizeDraftHtml(data.body_html);
		if (data.body_text === undefined) update.body_text = textFromDraftHtml(update.body_html);
	}
	if (data.status !== undefined && ['draft', 'ready', 'discarded'].includes(data.status)) update.status = data.status;
	if (Object.keys(update).length === 0) return before;

	const draft = await EmailDraft.findOneAndUpdate(
		{ _id: draftId, host_id },
		{ $set: update },
		{ returnDocument: 'after' },
	).lean();
	if (draft) {
		emitToTenant(host_id, 'email-draft:updated', draft);
		emitToTenant(host_id, 'counts:refresh');
		await enqueueDraftSync(host_id, draft, 'draft.upsert', ctx);
	}
	if (draft && ctx.user_id) {
		const details = audit.diffSnapshot(before, draft);
		audit.log({ action: 'update', resource: 'email_draft', resource_id: draftId, host_id, details, ...ctx });
	}
	return draft;
}

export async function discardEmailDraft(host_id, draftId, ctx = {}) {
	const before = await EmailDraft.findOne({ _id: draftId, host_id }).lean();
	if (!before) return null;
	const draft = await EmailDraft.findOneAndUpdate(
		{ _id: draftId, host_id },
		{ $set: { status: 'discarded' } },
		{ returnDocument: 'after' },
	).lean();
	if (draft) {
		emitToTenant(host_id, 'email-draft:updated', draft);
		emitToTenant(host_id, 'counts:refresh');
		await enqueueDraftSync(host_id, draft, 'draft.delete', ctx);
	}
	if (draft && ctx.user_id) {
		const details = audit.diffSnapshot(before, draft);
		audit.log({ action: 'delete', resource: 'email_draft', resource_id: draftId, host_id, details, ...ctx });
	}
	return draft;
}

function emailThreadSortTime(email) {
	const value = email.createdAt || email.updatedAt;
	const time = value ? new Date(value).getTime() : 0;
	return Number.isFinite(time) ? time : 0;
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

export async function getEmailThreadDraft(host_id, thread = []) {
	const sourceIds = thread.map((email) => stringifyObjectId(email._id)).filter(Boolean);
	if (!sourceIds.length) return null;
	return EmailDraft.findOne({
		host_id,
		source_email: { $in: sourceIds },
		status: { $ne: 'discarded' },
	})
		.sort({ updatedAt: -1 })
		.lean();
}
