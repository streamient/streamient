import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailIdentity } from '../model/email_identity.js';
import { OutgoingEmail } from '../model/outgoing_email.js';
import { MongoQueue } from '../modules/mongo_queue.js';
import * as outgoingEmailService from '../services/outgoing_email_service.js';

function queryResult(value) {
	return { lean: async () => value };
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
		originals.outgoingFindOne = OutgoingEmail.findOne;
		originals.outgoingCreate = OutgoingEmail.create;
		originals.outgoingFindOneAndUpdate = OutgoingEmail.findOneAndUpdate;
		originals.queueAdd = MongoQueue.add;
		originals.queueRemoveJob = MongoQueue.removeJob;
		originals.createTransport = nodemailer.createTransport;
	});

	afterEach(() => {
		Email.findOne = originals.emailFindOne;
		Email.findOneAndUpdate = originals.emailFindOneAndUpdate;
		Email.create = originals.emailCreate;
		EmailDraft.findOne = originals.draftFindOne;
		EmailDraft.findOneAndUpdate = originals.draftFindOneAndUpdate;
		EmailIdentity.findOne = originals.identityFindOne;
		OutgoingEmail.findOne = originals.outgoingFindOne;
		OutgoingEmail.create = originals.outgoingCreate;
		OutgoingEmail.findOneAndUpdate = originals.outgoingFindOneAndUpdate;
		MongoQueue.add = originals.queueAdd;
		MongoQueue.removeJob = originals.queueRemoveJob;
		nodemailer.createTransport = originals.createTransport;
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
	});
});
