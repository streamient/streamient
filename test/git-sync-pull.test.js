import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import vm from 'node:vm';
import test from 'node:test';

const exec = promisify(execFile);
const source = fs.readFileSync(new URL('../services/git_sync_service.js', import.meta.url), 'utf8');

function load(names, globals = {}) {
	const functions = names.map((name) => {
		const match = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm').exec(source);
		assert.ok(match, name);
		const next = /\n(?:export )?(?:async )?function \w+\(/g;
		next.lastIndex = match.index + match[0].length;
		return source.slice(match.index, next.exec(source)?.index ?? source.length).replace(/^export /, '');
	});
	const context = vm.createContext({ Date, Set, Map, path, ...globals });
	vm.runInContext(functions.join('\n'), context);
	return context;
}

test('one history command retains follow dates, renames, sync exclusion and unusual filenames', async (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-git-dates-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const git = async (args, env = {}) => (await exec('git', args, { cwd: dir, env: { ...process.env, ...env } })).stdout;
	await git(['init']);
	await git(['config', 'user.name', 'Test']);
	await git(['config', 'user.email', 'test@example.com']);
	const commit = async (subject, date) => { await git(['add', '.']); await git(['commit', '-m', subject], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }); };
	fs.mkdirSync(path.join(dir, 'sub'));
	fs.writeFileSync(path.join(dir, 'sub', 'old.md'), 'Original\n');
	await commit('create', '2026-01-01T00:00:00Z');
	await git(['mv', 'sub/old.md', 'sub/ü\tnew\nname.md']);
	await commit('rename', '2026-01-02T00:00:00Z');
	fs.appendFileSync(path.join(dir, 'sub', 'ü\tnew\nname.md'), 'Sync\n');
	fs.writeFileSync(path.join(dir, 'sub', 'sync-only.md'), 'Sync only\n');
	await commit('Streamient sync test', '2026-01-03T00:00:00Z');
	fs.appendFileSync(path.join(dir, 'sub', 'ü\tnew\nname.md'), 'Legacy sync\n');
	await commit('Kumbukum sync test', '2026-01-04T00:00:00Z');
	let calls = 0;
	const context = load(['validDateOrNull', 'gitRelativePath', 'getFileGitDates'], { cleanSyncBase: () => 'sub' });
	const files = ['ü\tnew\nname.md', 'sync-only.md'];
	const dates = await context.getFileGitDates({ raw: (args) => { calls++; return git(args); } }, 'sub', files);
	assert.equal(calls, 1);
	for (const file of files) {
		const output = await git(['log', '--follow', '--format=%cI%x1f%s', '--', `sub/${file}`]);
		const entries = output.trim().split('\n').map((line) => line.split('\x1f'));
		const userEntries = entries.filter((entry) => !/^(Streamient|Kumbukum) sync /.test(entry[1]));
		const expected = userEntries.length ? userEntries : entries;
		assert.equal(dates.get(file).createdAt.toISOString(), new Date(expected.at(-1)[0]).toISOString());
		assert.equal(dates.get(file).updatedAt.toISOString(), new Date(expected[0][0]).toISOString());
	}
});

for (const type of ['note', 'memory']) test(`batched ${type} snapshot preserves edits during history lookup`, async () => {
	const row = { _id: type, title: 'old', content: 'old', updatedAt: new Date(1000), git_source: { file_path: 'a.md', last_sha: 'old', last_synced_at: new Date(2000), origin: 'import' } };
	let reads = 0;
	const model = (present) => ({
		find: () => ({ lean: async () => { reads++; return present ? [structuredClone(row)] : []; } }),
		findOne: () => { throw new Error('per-file lookup'); },
		findOneAndUpdate: async (filter) => filter.updatedAt.getTime() === row.updatedAt.getTime() ? row : null,
	});
	const context = load(['validDateOrNull', 'timestampsDiffer', 'isLocalChangeNewer', 'importVersionGuard', 'normalizeImportedTimestamps', 'importedTags', 'pullFromGit'], {
		LOCAL_CHANGE_GRACE_MS: 1000,
		Note: model(type === 'note'), Memory: model(type === 'memory'),
		findMarkdownFiles: () => ['a.md'], containedRepoPath: (...parts) => path.join(...parts),
		fs: { constants: { O_RDONLY: 0, O_NOFOLLOW: 0 }, openSync: () => 1, readFileSync: () => 'remote', closeSync: () => {} },
		fileSha: () => 'remote', parseMarkdownFile: () => ({ type, title: 'remote', body: 'remote', tags: [] }),
		getFileGitDates: async () => { row.content = 'local edit'; row.updatedAt = new Date(9000); return new Map([['a.md', { createdAt: new Date(3000), updatedAt: new Date(3000) }]]); },
		marked: { parse: (text) => text }, striptags: (text) => text,
		syncMutation: (callback) => callback(), trashDeletedGitItems: async () => {},
		recordConflict: (summary) => { summary.conflicts++; },
	});
	const summary = { imported_files: 0, conflicts: 0 };
	await context.pullFromGit({}, '/virtual', '', { _id: 'repo' }, 'user', 'host', {}, summary);
	assert.equal(reads, 2);
	assert.equal(row.content, 'local edit');
	assert.equal(summary.imported_files, 0);
	assert.equal(summary.conflicts, 1);
});

test('batched trash pass keeps the concurrent-update fence and excludes commit memories', async () => {
	const note = { _id: 'note', updatedAt: new Date(1000), git_source: { file_path: 'a.md', last_synced_at: new Date(2000) } };
	const context = load(['isLocalChangeNewer', 'trashDeletedGitItems'], {
		LOCAL_CHANGE_GRACE_MS: 1000,
		Note: { findOneAndUpdate: async () => null },
		Memory: { findOneAndUpdate: () => { throw new Error('commit memory must not be trashed'); } },
		syncMutation: (callback) => callback(), recordConflict: (summary) => { summary.conflicts++; },
	});
	const summary = { trashed_items: 0, conflicts: 0 };
	await context.trashDeletedGitItems({ trash_on_delete: true }, 'host', new Set(), summary, [note], [{ ...note, git_commit: { repo_id: 'repo' } }]);
	assert.equal(summary.trashed_items, 0);
	assert.equal(summary.conflicts, 1);
});

test('batched import recognizes a claimed path with pending local edits', async () => {
	const row = { _id: 'note', title: 'Title', content: 'local edit', updatedAt: new Date(9000), git_source: { file_path: 'a.md', origin: 'push' } };
	const context = load(['validDateOrNull', 'timestampsDiffer', 'isLocalChangeNewer', 'importVersionGuard', 'normalizeImportedTimestamps', 'importedTags', 'pullFromGit'], {
		LOCAL_CHANGE_GRACE_MS: 1000,
		Note: { find: () => ({ lean: async () => [structuredClone(row)] }), create: () => { throw new Error('claimed path must not be duplicated'); } },
		Memory: { find: () => ({ lean: async () => [] }) },
		findMarkdownFiles: () => ['a.md'], containedRepoPath: (...parts) => path.join(...parts),
		fs: { constants: { O_RDONLY: 0, O_NOFOLLOW: 0 }, openSync: () => 1, readFileSync: () => 'remote', closeSync: () => {} },
		fileSha: () => 'remote', parseMarkdownFile: () => ({ type: 'note', title: 'Title', body: 'remote', tags: [] }),
		getFileGitDates: async () => new Map([['a.md', { createdAt: new Date(3000), updatedAt: new Date(3000) }]]),
		trashDeletedGitItems: async () => {}, recordConflict: (summary) => { summary.conflicts++; },
	});
	const summary = { imported_files: 0, conflicts: 0 };
	await context.pullFromGit({}, '/virtual', '', { _id: 'repo' }, 'user', 'host', {}, summary);
	assert.equal(summary.conflicts, 1);
	assert.equal(summary.imported_files, 0);
	assert.equal(row.content, 'local edit');
});
