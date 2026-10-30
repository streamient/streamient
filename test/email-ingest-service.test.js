import { beforeEach as beforeProject, afterEach as afterProject } from 'node:test';
import { mockActiveProject } from './helpers/active-project.js';
let restoreProject;
beforeProject(() => { restoreProject = mockActiveProject(); });
afterProject(() => { restoreProject(); });
import { beforeEach as beforeAccountWork, afterEach as afterAccountWork } from 'node:test';
import { mockTenantWork } from './helpers/tenant-work.js';
let restoreAccountWork;
beforeAccountWork(() => { restoreAccountWork = mockTenantWork(); });
afterAccountWork(() => { restoreAccountWork(); });
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { GraphLink } from '../model/graph_link.js';
import { Email } from '../model/email.js';
import { Project } from '../model/project.js';
import { ingestEmail, listEmails, matchesEmailFilter, parseEmailInput, parseForwardedEmailInput } from '../services/email_ingest_service.js';

describe('Email ingest storage service', () => {
	const originalEmailFindOne = Email.findOne;
	const originalEmailCreate = Email.create;
	const originalEmailUpsert = Email.findOneAndUpdate;
	const originalEmailFind = Email.find;
	const originalGraphLinkUpdateOne = GraphLink.updateOne;

	beforeEach(() => {
		Email.findOne = () => ({ lean: async () => null });
		Email.findOneAndUpdate = async (_filter, update) => ({ value: await Email.create({ ...update.$set, ...update.$setOnInsert }), lastErrorObject: { updatedExisting: false } });
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});
		GraphLink.updateOne = async () => ({ upsertedCount: 0 });
	});

	afterEach(() => {
		Email.findOne = originalEmailFindOne;
		Email.create = originalEmailCreate;
		Email.findOneAndUpdate = originalEmailUpsert;
		Email.find = originalEmailFind;
		GraphLink.updateOne = originalGraphLinkUpdateOne;
	});

	it('matches project email filter rules by sender or subject', () => {
		const filter = 'spam@bad.com\n@noisy.com\nsubject: status update';

		assert.equal(matchesEmailFilter(filter, ['spam@bad.com']), true);
		assert.equal(matchesEmailFilter(filter, ['hello@noisy.com']), true);
		assert.equal(matchesEmailFilter(filter, { from: ['friend@example.com'], subject: 'Weekly status update' }), true);
		assert.equal(matchesEmailFilter(filter, { from: ['friend@example.com'], subject: 'Other' }), false);
		assert.equal(matchesEmailFilter('', ['spam@bad.com']), false);
	});

	it('normalizes parsed email input', async () => {
		const normalized = await parseEmailInput({
			parsed_email: {
				message_id: '<Message-1@Example.com>',
				from: 'Sender <sender@example.com>',
				to: 'Team <team@example.com>',
				subject: 'Stored',
				html: '<p>Hello <strong>mail</strong></p>',
			},
		});

		assert.equal(normalized.message_id, 'message-1@example.com');
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['team@example.com']);
		assert.equal(normalized.text_content, 'Hello mail');
		assert.match(normalized.html_content, /<p>Hello <strong>mail<\/strong><\/p>/);
	});

	it('normalizes forwarded email input without attachment extraction', () => {
		const normalized = parseForwardedEmailInput({
			messageId: '<forwarded@example.com>',
			from: 'Sender <sender@example.com>',
			to: 'Project <project@example.com>',
			subject: 'Forwarded',
			html: '<p>Forwarded body</p>',
			attachments: [{ filename: 'ignored.txt', content: 'ignored' }],
		});

		assert.equal(normalized.message_id, 'forwarded@example.com');
		assert.deepEqual(normalized.from, ['sender@example.com']);
		assert.deepEqual(normalized.to, ['project@example.com']);
		assert.equal(normalized.text_content, 'Forwarded body');
		assert.equal(normalized.attachment_text_content, '');
	});

	it('stores email without triage or reply fields', async () => {
		let createdPayload = null;
		Email.create = async (payload) => {
			createdPayload = payload;
			return { _id: { toString: () => 'email-1' }, ...payload };
		};

		await ingestEmail('507f1f77bcf86cd799439012', 'host-1', {
			project: '507f1f77bcf86cd799439011',
			mailbox: 'inbox',
			labels: ['Needs Review'],
			parsed_email: {
				message_id: '<stored@example.com>',
				from: 'sender@example.com',
				to: 'project@example.com',
				subject: 'Stored',
				text: 'Stored body',
			},
		}, { skipSideEffects: true });

		assert.equal(createdPayload.project, '507f1f77bcf86cd799439011');
		assert.equal(createdPayload.mailbox, 'inbox');
		assert.deepEqual(createdPayload.labels, ['needs-review']);
	});
	it('atomically upserts a broadcast independently in each tenant without replica reads', async () => {
		const docs = new Map();
		Email.findOne = () => { throw new Error('dedup must not read a replica'); };
		Email.findOneAndUpdate = async (filter, update, options) => {
			assert.deepEqual(Object.keys(filter).sort(), ['host_id', 'message_id', 'project']);
			assert.equal(options.upsert, true);
			assert.equal(options.includeResultMetadata, true);
			const key = JSON.stringify(filter);
			const existing = docs.get(key);
			const value = { _id: existing?._id || `email-${docs.size}`, ...update.$setOnInsert, ...existing, ...update.$set };
			docs.set(key, value);
			return { value, lastErrorObject: { updatedExisting: !!existing } };
		};
		const data = { project: '507f1f77bcf86cd799439011', parsed_email: { message_id: '<broadcast@example.com>', text: 'Broadcast' } };
		const results = await Promise.all(['host-1', 'host-2', 'host-1'].map((host) => ingestEmail('507f1f77bcf86cd799439012', host, data, { skipSideEffects: true })));
		assert.equal(docs.size, 2);
		assert.equal(results[0]._id, results[2]._id);
		assert.notEqual(results[0]._id, results[1]._id);
	});

	it('re-ingesting an existing Message-ID keeps trash state, labels, project and owner', async () => {
		let update;
		let filter;
		Email.findOneAndUpdate = async (appliedFilter, applied) => {
			filter = appliedFilter;
			update = applied;
			return { value: { _id: 'email-1', project: appliedFilter.project, in_trash: true }, lastErrorObject: { updatedExisting: true } };
		};
		const email = await ingestEmail('507f1f77bcf86cd799439012', 'host-1', { project: '507f1f77bcf86cd799439011', labels: ['Fresh'], parsed_email: { message_id: '<retry@example.com>', text: 'Retry' } }, { skipSideEffects: true });
		for (const field of ['in_trash', 'trashed_at', 'labels', 'project', 'owner']) {
			assert.equal(field in update.$set, false, `${field} must not be in $set`);
			assert.equal(field in update.$setOnInsert, true, `${field} must be in $setOnInsert`);
		}
		assert.equal(update.$set.is_indexed, false);
		assert.equal(update.$set.text_content, 'Retry');
		assert.equal(String(filter.project), '507f1f77bcf86cd799439011', 'updates are limited to the leased project');
		assert.equal(email.in_trash, true);
	});

	it('reports a content-hash duplicate stored in another project instead of creating a copy', async () => {
		Email.findOne = () => ({ lean: async () => ({ _id: 'email-other', project: '507f1f77bcf86cd7994390ff' }) });
		Email.findOneAndUpdate = async () => assert.fail('must not update another project');
		Email.create = async () => assert.fail('must not create a duplicate');
		await assert.rejects(ingestEmail('507f1f77bcf86cd799439012', 'host-1', { project: '507f1f77bcf86cd799439011', parsed_email: { raw_hash: 'hash', subject: 'Dup', text: 'Body' } }, { skipSideEffects: true }), (err) => err.code === 'email_already_exists' && err.status === 409);
	});

	it('maps a tenant Message-ID conflict without an in-transaction fallback read', async () => {
		let calls = 0;
		Email.findOneAndUpdate = async (filter) => {
			assert.equal(filter.host_id, 'host-1');
			calls++;
			throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { host_id: 1, message_id: 1 } });
		};
		const data = { project: '507f1f77bcf86cd799439011', parsed_email: { message_id: 'race@example.com', text: 'Race' } };
		await assert.rejects(ingestEmail('507f1f77bcf86cd799439012', 'host-1', data, { skipSideEffects: true }), (err) => err.code === 'email_already_exists' && err.status === 409);
		assert.equal(calls, 1);
		Email.findOneAndUpdate = async () => { throw Object.assign(new Error('unrelated index'), { code: 11000, keyPattern: { message_id: 1 } }); };
		await assert.rejects(ingestEmail('507f1f77bcf86cd799439012', 'host-1', data, { skipSideEffects: true }), /unrelated index/);
	});

	it('creates a replacement when the hash-deduplicated row was deleted before persistence', async () => {
		Email.findOne = () => ({ lean: async () => ({ _id: 'deleted-email', project: '507f1f77bcf86cd799439011' }) });
		Email.findOneAndUpdate = async () => null;
		Email.create = async (payload) => Array.isArray(payload) ? [{ _id: 'replacement-email', ...payload[0] }] : { _id: 'replacement-email', ...payload };
		const email = await ingestEmail('507f1f77bcf86cd799439012', 'host-1', { project: '507f1f77bcf86cd799439011', parsed_email: { raw_hash: 'hash', subject: 'Replacement', text: 'Body' } }, { skipSideEffects: true });
		assert.equal(email._id, 'replacement-email');
		assert.equal(email.subject, 'Replacement');
	});

	it('fences publication so a deactivated destination project inserts nothing', async () => {
		const projectFindOneAndUpdate = Project.findOneAndUpdate;
		const projectUpdateOne = Project.updateOne;
		try {
			// Accept the lease acquisition but reject the in-transaction fence, as if
			// the project was deactivated after the lease was accepted.
			Project.findOneAndUpdate = (filter) => {
				const holdsLease = Object.keys(filter).some((key) => key.startsWith('active_work.'));
				return { select() { return this; }, read() { return this; }, lean: async () => (holdsLease ? null : { _id: filter._id }) };
			};
			Project.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
			let inserts = 0;
			Email.findOneAndUpdate = async () => { inserts++; return { value: { _id: 'email-1' }, lastErrorObject: { updatedExisting: false } }; };
			await assert.rejects(
				ingestEmail('507f1f77bcf86cd799439012', 'host-1', { project: '507f1f77bcf86cd799439011', parsed_email: { message_id: 'fence@example.com', text: 'Body' } }, { skipSideEffects: true }),
				(err) => err.code === 'project_not_found',
			);
			assert.equal(inserts, 0);
		} finally {
			Project.findOneAndUpdate = projectFindOneAndUpdate;
			Project.updateOne = projectUpdateOne;
		}
	});

	it('reuses the owning queue transaction so the fence and the upsert share one session', async () => {
		const projectFindOneAndUpdate = Project.findOneAndUpdate;
		const projectUpdateOne = Project.updateOne;
		try {
			const session = { owner: 'job-claim' };
			const sessions = [];
			Project.findOneAndUpdate = (filter, update, options) => {
				if (options?.session) sessions.push(options.session);
				return { select() { return this; }, read() { return this; }, lean: async () => ({ _id: filter._id }) };
			};
			Project.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
			Email.findOneAndUpdate = async (filter, update, options) => {
				sessions.push(options.session);
				return { value: { _id: 'email-1' }, lastErrorObject: { updatedExisting: false } };
			};
			const ctx = { skipSideEffects: true, withOwnership: async (callback) => callback(session) };
			await ingestEmail('507f1f77bcf86cd799439012', 'host-1', { project: '507f1f77bcf86cd799439011', parsed_email: { message_id: 'queue@example.com', text: 'Body' } }, ctx);
			assert.ok(sessions.length >= 2, 'fence and upsert each ran in a session');
			assert.ok(sessions.every((seen) => seen === session), 'fence and upsert shared the owning session');
		} finally {
			Project.findOneAndUpdate = projectFindOneAndUpdate;
			Project.updateOne = projectUpdateOne;
		}
	});

	it('listEmails groups threads on slim rows and loads full documents only for the page', async () => {
		const at = (n) => new Date(1000000 - n * 1000);
		const slimRows = [
			{ _id: 'a2', message_id: 'a2', in_reply_to: 'a1', references: ['a1'], createdAt: at(0), updatedAt: at(0) },
			{ _id: 'b1', message_id: 'b1', createdAt: at(1), updatedAt: at(1) },
			{ _id: 'a1', message_id: 'a1', createdAt: at(2), updatedAt: at(2) },
			{ _id: 'c1', message_id: 'c1', createdAt: at(3), updatedAt: at(3) },
		];
		const selects = [];
		const fullLoads = [];
		Email.find = (filter) => {
			if (filter._id) {
				fullLoads.push(filter._id.$in);
				return { lean: async () => filter._id.$in.map((id) => ({ _id: id, subject: `full-${id}`, text_content: 'body' })) };
			}
			const query = { select(fields) { selects.push(fields); return query; }, sort: () => query, lean: async () => slimRows };
			return query;
		};
		const page = await listEmails('host-1', 'project-1', { limit: 2 });
		assert.deepEqual(page.map((email) => email._id), ['a2', 'b1']);
		assert.equal(page[0].subject, 'full-a2');
		assert.equal(page[0].thread_latest._id, 'a2');
		assert.equal(page[1].thread_latest._id, 'b1');
		assert.equal(selects.length, 2);
		assert.deepEqual(fullLoads, [['a2', 'b1']]);
		const second = await listEmails('host-1', 'project-1', { limit: 2, offset: 2 });
		assert.deepEqual(second.map((email) => email._id), ['c1']);
		assert.equal((await listEmails('host-1', 'project-1', { limit: 100000 })).length, 3);
	});
});
