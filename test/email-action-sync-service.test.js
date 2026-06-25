import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { encrypt } from '../modules/encryption.js';
import { EmailIdentity } from '../model/email_identity.js';
import { EmailExternalSyncState } from '../model/email_external_sync_state.js';
import { MongoQueue } from '../modules/mongo_queue.js';
import { enqueueDraftSync, enqueueEmailMailboxSync } from '../services/email_action_sync_service.js';
import { sendHelpmonksReply, syncHelpmonksAction } from '../services/helpmonks_email_sync_service.js';
import { syncFastmailAction } from '../services/fastmail_email_sync_service.js';

function jsonResponse(payload, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => JSON.stringify(payload),
	};
}

describe('Email action sync service', () => {
	const originalEncryptionKey = config.gitEncryptionKey;
	const originals = {};

	beforeEach(() => {
		config.gitEncryptionKey = '12345678901234567890123456789012';
		originals.identityFind = EmailIdentity.find;
		originals.identityFindOne = EmailIdentity.findOne;
		originals.queueAdd = MongoQueue.add;
		originals.stateFindOneAndUpdate = EmailExternalSyncState.findOneAndUpdate;
	});

	afterEach(() => {
		config.gitEncryptionKey = originalEncryptionKey;
		EmailIdentity.find = originals.identityFind;
		EmailIdentity.findOne = originals.identityFindOne;
		MongoQueue.add = originals.queueAdd;
		EmailExternalSyncState.findOneAndUpdate = originals.stateFindOneAndUpdate;
	});

	it('enqueues provider jobs for matching inbound spam moves', async () => {
		const jobs = [];
		const states = [];
		const identity = {
			_id: 'identity-1',
			host_id: 'host-1',
			project: '507f1f77bcf86cd799439011',
			email: 'support@example.com',
			helpmonks: { enabled: true, base_url: 'https://helpmonks.example.com', api_key: 'encrypted-key' },
			fastmail: { enabled: true, api_token: 'encrypted-token' },
		};
		EmailIdentity.find = () => ({
			lean: async () => [identity],
		});
		MongoQueue.add = async (queue, data, options) => {
			jobs.push({ queue, data, options });
			return { _id: `job-${jobs.length}` };
		};
		EmailExternalSyncState.findOneAndUpdate = async (query, update) => {
			states.push({ query, update });
			return {};
		};

		await enqueueEmailMailboxSync('host-1', {
			_id: 'email-1',
			project: '507f1f77bcf86cd799439011',
			to: ['Support@Example.com'],
			cc: [],
			bcc: [],
		}, 'spam');

		assert.deepEqual(jobs.map((job) => job.data.provider).sort(), ['fastmail', 'helpmonks']);
		assert.equal(jobs[0].queue, 'email_action_sync');
		assert.equal(jobs[0].data.action, 'email.spam');
		assert.equal(jobs[0].data.local_type, 'email');
		assert.equal(jobs[0].data.local_id, 'email-1');
		assert.equal(states.length, 2);
		assert.equal(states[0].update.$set.last_status, 'queued');
	});

	it('enqueues draft sync from the draft From identity', async () => {
		const jobs = [];
		EmailIdentity.findOne = () => ({
			lean: async () => ({
				_id: 'identity-2',
				project: '507f1f77bcf86cd799439011',
				email: 'sender@example.com',
				helpmonks: { enabled: false },
				fastmail: { enabled: true, api_token: 'encrypted-token' },
			}),
		});
		MongoQueue.add = async (queue, data) => {
			jobs.push({ queue, data });
			return { _id: `job-${jobs.length}` };
		};
		EmailExternalSyncState.findOneAndUpdate = async () => ({});

		await enqueueDraftSync('host-1', {
			_id: 'draft-1',
			project: '507f1f77bcf86cd799439011',
			from: 'sender@example.com',
		}, 'draft.upsert');

		assert.equal(jobs.length, 1);
		assert.equal(jobs[0].data.provider, 'fastmail');
		assert.equal(jobs[0].data.action, 'draft.upsert');
		assert.equal(jobs[0].data.local_type, 'draft');
	});

	it('marks Helpmonks reply targets read before closing the conversation', async () => {
		const calls = [];
		const identity = {
			helpmonks: {
				enabled: true,
				base_url: 'https://helpmonks.example.com',
				api_key: encrypt('hm-key'),
			},
		};
		const fetchFn = async (url, options = {}) => {
			const parsed = new URL(url);
			const body = options.body ? JSON.parse(options.body) : null;
			calls.push({ path: parsed.pathname, method: options.method || 'GET', body, authorization: options.headers.Authorization, skipHeader: options.headers['x-helpmonks-skip-kumbukum-sync'] });
			if (parsed.pathname.endsWith('/conversation/findone')) {
				return jsonResponse({ success: true, results: { _id: '507f1f77bcf86cd799439011' } });
			}
			return jsonResponse({ success: true, results: { _id: '507f1f77bcf86cd799439011' } });
		};

		const result = await syncHelpmonksAction({
			identity,
			state: {},
			action: 'reply.sent',
			sourceEmail: { message_id: 'source@example.com', references: [] },
			fetchFn,
		});

		assert.equal(result.remote_conversation_id, '507f1f77bcf86cd799439011');
		assert.equal(calls[0].authorization, `Basic ${Buffer.from('hm-key:').toString('base64')}`);
		assert.equal(calls[0].skipHeader, 'true');
		assert.equal(calls[1].path, '/api/v1/conversation/update');
		assert.deepEqual(calls[1].body, { id: '507f1f77bcf86cd799439011', mark_read: true });
		assert.equal(calls[2].path, '/api/v1/conversation/status/507f1f77bcf86cd799439011/closed');
	});

	it('sends Helpmonks replies with the tracked remote draft id', async () => {
		const calls = [];
		const identity = {
			helpmonks: {
				enabled: true,
				base_url: 'https://helpmonks.example.com',
				api_key: encrypt('hm-key'),
			},
		};
		const fetchFn = async (url, options = {}) => {
			const parsed = new URL(url);
			const body = options.body ? JSON.parse(options.body) : null;
			calls.push({ path: parsed.pathname, method: options.method || 'GET', body, authorization: options.headers.Authorization, skipHeader: options.headers['x-helpmonks-skip-kumbukum-sync'] });
			return jsonResponse({ success: true, results: { id: '507f1f77bcf86cd799439011', status: 'closed' } });
		};

		const result = await sendHelpmonksReply({
			identity,
			state: {
				remote_conversation_id: '507f1f77bcf86cd799439011',
				remote_draft_id: 'remote-draft-1',
			},
			outgoing: {
				body_html: '<p>Reply body</p>',
				body_text: 'Reply body',
				subject: 'Re: Help',
				to: ['customer@example.com'],
				cc: ['copy@example.com'],
				bcc: [],
			},
			fetchFn,
		});

		assert.equal(result.remote_conversation_id, '507f1f77bcf86cd799439011');
		assert.equal(result.remote_draft_id, '');
		assert.equal(calls.length, 1);
		assert.equal(calls[0].path, '/api/v1/conversation/reply');
		assert.equal(calls[0].method, 'POST');
		assert.equal(calls[0].authorization, `Basic ${Buffer.from('hm-key:').toString('base64')}`);
		assert.equal(calls[0].skipHeader, 'true');
		assert.deepEqual(calls[0].body, {
			id: '507f1f77bcf86cd799439011',
			body: '<p>Reply body</p>',
			subject: 'Re: Help',
			to: ['customer@example.com'],
			cc: ['copy@example.com'],
			bcc: [],
			status_after: 'closed',
			draft_id: 'remote-draft-1',
		});
	});

	it('skips Helpmonks draft upserts once the local draft is no longer active', async () => {
		const calls = [];
		const result = await syncHelpmonksAction({
			identity: {
				helpmonks: {
					enabled: true,
					base_url: 'https://helpmonks.example.com',
					api_key: encrypt('hm-key'),
				},
			},
			state: {
				remote_conversation_id: '507f1f77bcf86cd799439011',
			},
			action: 'draft.upsert',
			draft: {
				status: 'ready',
			},
			fetchFn: async () => {
				calls.push(true);
				return jsonResponse({ success: true });
			},
		});

		assert.equal(result.skipped, true);
		assert.equal(result.reason, 'helpmonks_draft_not_active:ready');
		assert.equal(calls.length, 0);
	});

	it('retries Helpmonks requests with access-token auth when Basic auth is rejected', async () => {
		const calls = [];
		const identity = {
			helpmonks: {
				enabled: true,
				base_url: 'https://helpmonks.example.com',
				api_key: encrypt('hm-access-token'),
			},
		};
		const fetchFn = async (url, options = {}) => {
			const parsed = new URL(url);
			calls.push({
				path: parsed.pathname,
				authorization: options.headers.Authorization || '',
				accessToken: options.headers['x-access-token'] || '',
				skipHeader: options.headers['x-helpmonks-skip-kumbukum-sync'],
			});
			if (options.headers.Authorization) return jsonResponse({ message: 'API key not valid' }, 401);
			return jsonResponse({ success: true, results: { _id: '507f1f77bcf86cd799439011' } });
		};

		const result = await syncHelpmonksAction({
			identity,
			state: { remote_conversation_id: '507f1f77bcf86cd799439011' },
			action: 'email.spam',
			email: { message_id: 'source@example.com', references: [] },
			fetchFn,
		});

		assert.equal(result.remote_conversation_id, '507f1f77bcf86cd799439011');
		assert.equal(calls.length, 2);
		assert.equal(calls[0].authorization, `Basic ${Buffer.from('hm-access-token:').toString('base64')}`);
		assert.equal(calls[1].authorization, '');
		assert.equal(calls[1].accessToken, 'hm-access-token');
		assert.equal(calls[0].skipHeader, 'true');
		assert.equal(calls[1].skipHeader, 'true');
		assert.equal(calls[1].path, '/api/v1/conversation/status/507f1f77bcf86cd799439011/spam');
	});

	it('moves Fastmail source messages to junk through JMAP', async () => {
		const methodCalls = [];
		const identity = {
			fastmail: {
				enabled: true,
				api_token: encrypt('fm-token'),
				account_id: 'account-1',
			},
		};
		const fetchFn = async (url, options = {}) => {
			if (url.endsWith('/jmap/session')) {
				assert.equal(options.headers.Authorization, 'Bearer fm-token');
				return jsonResponse({ apiUrl: 'https://api.fastmail.com/jmap/api', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account-1' } });
			}
			const body = JSON.parse(options.body);
			methodCalls.push(body.methodCalls);
			const callName = body.methodCalls[0][0];
			if (callName === 'Mailbox/get') {
				return jsonResponse({ methodResponses: [['Mailbox/get', { list: [{ id: 'junk-id', role: 'junk' }, { id: 'trash-id', role: 'trash' }, { id: 'drafts-id', role: 'drafts' }] }, 'mailboxes']] });
			}
			if (callName === 'Email/query') {
				assert.deepEqual(body.methodCalls[0][1].filter, { header: ['Message-ID', '<source@example.com>'] });
				return jsonResponse({ methodResponses: [['Email/query', { ids: ['remote-email-1'] }, 'email_query']] });
			}
			return jsonResponse({ methodResponses: [['Email/set', { updated: { 'remote-email-1': {} } }, 'email_move']] });
		};

		const result = await syncFastmailAction({
			identity,
			state: {},
			action: 'email.spam',
			email: { message_id: 'source@example.com', references: [] },
			fetchFn,
		});

		assert.equal(result.remote_email_id, 'remote-email-1');
		assert.deepEqual(methodCalls[2][0][1].update['remote-email-1'], { mailboxIds: { 'junk-id': true } });
	});
});
