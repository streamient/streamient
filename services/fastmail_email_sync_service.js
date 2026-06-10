import { decrypt } from '../modules/encryption.js';

const DEFAULT_SESSION_URL = 'https://api.fastmail.com/jmap/session';
const DEFAULT_TIMEOUT_MS = 30000;
const MAIL_CAPABILITY = 'urn:ietf:params:jmap:mail';
const CORE_CAPABILITY = 'urn:ietf:params:jmap:core';

export class FastmailSyncSkip extends Error {
	constructor(reason) {
		super(reason);
		this.name = 'FastmailSyncSkip';
		this.reason = reason;
		this.skip = true;
	}
}

function normalizeMessageId(value) {
	return String(value || '').trim().replace(/^<+|>+$/g, '').trim();
}

function messageIdForHeader(value) {
	const id = normalizeMessageId(value);
	return id ? `<${id}>` : '';
}

function compactUnique(values) {
	return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function addressList(values) {
	return (values || [])
		.map((email) => String(email || '').trim())
		.filter(Boolean)
		.map((email) => ({ email }));
}

function collectMessageIds({ email, sourceEmail, outgoing } = {}) {
	const ids = [];
	for (const item of [email, sourceEmail, outgoing]) {
		if (!item) continue;
		ids.push(messageIdForHeader(item.message_id));
		ids.push(messageIdForHeader(item.in_reply_to));
		for (const ref of item.references || []) ids.push(messageIdForHeader(ref));
	}
	return compactUnique(ids);
}

function syncFetch(options) {
	return options.fetchFn || fetch;
}

async function fetchJson(url, options = {}) {
	const response = await syncFetch(options)(url, {
		...(options.request || {}),
		signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
	});
	const text = await response.text();
	const payload = text ? JSON.parse(text) : {};
	if (!response.ok) {
		const err = new Error(payload.detail || payload.error || payload.message || `Fastmail API ${response.status}`);
		err.status = response.status;
		throw err;
	}
	return payload;
}

async function getSession(identity, options = {}) {
	const token = decrypt(identity.fastmail?.api_token || '');
	if (!token) throw new FastmailSyncSkip('fastmail_not_configured');
	const sessionUrl = String(identity.fastmail?.session_url || DEFAULT_SESSION_URL).trim() || DEFAULT_SESSION_URL;
	const session = await fetchJson(sessionUrl, {
		fetchFn: options.fetchFn,
		request: {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		},
	});
	const accountId = String(identity.fastmail?.account_id || session.primaryAccounts?.[MAIL_CAPABILITY] || '').trim();
	if (!accountId) throw new FastmailSyncSkip('fastmail_account_missing');
	if (!session.apiUrl) throw new FastmailSyncSkip('fastmail_api_url_missing');
	return { token, session, accountId };
}

async function jmapCall(identity, methodCalls, options = {}) {
	const { token, session, accountId } = await getSession(identity, options);
	const calls = typeof methodCalls === 'function' ? methodCalls(accountId) : methodCalls;
	const payload = await fetchJson(session.apiUrl, {
		fetchFn: options.fetchFn,
		request: {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				using: [CORE_CAPABILITY, MAIL_CAPABILITY],
				methodCalls: calls,
			}),
		},
	});
	return { payload, accountId };
}

function getResponse(payload, callId, methodName = '') {
	const found = (payload.methodResponses || []).find((response) => response[2] === callId && (!methodName || response[0] === methodName));
	return found?.[1] || null;
}

async function getMailboxIds(identity, options = {}) {
	const { payload } = await jmapCall(identity, (accountId) => [
		['Mailbox/get', { accountId, ids: null, properties: ['id', 'name', 'role'] }, 'mailboxes'],
	], options);
	const mailboxes = getResponse(payload, 'mailboxes', 'Mailbox/get')?.list || [];
	const byRole = {};
	for (const mailbox of mailboxes) {
		if (mailbox.role) byRole[mailbox.role] = mailbox.id;
	}
	return byRole;
}

async function resolveEmailId(identity, state, context, options = {}) {
	if (state.remote_email_id) return state.remote_email_id;
	const messageIds = collectMessageIds(context);
	if (!messageIds.length) throw new FastmailSyncSkip('fastmail_email_unresolvable');

	for (const messageId of messageIds) {
		const { payload } = await jmapCall(identity, (accountId) => [
			['Email/query', {
				accountId,
				filter: { header: ['Message-ID', messageId] },
				limit: 1,
				position: 0,
			}, 'email_query'],
		], options);
		const ids = getResponse(payload, 'email_query', 'Email/query')?.ids || [];
		if (ids[0]) return ids[0];
	}
	throw new FastmailSyncSkip('fastmail_email_not_found');
}

function draftEmailObject(draft, draftMailboxId) {
	const hasHtml = Boolean(String(draft?.body_html || '').trim());
	const bodyPartId = hasHtml ? 'html' : 'text';
	return {
		mailboxIds: { [draftMailboxId]: true },
		keywords: { '$draft': true, '$seen': true },
		from: addressList([draft?.from || '']),
		to: addressList(draft?.to || []),
		cc: addressList(draft?.cc || []),
		bcc: addressList(draft?.bcc || []),
		subject: String(draft?.subject || ''),
		[hasHtml ? 'htmlBody' : 'textBody']: [{ partId: bodyPartId, type: hasHtml ? 'text/html' : 'text/plain' }],
		bodyValues: {
			[bodyPartId]: {
				value: String(hasHtml ? draft.body_html : draft?.body_text || ''),
				charset: 'utf-8',
			},
		},
	};
}

async function createFastmailDraft(identity, draft, mailboxIds, options = {}) {
	const draftObject = draftEmailObject(draft, mailboxIds.drafts);
	const { payload } = await jmapCall(identity, (accountId) => [
		['Email/set', { accountId, create: { draft: draftObject } }, 'draft_create'],
	], options);
	const response = getResponse(payload, 'draft_create', 'Email/set') || {};
	const id = response.created?.draft?.id;
	if (!id) throw new Error(JSON.stringify(response.notCreated?.draft || 'Fastmail draft create failed'));
	return id;
}

async function upsertFastmailDraft(identity, state, draft, mailboxIds, options = {}) {
	if (!state.remote_email_id) return createFastmailDraft(identity, draft, mailboxIds, options);
	const draftObject = draftEmailObject(draft, mailboxIds.drafts);
	const { payload } = await jmapCall(identity, (accountId) => [
		['Email/set', { accountId, update: { [state.remote_email_id]: draftObject } }, 'draft_update'],
	], options);
	const response = getResponse(payload, 'draft_update', 'Email/set') || {};
	if (response.updated?.[state.remote_email_id]) return state.remote_email_id;

	const { payload: destroyPayload } = await jmapCall(identity, (accountId) => [
		['Email/set', { accountId, destroy: [state.remote_email_id] }, 'draft_destroy'],
	], options);
	const destroyResponse = getResponse(destroyPayload, 'draft_destroy', 'Email/set') || {};
	if (destroyResponse.notDestroyed?.[state.remote_email_id]) throw new Error(JSON.stringify(destroyResponse.notDestroyed[state.remote_email_id]));
	return createFastmailDraft(identity, draft, mailboxIds, options);
}

export async function syncFastmailAction({ identity, state, action, email, draft, outgoing, sourceEmail, fetchFn } = {}) {
	const mailboxIds = await getMailboxIds(identity, { fetchFn });

	if (action === 'email.spam' || action === 'email.trash') {
		const targetRole = action === 'email.spam' ? 'junk' : 'trash';
		const targetMailboxId = mailboxIds[targetRole];
		if (!targetMailboxId) throw new FastmailSyncSkip(`fastmail_${targetRole}_mailbox_missing`);
		const remoteEmailId = await resolveEmailId(identity, state, { email }, { fetchFn });
		const { payload } = await jmapCall(identity, (accountId) => [
			['Email/set', { accountId, update: { [remoteEmailId]: { mailboxIds: { [targetMailboxId]: true } } } }, 'email_move'],
		], { fetchFn });
		const response = getResponse(payload, 'email_move', 'Email/set') || {};
		if (response.notUpdated?.[remoteEmailId]) throw new Error(JSON.stringify(response.notUpdated[remoteEmailId]));
		return {
			remote_email_id: remoteEmailId,
			remote_mailbox_ids: mailboxIds,
			result: response.updated?.[remoteEmailId] || null,
		};
	}

	if (action === 'reply.sent') {
		const remoteEmailId = await resolveEmailId(identity, state, { sourceEmail, outgoing }, { fetchFn });
		const { payload } = await jmapCall(identity, (accountId) => [
			['Email/set', { accountId, update: { [remoteEmailId]: { 'keywords/$seen': true } } }, 'email_seen'],
		], { fetchFn });
		const response = getResponse(payload, 'email_seen', 'Email/set') || {};
		if (response.notUpdated?.[remoteEmailId]) throw new Error(JSON.stringify(response.notUpdated[remoteEmailId]));
		return {
			remote_email_id: remoteEmailId,
			remote_mailbox_ids: mailboxIds,
			result: response.updated?.[remoteEmailId] || null,
		};
	}

	if (action === 'draft.upsert') {
		if (!draft) throw new FastmailSyncSkip('draft_not_found');
		if (!mailboxIds.drafts) throw new FastmailSyncSkip('fastmail_drafts_mailbox_missing');
		const remoteEmailId = await upsertFastmailDraft(identity, state, draft, mailboxIds, { fetchFn });
		return {
			remote_email_id: remoteEmailId,
			remote_mailbox_ids: mailboxIds,
		};
	}

	if (action === 'draft.delete') {
		if (!state.remote_email_id) {
			return {
				skipped: true,
				reason: 'fastmail_draft_id_missing',
				remote_mailbox_ids: mailboxIds,
			};
		}
		const { payload } = await jmapCall(identity, (accountId) => [
			['Email/set', { accountId, destroy: [state.remote_email_id] }, 'draft_destroy'],
		], { fetchFn });
		const response = getResponse(payload, 'draft_destroy', 'Email/set') || {};
		if (response.notDestroyed?.[state.remote_email_id]) throw new Error(JSON.stringify(response.notDestroyed[state.remote_email_id]));
		return {
			remote_email_id: '',
			remote_mailbox_ids: mailboxIds,
			result: response.destroyed || null,
		};
	}

	throw new FastmailSyncSkip(`unsupported_action:${action}`);
}
