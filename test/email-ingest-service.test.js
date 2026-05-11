import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseEmailInput, parseForwardedEmailInput, ingestEmail, ingestForwardedEmail, getEmailThread, listEmails, parseTriageResult, triageInboxEmails } from '../services/email_ingest_service.js';
import { Email } from '../model/email.js';
import { EmailLabel } from '../model/email_label.js';
import { GraphLink } from '../model/graph_link.js';
import { Tenant } from '../modules/tenancy.js';
import { toTypesenseDoc } from '../modules/typesense.js';

describe('Email ingest service', () => {
	const userId = '507f1f77bcf86cd799439012';

	it('normalizes parsed payload fields', async () => {
		const normalized = await parseEmailInput({
			parsed_email: {
				message_id: '<Msg-123@Example.COM>',
				references: '<Root@Example.com> <Prev@Example.com>',
				from: [{ address: 'Sender@Example.com' }],
				to: 'a@example.com, b@example.com',
				cc: [{ address: 'CC@Example.com' }],
				bcc: [{ value: [{ address: 'hidden@example.com' }] }],
				subject: '  Hello world  ',
				html: '<p>Hello <b>Team</b></p>',
				attachments: [],
			},
		});

		assert.equal(normalized.message_id, 'msg-123@example.com');
		assert.deepEqual(normalized.references, ['root@example.com', 'prev@example.com']);
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['a@example.com', 'b@example.com']);
		assert.deepEqual(normalized.cc, ['cc@example.com']);
		assert.deepEqual(normalized.bcc, ['hidden@example.com']);
		assert.equal(normalized.subject, 'Hello world');
		assert.equal(normalized.text_content, 'Hello Team');
	});

	it('normalizes forwarded payload fields without attachment text', () => {
		const normalized = parseForwardedEmailInput({
			message_id: '<Forwarded-123@Example.COM>',
			references: '<Root@Example.com>',
			in_reply_to: '<Prev@Example.com>',
			from: 'Sender Name <Sender@Example.com>',
			to: 'Project <507f1f77bcf86cd799439011@email.kumbukum.com>',
			cc: [{ address: 'CC@Example.com' }],
			subject: '  Forwarded hello  ',
			text: 'Forwarded body',
			html: '<p>Ignored HTML</p>',
			attachments: [{ filename: 'ignored.txt', content: 'ignored' }],
		});

		assert.equal(normalized.message_id, 'forwarded-123@example.com');
		assert.deepEqual(normalized.references, ['root@example.com']);
		assert.equal(normalized.in_reply_to, 'prev@example.com');
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['507f1f77bcf86cd799439011@email.kumbukum.com']);
		assert.deepEqual(normalized.cc, ['cc@example.com']);
		assert.equal(normalized.subject, 'Forwarded hello');
		assert.equal(normalized.text_content, 'Forwarded body');
		assert.equal(normalized.attachment_text_content, '');
	});

	it('falls back to stripped HTML text for forwarded payloads without plain text', () => {
		const normalized = parseForwardedEmailInput({
			message_id: '<HtmlOnly@Example.COM>',
			from: 'sender@example.com',
			to: '507f1f77bcf86cd799439011@email.kumbukum.com',
			subject: 'HTML only',
			html: '<div>Hello <strong>HTML</strong><br>Only</div>',
			attachments: [{ filename: 'ignored.txt', content: 'ignored' }],
		});

		assert.equal(normalized.message_id, 'htmlonly@example.com');
		assert.equal(normalized.text_content, 'Hello HTML Only');
		assert.equal(normalized.attachment_text_content, '');
	});

	it('reads forwarded payload fields from raw header strings and header lines', () => {
		const normalized = parseForwardedEmailInput({
			headers: 'Message-ID: <HeaderString@Example.COM>\r\nFrom: Sender <sender@example.com>\r\nSubject: Header subject',
			headerLines: [
				{ key: 'to', line: 'To: Project <507f1f77bcf86cd799439011@email.kumbukum.com>' },
				{ key: 'references', line: 'References: <Root@Example.com>' },
			],
			text: 'Header body',
		});

		assert.equal(normalized.message_id, 'headerstring@example.com');
		assert.deepEqual(normalized.references, ['root@example.com']);
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['507f1f77bcf86cd799439011@email.kumbukum.com']);
		assert.equal(normalized.subject, 'Header subject');
		assert.equal(normalized.text_content, 'Header body');
	});

	it('uses Forward Email session fields when parsed address fields are absent', () => {
		const normalized = parseForwardedEmailInput({
			messageId: '<SessionOnly@Example.COM>',
			session: {
				sender: 'sender@example.com',
				recipient: '507f1f77bcf86cd799439011@email.kumbukum.com',
			},
			subject: 'Session only',
			text: 'Session body',
		});

		assert.equal(normalized.message_id, 'sessiononly@example.com');
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['507f1f77bcf86cd799439011@email.kumbukum.com']);
		assert.equal(normalized.text_content, 'Session body');
	});

	it('updates duplicates by message_id only within the same host', async () => {
		const existing = { _id: 'email-1', host_id: 'host-1' };
		let createCalled = false;
		let updateQuery = null;

		const originalFindOne = Email.findOne;
		const originalFindOneAndUpdate = Email.findOneAndUpdate;
		const originalCreate = Email.create;
		const originalFind = Email.find;

		Email.findOne = async (query) => {
			assert.deepEqual(query, { message_id: 'dup@example.com' });
			return existing;
		};
		Email.findOneAndUpdate = async (query, update) => {
			updateQuery = query;
			return { _id: 'email-1', ...update.$set };
		};
		Email.create = async () => {
			createCalled = true;
			return null;
		};
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});

		try {
			const email = await ingestEmail(userId, 'host-1', {
				project: '507f1f77bcf86cd799439011',
				parsed_email: {
					message_id: '<dup@example.com>',
					from: 'sender@example.com',
					to: 'to@example.com',
					subject: 'Duplicate',
					text: 'Updated text',
				},
			}, { channel: 'api', skipSideEffects: true });

			assert.deepEqual(updateQuery, { _id: 'email-1', host_id: 'host-1' });
			assert.equal(createCalled, false);
			assert.equal(email.text_content, 'Updated text');
		} finally {
			Email.findOne = originalFindOne;
			Email.findOneAndUpdate = originalFindOneAndUpdate;
			Email.create = originalCreate;
			Email.find = originalFind;
		}
	});

	it('creates thread graph links for forwarded email references', async () => {
		const linkedId = { toString: () => 'linked-email' };
		const newId = { toString: () => 'new-email' };
		let graphLinkQuery = null;
		let graphLinkUpdate = null;

		const originalFindOne = Email.findOne;
		const originalCreate = Email.create;
		const originalFind = Email.find;
		const originalUpdateOne = GraphLink.updateOne;

		Email.findOne = async () => null;
		Email.create = async (payload) => ({ _id: newId, ...payload });
		Email.find = (query) => {
			assert.deepEqual(query.message_id.$in, ['root@example.com', 'prev@example.com']);
			return {
				select: () => ({
					lean: async () => [{ _id: linkedId }],
				}),
			};
		};
		GraphLink.updateOne = async (query, update) => {
			graphLinkQuery = query;
			graphLinkUpdate = update;
			return { upsertedCount: 1 };
		};

		try {
			await ingestForwardedEmail(userId, 'host-1', {
				project: '507f1f77bcf86cd799439011',
				message_id: '<new@example.com>',
				references: '<root@example.com>',
				in_reply_to: '<prev@example.com>',
				from: 'sender@example.com',
				to: '507f1f77bcf86cd799439011@email.kumbukum.com',
				subject: 'Reply',
				text: 'Reply text',
			}, { channel: 'emailforwarding', skipSideEffects: true });

			assert.equal(graphLinkQuery.host_id, 'host-1');
			assert.equal(graphLinkQuery.source_id, linkedId);
			assert.equal(graphLinkQuery.source_type, 'emails');
			assert.equal(graphLinkQuery.target_id, newId);
			assert.equal(graphLinkQuery.target_type, 'emails');
			assert.equal(graphLinkUpdate.$setOnInsert.label, 'thread');
		} finally {
			Email.findOne = originalFindOne;
			Email.create = originalCreate;
			Email.find = originalFind;
			GraphLink.updateOne = originalUpdateOne;
		}
	});

	it('builds thread via message_id and references', async () => {
		const root = {
			_id: { toString: () => '1' },
			message_id: 'msg-a@example.com',
			references: ['msg-b@example.com'],
			createdAt: '2026-01-01T10:00:00.000Z',
		};
		const parent = {
			_id: { toString: () => '2' },
			message_id: 'msg-b@example.com',
			references: [],
			createdAt: '2026-01-01T09:00:00.000Z',
		};
		const reply = {
			_id: { toString: () => '3' },
			message_id: 'msg-c@example.com',
			references: ['msg-a@example.com'],
			createdAt: '2026-01-01T11:00:00.000Z',
		};

		const originalFindOne = Email.findOne;
		const originalFind = Email.find;

		Email.findOne = () => ({
			lean: async () => root,
		});
		Email.find = (query) => ({
			lean: async () => {
				const messageId = query?.$or?.[0]?.message_id || query?.$or?.[1]?.references;
				if (messageId === 'msg-a@example.com') return [root, reply];
				if (messageId === 'msg-b@example.com') return [parent];
				return [];
			},
		});

		try {
			const thread = await getEmailThread('host-1', '1');
			assert.equal(thread.length, 3);
			assert.equal(thread[0].message_id, 'msg-b@example.com');
			assert.equal(thread[1].message_id, 'msg-a@example.com');
			assert.equal(thread[2].message_id, 'msg-c@example.com');
		} finally {
			Email.findOne = originalFindOne;
			Email.find = originalFind;
		}
	});

	it('includes sender in email Typesense documents', () => {
		const doc = toTypesenseDoc('emails', {
			_id: '507f1f77bcf86cd799439055',
			project: '507f1f77bcf86cd799439011',
			subject: 'Hello from sender test',
			from: ['sender@example.com'],
			to: ['to@example.com'],
			cc: [],
			bcc: [],
			text_content: 'hello world',
			attachment_text_content: '',
			message_id: 'msg-1@example.com',
			references: [],
			createdAt: '2026-01-01T10:00:00.000Z',
			updatedAt: '2026-01-01T10:00:00.000Z',
		});

		assert.deepEqual(doc.from, ['sender@example.com']);
		assert.deepEqual(doc.to, ['to@example.com']);
		assert.equal(doc.subject, 'Hello from sender test');
	});

	it('lists default ECC inbox as untriaged emails across projects', async () => {
		let findQuery = null;
		const originalFind = Email.find;

		Email.find = (query) => {
			findQuery = query;
			return {
				sort: () => ({
					skip: () => ({
						limit: async () => [],
					}),
				}),
			};
		};

		try {
			await listEmails('host-1', null, { mailbox: 'inbox', triaged: false });

			assert.equal(findQuery.host_id, 'host-1');
			assert.equal(findQuery.project, undefined);
			assert.equal(findQuery.mailbox, 'inbox');
			assert.deepEqual(findQuery.in_trash, { $ne: true });
			assert.deepEqual(findQuery.$or, [{ triaged_at: null }, { triaged_at: { $exists: false } }]);
		} finally {
			Email.find = originalFind;
		}
	});

	it('normalizes AI triage JSON to supported labels', () => {
		const triage = parseTriageResult('```json\n{"labels":["Reply Required","unknown"],"summary":"Needs reply","reason":"Customer asked a question"}\n```');

		assert.deepEqual(triage.labels, ['reply-required', 'triaged']);
		assert.equal(triage.summary, 'Needs reply');
		assert.equal(triage.reason, 'Customer asked a question');
	});

	it('triages inbox emails and persists labels', async () => {
		const emailId = { toString: () => 'email-1' };
		let updatePayload = null;
		const originalBulkWrite = EmailLabel.bulkWrite;
		const originalLabelFind = EmailLabel.find;
		const originalEmailFind = Email.find;
		const originalFindOneAndUpdate = Email.findOneAndUpdate;
		const originalTenantFindOne = Tenant.findOne;

		EmailLabel.bulkWrite = async () => ({});
		EmailLabel.find = () => ({
			sort: () => ({
				lean: async () => [],
			}),
		});
		Email.find = () => ({
			sort: () => ({
				limit: () => ({
					lean: async () => [{
						_id: emailId,
						subject: 'Question',
						from: ['sender@example.com'],
						to: ['team@example.com'],
						text_content: 'Can you help?',
						labels: [],
						updatedAt: '2026-01-01T10:00:00.000Z',
					}],
				}),
			}),
		});
		Email.findOneAndUpdate = async (query, update) => {
			assert.equal(query._id, emailId);
			updatePayload = update.$set;
			return { _id: emailId, ...update.$set };
		};
		let prompt;
		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => ({ settings: { ai_instructions: { global: 'Be concise', email: 'Use warm reply tone', email_triage: 'Prioritize support' } } }),
			}),
		});

		try {
			const result = await triageInboxEmails('host-1', userId, {
				skipSideEffects: true,
				completionFn: async ({ messages }) => {
					prompt = messages[1].content;
					return '{"labels":["human-do"],"summary":"Needs help","reason":"Requires human action"}';
				},
			});

			assert.match(prompt, /Email instructions:\nUse warm reply tone/);
			assert.match(prompt, /Email triage instructions:\nPrioritize support/);
			assert.equal(result.processed, 1);
			assert.equal(result.triaged, 1);
			assert.deepEqual(updatePayload.labels, ['human-do', 'triaged']);
			assert.equal(updatePayload.triage_summary, 'Needs help');
			assert.equal(updatePayload.triage_reason, 'Requires human action');
			assert.ok(updatePayload.triaged_at instanceof Date);
		} finally {
			EmailLabel.bulkWrite = originalBulkWrite;
			EmailLabel.find = originalLabelFind;
			Email.find = originalEmailFind;
			Email.findOneAndUpdate = originalFindOneAndUpdate;
			Tenant.findOne = originalTenantFindOne;
		}
	});
});
