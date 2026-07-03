import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import importRoutes from '../routes/import.js';
import { GraphLink } from '../model/graph_link.js';
import { Project } from '../model/project.js';
import { Email } from '../model/email.js';
import { AuditLog } from '../model/audit_log.js';
import { Tenant } from '../modules/tenancy.js';

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
	const originalProjectFindOne = Project.findOne;
	const originalEmailFindOne = Email.findOne;
	const originalEmailCreate = Email.create;
	const originalEmailFind = Email.find;
	const originalGraphLinkUpdateOne = GraphLink.updateOne;
	const originalTenantFindOne = Tenant.findOne;
	const originalAuditLogCreate = AuditLog.create;

	beforeEach(() => {
		config.emailForwardDomain = 'email.kumbukum.com';
		Project.findOne = () => ({
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
				email_filter: '',
			}),
		});
		Email.findOne = async () => null;
		Email.create = async (payload) => ({
			_id: { toString: () => '507f1f77bcf86cd799439101' },
			...payload,
		});
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});
		GraphLink.updateOne = async () => ({ upsertedCount: 0 });
		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => ({ plan: 'pro' }),
			}),
		});
		AuditLog.create = async () => ({});
	});

	afterEach(() => {
		config.emailForwardDomain = originalEmailForwardDomain;
		Project.findOne = originalProjectFindOne;
		Email.findOne = originalEmailFindOne;
		Email.create = originalEmailCreate;
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
				to: `${projectId}@email.kumbukum.com`,
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
				recipients: [`${projectId}@email.kumbukum.com`],
				session: {
					recipient: `${projectId}@email.kumbukum.com`,
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

	it('moves filtered imported email to trash', async () => {
		Project.findOne = () => ({
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
				to: `${projectId}@email.kumbukum.com`,
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
