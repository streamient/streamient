import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { resolveRestoreProject } from '../services/project_service.js';
import { restoreItem } from '../services/trash_service.js';
import { mockTenantWork } from './helpers/tenant-work.js';

function query(value) { return { select() { return this; }, lean: async () => value }; }

function mockProjectResolution(t, responses) {
	const calls = [];
	t.mock.method(Project, 'findOneAndUpdate', (filter) => {
		calls.push(filter);
		if (filter.is_default) return query(responses.default);
		if (filter._id === responses.originalId) return query(responses.original);
		return query(null);
	});
	return calls;
}

test('resolveRestoreProject returns the original project when it is active', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	mockProjectResolution(t, { originalId: 'project-1', original: { _id: 'project-1', host_id: 'host', is_active: true, deletion: null }, default: { _id: 'default' } });
	assert.equal(String(await resolveRestoreProject('host', 'project-1')), 'project-1');
});

test('resolveRestoreProject falls back to the default project for an inactive original', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const calls = mockProjectResolution(t, { originalId: 'project-1', original: { _id: 'project-1', host_id: 'host', is_active: false, deletion: null }, default: { _id: 'default' } });
	assert.equal(String(await resolveRestoreProject('host', 'project-1')), 'default');
	assert.ok(calls.some((filter) => filter.is_default === true));
});

test('resolveRestoreProject falls back to the default project for a missing original', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	mockProjectResolution(t, { originalId: 'project-1', original: null, default: { _id: 'default' } });
	assert.equal(String(await resolveRestoreProject('host', 'project-1')), 'default');
});

test('resolveRestoreProject fails closed for an active project with a pending deletion', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	mockProjectResolution(t, { originalId: 'project-1', original: { _id: 'project-1', host_id: 'host', is_active: true, deletion: { requested_at: new Date() } }, default: { _id: 'default' } });
	await assert.rejects(resolveRestoreProject('host', 'project-1'), (err) => err.code === 'project_not_found');
});

test('resolveRestoreProject fails closed when the original project belongs to a foreign host', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	// The referenced project exists but is owned by a different tenant; the
	// restore must never silently fall back to the host's Default project.
	mockProjectResolution(t, { originalId: 'project-1', original: { _id: 'project-1', host_id: 'foreign-host', is_active: true, deletion: null }, default: { _id: 'default' } });
	await assert.rejects(resolveRestoreProject('host', 'project-1'), (err) => err.code === 'project_not_found');
});

test('restoring a trashed item whose original project is inactive lands in the default project', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const trashed = { _id: 'note-1', host_id: 'host-1', project: 'old-project', title: 'Note', in_trash: true };
	let restoreSet;
	t.mock.method(Note, 'findOneAndUpdate', async (filter, update) => {
		if (update?.$inc) return { _id: trashed._id, host_id: trashed.host_id, project: trashed.project };
		restoreSet = update?.$set;
		return { ...trashed, ...restoreSet };
	});
	t.mock.method(Project, 'findOneAndUpdate', (filter) => {
		if (filter.is_default) return query({ _id: 'default-project' });
		if (filter._id === 'old-project') return query({ _id: 'old-project', host_id: 'host-1', is_active: false, deletion: null });
		return query({ _id: 'default-project' });
	});
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	t.mock.method(Note, 'updateMany', async () => ({}));

	const restored = await restoreItem('host-1', 'notes', 'note-1', {
		bulkIndexDocuments: async (hostId, type, docs) => docs.map((doc) => ({ id: String(doc._id), success: true })),
	});
	assert.equal(String(restored.project), 'default-project');
	assert.equal(restoreSet.project, 'default-project');
	assert.equal(restoreSet.in_trash, false);
});