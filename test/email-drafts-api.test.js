import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';

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
			});
			const updateJson = await readJson(updateResponse);

			assert.equal(updateResponse.status, 200);
			assert.equal(updatePayload.query._id, '507f1f77bcf86cd799439099');
			assert.equal(updatePayload.query.host_id, 'host-1');
			assert.equal(updateJson.draft.status, 'ready');
			assert.equal(updateJson.draft.body_text, 'Updated draft');
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
