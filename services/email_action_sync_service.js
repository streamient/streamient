import crypto from 'node:crypto';
import striptags from 'striptags';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailIdentity } from '../model/email_identity.js';
import { OutgoingEmail } from '../model/outgoing_email.js';
import { EmailExternalSyncState } from '../model/email_external_sync_state.js';
import { MongoQueue, MongoWorker } from '../modules/mongo_queue.js';
import { createLogger } from '../modules/logger.js';
import { syncHelpmonksAction } from './helpmonks_email_sync_service.js';
import { syncFastmailAction } from './fastmail_email_sync_service.js';

const log = createLogger('email-action-sync');
const SYNC_QUEUE = 'email_action_sync';
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function normalizeAddress(value) {
	return String(value || '').trim().toLowerCase();
}

function stringifyId(value) {
	return value?.toString ? value.toString() : String(value || '');
}

function isObjectId(value) {
	return OBJECT_ID_RE.test(stringifyId(value));
}

function stableJson(value) {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

function hashPayload(value) {
	return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function enabledProviders(identity) {
	const providers = [];
	if (identity?.helpmonks?.enabled && identity.helpmonks?.base_url && identity.helpmonks?.api_key) providers.push('helpmonks');
	if (identity?.fastmail?.enabled && identity.fastmail?.api_token) providers.push('fastmail');
	return providers;
}

function identityRecipientMatches(identity, email) {
	const identityEmail = normalizeAddress(identity.email);
	if (!identityEmail) return false;
	const recipients = [...(email?.to || []), ...(email?.cc || []), ...(email?.bcc || [])].map(normalizeAddress);
	return recipients.includes(identityEmail);
}

async function findIdentitiesForEmail(hostId, email) {
	if (!email?.project || !isObjectId(email.project)) return [];
	const identities = await EmailIdentity.find({
		host_id: hostId,
		project: email.project,
		$or: [
			{ 'helpmonks.enabled': true },
			{ 'fastmail.enabled': true },
		],
	}).lean();
	const enabled = identities.filter((identity) => enabledProviders(identity).length);
	const matching = enabled.filter((identity) => identityRecipientMatches(identity, email));
	if (matching.length) return matching;
	return enabled.length === 1 ? enabled : [];
}

async function findIdentityForDraft(hostId, draft) {
	const from = normalizeAddress(draft?.from);
	if (!from || !draft?.project || !isObjectId(draft.project)) return null;
	return EmailIdentity.findOne({ host_id: hostId, project: draft.project, email: from }).lean();
}

async function addSyncJob({ hostId, identity, provider, action, localType, localId }) {
	await MongoQueue.add(SYNC_QUEUE, {
		host_id: hostId,
		identity_id: stringifyId(identity._id),
		provider,
		action,
		local_type: localType,
		local_id: stringifyId(localId),
	}, { maxAttempts: 4 });
	await EmailExternalSyncState.findOneAndUpdate(
		{
			host_id: hostId,
			provider,
			local_type: localType,
			local_id: stringifyId(localId),
			identity: stringifyId(identity._id),
		},
		{
			$setOnInsert: {
				project: stringifyId(identity.project),
			},
			$set: {
				last_action: action,
				last_status: 'queued',
				last_error: '',
				last_skipped_reason: '',
			},
		},
		{ upsert: true },
	);
}

async function enqueueForIdentities(hostId, identities, action, localType, localId) {
	for (const identity of identities) {
		for (const provider of enabledProviders(identity)) {
			await addSyncJob({ hostId, identity, provider, action, localType, localId });
		}
	}
}

async function safeEnqueue(label, fn) {
	try {
		await fn();
	} catch (err) {
		log.warn({ err, label }, 'Email action sync enqueue skipped');
	}
}

export async function enqueueEmailMailboxSync(hostId, email, mailbox, ctx = {}) {
	if (ctx.skipExternalSync || ctx.skipSideEffects) return;
	const action = mailbox === 'spam' ? 'email.spam' : mailbox === 'trash' ? 'email.trash' : '';
	if (!action || !email?._id) return;
	await safeEnqueue(action, async () => {
		const identities = await findIdentitiesForEmail(hostId, email);
		if (!identities.length) {
			log.info({ host_id: hostId, email_id: stringifyId(email._id), action }, 'No matching external email identity for sync');
			return;
		}
		await enqueueForIdentities(hostId, identities, action, 'email', email._id);
	});
}

export async function enqueueDraftSync(hostId, draft, action, ctx = {}) {
	if (ctx.skipExternalSync || ctx.skipSideEffects || !draft?._id) return;
	if (!['draft.upsert', 'draft.delete'].includes(action)) return;
	await safeEnqueue(action, async () => {
		const identity = await findIdentityForDraft(hostId, draft);
		if (!identity || !enabledProviders(identity).length) return;
		await enqueueForIdentities(hostId, [identity], action, 'draft', draft._id);
	});
}

export async function enqueueReplySentSync(hostId, outgoing, ctx = {}) {
	if (ctx.skipExternalSync || !outgoing?._id) return;
	await safeEnqueue('reply.sent', async () => {
		const identity = await EmailIdentity.findOne({ _id: outgoing.email_identity, host_id: hostId }).lean();
		if (!identity || !enabledProviders(identity).length) return;
		await enqueueForIdentities(hostId, [identity], 'reply.sent', 'outgoing', outgoing._id);
	});
}

async function getState(job) {
	return EmailExternalSyncState.findOneAndUpdate(
		{
			host_id: job.host_id,
			provider: job.provider,
			local_type: job.local_type,
			local_id: job.local_id,
			identity: job.identity_id,
		},
		{
			$setOnInsert: {
				project: '',
			},
			$set: {
				last_action: job.action,
			},
		},
		{ upsert: true, returnDocument: 'after' },
	);
}

async function loadLocalContext(job) {
	if (job.local_type === 'email') {
		const email = await Email.findOne({ _id: job.local_id, host_id: job.host_id }).lean();
		return { email };
	}
	if (job.local_type === 'draft') {
		const draft = await EmailDraft.findOne({ _id: job.local_id, host_id: job.host_id }).lean();
		const sourceEmail = draft?.source_email ? await Email.findOne({ _id: draft.source_email, host_id: job.host_id }).lean() : null;
		return { draft, sourceEmail, email: sourceEmail };
	}
	if (job.local_type === 'outgoing') {
		const outgoing = await OutgoingEmail.findOne({ _id: job.local_id, host_id: job.host_id }).lean();
		const sourceEmail = outgoing?.source_email ? await Email.findOne({ _id: outgoing.source_email, host_id: job.host_id }).lean() : null;
		return { outgoing, sourceEmail };
	}
	return {};
}

function contextHash(job, context) {
	const { email, draft, outgoing, sourceEmail } = context;
	return hashPayload({
		action: job.action,
		provider: job.provider,
		email: email ? {
			id: stringifyId(email._id),
			message_id: email.message_id || '',
			references: email.references || [],
			in_reply_to: email.in_reply_to || '',
			mailbox: email.mailbox || '',
			in_trash: email.in_trash === true,
		} : null,
		draft: draft ? {
			id: stringifyId(draft._id),
			source_email: stringifyId(draft.source_email),
			from: draft.from || '',
			to: draft.to || [],
			cc: draft.cc || [],
			bcc: draft.bcc || [],
			subject: draft.subject || '',
			body_text: draft.body_text || '',
			body_html: draft.body_html || '',
			status: draft.status || '',
		} : null,
		outgoing: outgoing ? {
			id: stringifyId(outgoing._id),
			source_email: stringifyId(outgoing.source_email),
			message_id: outgoing.message_id || '',
			references: outgoing.references || [],
			in_reply_to: outgoing.in_reply_to || '',
			status: outgoing.status || '',
			sent_at: outgoing.sent_at || '',
		} : null,
		sourceEmail: sourceEmail ? {
			id: stringifyId(sourceEmail._id),
			message_id: sourceEmail.message_id || '',
			references: sourceEmail.references || [],
			in_reply_to: sourceEmail.in_reply_to || '',
		} : null,
	});
}

async function markState(state, update) {
	await EmailExternalSyncState.updateOne(
		{ _id: state._id },
		{ $set: update },
	);
	const obj = typeof state.toObject === 'function' ? state.toObject() : state;
	return { ...obj, ...update };
}

function publicText(value) {
	return striptags(String(value || ''), [], ' ').replace(/\s+/g, ' ').trim();
}

async function runProvider(job, identity, state, context, options = {}) {
	if (job.provider === 'helpmonks') {
		return syncHelpmonksAction({ identity, state, action: job.action, ...context, fetchFn: options.fetchFn });
	}
	if (job.provider === 'fastmail') {
		return syncFastmailAction({ identity, state, action: job.action, ...context, fetchFn: options.fetchFn });
	}
	return { skipped: true, reason: `unsupported_provider:${publicText(job.provider)}` };
}

export async function processEmailActionSyncJob(data, options = {}) {
	const job = data || {};
	const state = await getState(job);
	const identity = await EmailIdentity.findOne({ _id: job.identity_id, host_id: job.host_id }).lean();
	if (!identity) {
		return markState(state, {
			last_status: 'skipped',
			last_skipped_reason: 'identity_not_found',
			last_error: '',
		});
	}
	if (!enabledProviders(identity).includes(job.provider)) {
		return markState(state, {
			last_status: 'skipped',
			last_skipped_reason: 'provider_not_configured',
			last_error: '',
		});
	}

	const context = await loadLocalContext(job);
	if ((job.local_type === 'email' && !context.email) || (job.local_type === 'draft' && !context.draft) || (job.local_type === 'outgoing' && !context.outgoing)) {
		return markState(state, {
			last_status: 'skipped',
			last_skipped_reason: 'local_record_not_found',
			last_error: '',
		});
	}

	const hash = contextHash(job, context);
	if (state.last_status === 'synced' && state.last_action === job.action && state.last_synced_hash === hash) {
		return state;
	}

	try {
		const result = await runProvider(job, identity, state, context, options);
		if (result?.skipped) {
			return markState(state, {
				...result,
				last_status: 'skipped',
				last_skipped_reason: result.reason || '',
				last_error: '',
			});
		}
		return markState(state, {
			remote_conversation_id: result.remote_conversation_id ?? state.remote_conversation_id ?? '',
			remote_draft_id: result.remote_draft_id ?? state.remote_draft_id ?? '',
			remote_email_id: result.remote_email_id ?? state.remote_email_id ?? '',
			remote_thread_id: result.remote_thread_id ?? state.remote_thread_id ?? '',
			remote_mailbox_ids: result.remote_mailbox_ids ?? state.remote_mailbox_ids ?? null,
			last_action: job.action,
			last_status: 'synced',
			last_synced_hash: hash,
			last_synced_at: new Date(),
			last_error: '',
			last_error_at: null,
			last_skipped_reason: '',
		});
	} catch (err) {
		if (err?.skip) {
			return markState(state, {
				last_status: 'skipped',
				last_skipped_reason: err.reason || err.message || 'skipped',
				last_error: '',
			});
		}
		await markState(state, {
			last_status: 'error',
			last_error: err.message || String(err),
			last_error_at: new Date(),
		});
		throw err;
	}
}

export async function startEmailActionSyncWorker() {
	const worker = new MongoWorker(SYNC_QUEUE, {
		concurrency: parseInt(process.env.EMAIL_ACTION_SYNC_WORKER_CONCURRENCY, 10) || 3,
		handler: async (job) => processEmailActionSyncJob(job.data),
	});
	await worker.start();
	return worker;
}
