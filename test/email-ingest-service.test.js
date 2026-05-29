import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseEmailInput, parseForwardedEmailInput, ingestEmail, ingestForwardedEmail, getEmailThread, getEmailThreadDraft, listEmails, listEmailLabels, parseTriageResult, triageInboxEmails, backfillEmailTriageState, askEmailAi, askEmailListAi, buildEmailAiTypesenseFilter, buildTriageContext, parseEmailAiQuery, resetEmailTriage, updateEmail, parseEmailReplySuggestionsResult, suggestEmailReplies, suggestFromEmailAddresses, matchesEmailFilter } from '../services/email_ingest_service.js';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailLabel } from '../model/email_label.js';
import { GraphLink } from '../model/graph_link.js';
import { Tenant } from '../modules/tenancy.js';
import { toTypesenseDoc } from '../modules/typesense.js';

describe('Email ingest service', () => {
	const userId = '507f1f77bcf86cd799439012';

	it('matchesEmailFilter matches exact addresses, domains, and local parts, ignoring blanks', () => {
		const filter = 'spam@bad.com\nnoisy.com, @also-noisy.com\n';
		assert.equal(matchesEmailFilter(filter, ['spam@bad.com']), true);
		assert.equal(matchesEmailFilter(filter, ['anyone@noisy.com']), true);
		assert.equal(matchesEmailFilter(filter, ['anyone@also-noisy.com']), true);
		assert.equal(matchesEmailFilter(filter, ['SPAM@BAD.COM']), true);
		assert.equal(matchesEmailFilter(filter, ['friend@good.com']), false);
		assert.equal(matchesEmailFilter(filter, ['someone@notbad.com']), false);
		assert.equal(matchesEmailFilter('', ['spam@bad.com']), false);
		assert.equal(matchesEmailFilter('   ', ['spam@bad.com']), false);
		assert.equal(matchesEmailFilter('spam@bad.com', []), false);

		// local-part-only rules match the name on any domain (both "noreply@" and "noreply@*")
		assert.equal(matchesEmailFilter('noreply@', ['noreply@anywhere.com']), true);
		assert.equal(matchesEmailFilter('noreply@*', ['noreply@other.org']), true);
		assert.equal(matchesEmailFilter('noreply@', ['no-reply@anywhere.com']), false);
		assert.equal(matchesEmailFilter('noreply@', ['hello@noreply.com']), false);
	});

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
		assert.match(normalized.html_content, /<p>Hello <b>Team<\/b><\/p>/);
		assert.equal(normalized.html_content_has_remote_images, false);
	});

	it('sanitizes parsed HTML and rewrites remote image URLs', async () => {
		const normalized = await parseEmailInput({
			parsed_email: {
				message_id: '<html-sanitize@example.com>',
				from: 'sender@example.com',
				to: 'to@example.com',
				subject: 'HTML sanitize',
				html: '<div onclick="alert(1)" style="color:red;background-image:url(https://evil.example/x)">Hi<script>alert(1)</script><img src="https://cdn.example/image.png" onerror="alert(2)"><img src="cid:local-image"></div>',
			},
		});

		assert.match(normalized.text_content, /Hi/);
		assert.equal(normalized.html_content_has_remote_images, true);
		assert.match(normalized.html_content, /data-kk-remote-src="https:\/\/cdn\.example\/image\.png"/);
		assert.match(normalized.html_content, /<img src="cid:local-image" \/>/);
		assert.doesNotMatch(normalized.html_content, /script|onclick|onerror|background-image/i);
		assert.doesNotMatch(normalized.html_content, /<img\s+src="https:\/\/cdn\.example\/image\.png"/);
	});

	it('stores sanitized HTML from raw multipart email', async () => {
		const raw = [
			'Message-ID: <raw-html@example.com>',
			'From: Sender <sender@example.com>',
			'To: Team <team@example.com>',
			'Subject: Raw HTML',
			'MIME-Version: 1.0',
			'Content-Type: multipart/alternative; boundary="abc"',
			'',
			'--abc',
			'Content-Type: text/plain; charset=utf-8',
			'',
			'Plain body',
			'--abc',
			'Content-Type: text/html; charset=utf-8',
			'',
			'<table><tr><td style="color:#333">HTML body</td></tr></table><form><input name="x"></form>',
			'--abc--',
		].join('\r\n');

		const normalized = await parseEmailInput({ raw_email: raw });

		assert.equal(normalized.message_id, 'raw-html@example.com');
		assert.equal(normalized.text_content, 'Plain body');
		assert.match(normalized.html_content, /<table>/);
		assert.match(normalized.html_content, /HTML body/);
		assert.doesNotMatch(normalized.html_content, /form|input/i);
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
		assert.match(normalized.html_content, /<div>Hello <strong>HTML<\/strong><br \/>Only<\/div>/);
		assert.equal(normalized.attachment_text_content, '');
	});

	it('sanitizes HTML updates before storing', async () => {
		const originalFindOneAndUpdate = Email.findOneAndUpdate;
		let updatePayload = null;

		Email.findOneAndUpdate = async (query, update) => {
			assert.deepEqual(query, { _id: 'email-1', host_id: 'host-1' });
			updatePayload = update.$set;
			return { _id: 'email-1', host_id: 'host-1', ...update.$set };
		};

		try {
			const email = await updateEmail('host-1', 'email-1', {
				html_content: '<p onclick="alert(1)">Updated<img src="https://cdn.example/update.png"></p>',
			}, { skipSideEffects: true });

			assert.equal(updatePayload.html_content_has_remote_images, true);
			assert.match(updatePayload.html_content, /data-kk-remote-src="https:\/\/cdn\.example\/update\.png"/);
			assert.doesNotMatch(updatePayload.html_content, /onclick|<img\s+src="https:\/\/cdn\.example\/update\.png"/);
			assert.equal(email.html_content, updatePayload.html_content);
		} finally {
			Email.findOneAndUpdate = originalFindOneAndUpdate;
		}
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

	it('indexes updated emails immediately after Mongo commit', async () => {
		let indexed = null;
		let indexStateUpdate = null;
		const originalFindOneAndUpdate = Email.findOneAndUpdate;

		Email.findOneAndUpdate = async (query, update) => ({
			_id: '507f1f77bcf86cd799439099',
			host_id: query.host_id,
			project: '507f1f77bcf86cd799439011',
			subject: update.$set.subject,
			mailbox: 'inbox',
			triaged: false,
			in_trash: false,
		});

		try {
			await updateEmail('host-1', '507f1f77bcf86cd799439099', { subject: 'Fresh subject' }, {
				indexEmailFn: async (hostId, type, email) => {
					indexed = { hostId, type, email };
				},
				updateEmailIndexStateFn: async (query, update, options) => {
					indexStateUpdate = { query, update, options };
				},
			});

			assert.equal(indexed.hostId, 'host-1');
			assert.equal(indexed.type, 'emails');
			assert.equal(indexed.email.subject, 'Fresh subject');
			assert.deepEqual(indexStateUpdate.update, { $set: { is_indexed: true } });
		} finally {
			Email.findOneAndUpdate = originalFindOneAndUpdate;
		}
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

	it('defaults parsed email ingest to untriaged inbox with no labels', async () => {
		let createdPayload = null;
		const originalFindOne = Email.findOne;
		const originalCreate = Email.create;
		const originalFind = Email.find;

		Email.findOne = async () => null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => 'email-1' }, ...payload };
		};
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});

		try {
			await ingestEmail(userId, 'host-1', {
				project: '507f1f77bcf86cd799439011',
				parsed_email: {
					message_id: '<default-parsed@example.com>',
					from: 'sender@example.com',
					to: 'to@example.com',
					subject: 'Defaults',
					text: 'Default body',
				},
			}, { channel: 'api', skipSideEffects: true });

			assert.equal(createdPayload.mailbox, 'inbox');
			assert.equal(createdPayload.triaged, false);
			assert.deepEqual(createdPayload.labels, []);
		} finally {
			Email.findOne = originalFindOne;
			Email.create = originalCreate;
			Email.find = originalFind;
		}
	});

	it('defaults forwarded email ingest to untriaged inbox with no labels', async () => {
		let createdPayload = null;
		const originalFindOne = Email.findOne;
		const originalCreate = Email.create;
		const originalFind = Email.find;

		Email.findOne = async () => null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => 'email-2' }, ...payload };
		};
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});

		try {
			await ingestForwardedEmail(userId, 'host-1', {
				project: '507f1f77bcf86cd799439011',
				message_id: '<default-forwarded@example.com>',
				from: 'sender@example.com',
				to: '507f1f77bcf86cd799439011@email.kumbukum.com',
				subject: 'Forwarded defaults',
				text: 'Forwarded default body',
			}, { channel: 'emailforwarding', skipSideEffects: true });

			assert.equal(createdPayload.mailbox, 'inbox');
			assert.equal(createdPayload.triaged, false);
			assert.deepEqual(createdPayload.labels, []);
		} finally {
			Email.findOne = originalFindOne;
			Email.create = originalCreate;
			Email.find = originalFind;
		}
		});

		it('auto-triages only the newly created inbox email when enabled', async () => {
			const emailId = { toString: () => 'email-auto-1' };
			let createdEmail = null;
			let triageQuery = null;
			let updatePayload = null;
			const originalFindOne = Email.findOne;
			const originalCreate = Email.create;
			const originalFind = Email.find;
			const originalFindOneAndUpdate = Email.findOneAndUpdate;
			const originalBulkWrite = EmailLabel.bulkWrite;
			const originalLabelFind = EmailLabel.find;
			const originalTenantFindOne = Tenant.findOne;

			Email.findOne = async () => null;
			Email.create = async (payload) => {
				createdEmail = { _id: emailId, ...payload };
				return createdEmail;
			};
			Email.find = (query) => ({
				select: () => ({
					lean: async () => [],
				}),
				sort: () => ({
					limit: () => ({
						lean: async () => {
							triageQuery = query;
							return [createdEmail];
						},
					}),
				}),
			});
			Email.findOneAndUpdate = async (query, update) => {
				assert.equal(query._id, emailId);
				updatePayload = update.$set;
				return { _id: emailId, ...createdEmail, ...update.$set };
			};
			EmailLabel.bulkWrite = async () => ({});
			EmailLabel.find = () => ({
				sort: () => ({
					lean: async () => [],
				}),
			});
			Tenant.findOne = () => ({
				select: () => ({
					lean: async () => ({
						settings: {
							email: { auto_triage_incoming: true, send_draft_emails_automatically: true },
							ai_instructions: {},
						},
					}),
				}),
			});

			try {
				const email = await ingestEmail(userId, 'host-1', {
					project: '507f1f77bcf86cd799439011',
					parsed_email: {
						message_id: '<auto-triage@example.com>',
						from: 'sender@example.com',
						to: 'to@example.com',
						subject: 'Auto triage',
						text: 'Please reply',
					},
				}, {
					channel: 'api',
					awaitAutoTriage: true,
					indexEmailFn: async () => {},
					updateEmailIndexStateFn: async () => {},
					autoTriageOptions: {
						run_id: 'auto-run-1',
						skipSideEffects: true,
						searchKnowledgeFn: async () => ({}),
						getThreadFn: async () => [],
						getConnectionsFn: async () => ({ links: [], tag_connections: [] }),
						completionFn: async () => '{"primary_action":"reply-required","labels":["reply-required"],"summary":"Needs reply","reason":"Sender asked a question","confidence":0.9,"action_points":[{"text":"Reply","type":"reply"}],"related_context":[],"mailbox_action":"keep-inbox"}',
					},
				});

				assert.equal(email._id, emailId);
				assert.equal(triageQuery._id, 'email-auto-1');
				assert.equal(triageQuery.host_id, 'host-1');
				assert.equal(triageQuery.mailbox, 'inbox');
				assert.equal(triageQuery.triaged, false);
				assert.equal(updatePayload.triaged, true);
				assert.equal(updatePayload.triage_run_id, 'auto-run-1');
				assert.equal(updatePayload.triage_summary, 'Needs reply');
			} finally {
				Email.findOne = originalFindOne;
				Email.create = originalCreate;
				Email.find = originalFind;
				Email.findOneAndUpdate = originalFindOneAndUpdate;
				EmailLabel.bulkWrite = originalBulkWrite;
				EmailLabel.find = originalLabelFind;
				Tenant.findOne = originalTenantFindOne;
			}
		});

		it('does not auto-triage when only draft auto-send is enabled', async () => {
			const originalFindOne = Email.findOne;
			const originalCreate = Email.create;
			const originalFind = Email.find;
			const originalFindOneAndUpdate = Email.findOneAndUpdate;
			const originalTenantFindOne = Tenant.findOne;
			let triageUpdateCalled = false;

			Email.findOne = async () => null;
			Email.create = async (payload) => ({ _id: { toString: () => 'email-draft-setting-1' }, ...payload });
			Email.find = () => ({
				select: () => ({
					lean: async () => [],
				}),
			});
			Email.findOneAndUpdate = async () => {
				triageUpdateCalled = true;
				return null;
			};
			Tenant.findOne = () => ({
				select: () => ({
					lean: async () => ({
						settings: {
							email: { auto_triage_incoming: false, send_draft_emails_automatically: true },
							ai_instructions: {},
						},
					}),
				}),
			});

			try {
				const email = await ingestEmail(userId, 'host-1', {
					project: '507f1f77bcf86cd799439011',
					parsed_email: {
						message_id: '<draft-setting@example.com>',
						from: 'sender@example.com',
						to: 'to@example.com',
						subject: 'Draft setting',
						text: 'No triage should run',
					},
				}, {
					channel: 'api',
					awaitAutoTriage: true,
					indexEmailFn: async () => {},
					updateEmailIndexStateFn: async () => {},
				});

				assert.equal(email.triaged, false);
				assert.equal(triageUpdateCalled, false);
			} finally {
				Email.findOne = originalFindOne;
				Email.create = originalCreate;
				Email.find = originalFind;
				Email.findOneAndUpdate = originalFindOneAndUpdate;
				Tenant.findOne = originalTenantFindOne;
			}
		});

		it('does not fail ingestion when automatic triage fails', async () => {
			const emailId = { toString: () => 'email-auto-fail-1' };
			let createdEmail = null;
			let updatePayload = null;
			const originalFindOne = Email.findOne;
			const originalCreate = Email.create;
			const originalFind = Email.find;
			const originalFindOneAndUpdate = Email.findOneAndUpdate;
			const originalBulkWrite = EmailLabel.bulkWrite;
			const originalLabelFind = EmailLabel.find;
			const originalTenantFindOne = Tenant.findOne;
			const originalConsoleError = console.error;

			Email.findOne = async () => null;
			Email.create = async (payload) => {
				createdEmail = { _id: emailId, ...payload };
				return createdEmail;
			};
			Email.find = () => ({
				select: () => ({
					lean: async () => [],
				}),
				sort: () => ({
					limit: () => ({
						lean: async () => [createdEmail],
					}),
				}),
			});
			Email.findOneAndUpdate = async (query, update) => {
				updatePayload = update.$set;
				return { _id: query._id, ...createdEmail, ...update.$set };
			};
			EmailLabel.bulkWrite = async () => ({});
			EmailLabel.find = () => ({
				sort: () => ({
					lean: async () => [],
				}),
			});
			Tenant.findOne = () => ({
				select: () => ({
					lean: async () => ({
						settings: {
							email: { auto_triage_incoming: true, send_draft_emails_automatically: false },
							ai_instructions: {},
						},
					}),
				}),
			});
			console.error = () => {};

			try {
				const email = await ingestEmail(userId, 'host-1', {
					project: '507f1f77bcf86cd799439011',
					parsed_email: {
						message_id: '<auto-fail@example.com>',
						from: 'sender@example.com',
						to: 'to@example.com',
						subject: 'Auto triage fail',
						text: 'Please reply',
					},
				}, {
					channel: 'api',
					awaitAutoTriage: true,
					autoTriageOptions: {
						run_id: 'auto-run-fail',
						skipSideEffects: true,
						searchKnowledgeFn: async () => ({}),
						getThreadFn: async () => [],
						getConnectionsFn: async () => ({ links: [], tag_connections: [] }),
						completionFn: async () => {
							throw new Error('Provider unavailable');
						},
					},
				});

				assert.equal(email._id, emailId);
				assert.equal(updatePayload.triage_status, 'failed');
				assert.equal(updatePayload.triage_error, 'Provider unavailable');
				assert.equal(updatePayload.triage_run_id, 'auto-run-fail');
			} finally {
				Email.findOne = originalFindOne;
				Email.create = originalCreate;
				Email.find = originalFind;
				Email.findOneAndUpdate = originalFindOneAndUpdate;
				EmailLabel.bulkWrite = originalBulkWrite;
				EmailLabel.find = originalLabelFind;
				Tenant.findOne = originalTenantFindOne;
				console.error = originalConsoleError;
			}
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

	it('builds newest-first thread and resolves the active thread draft', async () => {
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
		const originalDraftFindOne = EmailDraft.findOne;
		let draftQuery = null;
		let draftSort = null;

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
				sort: (sort) => {
					draftSort = sort;
					return {
						lean: async () => ({ _id: 'draft-1', source_email: '1', status: 'draft' }),
					};
				},
			};
		};

		try {
			const thread = await getEmailThread('host-1', '1', { order: 'desc' });
			assert.deepEqual(thread.map((item) => item.message_id), ['msg-c@example.com', 'msg-a@example.com', 'msg-b@example.com']);

			const draft = await getEmailThreadDraft('host-1', thread);
			assert.deepEqual(draftQuery, {
				host_id: 'host-1',
				source_email: { $in: ['3', '1', '2'] },
				status: { $ne: 'discarded' },
			});
			assert.deepEqual(draftSort, { updatedAt: -1 });
			assert.equal(draft._id, 'draft-1');
		} finally {
			Email.findOne = originalFindOne;
			Email.find = originalFind;
			EmailDraft.findOne = originalDraftFindOne;
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
			html_content: '<p>do not index</p>',
			attachment_text_content: '',
			message_id: 'msg-1@example.com',
			references: [],
			createdAt: '2026-01-01T10:00:00.000Z',
			updatedAt: '2026-01-01T10:00:00.000Z',
		});

		assert.deepEqual(doc.from, ['sender@example.com']);
		assert.deepEqual(doc.to, ['to@example.com']);
		assert.deepEqual(doc.from_emails, ['sender@example.com']);
		assert.deepEqual(doc.to_emails, ['to@example.com']);
		assert.deepEqual(doc.participant_emails, ['sender@example.com', 'to@example.com']);
		assert.equal(doc.subject, 'Hello from sender test');
		assert.equal(doc.html_content, undefined);
	});

	it('parses list-level Email AI sender/count intent', () => {
		const intent = parseEmailAiQuery('How many emails from Sender@Example.com are in this view?');

		assert.equal(intent.mode, 'count');
		assert.equal(intent.from_email, 'sender@example.com');
		assert.equal(intent.search_text, '');
	});

	it('treats scoped mailbox summaries as current-view wildcard searches', () => {
		const intent = parseEmailAiQuery('Summarize this mailbox');

		assert.equal(intent.mode, 'summary');
		assert.equal(intent.search_text, '');
	});

	it('builds Typesense filters from current ECC scope and Email AI intent', () => {
		const filter = buildEmailAiTypesenseFilter(
			{ project: 'project-1', mailbox: 'inbox', triaged: false },
			parseEmailAiQuery('show emails from sender@example.com'),
		);

		assert.match(filter, /project_id:=`project-1`/);
		assert.match(filter, /mailbox:=`inbox`/);
		assert.match(filter, /triaged:=false/);
		assert.match(filter, /from_emails:=`sender@example.com`/);
	});

	it('uses Typesense for list-level Email AI results', async () => {
		let searchCall = null;
		const result = await askEmailListAi('host-1', 'show emails from sender@example.com', {
			project: 'project-1',
			mailbox: 'inbox',
			triaged: false,
		}, {
			searchFn: async (hostId, type, query, options) => {
				searchCall = { hostId, type, query, options };
				return {
					hits: [{
						document: {
							id: 'email-1',
							source_id: 'email-1',
							project_id: 'project-1',
							subject: 'Hello',
							from: ['sender@example.com'],
							to: ['team@example.com'],
							mailbox: 'inbox',
							labels: ['reply-required'],
							triaged: false,
							updated_at: 1778830000,
							created_at: 1778820000,
						},
					}],
				};
			},
		});

		assert.equal(searchCall.hostId, 'host-1');
		assert.equal(searchCall.type, 'emails');
		assert.equal(searchCall.query, '*');
		assert.match(searchCall.options.filter_by, /from_emails:=`sender@example.com`/);
		assert.equal(result.mode, 'list');
		assert.equal(result.count, 1);
		assert.equal(result.emails[0]._id, 'email-1');
		assert.equal(result.emails[0].updatedAt, '2026-05-15T07:26:40.000Z');
	});

	it('falls back to all projects for list-level Email AI summaries when scoped results are empty', async () => {
		const searchCalls = [];
		const originalTenantFindOne = Tenant.findOne;
		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => ({ settings: { ai_instructions: {} } }),
			}),
		});

		try {
			const result = await askEmailListAi('host-1', 'summarize support requests', {
				project: 'project-1',
				mailbox: 'inbox',
			}, {
				searchFn: async (hostId, type, query, options) => {
					searchCalls.push({ hostId, type, query, options });
					if (searchCalls.length === 1) return { hits: [] };
					return {
						hits: [{
							document: {
								id: 'email-2',
								source_id: 'email-2',
								project_id: 'project-2',
								subject: 'Support elsewhere',
								from: ['sender@example.com'],
								to: ['team@example.com'],
								mailbox: 'inbox',
								updated_at: 1778830000,
							},
						}],
					};
				},
				completionFn: async ({ messages }) => {
					assert.match(messages[1].content, /Support elsewhere/);
					assert.match(messages[0].content, /Return only valid JSON/);
					return JSON.stringify({
						overview: 'One support request found outside the selected project.',
						groups: [{
							title: 'Needs attention',
							items: [{
								subject: 'Support elsewhere',
								from: 'sender@example.com',
								summary: 'A support request needs review.',
								status: 'Reply needed',
							}],
						}],
						next_steps: ['Open the support email.'],
					});
				},
			});

			assert.equal(searchCalls.length, 2);
			assert.match(searchCalls[0].options.filter_by, /project_id:=`project-1`/);
			assert.doesNotMatch(searchCalls[1].options.filter_by || '', /project_id:=`project-1`/);
			assert.equal(result.context_scope, 'all-projects');
			assert.equal(result.scope.project, '');
			assert.equal(result.answer, 'One support request found outside the selected project.');
			assert.equal(result.summary.groups[0].items[0].subject, 'Support elsewhere');
			assert.equal(result.summary.next_steps[0], 'Open the support email.');
		} finally {
			Tenant.findOne = originalTenantFindOne;
		}
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
			assert.equal(findQuery.in_trash, false);
			assert.equal(findQuery.triaged, false);
		} finally {
			Email.find = originalFind;
		}
	});

	it('collapses sent emails by thread and keeps the newest sent reply', async () => {
		let findQuery = null;
		const originalFind = Email.find;
		const sentOlder = {
			_id: 'sent-older',
			message_id: 'sent-older@example.com',
			in_reply_to: 'root@example.com',
			references: ['root@example.com'],
			mailbox: 'sent',
			updatedAt: '2026-01-01T10:00:00.000Z',
		};
		const sentNewest = {
			_id: 'sent-newest',
			message_id: 'sent-newest@example.com',
			in_reply_to: 'root@example.com',
			references: ['root@example.com'],
			mailbox: 'sent',
			updatedAt: '2026-01-01T11:00:00.000Z',
		};
		const sentOtherThread = {
			_id: 'sent-other',
			message_id: 'sent-other@example.com',
			in_reply_to: 'other-root@example.com',
			references: ['other-root@example.com'],
			mailbox: 'sent',
			updatedAt: '2026-01-01T09:00:00.000Z',
		};

		Email.find = (query) => {
			findQuery = query;
			return {
				sort: () => ({
					lean: async () => [sentNewest, sentOlder, sentOtherThread],
				}),
			};
		};

		try {
			const emails = await listEmails('host-1', 'project-1', { mailbox: 'sent' });

			assert.equal(findQuery.host_id, 'host-1');
			assert.equal(findQuery.project, 'project-1');
			assert.equal(findQuery.mailbox, 'sent');
			assert.deepEqual(emails.map((email) => email._id), ['sent-newest', 'sent-other']);
		} finally {
			Email.find = originalFind;
		}
	});

	it('lists default email labels in beginner-friendly order and hides internal done label', async () => {
		let bulkOps = [];
		const originalBulkWrite = EmailLabel.bulkWrite;
		const originalLabelFind = EmailLabel.find;
		const originalEmailCountDocuments = Email.countDocuments;
		const originalEmailFind = Email.find;
		const originalDraftCountDocuments = EmailDraft.countDocuments;

		EmailLabel.bulkWrite = async (ops) => {
			bulkOps = ops;
			return {};
		};
		EmailLabel.find = () => ({
			sort: () => ({
				lean: async () => [
					{ _id: 'waiting', slug: 'waiting', name: 'Waiting', color: '#0d6efd', is_system: true },
					{ _id: 'triaged', slug: 'triaged', name: 'Done', color: '#198754', is_system: true },
					{ _id: 'human-do', slug: 'human-do', name: 'Human Do', color: '#fd7e14', is_system: true },
					{ _id: 'reply-required', slug: 'reply-required', name: 'Review', color: '#dc3545', is_system: true },
					{ _id: 'no-action', slug: 'no-action', name: 'No action', color: '#6c757d', is_system: true },
					{ _id: 'spam', slug: 'spam', name: 'Spam', color: '#212529', is_system: true },
				],
			}),
		});
		Email.countDocuments = async () => 0;
		Email.find = () => ({
			select: () => ({
				lean: async () => [
					{ _id: 'sent-1', message_id: 'sent-1@example.com', in_reply_to: 'root@example.com', references: ['root@example.com'] },
					{ _id: 'sent-2', message_id: 'sent-2@example.com', in_reply_to: 'root@example.com', references: ['root@example.com'] },
				],
			}),
		});
		EmailDraft.countDocuments = async () => 0;

		try {
			const result = await listEmailLabels('host-1');

			assert.deepEqual(result.labels.map((label) => label.name), ['Review', 'Human Do', 'Waiting', 'Spam', 'No action']);
			assert.ok(!result.labels.some((label) => label.slug === 'triaged'));
			assert.equal(result.mailboxes.find((mailbox) => mailbox.slug === 'sent').count, 1);
			assert.equal(bulkOps.find((op) => op.updateOne.filter.slug === 'reply-required').updateOne.update.$set.name, 'Review');
			assert.equal(bulkOps.find((op) => op.updateOne.filter.slug === 'triaged').updateOne.update.$set.name, 'Done');
		} finally {
			EmailLabel.bulkWrite = originalBulkWrite;
			EmailLabel.find = originalLabelFind;
			Email.countDocuments = originalEmailCountDocuments;
			Email.find = originalEmailFind;
			EmailDraft.countDocuments = originalDraftCountDocuments;
		}
	});

	it('backfills legacy email triage state fields', async () => {
		const calls = [];
		const originalUpdateMany = Email.updateMany;

		Email.updateMany = async (query, update, options) => {
			calls.push({ query, update, options });
			return { modifiedCount: 1 };
		};

		try {
			const result = await backfillEmailTriageState();

			assert.equal(result.mailbox, 1);
			assert.equal(result.in_trash, 1);
			assert.equal(result.triaged_true, 1);
			assert.equal(result.triaged_false, 1);
			assert.deepEqual(calls[0], {
				query: { mailbox: { $exists: false } },
				update: { $set: { mailbox: 'inbox' } },
				options: { timestamps: false },
			});
			assert.deepEqual(calls[1], {
				query: { in_trash: { $exists: false } },
				update: { $set: { in_trash: false } },
				options: { timestamps: false },
			});
			assert.deepEqual(calls[2], {
				query: { triaged: { $exists: false }, triaged_at: { $type: 'date' } },
				update: { $set: { triaged: true } },
				options: { timestamps: false },
			});
			assert.deepEqual(calls[3], {
				query: { triaged: { $exists: false }, $or: [{ triaged_at: null }, { triaged_at: { $exists: false } }] },
				update: { $set: { triaged: false } },
				options: { timestamps: false },
			});
		} finally {
			Email.updateMany = originalUpdateMany;
		}
	});

	it('resets email triage state back to untriaged inbox', async () => {
		const emailId = { toString: () => 'email-reset-1' };
		let updateQuery = null;
		let updatePayload = null;
		let draftQuery = null;
		let linkQuery = null;
		const originalFindOneAndUpdate = Email.findOneAndUpdate;
		const originalDraftUpdateMany = EmailDraft.updateMany;
		const originalGraphDeleteMany = GraphLink.deleteMany;

		Email.findOneAndUpdate = async (query, update) => {
			updateQuery = query;
			updatePayload = update.$set;
			return { _id: emailId, host_id: 'host-1', ...update.$set };
		};
		EmailDraft.updateMany = async (query, update) => {
			draftQuery = { query, update };
			return { modifiedCount: 1 };
		};
		GraphLink.deleteMany = async (query) => {
			linkQuery = query;
			return { deletedCount: 1 };
		};

		try {
			const result = await resetEmailTriage('host-1', 'email-reset-1', { skipSideEffects: true });

			assert.equal(result.mailbox, 'inbox');
			assert.deepEqual(result.labels, []);
			assert.equal(result.triaged, false);
			assert.equal(result.in_trash, false);
			assert.equal(result.triage_primary_action, '');
			assert.equal(result.triage_draft_id, null);
			assert.deepEqual(updateQuery, { _id: 'email-reset-1', host_id: 'host-1' });
			assert.deepEqual(updatePayload.triage_action_points, []);
			assert.deepEqual(updatePayload.triage_related_context, []);
			assert.equal(draftQuery.query.source_email, emailId);
			assert.equal(draftQuery.update.$set.status, 'discarded');
			assert.deepEqual(linkQuery, { host_id: 'host-1', source_id: emailId, source_type: 'emails', label: 'triage-context' });
		} finally {
			Email.findOneAndUpdate = originalFindOneAndUpdate;
			EmailDraft.updateMany = originalDraftUpdateMany;
			GraphLink.deleteMany = originalGraphDeleteMany;
		}
	});

		it('normalizes AI triage JSON to supported structured fields', () => {
			const triage = parseTriageResult('```json\n{"primary_action":"reply required","labels":["Reply Required","unknown"],"summary":"Needs reply","reason":"Customer asked a question","confidence":1.2,"action_points":[{"text":"Reply with setup details","type":"Reply"}],"related_context":[{"item_type":"note","item_id":"note-1","title":"Setup"}],"draft_reply":{"to":["sender@example.com"],"subject":"Re: Question","body_text":"Thanks"}}\n```');

			assert.equal(triage.primary_action, 'reply-required');
			assert.deepEqual(triage.labels, ['reply-required', 'triaged']);
			assert.equal(triage.summary, 'Needs reply');
			assert.equal(triage.reason, 'Customer asked a question');
			assert.equal(triage.confidence, 1);
			assert.deepEqual(triage.action_points, [{ text: 'Reply with setup details', type: 'reply', due_at: null }]);
			assert.deepEqual(triage.related_context, [{ item_id: 'note-1', item_type: 'notes', title: 'Setup', reason: '' }]);
			assert.equal(triage.draft_reply.body_text, 'Thanks');
		});

		it('rejects triage JSON without a valid primary action', () => {
			assert.throws(() => parseTriageResult('{"labels":["reply-required"]}'), /primary_action/);
			assert.throws(() => parseTriageResult('{"primary_action":"unknown"}'), /primary_action/);
		});

		it('builds project-scoped triage context without falling back when project records exist', async () => {
			const searchCalls = [];
			const context = await buildTriageContext('host-1', {
				_id: { toString: () => 'email-1' },
				project: { toString: () => 'project-1' },
				subject: 'Billing question',
				from: ['sender@example.com'],
				to: ['team@example.com'],
				text_content: 'Can you explain billing?',
			}, {
				searchKnowledgeFn: async (hostId, query, options) => {
					searchCalls.push(options);
					assert.equal(hostId, 'host-1');
					assert.match(query, /Billing question/);
					assert.equal(options.includeEmails, true);
					assert.equal(options.projectId, 'project-1');
					return {
						notes: { hits: [{ document: { id: 'note-1', title: 'Billing policy', text_content: 'Policy text' } }] },
						emails: { hits: [{ document: { id: 'email-1', subject: 'Current' } }, { document: { id: 'email-2', subject: 'Prior', text_content: 'Prior reply' } }] },
					};
				},
				getThreadFn: async () => [{ _id: { toString: () => 'email-3' }, subject: 'Thread item', text_content: 'Thread body' }],
				getConnectionsFn: async () => ({ links: [], tag_connections: [{ id: 'note-2', type: 'notes', title: 'Shared tag', shared_tags: ['billing'] }] }),
			});

			assert.equal(searchCalls.length, 1);
			assert.equal(context.context_scope, 'project');
			assert.equal(context.context_project_id, 'project-1');
			assert.deepEqual(context.knowledge.map((item) => item.item_id), ['note-1', 'email-2']);
			assert.deepEqual(context.prior_emails.map((item) => item.item_id), ['email-2']);
			assert.deepEqual(context.thread.map((item) => item.item_id), ['email-3']);
			assert.deepEqual(context.graph_connections.map((item) => item.item_id), ['note-2']);
		});

		it('falls back to all-project triage context when current project has no usable records', async () => {
			const searchCalls = [];
			const context = await buildTriageContext('host-1', {
				_id: { toString: () => 'email-1' },
				project: 'project-1',
				subject: 'Billing question',
				from: ['sender@example.com'],
				to: ['team@example.com'],
				text_content: 'Can you explain billing?',
			}, {
				searchKnowledgeFn: async (_hostId, _query, options) => {
					searchCalls.push(options);
					if (options.projectId) {
						return {
							emails: { hits: [{ document: { id: 'email-1', subject: 'Current' } }] },
						};
					}
					return {
						notes: { hits: [{ document: { id: 'note-9', title: 'Global billing note', text_content: 'Global policy' } }] },
					};
				},
				getThreadFn: async () => [],
				getConnectionsFn: async () => ({ links: [], tag_connections: [] }),
			});

			assert.equal(searchCalls.length, 2);
			assert.equal(searchCalls[0].projectId, 'project-1');
			assert.equal(searchCalls[1].projectId, undefined);
			assert.equal(context.context_scope, 'all-projects');
			assert.deepEqual(context.knowledge.map((item) => item.item_id), ['note-9']);
		});

		it('triages inbox emails, persists actions, creates drafts, and links context', async () => {
			const emailId = { toString: () => 'email-1' };
			const draftId = { toString: () => 'draft-1' };
			let updatePayload = null;
			let draftPayload = null;
			let linkPayload = null;
			const originalBulkWrite = EmailLabel.bulkWrite;
			const originalLabelFind = EmailLabel.find;
			const originalEmailFind = Email.find;
			const originalFindOneAndUpdate = Email.findOneAndUpdate;
			const originalDraftFindOneAndUpdate = EmailDraft.findOneAndUpdate;
			const originalGraphUpdateOne = GraphLink.updateOne;
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
							mailbox: 'inbox',
							project: 'project-1',
							owner: userId,
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
			EmailDraft.findOneAndUpdate = async (query, update) => {
				assert.equal(query.source_email, emailId);
				draftPayload = update.$set;
				return { _id: draftId, ...update.$set };
			};
			GraphLink.updateOne = async (query, update, options) => {
				linkPayload = { query, update, options };
				return { upsertedCount: 1 };
			};
			let prompt;
			Tenant.findOne = () => ({
				select: () => ({
					lean: async () => ({ settings: { ai_instructions: { global: 'Be concise', email: 'Use warm reply tone', email_triage: 'Prioritize support' } } }),
				}),
			});

			try {
				const result = await triageInboxEmails('host-1', userId, {
					run_id: 'client-run-1',
					skipSideEffects: true,
					searchKnowledgeFn: async () => ({
						notes: { hits: [{ document: { id: 'note-1', title: 'Support policy', text_content: 'Useful policy' } }] },
					}),
					getThreadFn: async () => [],
					getConnectionsFn: async () => ({ links: [], tag_connections: [] }),
					completionFn: async ({ messages, scope, maxTokens }) => {
						assert.equal(scope, 'email');
						assert.equal(maxTokens, 1800);
						prompt = messages[1].content;
						return '{"primary_action":"reply-required","labels":["reply-required"],"summary":"Needs help","reason":"Requires reply","confidence":0.8,"action_points":[{"text":"Answer the support question","type":"reply"}],"related_context":[{"item_type":"notes","item_id":"note-1","title":"Support policy","reason":"Relevant"}],"draft_reply":{"body_text":"Thanks for reaching out."},"mailbox_action":"keep-inbox"}';
					},
				});

				assert.match(prompt, /Email instructions:\nUse warm reply tone/);
				assert.match(prompt, /Email triage instructions:\nPrioritize support/);
				assert.match(prompt, /Default triage instructions:\nClassify email by the next operational action/);
				assert.match(prompt, /CURRENT-PROJECT KNOWLEDGE SEARCH/);
				assert.equal(result.run_id, 'client-run-1');
				assert.equal(result.processed, 1);
				assert.equal(result.triaged, 1);
				assert.equal(result.drafted, 1);
				assert.equal(result.linked, 1);
				assert.deepEqual(updatePayload.labels, ['reply-required', 'triaged']);
				assert.equal(updatePayload.triaged, true);
				assert.equal(updatePayload.triage_summary, 'Needs help');
				assert.equal(updatePayload.triage_reason, 'Requires reply');
				assert.equal(updatePayload.triage_primary_action, 'reply-required');
				assert.equal(updatePayload.triage_run_id, 'client-run-1');
				assert.equal(updatePayload.triage_confidence, 0.8);
				assert.deepEqual(updatePayload.triage_action_points, [{ text: 'Answer the support question', type: 'reply', due_at: null }]);
				assert.equal(updatePayload.triage_draft_id, draftId);
				assert.equal(draftPayload.to[0], 'sender@example.com');
				assert.equal(draftPayload.body_text, 'Thanks for reaching out.');
				assert.equal(linkPayload.query.target_id, 'note-1');
				assert.ok(updatePayload.triaged_at instanceof Date);
			} finally {
				EmailLabel.bulkWrite = originalBulkWrite;
				EmailLabel.find = originalLabelFind;
				Email.find = originalEmailFind;
				Email.findOneAndUpdate = originalFindOneAndUpdate;
				EmailDraft.findOneAndUpdate = originalDraftFindOneAndUpdate;
				GraphLink.updateOne = originalGraphUpdateOne;
				Tenant.findOne = originalTenantFindOne;
			}
		});

			it('returns processed errors when all inbox triage attempts fail', async () => {
				const emailId = { toString: () => 'email-err-1' };
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
								subject: 'Broken provider',
								from: ['sender@example.com'],
								to: ['team@example.com'],
								text_content: 'Please triage me',
								labels: [],
								mailbox: 'inbox',
								project: 'project-1',
								owner: userId,
							}],
						}),
					}),
				});
				Email.findOneAndUpdate = async (query, update) => {
					assert.equal(query._id, emailId);
					updatePayload = update.$set;
					return { _id: emailId, ...update.$set };
				};
				Tenant.findOne = () => ({
					select: () => ({
						lean: async () => ({ settings: { ai_instructions: {} } }),
					}),
				});

				try {
					const result = await triageInboxEmails('host-1', userId, {
						run_id: 'client-run-failed',
						skipSideEffects: true,
						searchKnowledgeFn: async () => ({}),
						getThreadFn: async () => [],
						getConnectionsFn: async () => ({ links: [], tag_connections: [] }),
						completionFn: async ({ scope }) => {
							assert.equal(scope, 'email');
							throw new Error('Provider unavailable');
						},
					});

					assert.equal(result.run_id, 'client-run-failed');
					assert.equal(result.processed, 1);
					assert.equal(result.triaged, 0);
					assert.equal(result.errors.length, 1);
					assert.equal(result.errors[0].error, 'Provider unavailable');
					assert.equal(updatePayload.triage_status, 'failed');
					assert.equal(updatePayload.triage_error, 'Provider unavailable');
					assert.equal(updatePayload.triage_run_id, 'client-run-failed');
					assert.equal(updatePayload.is_indexed, false);
				} finally {
					EmailLabel.bulkWrite = originalBulkWrite;
					EmailLabel.find = originalLabelFind;
					Email.find = originalEmailFind;
					Email.findOneAndUpdate = originalFindOneAndUpdate;
					Tenant.findOne = originalTenantFindOne;
				}
			});

		it('answers selected email AI requests with email instructions and context', async () => {
			const originalEmailFindOne = Email.findOne;
			const originalTenantFindOne = Tenant.findOne;
			let systemPrompt = '';
			let userPrompt = '';

			Email.findOne = (query) => {
				assert.deepEqual(query, { _id: 'email-1', host_id: 'host-1', in_trash: false });
				return {
					lean: async () => ({
						_id: 'email-1',
						project: 'project-1',
						subject: 'Contract question',
						from: ['sender@example.com'],
						to: ['team@example.com'],
						text_content: 'Can we update the contract?',
						attachment_text_content: '',
						labels: ['reply-required'],
						triage_summary: 'Needs contract reply',
						triage_reason: 'Sender asked a question',
					}),
				};
			};
			Tenant.findOne = () => ({
				select: () => ({
					lean: async () => ({ settings: { ai_instructions: { global: 'Be direct', email: 'Use customer context', email_triage: 'Escalate legal' } } }),
				}),
			});

			try {
				const result = await askEmailAi('host-1', 'email-1', 'Draft the key points', {
					searchKnowledgeFn: async (hostId, query, options) => {
						assert.equal(hostId, 'host-1');
						assert.match(query, /Draft the key points/);
						assert.equal(options.projectId, 'project-1');
						return {
							notes: { hits: [{ document: { id: 'note-1', title: 'Contract policy', text_content: 'Use approved terms.' } }] },
						};
					},
					completionFn: async ({ messages, scope }) => {
						assert.equal(scope, 'email');
						systemPrompt = messages[0].content;
						userPrompt = messages[1].content;
						return 'Mention the contract update and ask for preferred terms.';
					},
				});

				assert.equal(result.answer, 'Mention the contract update and ask for preferred terms.');
				assert.match(systemPrompt, /Answer as an email assistant for the selected message/);
				assert.match(systemPrompt, /Global instructions:\nBe direct/);
				assert.match(systemPrompt, /Email AI instructions:\nUse customer context/);
				assert.doesNotMatch(systemPrompt, /Escalate legal/);
				assert.match(userPrompt, /Subject: Contract question/);
				assert.match(userPrompt, /Can we update the contract/);
				assert.match(userPrompt, /CURRENT-PROJECT KNOWLEDGE SEARCH/);
				assert.match(userPrompt, /Contract policy/);
				assert.match(userPrompt, /User request:\nDraft the key points/);
				assert.equal(result.context_scope, 'project');
			} finally {
				Email.findOne = originalEmailFindOne;
				Tenant.findOne = originalTenantFindOne;
			}
		});

		it('parses structured reply suggestions', () => {
			const replies = parseEmailReplySuggestionsResult('```json\n{"replies":[{"title":"Short","body_text":"Thanks for the note."},{"title":"Detailed","body_text":"Thanks, I will review and follow up."},{"title":"Extra","body_text":"Ignore me"}]}\n```');
			assert.deepEqual(replies, [
				{ title: 'Short', body_text: 'Thanks for the note.' },
				{ title: 'Detailed', body_text: 'Thanks, I will review and follow up.' },
			]);
			assert.throws(() => parseEmailReplySuggestionsResult('{"items":[]}'), /replies/);
		});

		it('generates selected email reply suggestions as JSON', async () => {
			const originalEmailFindOne = Email.findOne;
			const originalTenantFindOne = Tenant.findOne;
			let userPrompt = '';

			Email.findOne = (query) => {
				assert.deepEqual(query, { _id: 'email-1', host_id: 'host-1', in_trash: false });
				return {
					lean: async () => ({
						_id: 'email-1',
						project: 'project-1',
						subject: 'Support request',
						from: ['sender@example.com'],
						to: ['team@example.com'],
						text_content: 'Can you help me configure this?',
					}),
				};
			};
			Tenant.findOne = () => ({
				select: () => ({
					lean: async () => ({ settings: { ai_instructions: { email: 'Be concise' } } }),
				}),
			});

			try {
				const result = await suggestEmailReplies('host-1', 'email-1', {
					searchKnowledgeFn: async (_hostId, _query, options) => {
						if (options.projectId) return { notes: { hits: [] } };
						return {
							memory: { hits: [{ document: { id: 'memory-1', title: 'Setup preference', content: 'Mention setup guide.' } }] },
						};
					},
					completionFn: async ({ messages, scope }) => {
						assert.equal(scope, 'email');
						userPrompt = messages[1].content;
						return '{"replies":[{"title":"Option A","body_text":"Happy to help."},{"title":"Option B","body_text":"Send over the details."}]}';
					},
				});

				assert.match(userPrompt, /Create exactly two different reply options/);
				assert.match(userPrompt, /Subject: Support request/);
				assert.match(userPrompt, /ALL-PROJECT KNOWLEDGE SEARCH/);
				assert.match(userPrompt, /Setup preference/);
				assert.equal(result.context_scope, 'all-projects');
				assert.deepEqual(result.replies, [
					{ title: 'Option A', body_text: 'Happy to help.' },
					{ title: 'Option B', body_text: 'Send over the details.' },
				]);
			} finally {
				Email.findOne = originalEmailFindOne;
				Tenant.findOne = originalTenantFindOne;
			}
		});

		it('can force reply suggestions to search all projects first', async () => {
			const originalEmailFindOne = Email.findOne;
			const originalTenantFindOne = Tenant.findOne;
			const searchOptions = [];

			Email.findOne = () => ({
				lean: async () => ({
					_id: 'email-1',
					project: 'project-1',
					subject: 'Support request',
					from: ['sender@example.com'],
					to: ['team@example.com'],
					text_content: 'Can you help me configure this?',
				}),
			});
			Tenant.findOne = () => ({
				select: () => ({
					lean: async () => ({ settings: { ai_instructions: {} } }),
				}),
			});

			try {
				const result = await suggestEmailReplies('host-1', 'email-1', {
					context_scope: 'all-projects',
					searchKnowledgeFn: async (_hostId, _query, options) => {
						searchOptions.push(options);
						return {
							notes: { hits: [{ document: { id: 'note-1', title: 'Setup guide', text_content: 'Use the setup guide.' } }] },
						};
					},
					completionFn: async () => '{"replies":[{"title":"Option A","body_text":"Happy to help."},{"title":"Option B","body_text":"Send over the details."}]}',
				});

				assert.equal(searchOptions.length, 1);
				assert.equal(searchOptions[0].projectId, undefined);
				assert.equal(result.context_scope, 'all-projects');
			} finally {
				Email.findOne = originalEmailFindOne;
				Tenant.findOne = originalTenantFindOne;
			}
		});

		it('suggests From email addresses from project first and then tenant fallback', async () => {
			const calls = [];
			const result = await suggestFromEmailAddresses('host-1', {
				query: 'sender',
				project: 'project-1',
				limit: 10,
				searchFn: async (_hostId, type, query, options) => {
					calls.push({ type, query, options });
					if (options.filter_by) return { hits: [] };
					return {
						hits: [
							{ document: { from_emails: ['sender@example.com', 'other@example.com'] } },
							{ document: { from: ['Sender Two <sender-two@example.com>'] } },
						],
					};
				},
			});

			assert.equal(calls.length, 2);
			assert.equal(calls[0].type, 'emails');
			assert.equal(calls[0].query, 'sender');
			assert.equal(calls[0].options.queryBy, 'participant_emails,from,to,cc,bcc');
			assert.match(calls[0].options.filter_by, /project_id:=`project-1`/);
			assert.equal(result.scope, 'tenant');
			assert.deepEqual(result.addresses, ['sender@example.com', 'sender-two@example.com']);
		});

		it('suggests addresses we have only ever sent to (recipient fields)', async () => {
			const result = await suggestFromEmailAddresses('host-1', {
				query: 'new',
				limit: 10,
				searchFn: async () => ({
					hits: [
						{ document: { participant_emails: ['me@example.com', 'new-contact@example.com'] } },
						{ document: { to_emails: ['another-new@example.com'] } },
					],
				}),
			});

			assert.deepEqual(result.addresses, ['new-contact@example.com', 'another-new@example.com']);
		});
	});
