import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import striptags from 'striptags';
import config from '../config.js';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailIdentity } from '../model/email_identity.js';
import { OutgoingEmail } from '../model/outgoing_email.js';
import { MongoQueue, MongoWorker } from '../modules/mongo_queue.js';
import { decrypt } from '../modules/encryption.js';
import { emitToTenant } from '../modules/socket.js';
import { invalidateGraphCache } from './graph_service.js';
import { indexEmailNow } from './email_index_service.js';
import { createSystemTransport } from './email_service.js';
import { buildEmailRealtimePayload, emitEmailCreatedOrUpdated } from './email_ingest_service.js';
import * as audit from './audit_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('email-send');

const SEND_QUEUE = 'send_outgoing_email';
const SEND_DELAY_MS = 10000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeAddress(value) {
	return String(value || '').trim().toLowerCase();
}

function assertRecipients(label, values) {
	if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} is required`);
	for (const value of values) {
		if (!EMAIL_RE.test(normalizeAddress(value))) throw new Error(`${label} contains invalid email address`);
	}
}

function canonicalMessageId(value) {
	return String(value || '').trim().replace(/^<|>$/g, '');
}

function messageIdForHeader(value) {
	const id = canonicalMessageId(value);
	return id ? `<${id}>` : '';
}

function appMessageDomain() {
	try {
		return new URL(config.appUrl).hostname || 'kumbukum.local';
	} catch {
		return 'kumbukum.local';
	}
}

function createMessageId() {
	return `${crypto.randomUUID()}-${Date.now()}@${appMessageDomain()}`;
}

function buildThreadHeaders(sourceEmail) {
	const sourceMessageId = canonicalMessageId(sourceEmail?.message_id);
	const references = [];
	for (const ref of sourceEmail?.references || []) {
		const canonical = canonicalMessageId(ref);
		if (canonical && !references.includes(canonical)) references.push(canonical);
	}
	if (sourceMessageId && !references.includes(sourceMessageId)) references.push(sourceMessageId);
	return {
		in_reply_to: sourceMessageId || canonicalMessageId(sourceEmail?.in_reply_to),
		references,
	};
}

function publicOutgoing(outgoing) {
	if (!outgoing) return null;
	const obj = typeof outgoing.toObject === 'function' ? outgoing.toObject() : { ...outgoing };
	return {
		...obj,
		_id: obj._id?.toString ? obj._id.toString() : obj._id,
		draft: obj.draft?.toString ? obj.draft.toString() : obj.draft,
		source_email: obj.source_email?.toString ? obj.source_email.toString() : obj.source_email,
		email_identity: obj.email_identity?.toString ? obj.email_identity.toString() : obj.email_identity,
		project: obj.project?.toString ? obj.project.toString() : obj.project,
		owner: obj.owner?.toString ? obj.owner.toString() : obj.owner,
	};
}

function emitDraft(hostId, event, draft) {
	emitToTenant(hostId, event, draft);
	emitToTenant(hostId, 'counts:refresh');
}

function emitOutgoing(hostId, event, outgoing, extra = {}) {
	emitToTenant(hostId, event, { outgoing_email: publicOutgoing(outgoing), ...extra });
}

async function findIdentityForDraft(hostId, draft) {
	const from = normalizeAddress(draft.from);
	if (!from) throw new Error('From address is required');
	const identity = await EmailIdentity.findOne({ host_id: hostId, project: draft.project, email: from }).lean();
	if (!identity) throw new Error('Selected From address is not configured for this project');
	return identity;
}

async function createTransport(identity) {
	if (identity.use_system_smtp) {
		const system = createSystemTransport();
		if (!system) throw new Error('System SMTP is not configured');
		return { transport: system.transporter, shared: true };
	}
	const smtp = identity.smtp || {};
	const transport = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port || 587,
		secure: Boolean(smtp.ssl),
		requireTLS: Boolean(smtp.tls),
		auth: smtp.auth_user
			? { user: smtp.auth_user, pass: decrypt(smtp.auth_password || '') }
			: undefined,
	});
	return { transport, shared: false };
}

export async function queueDraftSend(hostId, draftId, ctx = {}) {
	const draft = await EmailDraft.findOne({ _id: draftId, host_id: hostId, status: { $ne: 'discarded' } }).lean();
	if (!draft) return null;
	assertRecipients('To', draft.to);
	for (const field of ['cc', 'bcc']) {
		for (const value of draft[field] || []) {
			if (!EMAIL_RE.test(normalizeAddress(value))) throw new Error(`${field} contains invalid email address`);
		}
	}
	if (!String(draft.subject || '').trim()) throw new Error('Subject is required');
	if (!String(draft.body_text || draft.body_html || '').trim()) throw new Error('Message body is required');

	const [sourceEmail, identity] = await Promise.all([
		Email.findOne({ _id: draft.source_email, host_id: hostId }).lean(),
		findIdentityForDraft(hostId, draft),
	]);
	if (!sourceEmail) throw new Error('Source email not found');

	const existing = await OutgoingEmail.findOne({ host_id: hostId, draft: draft._id, status: { $in: ['queued', 'sending'] } }).lean();
	if (existing) {
		return { outgoing_email: publicOutgoing(existing), abort_until: existing.send_after };
	}

	const headers = buildThreadHeaders(sourceEmail);
	const sendAfter = new Date(Date.now() + SEND_DELAY_MS);
	const outgoing = await OutgoingEmail.create({
		draft: draft._id,
		source_email: sourceEmail._id,
		email_identity: identity._id,
		from: normalizeAddress(draft.from),
		to: draft.to.map(normalizeAddress),
		cc: (draft.cc || []).map(normalizeAddress),
		bcc: (draft.bcc || []).map(normalizeAddress),
		subject: String(draft.subject || '').trim(),
		body_text: String(draft.body_text || ''),
		body_html: String(draft.body_html || ''),
		message_id: createMessageId(),
		in_reply_to: headers.in_reply_to,
		references: headers.references,
		status: 'queued',
		send_after: sendAfter,
		project: draft.project,
		owner: draft.owner,
		host_id: hostId,
	});
	const job = await MongoQueue.add(SEND_QUEUE, { outgoing_email_id: outgoing._id.toString() }, { jobId: outgoing._id.toString(), delay: SEND_DELAY_MS, maxAttempts: 3 });
	outgoing.queue_job_id = String(job?._id || outgoing._id);
	await outgoing.save();
	const updatedDraft = await EmailDraft.findOneAndUpdate(
		{ _id: draft._id, host_id: hostId },
		{ $set: { status: 'ready' } },
		{ returnDocument: 'after' },
	).lean();
	emitDraft(hostId, 'email-draft:updated', updatedDraft);
	emitOutgoing(hostId, 'outgoing-email:queued', outgoing, { abort_until: sendAfter });
	log.info({ host_id: hostId, outgoing_id: outgoing._id.toString(), to: outgoing.to.length, cc: outgoing.cc.length, bcc: outgoing.bcc.length, send_after: sendAfter.toISOString() }, 'Outgoing email queued');
	if (ctx.user_id) {
		audit.log({ action: 'create', resource: 'outgoing_email', resource_id: outgoing._id.toString(), host_id: hostId, details: { draft_id: draft._id.toString() }, ...ctx });
	}
	return { outgoing_email: publicOutgoing(outgoing), abort_until: sendAfter };
}

export async function cancelOutgoingEmail(hostId, outgoingId, ctx = {}) {
	const outgoing = await OutgoingEmail.findOne({ _id: outgoingId, host_id: hostId });
	if (!outgoing) return null;
	if (outgoing.status !== 'queued') {
		const err = new Error('Outgoing email can no longer be canceled');
		err.status = 409;
		throw err;
	}
	const removed = await MongoQueue.removeJob(outgoing._id.toString());
	if (!removed) {
		const err = new Error('Outgoing email can no longer be canceled');
		err.status = 409;
		throw err;
	}
	outgoing.status = 'canceled';
	await outgoing.save();
	const draft = await EmailDraft.findOneAndUpdate(
		{ _id: outgoing.draft, host_id: hostId },
		{ $set: { status: 'draft' } },
		{ returnDocument: 'after' },
	).lean();
	emitDraft(hostId, 'email-draft:updated', draft);
	emitOutgoing(hostId, 'outgoing-email:canceled', outgoing, { draft });
	if (ctx.user_id) {
		audit.log({ action: 'update', resource: 'outgoing_email', resource_id: outgoing._id.toString(), host_id: hostId, details: { status: 'canceled' }, ...ctx });
	}
	return { outgoing_email: publicOutgoing(outgoing), draft };
}

async function markOutgoingError(outgoing, error) {
	outgoing.status = 'error';
	outgoing.error = error?.message || String(error);
	await outgoing.save();
	const draft = await EmailDraft.findOneAndUpdate(
		{ _id: outgoing.draft, host_id: outgoing.host_id },
		{ $set: { status: 'draft' } },
		{ returnDocument: 'after' },
	).lean();
	emitDraft(outgoing.host_id, 'email-draft:updated', draft);
	emitOutgoing(outgoing.host_id, 'outgoing-email:error', outgoing, { draft, error: outgoing.error });
	emitToTenant(outgoing.host_id, 'counts:refresh');
}

async function markSourceEmailHandled(outgoing, options = {}) {
	const handledAt = new Date();
	const sourceEmail = await Email.findOneAndUpdate(
		{ _id: outgoing.source_email, host_id: outgoing.host_id, in_trash: false },
		{
			$set: {
				triaged: true,
				triaged_at: handledAt,
				is_indexed: false,
			},
			$addToSet: {
				labels: 'triaged',
			},
		},
		{ returnDocument: 'after' },
	);
	if (!sourceEmail) return null;
	await indexEmailNow(outgoing.host_id, sourceEmail, {
		indexFn: options.indexEmailFn,
		updateFn: options.updateEmailIndexStateFn,
	});
	await emitEmailCreatedOrUpdated(outgoing.host_id, 'email:updated', sourceEmail);
	return sourceEmail;
}

export async function processOutgoingEmail(outgoingId, options = {}) {
	const outgoing = await OutgoingEmail.findOneAndUpdate(
		{ _id: outgoingId, status: 'queued', send_after: { $lte: new Date() } },
		{ $set: { status: 'sending', error: '' }, $inc: { attempts: 1 } },
		{ returnDocument: 'after' },
	);
	if (!outgoing) return null;
	const sendStartedAt = Date.now();
	log.info({ host_id: outgoing.host_id, outgoing_id: outgoing._id.toString(), attempts: outgoing.attempts, to: outgoing.to.length }, 'Sending outgoing email');
	try {
		const identity = await EmailIdentity.findOne({ _id: outgoing.email_identity, host_id: outgoing.host_id }).lean();
		if (!identity) throw new Error('Email identity not found');
		const { transport, shared } = await createTransport(identity);
		const html = outgoing.body_html || '';
		const text = outgoing.body_text || (html ? striptags(html, [], ' ').replace(/\s+/g, ' ').trim() : '');
		const mailOptions = {
			from: identity.name ? `${identity.name} <${outgoing.from}>` : outgoing.from,
			to: outgoing.to,
			cc: outgoing.cc?.length ? outgoing.cc : undefined,
			bcc: outgoing.bcc?.length ? outgoing.bcc : undefined,
			replyTo: outgoing.from,
			subject: outgoing.subject,
			text,
			html: html || undefined,
			messageId: messageIdForHeader(outgoing.message_id),
			inReplyTo: messageIdForHeader(outgoing.in_reply_to) || undefined,
			references: outgoing.references.map(messageIdForHeader).filter(Boolean),
		};
		await transport.sendMail(mailOptions);
		if (!shared) transport.close?.();

		outgoing.status = 'sent';
		outgoing.sent_at = new Date();
		await outgoing.save();
		const sentEmail = await Email.create({
			message_id: outgoing.message_id,
			references: outgoing.references,
			in_reply_to: outgoing.in_reply_to,
			from: [outgoing.from],
			to: outgoing.to,
			cc: outgoing.cc,
			bcc: outgoing.bcc,
			subject: outgoing.subject,
			text_content: text,
			html_content: html,
			html_content_has_remote_images: false,
			attachment_text_content: '',
			source: 'api',
			raw_hash: '',
			mailbox: 'sent',
			labels: [],
			triaged: true,
			project: outgoing.project,
			owner: outgoing.owner,
			host_id: outgoing.host_id,
			is_indexed: false,
			in_trash: false,
		});
		const draft = await EmailDraft.findOneAndUpdate(
			{ _id: outgoing.draft, host_id: outgoing.host_id },
			{ $set: { status: 'discarded' } },
			{ returnDocument: 'after' },
		).lean();
		const sourceEmail = await markSourceEmailHandled(outgoing, options);
		await indexEmailNow(outgoing.host_id, sentEmail, {
			indexFn: options.indexEmailFn,
			updateFn: options.updateEmailIndexStateFn,
		});
		invalidateGraphCache(outgoing.host_id).catch(() => {});
		const sentEmailPayload = await buildEmailRealtimePayload(outgoing.host_id, sentEmail);
		const sourceEmailPayload = sourceEmail ? await buildEmailRealtimePayload(outgoing.host_id, sourceEmail) : null;
		emitToTenant(outgoing.host_id, 'email:created', sentEmailPayload);
		emitDraft(outgoing.host_id, 'email-draft:updated', draft);
		emitOutgoing(outgoing.host_id, 'outgoing-email:sent', outgoing, { email: sentEmailPayload, draft, source_email: sourceEmailPayload });
		emitToTenant(outgoing.host_id, 'counts:refresh');
		log.info({ host_id: outgoing.host_id, outgoing_id: outgoing._id.toString(), message_id: outgoing.message_id, duration_ms: Date.now() - sendStartedAt }, 'Outgoing email sent');
		return { outgoing_email: publicOutgoing(outgoing), email: sentEmail };
	} catch (err) {
		log.error({ err, host_id: outgoing.host_id, outgoing_id: outgoing._id.toString(), attempts: outgoing.attempts, duration_ms: Date.now() - sendStartedAt }, 'Outgoing email send failed');
		await markOutgoingError(outgoing, err);
		return null;
	}
}

export async function startOutgoingEmailWorker() {
	const worker = new MongoWorker(SEND_QUEUE, {
		concurrency: parseInt(process.env.OUTGOING_EMAIL_WORKER_CONCURRENCY, 10) || 5,
		handler: async (job) => processOutgoingEmail(job.data.outgoing_email_id),
	});
	await worker.start();
	return worker;
}
