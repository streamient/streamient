import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { GitRepo } from '../model/git_repo.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { deleteProject, acquireProjectWrite } from '../services/project_service.js';
import { mockTenantWork } from './helpers/tenant-work.js';

function query(value) { return { select() { return this; }, read() { return this; }, lean: async () => value }; }

test('deleteProject refuses an occupied project using authoritative writes, not a stale count', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const project = { _id: '507f1f77bcf86cd799439011', host_id: 'audit', is_default: false, is_active: true, async save() { return this; } };
	t.mock.method(Project, 'findOne', () => query(project));
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	t.mock.method(Project, 'findOneAndUpdate', (filter) => query({ _id: filter._id, active_work: {} }));
	t.mock.method(Note, 'findOneAndUpdate', (filter) => query(filter._id?.$nin?.length ? null : { _id: 'note-1' }));
	for (const Model of [Memory, Url, Email, GitRepo, ObsidianConnection]) t.mock.method(Model, 'findOneAndUpdate', () => query(null));

	await assert.rejects(deleteProject('audit', project._id), /has notes/);
	assert.equal(project.is_active, true);
});

test('deleteProject deactivates an empty project after gating and draining writers', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const project = { _id: '507f1f77bcf86cd799439011', host_id: 'audit', is_default: false, is_active: true, async save() { this.is_active = false; return this; } };
	t.mock.method(Project, 'findOne', () => query(project));
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	t.mock.method(Project, 'findOneAndUpdate', (filter) => query({ _id: filter._id, active_work: {} }));
	for (const Model of [Note, Memory, Url, Email, GitRepo, ObsidianConnection]) t.mock.method(Model, 'findOneAndUpdate', () => query(null));

	const result = await deleteProject('audit', project._id);
	assert.equal(project.is_active, false);
	assert.equal(result, project);
});

test('project write leases are gated on active, non-deleting projects', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const filters = [];
	t.mock.method(Project, 'findOneAndUpdate', (filter) => { filters.push(filter); return query({ _id: 'project-1' }); });
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));

	const { projectId, release } = await acquireProjectWrite('host', 'project-1');
	assert.equal(projectId, 'project-1');
	assert.equal(filters[0].is_active, true);
	assert.equal(filters[0]['deletion.requested_at'], null);
	await release();
});

test('a paused writer whose lease expired cannot publish into a deactivated project', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	t.mock.method(Project, 'findOneAndUpdate', (filter) => {
		const hasLease = Object.keys(filter).some((key) => key.startsWith('active_work.'));
		return query(hasLease ? null : { _id: filter._id });
	});
	const { projectId, publish, release } = await acquireProjectWrite('host', 'project-1');
	t.after(() => release());
	assert.equal(projectId, 'project-1');
	let inserted = 0;
	await assert.rejects(publish(async () => { inserted++; }), (err) => err.code === 'project_not_found');
	assert.equal(inserted, 0);
});

test('publish reuses the owning queue transaction for the project fence', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const session = { owner: 'job-claim' };
	let fenceSession;
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	t.mock.method(Project, 'findOneAndUpdate', (filter, update, options) => {
		if (options?.session) fenceSession = options.session;
		return query({ _id: filter._id });
	});
	const ctx = { withOwnership: async (callback) => callback(session) };
	const { publish, release } = await acquireProjectWrite('host', 'project-1', ctx);
	t.after(() => release());
	let persistedSession;
	await publish(async (s) => { persistedSession = s; return 'ok'; });
	assert.equal(fenceSession, session);
	assert.equal(persistedSession, session);
});

test('deleteProject waits for an active writer lease then deactivates', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const project = { _id: '507f1f77bcf86cd799439011', host_id: 'audit', is_default: false, is_active: true, async save() { this.is_active = false; return this; } };
	t.mock.method(Project, 'findOne', () => query(project));
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	const future = new Date(Date.now() + 60_000);
	let drainCalls = 0;
	t.mock.method(Project, 'findOneAndUpdate', (filter, update) => {
		if (update?.$inc) {
			drainCalls++;
			return { select() { return this; }, lean: async () => ({ _id: filter._id, active_work: drainCalls === 1 ? { lease: future } : {} }) };
		}
		return query({ _id: filter._id });
	});
	for (const Model of [Note, Memory, Url, Email, GitRepo, ObsidianConnection]) t.mock.method(Model, 'findOneAndUpdate', () => query(null));

	const result = await deleteProject('audit', project._id);
	assert.equal(project.is_active, false);
	assert.equal(result, project);
	assert.equal(drainCalls, 2);
});