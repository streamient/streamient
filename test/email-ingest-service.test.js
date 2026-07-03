import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { GraphLink } from '../model/graph_link.js';
import { Email } from '../model/email.js';
import { ingestEmail, matchesEmailFilter, parseEmailInput, parseForwardedEmailInput } from '../services/email_ingest_service.js';

describe('Email ingest storage service', () => {
	const originalEmailFindOne = Email.findOne;
	const originalEmailCreate = Email.create;
	const originalEmailFind = Email.find;
	const originalGraphLinkUpdateOne = GraphLink.updateOne;

	beforeEach(() => {
		Email.findOne = async () => null;
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});
		GraphLink.updateOne = async () => ({ upsertedCount: 0 });
	});

	afterEach(() => {
		Email.findOne = originalEmailFindOne;
		Email.create = originalEmailCreate;
		Email.find = originalEmailFind;
		GraphLink.updateOne = originalGraphLinkUpdateOne;
	});

	it('matches project email filter rules by sender or subject', () => {
		const filter = 'spam@bad.com\n@noisy.com\nsubject: status update';

		assert.equal(matchesEmailFilter(filter, ['spam@bad.com']), true);
		assert.equal(matchesEmailFilter(filter, ['hello@noisy.com']), true);
		assert.equal(matchesEmailFilter(filter, { from: ['friend@example.com'], subject: 'Weekly status update' }), true);
		assert.equal(matchesEmailFilter(filter, { from: ['friend@example.com'], subject: 'Other' }), false);
		assert.equal(matchesEmailFilter('', ['spam@bad.com']), false);
	});

	it('normalizes parsed email input', async () => {
		const normalized = await parseEmailInput({
			parsed_email: {
				message_id: '<Message-1@Example.com>',
				from: 'Sender <sender@example.com>',
				to: 'Team <team@example.com>',
				subject: 'Stored',
				html: '<p>Hello <strong>mail</strong></p>',
			},
		});

		assert.equal(normalized.message_id, 'message-1@example.com');
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['team@example.com']);
		assert.equal(normalized.text_content, 'Hello mail');
		assert.match(normalized.html_content, /<p>Hello <strong>mail<\/strong><\/p>/);
	});

	it('normalizes forwarded email input without attachment extraction', () => {
		const normalized = parseForwardedEmailInput({
			messageId: '<forwarded@example.com>',
			from: 'Sender <sender@example.com>',
			to: 'Project <project@example.com>',
			subject: 'Forwarded',
			html: '<p>Forwarded body</p>',
			attachments: [{ filename: 'ignored.txt', content: 'ignored' }],
		});

		assert.equal(normalized.message_id, 'forwarded@example.com');
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['project@example.com']);
		assert.equal(normalized.text_content, 'Forwarded body');
		assert.equal(normalized.attachment_text_content, '');
	});

	it('stores email without triage or reply fields', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => 'email-1' }, ...payload };
		};

		await ingestEmail('507f1f77bcf86cd799439012', 'host-1', {
			project: '507f1f77bcf86cd799439011',
			mailbox: 'inbox',
			labels: ['Needs Review'],
			parsed_email: {
				message_id: '<stored@example.com>',
				from: 'sender@example.com',
				to: 'project@example.com',
				subject: 'Stored',
				text: 'Stored body',
			},
		}, { skipSideEffects: true });

		assert.equal(createdPayload.project, '507f1f77bcf86cd799439011');
		assert.equal(createdPayload.mailbox, 'inbox');
		assert.deepEqual(createdPayload.labels, ['needs-review']);
	});
});
