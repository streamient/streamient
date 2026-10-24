import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from '../model/mongoose.js';
import { Project } from '../model/project.js';
import { GitRepo } from '../model/git_repo.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { AuditLog } from '../model/audit_log.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { createGitRepo } from '../services/git_sync_service.js';
import { createConnection, __test as syncTest } from '../services/obsidian_sync_service.js';
import { mockTenantWork } from './helpers/tenant-work.js';

function query(value) { return { select() { return this; }, read() { return this; }, lean: async () => value }; }

// The fence filter (acquire vs re-verify) is distinguished by the presence of the active_work lease key.
function fenceAwareProject(findResult, fenceResult = findResult) {
	return (filter, update, options) => {
		const hasLease = Object.keys(filter || {}).some((key) => key.startsWith('active_work.'));
		return query(hasLease ? fenceResult : findResult);
	};
}

test('createGitRepo persists the repo inside the project write gate sharing the transaction session', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	t.mock.method(Project, 'findOneAndUpdate', fenceAwareProject({ _id: 'project-1' }));
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	let captured;
	t.mock.method(GitRepo, 'create', async (payload, options) => { captured = { payload, options }; return [{ _id: 'repo-1', ...(Array.isArray(payload) ? payload[0] : payload) }]; });
	t.mock.method(AuditLog, 'create', async () => ({}));

	const repo = await createGitRepo('user', 'host', { project: 'project-1', name: 'Repo' });

	assert.equal(String(repo._id), 'repo-1');
	assert.equal(captured.options.session, 'unit-session', 'the repo create shares the gate transaction session');
	assert.equal(captured.payload[0].project, 'project-1');
});

test('createGitRepo creates nothing when the project fence aborts', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	// Acquire succeeds, but the fence re-verification fails: the project was deactivated or the lease expired.
	t.mock.method(Project, 'findOneAndUpdate', fenceAwareProject({ _id: 'project-1' }, null));
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	let creates = 0;
	t.mock.method(GitRepo, 'create', async () => { creates++; return [{}]; });
	t.mock.method(AuditLog, 'create', async () => ({}));

	await assert.rejects(createGitRepo('user', 'host', { project: 'project-1', name: 'Repo' }), (err) => err.code === 'project_not_found');
	assert.equal(creates, 0, 'no repo is stranded in a deactivated project');
});

test('createConnection creates nothing when the project fence aborts', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	t.mock.method(Project, 'findOneAndUpdate', fenceAwareProject({ _id: 'project-1' }, null));
	t.mock.method(Project, 'updateOne', async () => ({ matchedCount: 1 }));
	t.mock.method(ObsidianConnection, 'findOne', () => query(null));
	let creates = 0;
	t.mock.method(ObsidianConnection, 'create', async () => { creates++; return [{ _id: 'connection-1' }]; });
	t.mock.method(AuditLog, 'create', async () => ({}));

	await assert.rejects(createConnection('user', 'host', { project_id: 'project-1', name: 'Vault' }), (err) => err.code === 'project_not_found');
	assert.equal(creates, 0, 'no connection is stranded in a deactivated project');
});

test('commitFileAtomic runs commitFile inside the provided publish and flushes events only postcommit', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const persisted = { _id: 'file', connection: 'conn', host_id: 'host', path: 'a.png', kind: 'image', size: 1, revision: 1, blob: 'old', sha256: 'old', modified_at: new Date(1000), last_source: 'obsidian', last_device_id: '', in_trash: false, trashed_at: null };
	t.mock.method(ObsidianRevision, 'create', async (data) => data);
	t.mock.method(ObsidianConnection, 'findOneAndUpdate', async () => ({ sequence: 1 }));
	t.mock.method(ObsidianConnection, 'updateOne', async () => ({ matchedCount: 1 }));
	t.mock.method(ObsidianChange, 'create', async (data) => data);
	t.mock.method(ObsidianBlob, 'findOneAndUpdate', async () => null);
	t.mock.method(ObsidianFile, 'findOneAndUpdate', async (filter, update) => {
		if (filter.revision !== persisted.revision) return null;
		Object.assign(persisted, update.$set);
		return { ...persisted };
	});

	const connection = { _id: 'conn', host_id: 'host', project: 'project', storage_bytes: 1, owner: 'owner' };
	let publishCalls = 0;
	let flushed = 0;
	const publish = async (persist) => { publishCalls++; const result = await persist('gate-session'); flushed++; return result; };
	const result = await syncTest.commitFileAtomic(connection, { ...structuredClone(persisted) }, 'update', { blob: { _id: 'A', sha256: 'A', total_bytes: 1 }, modifiedAt: new Date(2000), source: 'obsidian', operationId: 'A' }, publish);

	assert.equal(publishCalls, 1, 'one publish transaction per successful publication');
	assert.equal(flushed, 1, 'buffered events flush only after the publish transaction resolves');
	assert.equal(result.file.revision, 2);
});