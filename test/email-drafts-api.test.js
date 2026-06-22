import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { Tenant } from '../modules/tenancy.js';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailLabel } from '../model/email_label.js';
import { EmailTriageRun } from '../model/email_triage_run.js';
import { EmailIdentity } from '../model/email_identity.js';
import { EmailInternalNote } from '../model/email_internal_note.js';
import { GraphLink } from '../model/graph_link.js';
import { AuditLog } from '../model/audit_log.js';

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
			const originalEmailDeleteMany = Email.deleteMany;
			const originalEmailUpdateOne = Email.updateOne;
			const originalEmailUpdateMany = Email.updateMany;
			const originalEmailCountDocuments = Email.countDocuments;
		const originalGraphDeleteMany = GraphLink.deleteMany;
		const originalAuditCreate = AuditLog.create;
	const originalLabelBulkWrite = EmailLabel.bulkWrite;
	const originalLabelFind = EmailLabel.find;
	const originalRunCreate = EmailTriageRun.create;
	const originalRunFindOne = EmailTriageRun.findOne;
	const originalRunFindOneAndUpdate = EmailTriageRun.findOneAndUpdate;
	const originalTenantFindOne = Tenant.findOne;
	const originalDraftFind = EmailDraft.find;
	const originalDraftFindOne = EmailDraft.findOne;
	const originalDraftFindOneAndUpdate = EmailDraft.findOneAndUpdate;
	const originalIdentityFind = EmailIdentity.find;
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
		EmailIdentity.find = () => ({
			select: () => ({
				sort: () => ({
					lean: async () => [],
				}),
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
				Email.deleteMany = originalEmailDeleteMany;
				Email.updateOne = originalEmailUpdateOne;
				Email.updateMany = originalEmailUpdateMany;
				Email.countDocuments = originalEmailCountDocuments;
			GraphLink.deleteMany = originalGraphDeleteMany;
			AuditLog.create = originalAuditCreate;
		EmailLabel.bulkWrite = originalLabelBulkWrite;
		EmailLabel.find = originalLabelFind;
		EmailTriageRun.create = originalRunCreate;
		EmailTriageRun.findOne = originalRunFindOne;
		EmailTriageRun.findOneAndUpdate = originalRunFindOneAndUpdate;
		Tenant.findOne = originalTenantFindOne;
		EmailDraft.find = originalDraftFind;
		EmailDraft.findOne = originalDraftFindOne;
		EmailDraft.findOneAndUpdate = originalDraftFindOneAndUpdate;
		EmailIdentity.find = originalIdentityFind;
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

			const deleteResponse = await request(server, 'DELETE', '/email-drafts/507f1f77bcf86cd799439099');
			const deleteJson = await readJson(deleteResponse);

			assert.equal(deleteResponse.status, 200);
			assert.equal(updatePayload.query._id, '507f1f77bcf86cd799439099');
			assert.equal(updatePayload.query.host_id, 'host-1');
			assert.equal(updatePayload.update.$set.status, 'discarded');
			assert.equal(deleteJson.message, 'Email draft deleted');
			assert.equal(deleteJson.draft.status, 'discarded');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

		it('rejects invalid manual draft recipients', async () => {
			EmailDraft.findOne = () => ({
				lean: async () => ({ _id: '507f1f77bcf86cd799439099', project: 'project-1', status: 'draft' }),
		});
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

		it('empties spam only after explicit confirmation', async () => {
			const spamDocs = [
				{ _id: { toString: () => 'spam-1' } },
				{ _id: { toString: () => 'spam-2' } },
			];
			let findQuery = null;
			let deleteQuery = null;
			const indexUpdates = [];
			const graphQueries = [];
			const auditLogs = [];

			Email.find = (query) => {
				findQuery = query;
				return {
					select: (fields) => {
						assert.equal(fields, '_id');
						return {
							lean: async () => spamDocs,
						};
					},
				};
			};
			Email.deleteMany = async (query) => {
				deleteQuery = query;
				return { deletedCount: 2 };
			};
				Email.updateMany = async (query, update, options) => {
					indexUpdates.push({ query, update, options });
					return { modifiedCount: 0 };
				};
			GraphLink.deleteMany = async (query) => {
				graphQueries.push(query);
				return { deletedCount: 1 };
			};
			AuditLog.create = async (payload) => {
				auditLogs.push(payload);
				return payload;
			};

			const server = await createServer();
			try {
				const rejectedResponse = await request(server, 'DELETE', '/emails/spam');
				const rejectedJson = await readJson(rejectedResponse);

				assert.equal(rejectedResponse.status, 400);
				assert.equal(rejectedJson.error, 'confirm=true required');
				assert.equal(findQuery, null);

				const response = await request(server, 'DELETE', '/emails/spam?confirm=true');
				const json = await readJson(response);

				assert.equal(response.status, 200);
				assert.equal(json.deleted, 2);
				assert.equal(json.message, 'Spam emptied, 2 emails deleted');
				assert.deepEqual(findQuery, { host_id: 'host-1', mailbox: 'spam', in_trash: { $ne: true } });
				assert.deepEqual(deleteQuery, { _id: { $in: ['spam-1', 'spam-2'] }, host_id: 'host-1', mailbox: 'spam', in_trash: { $ne: true } });
				assert.deepEqual(indexUpdates.map((call) => call.query), [
					{ _id: { $in: ['spam-1', 'spam-2'] }, host_id: 'host-1' },
				]);
				assert.deepEqual(graphQueries.sort((a, b) => String(a.$or?.[0]?.source_id || '').localeCompare(String(b.$or?.[0]?.source_id || ''))), [
					{ host_id: 'host-1', $or: [{ source_id: 'spam-1' }, { target_id: 'spam-1' }] },
					{ host_id: 'host-1', $or: [{ source_id: 'spam-2' }, { target_id: 'spam-2' }] },
				]);
				assert.equal(auditLogs[0].details.mailbox, 'spam');
				assert.equal(auditLogs[0].details.deleted, 2);
			} finally {
				await new Promise((resolve) => server.close(resolve));
			}
		});

		it('normalizes Tagify recipient objects in draft updates', async () => {
			let updatePayload = null;
		EmailDraft.findOne = () => ({
			lean: async () => ({ _id: '507f1f77bcf86cd799439099', project: 'project-1', status: 'draft' }),
		});
		EmailDraft.findOneAndUpdate = (query, update) => {
			updatePayload = update.$set;
			return {
				lean: async () => ({ _id: query._id, ...update.$set }),
			};
		};

		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/email-drafts/507f1f77bcf86cd799439099', {
				to: [{ value: 'nitai@fastmail.com' }],
				cc: [{ email: 'copy@example.com' }],
				bcc: [{ text: 'Hidden <hidden@example.com>' }],
				body_text: 'Hello',
			});
			const json = await readJson(response);

			assert.equal(response.status, 200);
			assert.deepEqual(updatePayload.to, ['nitai@fastmail.com']);
			assert.deepEqual(updatePayload.cc, ['copy@example.com']);
			assert.deepEqual(updatePayload.bcc, ['hidden@example.com']);
			assert.deepEqual(json.draft.to, ['nitai@fastmail.com']);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('defaults and validates draft from against project outbound identities', async () => {
		let draftPayload = null;
		const identities = [
			{ _id: 'identity-sales', email: 'sales@example.com', name: 'Sales', signature: '' },
			{ _id: 'identity-support', email: 'support@example.com', name: 'Support', signature: '' },
		];
		EmailIdentity.find = () => ({
			select: () => ({
				sort: () => ({
					lean: async () => identities,
				}),
			}),
		});
		const email = {
			_id: 'email-1',
			message_id: 'inbound@example.com',
			references: [],
			in_reply_to: '',
			mailbox: 'inbox',
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			from: ['customer@example.com'],
			to: ['Support <support@example.com>'],
			subject: 'Question',
			host_id: 'host-1',
		};
		Email.findOne = () => ({
			lean: async () => ({
				...email,
			}),
		});
		Email.find = () => ({
			lean: async () => [email],
		});
		EmailDraft.findOne = () => ({
			sort: () => ({
				lean: async () => null,
			}),
		});
		EmailDraft.findOneAndUpdate = (query, update) => {
			draftPayload = update.$set;
			return { _id: 'draft-1', ...update.$set };
		};

		const server = await createServer();
		try {
			const defaultResponse = await request(server, 'POST', '/emails/email-1/draft-reply', {
				body_text: 'Hello',
			});
			const defaultJson = await readJson(defaultResponse);

			assert.equal(defaultResponse.status, 200);
			assert.equal(draftPayload.from, 'support@example.com');
			assert.equal(defaultJson.draft.from, 'support@example.com');

			const selectedResponse = await request(server, 'POST', '/emails/email-1/draft-reply', {
				from: 'sales@example.com',
				body_text: 'Hello',
			});
			assert.equal(selectedResponse.status, 200);
			assert.equal(draftPayload.from, 'sales@example.com');

			const rejectedResponse = await request(server, 'POST', '/emails/email-1/draft-reply', {
				from: 'other@example.com',
				body_text: 'Hello',
			});
			const rejectedJson = await readJson(rejectedResponse);

			assert.equal(rejectedResponse.status, 400);
			assert.match(rejectedJson.error, /from must match a configured outbound email address/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('creates draft replies against the latest non-sent thread message when selected email is sent', async () => {
		let draftQuery = null;
		let draftPayload = null;
		const sent = {
			_id: 'sent-1',
			message_id: 'sent-1@example.com',
			references: ['root@example.com'],
			in_reply_to: 'root@example.com',
			mailbox: 'sent',
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			from: ['support@example.com'],
			to: ['old-customer@example.com'],
			subject: 'Re: Question',
			host_id: 'host-1',
			createdAt: '2026-01-01T11:00:00.000Z',
		};
		const root = {
			_id: 'root-1',
			message_id: 'root@example.com',
			references: [],
			in_reply_to: '',
			mailbox: 'inbox',
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			from: ['old-customer@example.com'],
			to: ['support@example.com'],
			subject: 'Question',
			host_id: 'host-1',
			createdAt: '2026-01-01T10:00:00.000Z',
		};
		const latestInbound = {
			_id: 'latest-inbound',
			message_id: 'latest@example.com',
			references: ['root@example.com'],
			in_reply_to: 'sent-1@example.com',
			mailbox: 'inbox',
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			from: ['new-customer@example.com'],
			to: ['Support <support@example.com>'],
			subject: 'Follow-up',
			host_id: 'host-1',
			createdAt: '2026-01-01T12:00:00.000Z',
		};

		EmailIdentity.find = () => ({
			select: () => ({
				sort: () => ({
					lean: async () => [{ _id: 'identity-support', email: 'support@example.com', name: 'Support', signature: '' }],
				}),
			}),
		});
		Email.findOne = (query) => ({
			lean: async () => {
				if (String(query._id) === 'latest-inbound') return latestInbound;
				if (String(query._id) === 'root-1') return root;
				return sent;
			},
		});
		Email.find = (query) => ({
			lean: async () => {
				const messageId = query?.$or?.[0]?.message_id || query?.$or?.[1]?.references || query?.$or?.[2]?.in_reply_to;
				if (messageId === 'sent-1@example.com') return [sent, latestInbound];
				if (messageId === 'root@example.com') return [root, sent, latestInbound];
				if (messageId === 'latest@example.com') return [latestInbound];
				return [];
			},
		});
		EmailDraft.findOne = (query) => {
			draftQuery = query;
			return {
				sort: () => ({
					lean: async () => null,
				}),
			};
		};
		EmailDraft.findOneAndUpdate = (query, update) => {
			draftQuery = query;
			draftPayload = update.$set;
			return { _id: 'draft-1', source_email: query.source_email, ...update.$set };
		};

		const server = await createServer();
		try {
			const response = await request(server, 'POST', '/emails/sent-1/draft-reply', {
				body_text: 'Reply body',
			});
			const json = await readJson(response);

			assert.equal(response.status, 200);
			assert.equal(String(draftQuery.source_email), 'latest-inbound');
			assert.equal(draftPayload.from, 'support@example.com');
			assert.deepEqual(draftPayload.to, ['new-customer@example.com']);
			assert.equal(draftPayload.subject, 'Re: Follow-up');
			assert.equal(json.draft.source_email, 'latest-inbound');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('falls back to the selected sent email when a thread has no non-sent message', async () => {
		let draftPayload = null;
		const sent = {
			_id: 'sent-only',
			message_id: 'sent-only@example.com',
			references: [],
			in_reply_to: '',
			mailbox: 'sent',
			project: 'project-1',
			owner: '507f1f77bcf86cd799439011',
			from: ['support@example.com'],
			to: ['customer@example.com'],
			subject: 'Sent only',
			host_id: 'host-1',
			createdAt: '2026-01-01T11:00:00.000Z',
		};

		EmailIdentity.find = () => ({
			select: () => ({
				sort: () => ({
					lean: async () => [{ _id: 'identity-support', email: 'support@example.com', name: 'Support', signature: '' }],
				}),
			}),
		});
		Email.findOne = () => ({
			lean: async () => sent,
		});
		Email.find = () => ({
			lean: async () => [sent],
		});
		EmailDraft.findOne = () => ({
			sort: () => ({
				lean: async () => null,
			}),
		});
		EmailDraft.findOneAndUpdate = (query, update) => {
			draftPayload = update.$set;
			return { _id: 'draft-1', source_email: query.source_email, ...update.$set };
		};

		const server = await createServer();
		try {
			const response = await request(server, 'POST', '/emails/sent-only/draft-reply', {
				body_text: 'Reply body',
			});
			const json = await readJson(response);

			assert.equal(response.status, 200);
			assert.equal(json.draft.source_email, 'sent-only');
			assert.deepEqual(draftPayload.to, ['support@example.com']);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('enforces the ten-address draft recipient limit', async () => {
		let updatePayload = null;
		EmailDraft.findOne = () => ({
			lean: async () => ({ _id: '507f1f77bcf86cd799439099', project: 'project-1', status: 'draft' }),
		});
		EmailDraft.findOneAndUpdate = (query, update) => {
			updatePayload = update.$set;
			return {
				lean: async () => ({ _id: query._id, ...update.$set }),
			};
		};

		const ten = Array.from({ length: 10 }, (_, index) => `person${index}@example.com`);
		const eleven = Array.from({ length: 11 }, (_, index) => `person${index}@example.com`);

		const server = await createServer();
		try {
			const acceptedResponse = await request(server, 'PUT', '/email-drafts/507f1f77bcf86cd799439099', {
				to: ten,
				body_text: 'Hello',
			});
			assert.equal(acceptedResponse.status, 200);
			assert.deepEqual(updatePayload.to, ten);

			const rejectedResponse = await request(server, 'PUT', '/email-drafts/507f1f77bcf86cd799439099', {
				to: eleven,
				body_text: 'Hello',
			});
			const rejectedJson = await readJson(rejectedResponse);
			assert.equal(rejectedResponse.status, 400);
			assert.match(rejectedJson.error, /to cannot contain more than 10 addresses/);
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

	it('queues inbox triage asynchronously for account members and exposes run status', async () => {
		let currentRun = null;
		let findLimit = null;
		Email.countDocuments = async (query) => {
			assert.equal(query.host_id, 'host-1');
			assert.equal(query.mailbox, 'inbox');
			assert.equal(query.triaged, false);
			return 125;
		};
		EmailTriageRun.create = async (doc) => {
			currentRun = { ...doc, createdAt: new Date(), updatedAt: new Date() };
			return currentRun;
		};
		EmailTriageRun.findOne = () => ({
			lean: async () => currentRun,
		});
		EmailTriageRun.findOneAndUpdate = async (query, update) => {
			assert.equal(query.host_id, 'host-1');
			assert.equal(query.run_id, 'api-run-1');
			currentRun = { ...currentRun, ...update.$set, updatedAt: new Date() };
			return currentRun;
		};
		EmailLabel.bulkWrite = async () => ({});
		EmailLabel.find = () => ({
			sort: () => ({
				lean: async () => [],
			}),
		});
		Email.find = () => ({
			sort: () => ({
				limit: (limit) => ({
					lean: async () => {
						findLimit = limit;
						return [];
					},
				}),
			}),
		});
		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => ({ settings: { ai_instructions: {} } }),
			}),
		});
		TenantMember.find = () => ({
			populate: () => ({
				lean: async () => [{
					_id: { toString: () => 'membership-1' },
					role: 'member',
					tenant: {
						_id: { toString: () => '507f1f77bcf86cd799439012' },
						host_id: 'host-1',
						name: 'Test Account',
						is_active: true,
					},
				}],
			}),
		});

		const server = await createServer();
		try {
			const response = await request(server, 'POST', '/emails/triage-inbox', { run_id: 'api-run-1' });
			const json = await readJson(response);

			assert.equal(response.status, 202);
			assert.equal(json.run_id, 'api-run-1');
			assert.equal(json.status, 'queued');
			assert.equal(json.total, 125);
			assert.equal(json.run.limit, 0);
			assert.equal(json.run.member_role, 'member');

			await new Promise((resolve) => setImmediate(resolve));
			await new Promise((resolve) => setImmediate(resolve));

			const statusResponse = await request(server, 'GET', '/emails/triage-runs/api-run-1');
			const statusJson = await readJson(statusResponse);

			assert.equal(statusResponse.status, 200);
			assert.equal(statusJson.run.status, 'completed');
			assert.equal(statusJson.run.processed, 0);
			assert.equal(statusJson.run.limit, 0);
			assert.equal(findLimit, 0);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
