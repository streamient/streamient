import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import importRoutes from '../routes/import.js';
import { Project } from '../model/project.js';
import { Email } from '../model/email.js';

function createServer() {
	const app = express();
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

	beforeEach(() => {
		config.emailForwardDomain = 'email.kumbukum.com';
		Project.findOne = () => ({
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
			}),
		});
		Email.findOne = async () => null;
		Email.create = async (payload) => ({
			_id: { toString: () => 'email-1' },
			...payload,
		});
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});
	});

	afterEach(() => {
		config.emailForwardDomain = originalEmailForwardDomain;
		Project.findOne = originalProjectFindOne;
		Email.findOne = originalEmailFindOne;
		Email.create = originalEmailCreate;
		Email.find = originalEmailFind;
	});

	it('ingests forwarded text email and ignores attachments', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => 'email-1' }, ...payload };
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
			assert.deepEqual(json, { accepted: true, email_id: 'email-1' });
			assert.equal(createdPayload.source, 'emailforwarding');
			assert.equal(createdPayload.project, projectId);
			assert.equal(createdPayload.text_content, 'Forwarded text');
			assert.equal(createdPayload.attachment_text_content, '');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('ingests stripped HTML when no plain text is present', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => 'email-2' }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<route-html@example.com>',
				from: 'Sender <sender@example.com>',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'HTML only',
				html: '<p>Hello <strong>HTML</strong></p><p>Only</p>',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: 'email-2' });
			assert.equal(createdPayload.text_content, 'Hello HTML Only');
			assert.match(createdPayload.html_content, /<p>Hello <strong>HTML<\/strong><\/p><p>Only<\/p>/);
			assert.equal(createdPayload.html_content_has_remote_images, false);
			assert.equal(createdPayload.attachment_text_content, '');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('routes Forward Email webhook payloads by session recipient instead of visible To header', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => 'email-3' }, ...payload };
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
			assert.deepEqual(json, { accepted: true, email_id: 'email-3' });
			assert.equal(createdPayload.project, projectId);
			assert.deepEqual(createdPayload.to, ['nitai@fastmail.com']);
			assert.deepEqual(createdPayload.from, ['nitai@helpmonks.com']);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('rejects forwarded email for the wrong domain', async () => {
		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				from: 'sender@example.com',
				to: `${projectId}@example.com`,
				subject: 'Wrong domain',
				text: 'Body',
			}));
			const json = await response.json();

			assert.equal(response.status, 403);
			assert.match(json.error, /EMAIL_FORWARD_DOMAIN/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('does not ingest when project is unknown', async () => {
		Project.findOne = () => ({
			lean: async () => null,
		});

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				from: 'sender@example.com',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'Unknown project',
				text: 'Body',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: false });
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('rejects invalid JSON', async () => {
		const server = createServer();
		try {
			const response = await request(server, '{');
			const json = await response.json();

			assert.equal(response.status, 400);
			assert.equal(json.error, 'Invalid JSON payload');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
