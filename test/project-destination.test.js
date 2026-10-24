import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from '../model/mongoose.js';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { requireActiveProject } from '../services/project_service.js';
import { createNote } from '../services/note_service.js';
import { storeMemory } from '../services/memory_service.js';
import { saveUrl } from '../services/url_service.js';
import { createGitRepo } from '../services/git_sync_service.js';
import { mockTenantWork } from './helpers/tenant-work.js';

function query(result) { return { select() { return this; }, read() { return this; }, lean: async () => result }; }

test('shared destination guard scopes active projects and preserves default behavior', async (t) => {
	const original = Project.findOneAndUpdate;
	t.after(() => { Project.findOneAndUpdate = original; });
	const id = new mongoose.Types.ObjectId();
	const calls = [];
	Project.findOneAndUpdate = (filter) => { calls.push(filter); return query({ _id: id }); };
	assert.equal(await requireActiveProject('host', id), id);
	assert.deepEqual(calls[0], { _id: id, host_id: 'host', is_active: true });
	assert.equal(await requireActiveProject('host'), id);
	assert.deepEqual(calls[1], { host_id: 'host', is_active: true, is_default: true });
	for (const invalid of [null, { $ne: null }, [], 123]) await assert.rejects(requireActiveProject('host', invalid), /Active project/);
	Project.findOneAndUpdate = () => query(null);
	await assert.rejects(requireActiveProject('foreign-host', id), /Active project/);
	Project.findOneAndUpdate = () => ({ select() { return this; }, read() { return this; }, lean: async () => { throw Object.assign(new Error('bad id'), { name: 'CastError' }); } });
	await assert.rejects(requireActiveProject('host', 'malformed'), /Active project/);
});

test('rejected destinations cause no record creation or external fetch', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const original = Project.findOneAndUpdate;
	t.after(() => { Project.findOneAndUpdate = original; });
	Project.findOneAndUpdate = () => query(null);
	for (const create of [createNote, storeMemory, saveUrl, createGitRepo]) await assert.rejects(create('user', 'host', { project: new mongoose.Types.ObjectId(), url: 'http://127.0.0.1', repo_url: '/must-not-clone' }), /Active project/);
});

test('idempotent imports reuse a scoped identity and reject cancellation before writing', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const projectFind = Project.findOneAndUpdate;
	const noteFind = Note.findOne;
	const noteCreate = Note.create;
	t.after(() => { Project.findOneAndUpdate = projectFind; Note.findOne = noteFind; Note.create = noteCreate; });
	Project.findOneAndUpdate = (filter) => query({ _id: filter._id });
	let creates = 0;
	Note.create = async () => { creates++; throw new Error('must not create'); };
	const controller = new AbortController(); controller.abort();
	await assert.rejects(createNote('user', 'host', { project: 'project' }, { signal: controller.signal }), /abort/i);
	assert.equal(creates, 0);
	await assert.rejects(createNote('user', 'host', { project: 'project' }, { assertOwnership: async () => { throw new Error('lease lost'); } }), /lease lost/);
	assert.equal(creates, 0);
});

test('import publication uses the owning queue transaction and retries keep one identity', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const projectFind = Project.findOneAndUpdate;
	const projectUpdate = Project.updateOne;
	const noteFind = Note.findOneAndUpdate;
	const noteCreate = Note.create;
	t.after(() => { Project.findOneAndUpdate = projectFind; Project.updateOne = projectUpdate; Note.findOneAndUpdate = noteFind; Note.create = noteCreate; });
	Project.findOneAndUpdate = (filter) => query({ _id: filter._id });
	Project.updateOne = () => Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
	const session = { owner: 'job-claim' };
	let stored;
	let transactions = 0;
	let inserts = 0;
	Note.findOneAndUpdate = (filter, update, options) => {
		assert.equal(options.session, session);
		assert.equal(options.upsert, true);
		assert.equal(options.timestamps, false);
		assert.equal(filter.host_id, 'host');
		assert.equal(filter.project, 'project');
		if (!stored) { inserts++; stored = { ...update.$setOnInsert }; }
		return { lean: async () => stored };
	};
	const ctx = { idempotency_id: 'import-id', withOwnership: async (publish) => { transactions++; return publish(session); } };
	const first = await createNote('user', 'host', { title: 'Imported', project: 'project' }, ctx);
	const second = await createNote('user', 'host', { title: 'Imported', project: 'project' }, ctx);
	assert.equal(first._id, 'import-id');
	assert.equal(second._id, first._id);
	assert.equal(inserts, 1);
	assert.equal(transactions, 2);
});
