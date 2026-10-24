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

	await assert.rejects(deleteProject('audit', project._id), /has 1 note/);
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