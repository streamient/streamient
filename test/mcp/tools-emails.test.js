import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { emailTools } from '../../apps/mcp/tools/emails.js';

const EMAIL_FIXTURE = {
	_id: '507f1f77bcf86cd799439055',
	subject: 'Hello from tests',
	message_id: 'msg-1@example.com',
	from: ['sender@example.com'],
	to: ['to@example.com'],
	cc: [],
	bcc: [],
	text_content: 'hello world',
	references: [],
};

describe('MCP Tools — Emails', () => {
	let api;
	let tools;

	beforeEach(() => {
		api = createMockApi({
			get: async (path) => {
				if (path.endsWith('/thread')) return { thread: [EMAIL_FIXTURE] };
				if (path.includes('?')) return { emails: [EMAIL_FIXTURE] };
				return { email: EMAIL_FIXTURE };
			},
			post: async (path, body) => {
				if (path === '/emails/search') return { results: [EMAIL_FIXTURE] };
				return { email: { ...EMAIL_FIXTURE, ...body } };
			},
			delete: async () => ({}),
		});
		tools = emailTools(api, '507f1f77bcf86cd799439011');
	});

	it('ingest_email posts to /emails', async () => {
		const result = await tools.ingest_email.handler({
			raw_email: 'From: a@example.com\nTo: b@example.com\nSubject: Test\n\nBody',
		});
		assert.equal(api.lastCall.method, 'POST');
		assert.equal(api.lastCall.path, '/emails');
		assert.equal(api.lastCall.body.project, '507f1f77bcf86cd799439011');
		const parsed = JSON.parse(result.content[0].text);
		assert.equal(parsed.id, EMAIL_FIXTURE._id);
		assert.equal(parsed.message_id, undefined);
	});

	it('list_emails calls GET /emails with params', async () => {
		const result = await tools.list_emails.handler({ page: 1, limit: 10 });
		assert.equal(api.lastCall.method, 'GET');
		assert.ok(api.lastCall.path.startsWith('/emails?'));
		const parsed = JSON.parse(result.content[0].text);
		assert.equal(parsed[0].id, EMAIL_FIXTURE._id);
		assert.equal(parsed[0].message_id, undefined);
	});

	it('search_emails posts to /emails/search', async () => {
		const result = await tools.search_emails.handler({ query: 'hello' });
		assert.equal(api.lastCall.method, 'POST');
		assert.equal(api.lastCall.path, '/emails/search');
		const parsed = JSON.parse(result.content[0].text);
		assert.equal(parsed[0].id, EMAIL_FIXTURE._id);
		assert.equal(parsed[0].message_id, undefined);
	});

	it('search_emails passes optional per_page and requests searchable body fields for excerpts', async () => {
		await tools.search_emails.handler({ query: 'hello', per_page: 3 });
		assert.equal(api.lastCall.body.options.perPage, 3);
		assert.equal(api.lastCall.body.options.exclude_fields, 'embedding');
	});

	it('get_email_thread calls /emails/:id/thread', async () => {
		const result = await tools.get_email_thread.handler({ id: EMAIL_FIXTURE._id });
		assert.equal(api.lastCall.method, 'GET');
		assert.equal(api.lastCall.path, `/emails/${EMAIL_FIXTURE._id}/thread`);
		const parsed = JSON.parse(result.content[0].text);
		assert.equal(parsed.length, 1);
	});

	it('delete_email calls DELETE /emails/:id', async () => {
		const result = await tools.delete_email.handler({ id: EMAIL_FIXTURE._id });
		assert.equal(api.lastCall.method, 'DELETE');
		assert.equal(api.lastCall.path, `/emails/${EMAIL_FIXTURE._id}`);
		assert.equal(result.content[0].text, 'Email deleted');
	});
});
