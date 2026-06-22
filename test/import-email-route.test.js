import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import importRoutes from '../routes/import.js';
import { Project } from '../model/project.js';
import { Email } from '../model/email.js';
import { EmailIdentity } from '../model/email_identity.js';
import { AuditLog } from '../model/audit_log.js';
import { Tenant } from '../modules/tenancy.js';

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
	const emailIds = [
		'507f1f77bcf86cd799439101',
		'507f1f77bcf86cd799439102',
		'507f1f77bcf86cd799439103',
	];
	const originalEmailForwardDomain = config.emailForwardDomain;
	const originalProjectFindOne = Project.findOne;
	const originalEmailFindOne = Email.findOne;
	const originalEmailCreate = Email.create;
	const originalEmailFind = Email.find;
	const originalEmailUpdateOne = Email.updateOne;
	const originalEmailIdentityFindOne = EmailIdentity.findOne;
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
			}),
		});
		Email.findOne = (query) => {
			if (query.message_id) return Promise.resolve(null);
			return {
				lean: async () => null,
			};
		};
		Email.create = async (payload) => ({
			_id: { toString: () => emailIds[0] },
			...payload,
		});
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});
		Email.updateOne = async () => ({ modifiedCount: 1 });
		EmailIdentity.findOne = () => ({
			select: () => ({
				lean: async () => null,
			}),
		});
		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => ({ plan: 'pro', settings: { email: { auto_triage_incoming: false }, ai_instructions: {} } }),
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
		Email.updateOne = originalEmailUpdateOne;
		EmailIdentity.findOne = originalEmailIdentityFindOne;
		Tenant.findOne = originalTenantFindOne;
		AuditLog.create = originalAuditLogCreate;
	});

	it('ingests forwarded text email and ignores attachments', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
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
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
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
			return { _id: { toString: () => emailIds[1] }, ...payload };
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
			assert.deepEqual(json, { accepted: true, email_id: emailIds[1] });
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
			return { _id: { toString: () => emailIds[2] }, ...payload };
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
			assert.deepEqual(json, { accepted: true, email_id: emailIds[2] });
			assert.equal(createdPayload.project, projectId);
			assert.deepEqual(createdPayload.to, ['nitai@fastmail.com']);
			assert.deepEqual(createdPayload.from, ['nitai@helpmonks.com']);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('archives and untriages BCC project replies from configured identities', async () => {
		Project.findOne = () => ({
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
				email_filter: 'support@example.com',
			}),
		});
		let identityQuery = null;
		let createdPayload = null;
		EmailIdentity.findOne = (query) => {
			identityQuery = query;
			return {
				select: () => ({
					lean: async () => ({ _id: 'identity-1' }),
				}),
			};
		};
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<bcc-reply-1@example.com>',
				from: 'Support <support@example.com>',
				to: 'customer@example.com',
				bcc: `${projectId}@email.kumbukum.com`,
				recipients: [`${projectId}@email.kumbukum.com`],
				session: {
					recipient: `${projectId}@email.kumbukum.com`,
					sender: 'support@example.com',
				},
				subject: 'Re: Customer question',
				text: 'Reply copy',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
			assert.equal(identityQuery.host_id, 'host-1');
			assert.equal(identityQuery.project, projectId);
			assert.equal(identityQuery.email, 'support@example.com');
			assert.equal(createdPayload.mailbox, 'archived');
			assert.deepEqual(createdPayload.labels, []);
			assert.equal(createdPayload.triaged, false);
			assert.equal(createdPayload.triaged_at, null);
			assert.equal(createdPayload.in_trash, false);
			assert.deepEqual(createdPayload.bcc, [`${projectId}@email.kumbukum.com`]);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('archives and untriages envelope-only BCC project replies from configured identities', async () => {
		let identityQuery = null;
		let createdPayload = null;
		EmailIdentity.findOne = (query) => {
			identityQuery = query;
			return {
				select: () => ({
					lean: async () => ({ _id: 'identity-1' }),
				}),
			};
		};
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[2] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<bcc-envelope-reply-1@example.com>',
				from: 'Support <support@example.com>',
				to: 'customer@example.com',
				recipients: [`${projectId}@email.kumbukum.com`],
				session: {
					recipient: `${projectId}@email.kumbukum.com`,
					sender: 'support@example.com',
				},
				subject: 'Re: Customer question',
				text: 'Reply copy',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[2] });
			assert.equal(identityQuery.host_id, 'host-1');
			assert.equal(identityQuery.project, projectId);
			assert.equal(identityQuery.email, 'support@example.com');
			assert.equal(createdPayload.mailbox, 'archived');
			assert.deepEqual(createdPayload.labels, []);
			assert.equal(createdPayload.triaged, false);
			assert.equal(createdPayload.triaged_at, null);
			assert.deepEqual(createdPayload.to, ['customer@example.com']);
			assert.deepEqual(createdPayload.bcc, []);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('archives ForwardEmail delivery-recipient BCC copies when visible To is only in headers', async () => {
		let createdPayload = null;
		EmailIdentity.findOne = () => ({
			select: () => ({
				lean: async () => ({ _id: 'identity-1' }),
			}),
		});
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[2] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<forwardemail-bcc-reply-1@example.com>',
				from: 'Support <support@example.com>',
				to: `${projectId}@email.kumbukum.com`,
				recipient: `${projectId}@email.kumbukum.com`,
				headers: {
					To: 'Customer <customer@example.com>',
				},
				subject: 'Re: Customer question',
				text: 'Reply copy',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[2] });
			assert.equal(createdPayload.mailbox, 'archived');
			assert.deepEqual(createdPayload.labels, []);
			assert.equal(createdPayload.triaged, false);
			assert.equal(createdPayload.triaged_at, null);
			assert.deepEqual(createdPayload.to, ['customer@example.com']);
			assert.deepEqual(createdPayload.cc, []);
			assert.deepEqual(createdPayload.bcc, []);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('archives BCC project replies from common envelope recipient fields', async () => {
		const createdPayloads = [];
		EmailIdentity.findOne = () => ({
			select: () => ({
				lean: async () => ({ _id: 'identity-1' }),
			}),
		});
		Email.create = async (payload) => {
			createdPayloads.push(payload);
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const cases = [
			{
				name: 'delivered-to',
				payload: {
					headers: { 'Delivered-To': `${projectId}@email.kumbukum.com` },
				},
			},
			{
				name: 'envelope-to',
				payload: {
					headerLines: [{ key: 'Envelope-To', value: `${projectId}@email.kumbukum.com` }],
				},
			},
			{
				name: 'original-recipient',
				payload: {
					OriginalRecipient: `rfc822;${projectId}@email.kumbukum.com`,
				},
			},
			{
				name: 'ses-receipt',
				payload: {
					receipt: { recipients: [`${projectId}@email.kumbukum.com`] },
				},
			},
			{
				name: 'received-for',
				payload: {
					headers: [
						{ key: 'Received', value: `from mail.example.com by mx.example.com for <${projectId}@email.kumbukum.com>; Thu, 4 Jun 2026 23:00:00 +0000` },
					],
				},
			},
		];

		const server = createServer();
		try {
			for (const testCase of cases) {
				const response = await request(server, JSON.stringify({
					message_id: `<bcc-${testCase.name}@example.com>`,
					from: 'Support <support@example.com>',
					to: 'customer@example.com',
					subject: 'Re: Customer question',
					text: 'Reply copy',
					...testCase.payload,
				}));
				const json = await response.json();

				assert.equal(response.status, 200, testCase.name);
				assert.deepEqual(json, { accepted: true, email_id: emailIds[0] }, testCase.name);
			}

			assert.equal(createdPayloads.length, cases.length);
			for (const payload of createdPayloads) {
				assert.equal(payload.mailbox, 'archived');
				assert.deepEqual(payload.labels, []);
				assert.equal(payload.triaged, false);
				assert.equal(payload.triaged_at, null);
				assert.deepEqual(payload.to, ['customer@example.com']);
				assert.deepEqual(payload.cc, []);
				assert.deepEqual(payload.bcc, []);
			}
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('keeps visible CC project-address mail from configured identities as inbox mail', async () => {
		let createdPayload = null;
		EmailIdentity.findOne = () => ({
			select: () => ({
				lean: async () => ({ _id: 'identity-1' }),
			}),
		});
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<visible-cc-identity-1@example.com>',
				from: 'Support <support@example.com>',
				to: 'customer@example.com',
				cc: `${projectId}@email.kumbukum.com`,
				recipients: [`${projectId}@email.kumbukum.com`],
				session: {
					recipient: `${projectId}@email.kumbukum.com`,
					sender: 'support@example.com',
				},
				subject: 'Visible copy',
				text: 'Visible inbound copy',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
			assert.equal(createdPayload.mailbox, 'inbox');
			assert.equal(createdPayload.triaged, false);
			assert.equal(createdPayload.triaged_at, null);
			assert.deepEqual(createdPayload.cc, [`${projectId}@email.kumbukum.com`]);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('keeps later visible inbound replies on the same thread as untriaged inbox mail', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<customer-reopen-1@example.com>',
				in_reply_to: '<bcc-reply-1@example.com>',
				references: ['<root-question-1@example.com>', '<bcc-reply-1@example.com>'],
				from: 'Customer <customer@example.com>',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'Re: Customer question',
				text: 'New customer response',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
			assert.equal(createdPayload.mailbox, 'inbox');
			assert.deepEqual(createdPayload.labels, []);
			assert.equal(createdPayload.triaged, false);
			assert.equal(createdPayload.triaged_at, null);
			assert.deepEqual(createdPayload.to, [`${projectId}@email.kumbukum.com`]);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('keeps direct project-address mail from configured identities as inbox mail', async () => {
		let createdPayload = null;
		EmailIdentity.findOne = () => ({
			select: () => ({
				lean: async () => ({ _id: 'identity-1' }),
			}),
		});
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<direct-identity-1@example.com>',
				from: 'Support <support@example.com>',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'Direct note',
				text: 'Direct inbound copy',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
			assert.equal(createdPayload.mailbox, 'inbox');
			assert.equal(createdPayload.triaged, false);
			assert.equal(createdPayload.triaged_at, null);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('keeps BCC project emails from unknown senders as inbox mail', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[1] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<bcc-unknown-1@example.com>',
				from: 'Customer <customer@example.com>',
				to: 'support@example.com',
				bcc: `${projectId}@email.kumbukum.com`,
				recipients: [`${projectId}@email.kumbukum.com`],
				session: {
					recipient: `${projectId}@email.kumbukum.com`,
					sender: 'customer@example.com',
				},
				subject: 'Customer copy',
				text: 'Inbox copy',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[1] });
			assert.equal(createdPayload.mailbox, 'inbox');
			assert.equal(createdPayload.triaged, false);
			assert.equal(createdPayload.triaged_at, null);
			assert.equal(createdPayload.in_trash, false);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('trashes forwarded email when sender matches the project email filter', async () => {
		Project.findOne = () => ({
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
				email_filter: 'noisy.com\nspam@bad.com',
			}),
		});
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<filtered-1@example.com>',
				from: 'Newsletter <hello@noisy.com>',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'Filtered',
				text: 'Body',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
			assert.equal(createdPayload.in_trash, true);
			assert.ok(createdPayload.trashed_at instanceof Date);
			assert.equal(createdPayload.triaged, false);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('trashes forwarded email when subject matches the project email filter', async () => {
		Project.findOne = () => ({
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
				email_filter: 'subject contains: status message',
			}),
		});
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<filtered-subject-1@example.com>',
				from: 'Monitor <monitor@example.com>',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'Daily status message',
				text: 'Body',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
			assert.equal(createdPayload.in_trash, true);
			assert.ok(createdPayload.trashed_at instanceof Date);
			assert.equal(createdPayload.triaged, false);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('moves forwarded email to spam when subject matches the account spam guard', async () => {
		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => ({
					plan: 'pro',
					settings: {
						email: {
							auto_triage_incoming: true,
							spam_guard: 'subject contains: guarded offer',
						},
						ai_instructions: {},
					},
				}),
			}),
		});
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<guarded-forwarded-1@example.com>',
				from: 'Marketer <marketer@example.com>',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'Guarded offer',
				text: 'Body',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.deepEqual(json, { accepted: true, email_id: emailIds[0] });
			assert.equal(createdPayload.mailbox, 'spam');
			assert.equal(createdPayload.in_trash, false);
			assert.equal(createdPayload.triaged, true);
			assert.equal(createdPayload.triage_primary_action, 'spam');
			assert.equal(createdPayload.triage_status, 'complete');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('does not trash forwarded email when sender does not match the project email filter', async () => {
		Project.findOne = () => ({
			lean: async () => ({
				_id: projectId,
				owner: '507f1f77bcf86cd799439012',
				host_id: 'host-1',
				is_active: true,
				email_filter: 'noisy.com',
			}),
		});
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => emailIds[0] }, ...payload };
		};

		const server = createServer();
		try {
			const response = await request(server, JSON.stringify({
				message_id: '<unfiltered-1@example.com>',
				from: 'Friend <friend@good.com>',
				to: `${projectId}@email.kumbukum.com`,
				subject: 'Not filtered',
				text: 'Body',
			}));
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.equal(createdPayload.in_trash, false);
			assert.equal(createdPayload.trashed_at, null);
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
