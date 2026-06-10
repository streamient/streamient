import { decrypt } from '../modules/encryption.js';

const DEFAULT_TIMEOUT_MS = 30000;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export class HelpmonksSyncSkip extends Error {
	constructor(reason) {
		super(reason);
		this.name = 'HelpmonksSyncSkip';
		this.reason = reason;
		this.skip = true;
	}
}

function normalizeBaseUrl(value) {
	return String(value || '').trim().replace(/\/+$/g, '');
}

function normalizeMessageId(value) {
	return String(value || '').trim().replace(/^<+|>+$/g, '').trim();
}

function messageIdVariants(value) {
	const id = normalizeMessageId(value);
	if (!id) return [];
	return [id, `<${id}>`];
}

function compactUnique(values) {
	return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function objectIdCandidates(messageIds) {
	const found = [];
	for (const value of messageIds) {
		for (const match of String(value || '').matchAll(/[a-f0-9]{24}/ig)) {
			if (!found.includes(match[0])) found.push(match[0]);
		}
	}
	return found;
}

function syncFetch(options) {
	return options.fetchFn || fetch;
}

async function requestHelpmonks(identity, path, { method = 'GET', body = null, fetchFn } = {}) {
	const baseUrl = normalizeBaseUrl(identity.helpmonks?.base_url);
	const apiKey = decrypt(identity.helpmonks?.api_key || '');
	if (!baseUrl || !apiKey) throw new HelpmonksSyncSkip('helpmonks_not_configured');

	let lastError = null;
	for (const authMode of ['basic', 'access_token']) {
		try {
			return await requestHelpmonksWithAuth({ baseUrl, apiKey, path, method, body, fetchFn, authMode });
		} catch (err) {
			lastError = err;
			if (authMode === 'basic' && err.status === 401) continue;
			throw err;
		}
	}
	throw lastError;
}

async function requestHelpmonksWithAuth({ baseUrl, apiKey, path, method, body, fetchFn, authMode }) {
	const headers = { 'Content-Type': 'application/json' };
	if (authMode === 'access_token') {
		headers['x-access-token'] = apiKey;
	} else {
		headers.Authorization = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
	}
	const response = await syncFetch({ fetchFn })(`${baseUrl}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
	});
	const text = await response.text();
	const payload = text ? JSON.parse(text) : {};
	if (!response.ok || payload.success === false) {
		const message = payload.error || payload.message || `Helpmonks API ${response.status}`;
		const err = new Error(message);
		err.status = response.status;
		throw err;
	}
	return payload;
}

function collectMessageIds({ email, sourceEmail, outgoing } = {}) {
	const ids = [];
	for (const item of [email, sourceEmail, outgoing]) {
		if (!item) continue;
		ids.push(...messageIdVariants(item.message_id));
		ids.push(...messageIdVariants(item.in_reply_to));
		for (const ref of item.references || []) ids.push(...messageIdVariants(ref));
	}
	return compactUnique(ids);
}

async function resolveConversation(identity, state, context, options = {}) {
	if (state.remote_conversation_id) return state.remote_conversation_id;
	const messageIds = collectMessageIds(context);
	const idCandidates = objectIdCandidates(messageIds);
	const or = [];
	for (const id of idCandidates) {
		if (OBJECT_ID_RE.test(id)) or.push({ _id: id });
	}
	if (messageIds.length) {
		or.push({ 'emails.message_id': { $in: messageIds } });
		or.push({ 'emails.message_id_customer': { $in: messageIds } });
		or.push({ 'emails.message_id_original': { $in: messageIds } });
	}
	if (!or.length) throw new HelpmonksSyncSkip('helpmonks_conversation_unresolvable');

	const result = await requestHelpmonks(identity, '/api/v1/conversation/findone', {
		method: 'POST',
		body: {
			query: { $or: or },
			fields: '_id status mark_read mailbox_id emails.message_id emails.message_id_customer emails.message_id_original',
			options: { lean: true },
		},
		fetchFn: options.fetchFn,
	});
	const conversation = result.results;
	const id = conversation?._id?.toString ? conversation._id.toString() : String(conversation?._id || '');
	if (!id) throw new HelpmonksSyncSkip('helpmonks_conversation_not_found');
	return id;
}

function draftBody(draft) {
	return String(draft?.body_html || draft?.body_text || '');
}

export async function syncHelpmonksAction({ identity, state, action, email, draft, outgoing, sourceEmail, fetchFn } = {}) {
	const conversationId = await resolveConversation(identity, state, { email, sourceEmail, outgoing }, { fetchFn });

	if (action === 'email.spam' || action === 'email.trash') {
		const status = action === 'email.spam' ? 'spam' : 'trash';
		const result = await requestHelpmonks(identity, `/api/v1/conversation/status/${encodeURIComponent(conversationId)}/${status}`, { fetchFn });
		return {
			remote_conversation_id: conversationId,
			result: result.results || null,
		};
	}

	if (action === 'draft.upsert') {
		if (!draft) throw new HelpmonksSyncSkip('draft_not_found');
		const result = await requestHelpmonks(identity, '/api/v1/conversation/draft/save', {
			method: 'POST',
			body: {
				id: conversationId,
				draft_id: state.remote_draft_id || undefined,
				body: draftBody(draft),
				subject: draft.subject || '',
				to: draft.to || [],
				cc: draft.cc || [],
				bcc: draft.bcc || [],
				draft_type: 'reply',
			},
			fetchFn,
		});
		const remoteDraftId = result.results?._id?.toString ? result.results._id.toString() : String(result.results?._id || state.remote_draft_id || '');
		return {
			remote_conversation_id: conversationId,
			remote_draft_id: remoteDraftId,
			result: result.results || null,
		};
	}

	if (action === 'draft.delete') {
		if (!state.remote_draft_id) {
			return {
				remote_conversation_id: conversationId,
				skipped: true,
				reason: 'helpmonks_draft_id_missing',
			};
		}
		const result = await requestHelpmonks(identity, `/api/v1/conversation/draft/delete/${encodeURIComponent(state.remote_draft_id)}`, { fetchFn });
		return {
			remote_conversation_id: conversationId,
			remote_draft_id: '',
			result: result.results || null,
		};
	}

	if (action === 'reply.sent') {
		await requestHelpmonks(identity, '/api/v1/conversation/update', {
			method: 'POST',
			body: { id: conversationId, mark_read: true },
			fetchFn,
		});
		const result = await requestHelpmonks(identity, `/api/v1/conversation/status/${encodeURIComponent(conversationId)}/closed`, { fetchFn });
		return {
			remote_conversation_id: conversationId,
			result: result.results || null,
		};
	}

	throw new HelpmonksSyncSkip(`unsupported_action:${action}`);
}
