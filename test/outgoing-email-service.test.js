import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailIdentity } from '../model/email_identity.js';
import { EmailExternalSyncState } from '../model/email_external_sync_state.js';
import { OutgoingEmail } from '../model/outgoing_email.js';
import { MongoQueue } from '../modules/mongo_queue.js';
import { encrypt } from '../modules/encryption.js';
import config from '../config.js';
import * as outgoingEmailService from '../services/outgoing_email_service.js';

function queryResult(value) {
	return { lean: async () => value };
}

function jsonResponse(payload, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => JSON.stringify(payload),
	};
}

describe('Outgoing email service', () => {
	const originals = {};

	beforeEach(() => {
		originals.emailFindOne = Email.findOne;
		originals.emailFindOneAndUpdate = Email.findOneAndUpdate;
		originals.emailCreate = Email.create;
		originals.draftFindOne = EmailDraft.findOne;
		originals.draftFindOneAndUpdate = EmailDraft.findOneAndUpdate;
		originals.identityFindOne = EmailIdentity.findOne;
		originals.externalSyncFindOne = EmailExternalSyncState.findOne;
		originals.externalSyncFindOneAndUpdate = EmailExternalSyncState.findOneAndUpdate;
		originals.externalSyncUpdateOne = EmailExternalSyncState.updateOne;
		originals.outgoingFindOne = OutgoingEmail.findOne;
		originals.outgoingCreate = OutgoingEmail.create;
		originals.outgoingFindOneAndUpdate = OutgoingEmail.findOneAndUpdate;
		originals.queueAdd = MongoQueue.add;
		originals.queueRemoveJob = MongoQueue.removeJob;
		originals.createTransport = nodemailer.createTransport;
		originals.smtpServers = config.smtp.servers;
		originals.smtpHost = config.smtp.host;
		originals.smtpPort = config.smtp.port;
		originals.smtpUser = config.smtp.user;
		originals.smtpPass = config.smtp.pass;
		originals.smtpFrom = config.smtp.from;
		originals.gitEncryptionKey = config.gitEncryptionKey;
		config.gitEncryptionKey = '12345678901234567890123456789012';
	});

	afterEach(() => {
		Email.findOne = originals.emailFindOne;
		Email.findOneAndUpdate = originals.emailFindOneAndUpdate;
		Email.create = originals.emailCreate;
		EmailDraft.findOne = originals.draftFindOne;
		EmailDraft.findOneAndUpdate = originals.draftFindOneAndUpdate;
		EmailIdentity.findOne = originals.identityFindOne;
		EmailExternalSyncState.findOne = originals.externalSyncFindOne;
		EmailExternalSyncState.findOneAndUpdate = originals.externalSyncFindOneAndUpdate;
		EmailExternalSyncState.updateOne = originals.externalSyncUpdateOne;
		OutgoingEmail.findOne = originals.outgoingFindOne;
		OutgoingEmail.create = originals.outgoingCreate;
		OutgoingEmail.findOneAndUpdate = originals.outgoingFindOneAndUpdate;
		MongoQueue.add = originals.queueAdd;
		MongoQueue.removeJob = originals.queueRemoveJob;
		nodemailer.createTransport = originals.createTransport;
		config.smtp.servers = originals.smtpServers;
		config.smtp.host = originals.smtpHost;
		config.smtp.port = originals.smtpPort;
		config.smtp.user = originals.smtpUser;
		config.smtp.pass = originals.smtpPass;
		config.smtp.from = originals.smtpFrom;
		config.gitEncryptionKey = originals.gitEncryptionKey;
	});

	it('queues a draft with a 10 second delayed job', async () => {
		const draft = {
			_id: 'draft-1',
			source_email: 'email-1',
			from: 'support@example.com',
			to: ['customer@example.com'],
			cc: [],
			bcc: [],
			subject: 'Re: Help',
			body_text: 'Reply body',
			body_html: '<p>Reply body</p>',
			project: 'project-1',
			owner: 'user-1',
			host_id: 'host-1',
		};
		const sourceEmail = {
			_id: 'email-1',
			message_id: 'source@example.net',
			references: ['root@example.net'],
			in_reply_to: '',
		};
		let queuedJob = null;
		let updatedDraft = null;
		let savedOutgoing = null;

		EmailDraft.findOne = () => queryResult(draft);
		Email.findOne = () => queryResult(sourceEmail);
		EmailIdentity.findOne = () => queryResult({ _id: 'identity-1', email: 'support@example.com', smtp: { host: 'smtp.example.com', port: 587 } });
		OutgoingEmail.findOne = () => queryResult(null);
		OutgoingEmail.create = async (payload) => {
			savedOutgoing = {
				_id: 'outgoing-1',
				...payload,
				save: async function () {
					return this;
				},
			};
			return savedOutgoing;
		};
		MongoQueue.add = async (queue, data, options) => {
			queuedJob = { queue, data, options };
			return { _id: options.jobId };
		};
		EmailDraft.findOneAndUpdate = () => ({
			lean: async () => {
				updatedDraft = { ...draft, status: 'ready' };
				return updatedDraft;
			},
		});

		const result = await outgoingEmailService.queueDraftSend('host-1', 'draft-1');

		assert.equal(result.outgoing_email._id, 'outgoing-1');
		assert.equal(savedOutgoing.in_reply_to, 'source@example.net');
		assert.deepEqual(savedOutgoing.references, ['root@example.net', 'source@example.net']);
		assert.equal(queuedJob.queue, 'send_outgoing_email');
		assert.deepEqual(queuedJob.data, { outgoing_email_id: 'outgoing-1' });
		assert.equal(queuedJob.options.delay, 10000);
		assert.equal(queuedJob.options.jobId, 'outgoing-1');
		assert.equal(updatedDraft.status, 'ready');
		assert.ok(new Date(result.abort_until).getTime() > Date.now());
	});

	it('rejects cancel once the queue job cannot be removed', async () => {
		OutgoingEmail.findOne = async () => ({
			_id: 'outgoing-1',
			host_id: 'host-1',
			status: 'queued',
			save: async function () {
				return this;
			},
		});
		MongoQueue.removeJob = async () => false;

		await assert.rejects(
			() => outgoingEmailService.cancelOutgoingEmail('host-1', 'outgoing-1'),
			/can no longer be canceled/,
		);
	});

	it('sends queued outgoing mail with reply headers and creates a sent email', async () => {
		let mailOptions = null;
		let createdEmail = null;
		let sourceUpdate = null;
		let syncJob = null;
		const outgoing = {
			_id: 'outgoing-1',
			draft: 'draft-1',
			source_email: 'email-1',
			email_identity: 'identity-1',
			from: 'support@example.com',
			to: ['customer@example.com'],
			cc: ['cc@example.com'],
			bcc: [],
			subject: 'Re: Help',
			body_text: 'Reply body',
			body_html: '<p>Reply body</p>',
			message_id: 'reply@example.com',
			in_reply_to: 'source@example.com',
			references: ['root@example.com', 'source@example.com'],
			project: 'project-1',
			owner: 'user-1',
			host_id: 'host-1',
			save: async function () {
				return this;
			},
		};

		OutgoingEmail.findOneAndUpdate = async () => outgoing;
		EmailIdentity.findOne = () => queryResult({
			_id: 'identity-1',
			name: 'Support',
			email: 'support@example.com',
			helpmonks: { enabled: false },
			fastmail: { enabled: true, api_token: 'fastmail-token' },
			smtp: { host: 'smtp.example.com', port: 587, auth_user: '', auth_password: '', tls: true, ssl: false },
		});
		nodemailer.createTransport = () => ({
			sendMail: async (options) => {
				mailOptions = options;
				return { accepted: ['customer@example.com'] };
			},
			close: () => {},
		});
		Email.create = async (payload) => {
			createdEmail = { _id: 'sent-email-1', ...payload };
			return createdEmail;
		};
		Email.findOneAndUpdate = async (filter, update) => {
			sourceUpdate = { filter, update };
			return {
				_id: filter._id,
				host_id: filter.host_id,
				mailbox: 'inbox',
				triaged: update.$set.triaged,
				triaged_at: update.$set.triaged_at,
				labels: ['reply-required', update.$addToSet.labels],
			};
		};
		EmailDraft.findOneAndUpdate = () => queryResult({ _id: 'draft-1', status: 'discarded' });
		MongoQueue.add = async (queue, data, options) => {
			syncJob = { queue, data, options };
			return { _id: 'sync-job-1' };
		};
		EmailExternalSyncState.findOneAndUpdate = async () => ({});

		const indexed = [];
		const result = await outgoingEmailService.processOutgoingEmail('outgoing-1', {
			indexEmailFn: async (hostId, type, email) => {
				indexed.push({ hostId, type, email });
			},
			updateEmailIndexStateFn: async () => {},
		});

		assert.equal(outgoing.status, 'sent');
		assert.equal(result.email._id, 'sent-email-1');
		assert.equal(mailOptions.messageId, '<reply@example.com>');
		assert.equal(mailOptions.inReplyTo, '<source@example.com>');
		assert.deepEqual(mailOptions.references, ['<root@example.com>', '<source@example.com>']);
		assert.equal(createdEmail.mailbox, 'sent');
		assert.equal(createdEmail.message_id, 'reply@example.com');
		assert.equal(createdEmail.in_reply_to, 'source@example.com');
		assert.deepEqual(sourceUpdate.filter, { _id: 'email-1', host_id: 'host-1', in_trash: false });
		assert.equal(sourceUpdate.update.$set.triaged, true);
		assert.ok(sourceUpdate.update.$set.triaged_at instanceof Date);
		assert.equal(sourceUpdate.update.$addToSet.labels, 'triaged');
		assert.deepEqual(indexed.map((item) => item.email._id), ['email-1', 'sent-email-1']);
		assert.equal(syncJob.queue, 'email_action_sync');
		assert.equal(syncJob.data.provider, 'fastmail');
		assert.equal(syncJob.data.action, 'reply.sent');
		assert.equal(syncJob.data.local_type, 'outgoing');
		assert.equal(syncJob.data.local_id, 'outgoing-1');
	});

	it('sends Helpmonks-backed outgoing mail through Helpmonks and clears the remote draft state', async () => {
		const calls = [];
		const syncJobs = [];
		let createdEmail = null;
		let sourceUpdate = null;
		let draftStateQuery = null;
		let draftStateUpdate = null;
		let createTransportCalled = false;
		const outgoing = {
			_id: 'outgoing-helpmonks',
			draft: 'draft-helpmonks',
			source_email: 'email-helpmonks',
			email_identity: 'identity-helpmonks',
			from: 'support@example.com',
			to: ['customer@example.com'],
			cc: ['cc@example.com'],
			bcc: [],
			subject: 'Re: Help',
			body_text: 'Reply body',
			body_html: '<p>Reply body</p>',
			message_id: 'reply-helpmonks@example.com',
			in_reply_to: 'source-helpmonks@example.com',
			references: ['source-helpmonks@example.com'],
			project: 'project-1',
			owner: 'user-1',
			host_id: 'host-1',
			save: async function () {
				return this;
			},
		};
		const sourceEmail = {
			_id: 'email-helpmonks',
			message_id: 'source-helpmonks@example.com',
			references: [],
			in_reply_to: '',
		};
		const identity = {
			_id: 'identity-helpmonks',
			name: 'Support',
			email: 'support@example.com',
			helpmonks: { enabled: true, base_url: 'https://helpmonks.example.com', api_key: encrypt('hm-key') },
			fastmail: { enabled: true, api_token: 'fastmail-token' },
			smtp: { host: 'smtp.example.com', port: 587 },
		};

		OutgoingEmail.findOneAndUpdate = async () => outgoing;
		EmailIdentity.findOne = () => queryResult(identity);
		Email.findOne = () => queryResult(sourceEmail);
		EmailExternalSyncState.findOne = (query) => {
			draftStateQuery = query;
			return queryResult({
				_id: 'draft-sync-state-1',
				remote_conversation_id: '507f1f77bcf86cd799439011',
				remote_draft_id: 'remote-draft-1',
			});
		};
		EmailExternalSyncState.updateOne = async (query, update) => {
			draftStateUpdate = { query, update };
			return { modifiedCount: 1 };
		};
		EmailExternalSyncState.findOneAndUpdate = async () => ({});
		nodemailer.createTransport = () => {
			createTransportCalled = true;
			throw new Error('SMTP should not be used for Helpmonks sends');
		};
		Email.create = async (payload) => {
			createdEmail = { _id: 'sent-email-helpmonks', ...payload };
			return createdEmail;
		};
		Email.findOneAndUpdate = async (filter, update) => {
			sourceUpdate = { filter, update };
			return {
				_id: filter._id,
				host_id: filter.host_id,
				mailbox: 'inbox',
				triaged: update.$set.triaged,
				triaged_at: update.$set.triaged_at,
				labels: ['triaged'],
			};
		};
		EmailDraft.findOneAndUpdate = () => queryResult({ _id: 'draft-helpmonks', status: 'discarded' });
		MongoQueue.add = async (queue, data, options) => {
			syncJobs.push({ queue, data, options });
			return { _id: 'sync-job-1' };
		};

		const result = await outgoingEmailService.processOutgoingEmail('outgoing-helpmonks', {
			fetchFn: async (url, options = {}) => {
				const parsed = new URL(url);
				calls.push({
					path: parsed.pathname,
					body: options.body ? JSON.parse(options.body) : null,
					authorization: options.headers.Authorization,
				});
				return jsonResponse({ success: true, results: { id: '507f1f77bcf86cd799439011', status: 'closed' } });
			},
			indexEmailFn: async () => {},
			updateEmailIndexStateFn: async () => {},
		});

		assert.equal(outgoing.status, 'sent');
		assert.equal(result.email._id, 'sent-email-helpmonks');
		assert.equal(createTransportCalled, false);
		assert.deepEqual(draftStateQuery, {
			host_id: 'host-1',
			provider: 'helpmonks',
			local_type: 'draft',
			local_id: 'draft-helpmonks',
			identity: 'identity-helpmonks',
		});
		assert.equal(calls.length, 1);
		assert.equal(calls[0].path, '/api/v1/conversation/reply');
		assert.equal(calls[0].authorization, `Basic ${Buffer.from('hm-key:').toString('base64')}`);
		assert.deepEqual(calls[0].body, {
			id: '507f1f77bcf86cd799439011',
			body: '<p>Reply body</p>',
			subject: 'Re: Help',
			to: ['customer@example.com'],
			cc: ['cc@example.com'],
			bcc: [],
			status_after: 'closed',
			draft_id: 'remote-draft-1',
		});
		assert.deepEqual(draftStateUpdate.query, { _id: 'draft-sync-state-1' });
		assert.equal(draftStateUpdate.update.$set.remote_draft_id, '');
		assert.equal(draftStateUpdate.update.$set.last_action, 'reply.sent');
		assert.equal(createdEmail.mailbox, 'sent');
		assert.deepEqual(sourceUpdate.filter, { _id: 'email-helpmonks', host_id: 'host-1', in_trash: false });
		assert.equal(syncJobs.length, 1);
		assert.equal(syncJobs[0].data.provider, 'fastmail');
		assert.equal(syncJobs[0].data.action, 'reply.sent');
	});

	it('restores the local draft when Helpmonks send fails', async () => {
		const calls = [];
		let draftUpdate = null;
		let errorSaved = null;
		let draftStateCleared = false;
		const outgoing = {
			_id: 'outgoing-helpmonks-error',
			draft: 'draft-helpmonks-error',
			source_email: 'email-helpmonks-error',
			email_identity: 'identity-helpmonks',
			from: 'support@example.com',
			to: ['customer@example.com'],
			cc: [],
			bcc: [],
			subject: 'Re: Help',
			body_text: 'Reply body',
			body_html: '<p>Reply body</p>',
			message_id: 'reply-helpmonks-error@example.com',
			in_reply_to: 'source-helpmonks-error@example.com',
			references: ['source-helpmonks-error@example.com'],
			host_id: 'host-1',
			save: async function () {
				errorSaved = { status: this.status, error: this.error };
				return this;
			},
		};

		OutgoingEmail.findOneAndUpdate = async () => outgoing;
		EmailIdentity.findOne = () => queryResult({
			_id: 'identity-helpmonks',
			email: 'support@example.com',
			helpmonks: { enabled: true, base_url: 'https://helpmonks.example.com', api_key: encrypt('hm-key') },
		});
		Email.findOne = () => queryResult({
			_id: 'email-helpmonks-error',
			message_id: 'source-helpmonks-error@example.com',
			references: [],
		});
		EmailExternalSyncState.findOne = () => queryResult({
			_id: 'draft-sync-state-error',
			remote_conversation_id: '507f1f77bcf86cd799439011',
			remote_draft_id: 'remote-draft-error',
		});
		EmailExternalSyncState.updateOne = async () => {
			draftStateCleared = true;
		};
		nodemailer.createTransport = () => {
			throw new Error('SMTP should not be used for Helpmonks sends');
		};
		Email.create = async () => {
			throw new Error('sent email should not be created after send failure');
		};
		EmailDraft.findOneAndUpdate = (filter, update) => {
			draftUpdate = { filter, update };
			return queryResult({ _id: filter._id, status: 'draft' });
		};

		const result = await outgoingEmailService.processOutgoingEmail('outgoing-helpmonks-error', {
			fetchFn: async (url, options = {}) => {
				const parsed = new URL(url);
				calls.push({
					path: parsed.pathname,
					body: options.body ? JSON.parse(options.body) : null,
				});
				return jsonResponse({ success: false, error: 'Helpmonks send failed' }, 500);
			},
		});

		assert.equal(result, null);
		assert.equal(outgoing.status, 'error');
		assert.equal(errorSaved.status, 'error');
		assert.match(errorSaved.error, /Helpmonks send failed/);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].path, '/api/v1/conversation/reply');
		assert.equal(draftUpdate.filter._id, 'draft-helpmonks-error');
		assert.equal(draftUpdate.update.$set.status, 'draft');
		assert.equal(draftStateCleared, false);
	});

	it('routes an identity with use_system_smtp through the shared system SMTP transport', async () => {
		let systemTransportArgs = null;
		let mailOptions = null;
		let closeCalled = false;
		config.smtp.servers = [{
			name: 'system-test',
			host: 'smtp.system.example.com',
			port: 587,
			secure: false,
			user: 'sys-user',
			pass: 'sys-pass',
			from: 'hi@kumbukum.com',
		}];

		const outgoing = {
			_id: 'outgoing-2',
			draft: 'draft-2',
			source_email: 'email-2',
			email_identity: 'identity-2',
			from: 'support@example.com',
			to: ['customer@example.com'],
			cc: [],
			bcc: [],
			subject: 'Hello',
			body_text: 'Body',
			body_html: '<p>Body</p>',
			message_id: 'msg@example.com',
			in_reply_to: '',
			references: [],
			project: 'project-1',
			owner: 'user-1',
			host_id: 'host-1',
			save: async function () {
				return this;
			},
		};

		OutgoingEmail.findOneAndUpdate = async () => outgoing;
		EmailIdentity.findOne = () => queryResult({
			_id: 'identity-2',
			name: 'Support',
			email: 'support@example.com',
			use_system_smtp: true,
			smtp: { host: '', port: 587, auth_user: '', auth_password: '', tls: false, ssl: false },
		});
		nodemailer.createTransport = (args) => {
			systemTransportArgs = args;
			return {
				sendMail: async (options) => {
					mailOptions = options;
					return { accepted: ['customer@example.com'] };
				},
				close: () => {
					closeCalled = true;
				},
			};
		};
		Email.create = async (payload) => ({ _id: 'sent-email-2', ...payload });
		Email.findOneAndUpdate = async (filter, update) => ({
			_id: filter._id,
			host_id: filter.host_id,
			mailbox: 'inbox',
			triaged: update.$set.triaged,
			triaged_at: update.$set.triaged_at,
			labels: [],
		});
		EmailDraft.findOneAndUpdate = () => queryResult({ _id: 'draft-2', status: 'discarded' });

		const result = await outgoingEmailService.processOutgoingEmail('outgoing-2', {
			indexEmailFn: async () => {},
			updateEmailIndexStateFn: async () => {},
		});

		assert.equal(outgoing.status, 'sent');
		assert.equal(result.email._id, 'sent-email-2');
		// Used the system SMTP server, not the (empty) identity SMTP.
		assert.equal(systemTransportArgs.host, 'smtp.system.example.com');
		assert.deepEqual(systemTransportArgs.auth, { user: 'sys-user', pass: 'sys-pass' });
		// From address stays the identity email (DNS handled separately).
		assert.equal(mailOptions.from, 'Support <support@example.com>');
		// Shared transporter must not be closed by the caller.
		assert.equal(closeCalled, false);
	});

	it('fails to send when use_system_smtp is set but no system SMTP is configured', async () => {
		config.smtp.servers = [];
		config.smtp.host = '';
		config.smtp.port = 587;
		config.smtp.user = '';
		config.smtp.pass = '';
		config.smtp.from = '';
		let errorSaved = null;
		const outgoing = {
			_id: 'outgoing-3',
			email_identity: 'identity-3',
			from: 'support@example.com',
			to: ['customer@example.com'],
			cc: [],
			bcc: [],
			subject: 'Hello',
			body_html: '<p>Body</p>',
			references: [],
			host_id: 'host-1',
			save: async function () {
				errorSaved = { status: this.status, error: this.error };
				return this;
			},
		};
		OutgoingEmail.findOneAndUpdate = async () => outgoing;
		EmailIdentity.findOne = () => queryResult({
			_id: 'identity-3',
			email: 'support@example.com',
			use_system_smtp: true,
			smtp: { host: '', port: 587 },
		});
		EmailDraft.findOneAndUpdate = () => queryResult({ _id: 'draft-3', status: 'draft' });

		const result = await outgoingEmailService.processOutgoingEmail('outgoing-3');
		assert.equal(result, null);
		assert.equal(errorSaved.status, 'error');
		assert.match(errorSaved.error, /System SMTP is not configured/);
	});
});
