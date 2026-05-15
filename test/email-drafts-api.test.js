import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailInternalNote } from '../model/email_internal_note.js';

async function createServer() {
	const { default: apiRoutes } = await import(`../routes/api.js?email_drafts_test=${Date.now()}_${Math.random()}`);
	const app = express();
	app.use(express.json());
	app.use((req, res, next) => {
		req.session = {
			userId: '507f1f77bcf86cd799439011',
			tenantId: '507f1f77bcf86cd799439012',
			host_id: 'host-1',
		};
		next();
	});
	app.use('/api/v1', apiRoutes);
	return app.listen(0);
}

async function request(server, method, path, body) {
	const { port } = server.address();
	return fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
		method,
		headers: { accept: 'application/json', 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
}

async function readJson(response) {
	const text = await response.text();
	assert.match(response.headers.get('content-type') || '', /application\/json/, text.slice(0, 300));
	return JSON.parse(text);
}

describe('Email draft API', () => {
	const originalIsHosted = config.isHosted;
	const originalUserFindById = User.findById;
	const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
	const originalTenantMemberFind = TenantMember.find;
	const originalTenantMemberFindOneAndUpdate = TenantMember.findOneAndUpdate;
	const originalEmailFind = Email.find;
	const originalEmailFindOne = Email.findOne;
	const originalDraftFind = EmailDraft.find;
	const originalDraftFindOne = EmailDraft.findOne;
	const originalDraftFindOneAndUpdate = EmailDraft.findOneAndUpdate;
	const originalInternalNoteFind = EmailInternalNote.find;
	const originalInternalNoteFindOne = EmailInternalNote.findOne;
	const originalInternalNoteCreate = EmailInternalNote.create;
	const originalInternalNoteFindOneAndUpdate = EmailInternalNote.findOneAndUpdate;
	const originalInternalNoteFindOneAndDelete = EmailInternalNote.findOneAndDelete;
	const originalInternalNoteCountDocuments = EmailInternalNote.countDocuments;

	beforeEach(() => {
		config.isHosted = false;
		User.findById = () => ({
			select: async () => ({
				_id: { toString: () => '507f1f77bcf86cd799439011' },
				tenant: { toString: () => '507f1f77bcf86cd799439012' },
				host_id: 'host-1',
			}),
		});
		User.findByIdAndUpdate = async () => null;
		TenantMember.findOneAndUpdate = async () => null;
		TenantMember.find = () => ({
			populate: () => ({
				lean: async () => [{
					_id: { toString: () => 'membership-1' },
					role: 'owner',
					tenant: {
						_id: { toString: () => '507f1f77bcf86cd799439012' },
						host_id: 'host-1',
						name: 'Test Account',
						is_active: true,
					},
				}],
			}),
		});
	});

	afterEach(() => {
		config.isHosted = originalIsHosted;
		User.findById = originalUserFindById;
		User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
		TenantMember.find = originalTenantMemberFind;
		TenantMember.findOneAndUpdate = originalTenantMemberFindOneAndUpdate;
		Email.find = originalEmailFind;
		Email.findOne = originalEmailFindOne;
		EmailDraft.find = originalDraftFind;
		EmailDraft.findOne = originalDraftFindOne;
		EmailDraft.findOneAndUpdate = originalDraftFindOneAndUpdate;
		EmailInternalNote.find = originalInternalNoteFind;
		EmailInternalNote.findOne = originalInternalNoteFindOne;
		EmailInternalNote.create = originalInternalNoteCreate;
		EmailInternalNote.findOneAndUpdate = originalInternalNoteFindOneAndUpdate;
		EmailInternalNote.findOneAndDelete = originalInternalNoteFindOneAndDelete;
		EmailInternalNote.countDocuments = originalInternalNoteCountDocuments;
	});

	it('lists and updates email drafts', async () => {
		let listQuery = null;
		let updatePayload = null;
		EmailDraft.find = (query) => {
			listQuery = query;
			return {
				sort: () => ({
					skip: () => ({
						limit: () => ({
							lean: async () => [{ _id: 'draft-1', subject: 'Re: Hello', status: 'draft' }],
						}),
					}),
				}),
			};
		};
		EmailDraft.findOneAndUpdate = (query, update) => {
			updatePayload = { query, update };
			return {
				lean: async () => ({ _id: query._id, host_id: query.host_id, ...update.$set }),
			};
		};
		EmailDraft.findOne = () => ({
			lean: async () => ({ _id: '507f1f77bcf86cd799439099', status: 'draft' }),
		});

		const server = await createServer();
		try {
			const listResponse = await request(server, 'GET', '/email-drafts?project=project-1');
			const listJson = await readJson(listResponse);

			assert.equal(listResponse.status, 200);
			assert.equal(listQuery.host_id, 'host-1');
			assert.equal(listQuery.project, 'project-1');
			assert.equal(listJson.drafts[0]._id, 'draft-1');

			const updateResponse = await request(server, 'PUT', '/email-drafts/507f1f77bcf86cd799439099', {
				status: 'ready',
				body_text: 'Updated draft',
				body_html: '<p><strong>Updated draft</strong><script>alert(1)</script></p>',
				to: 'Customer <customer@example.com>, second@example.com',
				cc: '',
				bcc: ['hidden@example.com'],
			});
			const updateJson = await readJson(updateResponse);

			assert.equal(updateResponse.status, 200);
			assert.equal(updatePayload.query._id, '507f1f77bcf86cd799439099');
			assert.equal(updatePayload.query.host_id, 'host-1');
			assert.deepEqual(updatePayload.update.$set.to, ['customer@example.com', 'second@example.com']);
			assert.deepEqual(updatePayload.update.$set.cc, []);
			assert.deepEqual(updatePayload.update.$set.bcc, ['hidden@example.com']);
			assert.equal(updatePayload.update.$set.body_html, '<p><strong>Updated draft</strong></p>');
			assert.equal(updateJson.draft.status, 'ready');
			assert.equal(updateJson.draft.body_text, 'Updated draft');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('rejects invalid manual draft recipients', async () => {
		EmailDraft.findOneAndUpdate = () => {
			throw new Error('should not update invalid recipients');
		};

		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/email-drafts/507f1f77bcf86cd799439099', {
				to: 'not-an-email',
				body_text: 'Hello',
			});
			const json = await readJson(response);

			assert.equal(response.status, 400);
			assert.match(json.error, /to contains invalid email address/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('stores internal email notes separately from draft payloads', async () => {
		const root = {
			_id: { toString: () => 'email-1' },
			message_id: 'msg-a@example.com',
			references: [],
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			host_id: 'host-1',
		};
		let noteFindQuery = null;
		let notePayload = null;
		let draftUpdate = null;

		Email.findOne = () => ({
			lean: async () => root,
		});
		Email.find = () => ({
			lean: async () => [root],
		});
		EmailInternalNote.find = (query) => {
			noteFindQuery = query;
			return {
				populate: () => ({
					sort: () => ({
						lean: async () => [{
							_id: 'note-1',
							content: '<p>Private note</p>',
							text_content: 'Private note',
							owner: { name: 'Nitai' },
						}],
					}),
				}),
			};
		};
		EmailInternalNote.create = async (payload) => {
			notePayload = payload;
			return {
				_id: { toString: () => 'note-1' },
				...payload,
				populate: async () => ({ _id: 'note-1', ...payload, owner: { name: 'Nitai' } }),
			};
		};
		EmailDraft.findOne = () => ({
			lean: async () => ({ _id: '507f1f77bcf86cd799439099', status: 'draft' }),
		});
		EmailDraft.findOneAndUpdate = (query, update) => {
			draftUpdate = update.$set;
			return {
				lean: async () => ({ _id: query._id, ...update.$set }),
			};
		};

		const server = await createServer();
		try {
			const createResponse = await request(server, 'POST', '/emails/email-1/internal-notes', {
				content: '<p>Private note</p>',
				text_content: 'Private note',
			});
			const createJson = await readJson(createResponse);

			assert.equal(createResponse.status, 201);
			assert.equal(notePayload.host_id, 'host-1');
			assert.equal(notePayload.source_email, root._id);
			assert.equal(notePayload.content, '<p>Private note</p>');
			assert.equal(createJson.note.text_content, 'Private note');

			const listResponse = await request(server, 'GET', '/emails/email-1/internal-notes');
			const listJson = await readJson(listResponse);

			assert.equal(listResponse.status, 200);
			assert.deepEqual(noteFindQuery.source_email.$in, ['email-1']);
			assert.equal(listJson.notes[0].text_content, 'Private note');

			await request(server, 'PUT', '/email-drafts/507f1f77bcf86cd799439099', {
				to: 'customer@example.com',
				body_text: 'Customer reply',
			});
			assert.equal(draftUpdate.text_content, undefined);
			assert.equal(draftUpdate.content, undefined);
			assert.equal(draftUpdate.body_text, 'Customer reply');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('threads, edits, and deletes internal email notes', async () => {
		const root = {
			_id: { toString: () => 'email-1' },
			message_id: 'msg-a@example.com',
			references: [],
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			host_id: 'host-1',
		};
		const replyEmail = {
			_id: { toString: () => 'email-2' },
			message_id: 'msg-b@example.com',
			references: ['msg-a@example.com'],
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			host_id: 'host-1',
		};
		const createdPayloads = [];
		let updatePayload = null;
		let deleteQuery = null;
		let replyCount = 0;

		Email.findOne = () => ({
			lean: async () => root,
		});
		Email.find = () => ({
			lean: async () => [root, replyEmail],
		});
		EmailInternalNote.findOne = (query) => ({
			lean: async () => {
				if (query._id === 'parent-note') return { _id: 'parent-note', source_email: root._id, host_id: 'host-1' };
				if (query._id === 'note-edit') return { _id: 'note-edit', content: '<p>Old</p>', text_content: 'Old' };
				return null;
			},
		});
		EmailInternalNote.create = async (payload) => {
			createdPayloads.push(payload);
			return {
				_id: { toString: () => createdPayloads.length === 1 ? 'root-note' : 'reply-note' },
				...payload,
				populate: async () => ({ _id: createdPayloads.length === 1 ? 'root-note' : 'reply-note', ...payload, owner: { name: 'Nitai' } }),
			};
		};
		EmailInternalNote.findOneAndUpdate = (query, update) => {
			updatePayload = { query, update };
			return {
				populate: async () => ({ _id: query._id, ...update.$set, owner: { name: 'Nitai' } }),
			};
		};
		EmailInternalNote.countDocuments = async () => replyCount;
		EmailInternalNote.findOneAndDelete = async (query) => {
			deleteQuery = query;
			return { _id: query._id, source_email: root._id, parent_note: null };
		};

		const server = await createServer();
		try {
			const rootResponse = await request(server, 'POST', '/emails/email-1/internal-notes', {
				content: '<p>Root note</p>',
				text_content: 'Root note',
			});
			const rootJson = await readJson(rootResponse);

			assert.equal(rootResponse.status, 201);
			assert.equal(rootJson.note.text_content, 'Root note');
			assert.equal(createdPayloads[0].parent_note, null);

			const replyResponse = await request(server, 'POST', '/emails/email-1/internal-notes', {
				content: '<p>Reply note</p>',
				text_content: 'Reply note',
				parent_note: 'parent-note',
				client_request_id: 'client-request-1',
			});
			const replyJson = await readJson(replyResponse);

			assert.equal(replyResponse.status, 201);
			assert.equal(replyJson.note.text_content, 'Reply note');
			assert.equal(createdPayloads[1].parent_note, 'parent-note');
			assert.equal(createdPayloads[1].client_request_id, undefined);

			const invalidParentResponse = await request(server, 'POST', '/emails/email-1/internal-notes', {
				content: '<p>Bad reply</p>',
				text_content: 'Bad reply',
				parent_note: 'other-thread-note',
			});
			const invalidParentJson = await readJson(invalidParentResponse);

			assert.equal(invalidParentResponse.status, 400);
			assert.match(invalidParentJson.error, /Parent note not found/);

			const updateResponse = await request(server, 'PUT', '/emails/email-1/internal-notes/note-edit', {
				content: '<p>Edited note</p>',
				text_content: 'Edited note',
			});
			const updateJson = await readJson(updateResponse);

			assert.equal(updateResponse.status, 200);
			assert.equal(updatePayload.query._id, 'note-edit');
			assert.deepEqual(updatePayload.query.source_email.$in, ['email-1', 'email-2']);
			assert.equal(updatePayload.update.$set.text_content, 'Edited note');
			assert.equal(updateJson.note.text_content, 'Edited note');

			replyCount = 1;
			const blockedDeleteResponse = await request(server, 'DELETE', '/emails/email-1/internal-notes/parent-note');
			const blockedDeleteJson = await readJson(blockedDeleteResponse);

			assert.equal(blockedDeleteResponse.status, 400);
			assert.match(blockedDeleteJson.error, /replies/);

			replyCount = 0;
			const deleteResponse = await request(server, 'DELETE', '/emails/email-1/internal-notes/reply-note');
			const deleteJson = await readJson(deleteResponse);

			assert.equal(deleteResponse.status, 200);
			assert.equal(deleteJson.message, 'Internal note deleted');
			assert.equal(deleteQuery._id, 'reply-note');
			assert.deepEqual(deleteQuery.source_email.$in, ['email-1', 'email-2']);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('returns newest-first email thread with active draft', async () => {
		const root = {
			_id: { toString: () => '1' },
			message_id: 'msg-a@example.com',
			references: ['msg-b@example.com'],
			subject: 'Root',
			createdAt: '2026-01-01T10:00:00.000Z',
		};
		const parent = {
			_id: { toString: () => '2' },
			message_id: 'msg-b@example.com',
			references: [],
			subject: 'Parent',
			createdAt: '2026-01-01T09:00:00.000Z',
		};
		const reply = {
			_id: { toString: () => '3' },
			message_id: 'msg-c@example.com',
			references: ['msg-a@example.com'],
			subject: 'Reply',
			createdAt: '2026-01-01T11:00:00.000Z',
		};
		let draftQuery = null;

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
		EmailDraft.findOne = (query) => {
			draftQuery = query;
			return {
				sort: () => ({
					lean: async () => ({ _id: 'draft-1', source_email: '1', status: 'draft', body_text: 'Reply draft' }),
				}),
			};
		};

		const server = await createServer();
		try {
			const response = await request(server, 'GET', '/emails/1/thread?order=desc&include=draft');
			const json = await readJson(response);

			assert.equal(response.status, 200);
			assert.deepEqual(json.thread.map((item) => item.message_id), ['msg-c@example.com', 'msg-a@example.com', 'msg-b@example.com']);
			assert.deepEqual(draftQuery.status, { $ne: 'discarded' });
			assert.equal(json.draft._id, 'draft-1');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('returns email triage status with optional email and draft payloads', async () => {
		let listQuery = null;
		let singleQuery = null;
		let draftQuery = null;
		const email = {
			_id: 'email-1',
			message_id: 'external@example.com',
			subject: 'Need setup help',
			from: ['sender@example.com'],
			to: ['support@example.com'],
			text_content: 'Can you help with setup?',
			project: 'project-1',
			mailbox: 'inbox',
			labels: ['reply-required', 'triaged'],
			triaged: true,
			triaged_at: new Date('2026-05-11T07:00:00.000Z'),
			triage_status: 'complete',
			triage_primary_action: 'reply-required',
			triage_summary: 'Needs setup help',
			triage_reason: 'Sender asked a support question',
			triage_confidence: 0.88,
			triage_action_points: [{ text: 'Reply with setup steps', type: 'reply', due_at: null }],
			triage_related_context: [],
			triage_mailbox_action: 'keep-inbox',
			triage_error: '',
			triage_run_id: 'run-1',
			triage_draft_id: 'draft-1',
			createdAt: new Date('2026-05-11T06:00:00.000Z'),
			updatedAt: new Date('2026-05-11T07:00:00.000Z'),
		};
		const draft = {
			_id: 'draft-1',
			source_email: 'email-1',
			subject: 'Re: Need setup help',
			body_text: 'Here are the setup steps.',
			status: 'draft',
		};

		Email.find = (query) => {
			listQuery = query;
			return {
				sort: () => ({
					skip: () => ({
						limit: () => ({
							lean: async () => [email],
						}),
					}),
				}),
			};
		};
		Email.findOne = (query) => {
			singleQuery = query;
			return {
				lean: async () => email,
			};
		};
		EmailDraft.find = (query) => {
			draftQuery = query;
			return {
				lean: async () => [draft],
			};
		};

		const server = await createServer();
		try {
			const listResponse = await request(server, 'GET', '/emails/triage-status?message_id=%3CExternal%40Example.COM%3E&status=complete&primary_action=reply-required&include=email,draft');
			const listJson = await readJson(listResponse);

			assert.equal(listResponse.status, 200);
			assert.equal(listQuery.host_id, 'host-1');
			assert.equal(listQuery.message_id, 'external@example.com');
			assert.equal(listQuery.triage_status, 'complete');
			assert.equal(listQuery.triage_primary_action, 'reply-required');
			assert.deepEqual(draftQuery._id.$in, ['draft-1']);
			assert.equal(listJson.statuses[0].email_id, 'email-1');
			assert.equal(listJson.statuses[0].triage_status, 'complete');
			assert.equal(listJson.statuses[0].email.text_content, 'Can you help with setup?');
			assert.equal(listJson.statuses[0].draft.body_text, 'Here are the setup steps.');

			const singleResponse = await request(server, 'GET', '/emails/email-1/triage-status?include=draft');
			const singleJson = await readJson(singleResponse);

			assert.equal(singleResponse.status, 200);
			assert.deepEqual(singleQuery, { _id: 'email-1', host_id: 'host-1', in_trash: false });
			assert.equal(singleJson.status.triage_primary_action, 'reply-required');
			assert.equal(singleJson.status.email, undefined);
			assert.equal(singleJson.status.draft._id, 'draft-1');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
