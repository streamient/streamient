import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { syncRepo, backfillGitSyncMode } from '../services/git_sync_service.js';
import { GitRepo } from '../model/git_repo.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';

const exec = promisify(execFile);
const originals = {};

function now(offsetMs = 0) {
	return new Date(Date.now() + offsetMs);
}

function gitDate(date) {
	return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function oid(value) {
	return {
		value,
		toString() {
			return value;
		},
	};
}

function getValue(obj, key) {
	return key.split('.').reduce((acc, part) => acc?.[part], obj);
}

function setValue(obj, key, value) {
	const parts = key.split('.');
	let target = obj;
	for (const part of parts.slice(0, -1)) {
		target[part] ||= {};
		target = target[part];
	}
	target[parts.at(-1)] = value;
}

function sameValue(actual, expected) {
	if (actual?.toString && expected?.toString) return actual.toString() === expected.toString();
	return actual === expected;
}

function matches(doc, query) {
	for (const [key, expected] of Object.entries(query)) {
		if (key === '$or') {
			if (!expected.some((candidate) => matches(doc, candidate))) return false;
			continue;
		}

		const actual = getValue(doc, key);
		const isOperatorObject = expected && typeof expected === 'object' && !Array.isArray(expected) && Object.keys(expected).some((part) => part.startsWith('$'));
		if (isOperatorObject) {
			if ('$ne' in expected && sameValue(actual, expected.$ne)) return false;
			if ('$exists' in expected && ((actual !== undefined && actual !== null) !== expected.$exists)) return false;
			continue;
		}

		if (!sameValue(actual, expected)) return false;
	}
	return true;
}

function makeDoc(data) {
	return {
		createdAt: now(),
		updatedAt: now(),
		...data,
		async save() {
			this.updatedAt = now();
			return this;
		},
		toObject() {
			return { ...this };
		},
	};
}

function installModelMocks(state) {
	originals.GitRepo = {
		findOne: GitRepo.findOne,
		findOneAndUpdate: GitRepo.findOneAndUpdate,
		countDocuments: GitRepo.countDocuments,
	};
	originals.Note = {
		findOne: Note.findOne,
		find: Note.find,
		create: Note.create,
		findByIdAndUpdate: Note.findByIdAndUpdate,
		countDocuments: Note.countDocuments,
	};
	originals.Memory = {
		findOne: Memory.findOne,
		find: Memory.find,
		create: Memory.create,
		findByIdAndUpdate: Memory.findByIdAndUpdate,
		countDocuments: Memory.countDocuments,
	};

	GitRepo.findOne = async (query) => state.repos.find((repo) => matches(repo, query)) || null;
	GitRepo.findOneAndUpdate = async (query, update) => {
		const repo = state.repos.find((candidate) => matches(candidate, query));
		if (!repo) return null;
		for (const [key, value] of Object.entries(update.$set || {})) setValue(repo, key, value);
		return repo;
	};
	GitRepo.countDocuments = async (query) => state.repos.filter((repo) => matches(repo, query)).length;

	for (const [Model, collection] of [[Note, state.notes], [Memory, state.memories]]) {
		Model.findOne = async (query) => collection.find((doc) => matches(doc, query)) || null;
		Model.find = async (query) => collection.filter((doc) => matches(doc, query));
		Model.countDocuments = async (query) => collection.filter((doc) => matches(doc, query)).length;
		Model.create = async (data) => {
			const doc = makeDoc({ _id: oid(`${Model.modelName.toLowerCase()}-${collection.length + 1}`), ...data });
			collection.push(doc);
			return doc;
		};
		Model.findByIdAndUpdate = async (id, update, options = {}) => {
			const doc = collection.find((candidate) => sameValue(candidate._id, id));
			if (!doc) return null;
			for (const [key, value] of Object.entries(update.$set || {})) setValue(doc, key, value);
			if (options.timestamps !== false && !Object.hasOwn(update.$set || {}, 'updatedAt')) doc.updatedAt = now();
			return doc;
		};
	}
}

function restoreModelMocks() {
	if (!originals.GitRepo) return;
	Object.assign(GitRepo, originals.GitRepo);
	Object.assign(Note, originals.Note);
	Object.assign(Memory, originals.Memory);
}

async function git(cwd, args, env = {}) {
	return exec('git', args, { cwd, env: { ...process.env, ...env } });
}

async function commitAll(cwd, message, date = new Date()) {
	const env = {
		GIT_AUTHOR_DATE: date.toISOString(),
		GIT_COMMITTER_DATE: date.toISOString(),
	};
	await git(cwd, ['add', '.']);
	await git(cwd, ['commit', '-m', message], env);
}

async function createRemoteRepo() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-git-sync-'));
	const bare = path.join(root, 'remote.git');
	const work = path.join(root, 'work');
	await git(root, ['init', '--bare', bare]);
	await git(root, ['init', work]);
	await git(work, ['config', 'user.email', 'author@example.com']);
	await git(work, ['config', 'user.name', 'Author']);
	await git(work, ['branch', '-M', 'main']);
	await git(work, ['remote', 'add', 'origin', bare]);
	fs.writeFileSync(path.join(work, 'seed.txt'), 'seed\n');
	await commitAll(work, 'seed');
	await git(work, ['push', '-u', 'origin', 'main']);
	return { root, bare, work };
}

function makeRepo(remote, overrides = {}) {
	return makeDoc({
		_id: oid(overrides.id || `repo-${Math.random().toString(16).slice(2)}`),
		project: oid(overrides.project || 'project-1'),
		owner: oid('user-1'),
		host_id: overrides.hostId || `host-${Math.random().toString(16).slice(2)}`,
		name: overrides.name || 'Repo',
		repo_url: remote.bare,
		branch: 'main',
		auth_token: '',
		sync_interval: 10,
		enabled: true,
		sync_mode: 'read_write',
		notes_path: 'notes',
		memories_path: 'memories',
		sync_path: '/',
		trash_on_delete: true,
		commit_sync_enabled: overrides.commit_sync_enabled ?? true,
		commit_history_days: overrides.commit_history_days || 90,
		last_synced_at: null,
		last_sync_status: null,
		last_sync_error: '',
		sync_runs: [],
		...overrides,
	});
}

function cleanupClone(hostId) {
	fs.rmSync(path.join(process.cwd(), 'assets', 'git-repos', hostId), { recursive: true, force: true });
}

test.afterEach(() => {
	restoreModelMocks();
});

test('imports markdown notes, memories, and recent commit memories', async (t) => {
	const remote = await createRemoteRepo();
	t.after(() => fs.rmSync(remote.root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(remote.work, 'notes'), { recursive: true });
	fs.mkdirSync(path.join(remote.work, 'memories'), { recursive: true });
	fs.writeFileSync(path.join(remote.work, 'notes', 'old.md'), '---\ntitle: Old Note\n---\n\nOld\n');
	await commitAll(remote.work, 'old outside window', now(-120 * 24 * 60 * 60 * 1000));
	fs.writeFileSync(path.join(remote.work, 'notes', 'recent.md'), '---\ntitle: Recent Note\ntags:\n  - alpha\n---\n\nRecent\n');
	fs.writeFileSync(path.join(remote.work, 'memories', 'recent.md'), '---\ntitle: Recent Memory\ntype: memory\n---\n\nRemember this\n');
	const recentCreatedDate = now(-20 * 24 * 60 * 60 * 1000);
	await commitAll(remote.work, 'create recent knowledge files', recentCreatedDate);
	fs.writeFileSync(path.join(remote.work, 'notes', 'recent.md'), '---\ntitle: Recent Note\ntags:\n  - alpha\n---\n\nRecent updated\n');
	const recentUpdatedDate = now(-2 * 24 * 60 * 60 * 1000);
	await commitAll(remote.work, 'update recent note', recentUpdatedDate);
	fs.writeFileSync(path.join(remote.work, 'notes', 'recent.md'), '---\ntitle: Recent Note\ntags:\n  - alpha\n---\n\nRecent updated by sync\n');
	await commitAll(remote.work, 'Streamient sync 2026-05-08T03:49:21.097Z', now(-1 * 24 * 60 * 60 * 1000));
	await git(remote.work, ['push']);

	const repo = makeRepo(remote);
	t.after(() => cleanupClone(repo.host_id));
	const state = { repos: [repo], notes: [], memories: [] };
	installModelMocks(state);

	const summary = await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });

	assert.equal(summary.imported_files, 3);
	assert.equal(state.notes.some((note) => note.title === 'Recent Note'), true);
	assert.equal(state.memories.some((memory) => memory.title === 'Recent Memory'), true);
	assert.equal(state.memories.filter((memory) => memory.git_commit?.sha).length >= 1, true);
	assert.match(state.memories.find((memory) => memory.git_commit?.sha).content, /Changed files:/);
	assert.equal(state.notes.find((note) => note.title === 'Recent Note').createdAt.toISOString(), gitDate(recentCreatedDate).toISOString());
	assert.equal(state.notes.find((note) => note.title === 'Recent Note').updatedAt.toISOString(), gitDate(recentUpdatedDate).toISOString());
	assert.equal(state.memories.find((memory) => memory.title === 'Recent Memory').createdAt.toISOString(), gitDate(recentCreatedDate).toISOString());
	assert.equal(state.memories.find((memory) => memory.title === 'Recent Memory').updatedAt.toISOString(), gitDate(recentCreatedDate).toISOString());

	const recentNote = state.notes.find((note) => note.title === 'Recent Note');
	recentNote.updatedAt = now(5000);
	recentNote.is_indexed = true;
	await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });
	assert.equal(recentNote.updatedAt.toISOString(), gitDate(recentUpdatedDate).toISOString());

	for (const memory of state.memories.filter((candidate) => candidate.git_commit?.sha)) {
		assert.equal(memory.createdAt.toISOString(), memory.git_commit.committed_at.toISOString());
		assert.equal(memory.updatedAt.toISOString(), memory.git_commit.committed_at.toISOString());
	}
});

test('imports new commits incrementally without duplicates', async (t) => {
	const remote = await createRemoteRepo();
	t.after(() => fs.rmSync(remote.root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(remote.work, 'notes'), { recursive: true });
	fs.writeFileSync(path.join(remote.work, 'notes', 'a.md'), '---\ntitle: A\n---\n\nA\n');
	await commitAll(remote.work, 'first note', now(-2 * 24 * 60 * 60 * 1000));
	await git(remote.work, ['push']);

	const repo = makeRepo(remote);
	t.after(() => cleanupClone(repo.host_id));
	const state = { repos: [repo], notes: [], memories: [] };
	installModelMocks(state);

	await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });
	const firstCommitCount = state.memories.filter((memory) => memory.git_commit?.sha).length;
	assert.equal(firstCommitCount >= 1, true);

	fs.writeFileSync(path.join(remote.work, 'notes', 'b.md'), '---\ntitle: B\n---\n\nB\n');
	await commitAll(remote.work, 'second note', now(-1 * 24 * 60 * 60 * 1000));
	await git(remote.work, ['push']);
	await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });

	const commitMemories = state.memories.filter((memory) => memory.git_commit?.sha);
	assert.equal(commitMemories.length, firstCommitCount + 1);
	assert.equal(new Set(commitMemories.map((memory) => memory.git_commit.sha)).size, firstCommitCount + 1);
});

test('does not export local-only items when multiple enabled repos share a project', async (t) => {
	const remote = await createRemoteRepo();
	const otherRemote = await createRemoteRepo();
	t.after(() => {
		fs.rmSync(remote.root, { recursive: true, force: true });
		fs.rmSync(otherRemote.root, { recursive: true, force: true });
	});
	const repo = makeRepo(remote, { project: 'shared-project', commit_sync_enabled: false });
	const otherRepo = makeRepo(otherRemote, { project: 'shared-project', commit_sync_enabled: false });
	t.after(() => cleanupClone(repo.host_id));
	const state = {
		repos: [repo, otherRepo],
		notes: [makeDoc({ _id: oid('local-note'), title: 'Local Only', content: '<p>Local</p>', project: oid('shared-project'), owner: oid('user-1'), host_id: repo.host_id, in_trash: false })],
		memories: [],
	};
	otherRepo.host_id = repo.host_id;
	installModelMocks(state);

	const summary = await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });
	const tree = await git(remote.bare, ['ls-tree', '-r', '--name-only', 'main']);

	assert.equal(summary.exported_files, 0);
	assert.equal(summary.skipped > 0, true);
	assert.equal(tree.stdout.includes('Local Only.md'), false);
});

test('trashes synced items when their git file is deleted', async (t) => {
	const remote = await createRemoteRepo();
	t.after(() => fs.rmSync(remote.root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(remote.work, 'notes'), { recursive: true });
	fs.writeFileSync(path.join(remote.work, 'notes', 'delete-me.md'), '---\ntitle: Delete Me\n---\n\nBody\n');
	await commitAll(remote.work, 'add note');
	await git(remote.work, ['push']);

	const repo = makeRepo(remote, { commit_sync_enabled: false });
	t.after(() => cleanupClone(repo.host_id));
	const state = { repos: [repo], notes: [], memories: [] };
	installModelMocks(state);

	await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });
	fs.rmSync(path.join(remote.work, 'notes', 'delete-me.md'));
	await commitAll(remote.work, 'delete note');
	await git(remote.work, ['push']);
	const summary = await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });

	assert.equal(summary.trashed_items, 1);
	assert.equal(state.notes[0].in_trash, true);
});

test('records conflict and skips overwrite when git and local item both changed', async (t) => {
	const remote = await createRemoteRepo();
	t.after(() => fs.rmSync(remote.root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(remote.work, 'notes'), { recursive: true });
	fs.writeFileSync(path.join(remote.work, 'notes', 'conflict.md'), '---\ntitle: Conflict\n---\n\nRemote one\n');
	await commitAll(remote.work, 'add conflict note');
	await git(remote.work, ['push']);

	const repo = makeRepo(remote, { commit_sync_enabled: false });
	t.after(() => cleanupClone(repo.host_id));
	const state = { repos: [repo], notes: [], memories: [] };
	installModelMocks(state);

	await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });
	const note = state.notes[0];
	note.content = '<p>Local edit</p>';
	note.text_content = 'Local edit';
	note.updatedAt = now(5000);
	fs.writeFileSync(path.join(remote.work, 'notes', 'conflict.md'), '---\ntitle: Conflict\n---\n\nRemote two\n');
	await commitAll(remote.work, 'remote conflict edit');
	await git(remote.work, ['push']);

	const summary = await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });

	assert.equal(summary.conflicts, 1);
	assert.equal(state.notes[0].content, '<p>Local edit</p>');
});

test('read-only repo imports but never exports to git', async (t) => {
	const remote = await createRemoteRepo();
	t.after(() => fs.rmSync(remote.root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(remote.work, 'notes'), { recursive: true });
	fs.writeFileSync(path.join(remote.work, 'notes', 'Foo.md'), '---\ntitle: Foo\n---\n\nOriginal remote\n');
	await commitAll(remote.work, 'add foo');
	await git(remote.work, ['push']);

	const repo = makeRepo(remote, { sync_mode: 'read_only', commit_sync_enabled: false });
	t.after(() => cleanupClone(repo.host_id));
	const state = {
		repos: [repo],
		notes: [makeDoc({ _id: oid('local-bar'), title: 'Bar', content: '<p>Bar</p>', text_content: 'Bar', project: repo.project, owner: oid('user-1'), host_id: repo.host_id, in_trash: false })],
		memories: [],
	};
	installModelMocks(state);

	const summary = await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });
	const tree = await git(remote.bare, ['ls-tree', '-r', '--name-only', 'main']);

	assert.equal(summary.exported_files, 0);
	assert.equal(tree.stdout.includes('Bar.md'), false);
	// Import direction still works in read-only mode.
	assert.equal(state.notes.some((note) => note.title === 'Foo'), true);
});

test('read-write export never overwrites an existing repo file', async (t) => {
	const remote = await createRemoteRepo();
	t.after(() => fs.rmSync(remote.root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(remote.work, 'notes'), { recursive: true });
	fs.writeFileSync(path.join(remote.work, 'notes', 'Foo.md'), '---\ntitle: Foo\n---\n\nOriginal remote\n');
	await commitAll(remote.work, 'add foo');
	await git(remote.work, ['push']);

	// Single enabled read-write repo + a brand-new local note whose title collides with Foo.md.
	const repo = makeRepo(remote, { commit_sync_enabled: false });
	t.after(() => cleanupClone(repo.host_id));
	const state = {
		repos: [repo],
		notes: [makeDoc({ _id: oid('local-foo'), title: 'Foo', content: '<p>New local body</p>', text_content: 'New local body', project: repo.project, owner: oid('user-1'), host_id: repo.host_id, in_trash: false })],
		memories: [],
	};
	installModelMocks(state);

	await syncRepo(repo._id.toString(), 'user-1', repo.host_id, { skip_lock: true, skip_audit: true });

	const tree = (await git(remote.bare, ['ls-tree', '-r', '--name-only', 'main'])).stdout;
	assert.equal(tree.includes('notes/Foo.md'), true);
	assert.equal(tree.includes('notes/Foo-2.md'), true);
	// Existing repo file is untouched; the new note lands at a non-colliding path.
	assert.match((await git(remote.bare, ['show', 'main:notes/Foo.md'])).stdout, /Original remote/);
	assert.match((await git(remote.bare, ['show', 'main:notes/Foo-2.md'])).stdout, /New local body/);
});

test('backfillGitSyncMode sets read_write only on repos missing sync_mode', async () => {
	const repos = [{ sync_mode: undefined }, { sync_mode: 'read_only' }, {}];
	const original = GitRepo.updateMany;
	let captured;
	GitRepo.updateMany = async (query, update) => {
		captured = { query, update };
		const matched = repos.filter((r) => r.sync_mode === undefined);
		matched.forEach((r) => Object.assign(r, update.$set));
		return { modifiedCount: matched.length };
	};
	try {
		const result = await backfillGitSyncMode();
		assert.deepEqual(captured.query, { sync_mode: { $exists: false } });
		assert.equal(captured.update.$set.sync_mode, 'read_write');
		assert.equal(result.sync_mode, 2);
		assert.equal(repos[1].sync_mode, 'read_only'); // untouched
	} finally {
		GitRepo.updateMany = original;
	}
});
