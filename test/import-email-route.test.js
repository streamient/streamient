import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import importRoutes from '../routes/import.js';
import { mockTenantWork } from './helpers/tenant-work.js';
import { GraphLink } from '../model/graph_link.js';
import { Project } from '../model/project.js';
import { Email } from '../model/email.js';
import { AuditLog } from '../model/audit_log.js';
import { Tenant } from '../modules/tenancy.js';

let restoreAccountWork;
beforeEach(() => { restoreAccountWork = mockTenantWork(); });
afterEach(() => { restoreAccountWork(); });

function createServer() {
	const app = express();
	app.locals.emailIngestContext = { skipSideEffects: true };
	app.use('/import', importRoutes);
	return app.listen(0);
}

function request(server, body) {
	const { port } = server.address();
	return fetch(`http://127.0.0.1:${port}/import/email`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body,
	});
}

describe('Email forwarding import route', () => {
	const projectId = '507f1f77bcf86cd799439011';
	const originalEmailForwardDomain = config.emailForwardDomain;
	const originalProjectRead = Project.findOne;
	const originalProjectFindOne = Project.findOneAndUpdate;
	const originalEmailFindOne = Email.findOne;
	const originalEmailCreate = Email.create;
	const originalEmailUpsert = Email.findOneAndUpdate;
	const originalEmailFind = Email.find;
	const originalGraphLinkUpdateOne = GraphLink.updateOne;
	const originalTenantFindOne = Tenant.findOne;
	const originalAuditLogCreate = AuditLog.create;
	const originalProjectUpdateOne = Project.updateOne;

	beforeEach(() => {
		config.emailForwardDomain = 'email.streamient.com';
		Project.findOne = (...args) => Project.findOneAndUpdate(...args);
		Project.findOneAndUpdate = () => ({
			select() { return this; },
			read() { return this; },
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
				email_filter: '',
			}),
		});
		Project.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
		Email.findOne = () => ({ lean: async () => null });
		Email.findOneAndUpdate = async (_filter, update) => ({ value: await Email.create(update.$set), lastErrorObject: { updatedExisting: false } });
		Email.create = async (payload) => ({
			_id: { toString: () => '507f1f77bcf86cd799439101' },
			...payload,
		});
		Email.find = () => ({
			select: () => ({
				read() { return this; },
				lean: async () => [],
			}),
		});
		GraphLink.updateOne = async () => ({ upsertedCount: 0 });
		Tenant.findOne = () => ({
			select: () => ({
				read() { return this; },
				lean: async () => ({ plan: 'pro' }),
			}),
		});
		AuditLog.create = async () => ({});
	});

	afterEach(() => {
		config.emailForwardDomain = originalEmailForwardDomain;
		Project.findOneAndUpdate = originalProjectFindOne;
		Project.findOne = originalProjectRead;
		Project.updateOne = originalProjectUpdateOne;
		Email.findOne = originalEmailFindOne;
		Email.create = originalEmailCreate;
		Email.findOneAndUpdate = originalEmailUpsert;
		Email.find = originalEmailFind;
		GraphLink.updateOne = originalGraphLinkUpdateOne;
		Tenant.findOne = originalTenantFindOne;
		AuditLog.create = originalAuditLogCreate;
	});

	it('stores forwarded text email', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => '507f1f77bcf86cd799439101' }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<route-1@example.com>',
				from: 'Sender <sender@example.com>',
				to: `${projectId}@email.streamient.com`,
				subject: 'Forwarded',
				text: 'Forwarded text',
				html: '<p>Ignored</p>',
				attachments: [{ filename: 'ignored.txt', content: 'ignored' }],
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: '507f1f77bcf86cd799439101' });
			assert.equal(createdPayload.source, 'emailforwarding');
			assert.equal(createdPayload.project, projectId);
			assert.equal(createdPayload.text_content, 'Forwarded text');
			assert.equal(createdPayload.attachment_text_content, '');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('routes Forward Email webhook payloads by session recipient', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => '507f1f77bcf86cd799439102' }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				messageId: '<forward-email-session@example.com>',
				from: {
					value: [{ address: 'nitai@helpmonks.com', name: 'Nitai' }],
					text: 'Nitai <nitai@helpmonks.com>',
				},
				to: {
					value: [{ address: 'nitai@fastmail.com', name: 'Nitai' }],
					text: 'Nitai <nitai@fastmail.com>',
				},
				recipients: [`${projectId}@email.streamient.com`],
				session: {
					recipient: `${projectId}@email.streamient.com`,
					sender: 'nitai@helpmonks.com',
				},
				subject: 'Forward Email production shape',
				text: 'Forwarded text',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: '507f1f77bcf86cd799439102' });
			assert.equal(createdPayload.project, projectId);
			assert.deepEqual(createdPayload.to, ['nitai@fastmail.com']);
			assert.deepEqual(createdPayload.from, ['nitai@helpmonks.com']);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('acknowledges a tenant Message-ID conflict without exposing the database error', async () => {
		Email.findOneAndUpdate = async () => { throw Object.assign(new Error('duplicate database key'), { code: 11000, keyPattern: { host_id: 1, message_id: 1 } }); };
		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({ message_id: '<duplicate@example.com>', from: 'sender@example.com', to: `${projectId}@email.streamient.com`, subject: 'Duplicate', text: 'Body' }));
			assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
			assert.deepEqual(await response.json(), { accepted: false });
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('moves filtered imported email to trash', async () => {
		Project.findOneAndUpdate = () => ({
			select() { return this; },
			read() { return this; },
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
				email_filter: 'blocked@example.com',
			}),
		});
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => '507f1f77bcf86cd799439103' }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<filtered@example.com>',
				from: 'blocked@example.com',
				to: `${projectId}@email.streamient.com`,
				subject: 'Filtered',
				text: 'Filtered body',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: '507f1f77bcf86cd799439103' });
			assert.equal(createdPayload.in_trash, true);
			assert.deepEqual(createdPayload.labels, []);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
