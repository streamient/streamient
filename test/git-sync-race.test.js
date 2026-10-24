import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../services/git_sync_service.js', import.meta.url), 'utf8');

function extract(name) {
	const match = new RegExp(`^(?:export )?(?:async )?function(?:\\*)? ${name}\\(`, 'm').exec(source);
	assert.ok(match, `missing function ${name}`);
	const next = /\n(?:export )?(?:async )?function(?:\*)? \w+\(/g;
	next.lastIndex = match.index + match[0].length;
	return source.slice(match.index, next.exec(source)?.index ?? source.length).replace(/^export /, '');
}

function load(names, globals) {
	const context = vm.createContext({ Date, Number, String, Math, Set, Map, Error, Buffer, crypto, path, fs, structuredClone, ...globals });
	vm.runInContext(names.map(extract).join('\n'), context);
	return context;
}

function setValue(obj, key, value) {
	const parts = key.split('.');
	let target = obj;
	for (const part of parts.slice(0, -1)) target = target[part] ||= {};
	target[parts.at(-1)] = value;
}

test('Git import does not overwrite a note edited during the git-history await', async () => {
	const row = { _id: 'note', title: 'old', content: 'old', updatedAt: new Date(1000), git_source: { last_sha: 'old', last_synced_at: new Date(2000), origin: 'import' } };
	const conflicts = [];
	const Note = {
		find: async () => [],
		findOne: async () => structuredClone(row),
		findOneAndUpdate: async (filter, update) => {
			if (filter.updatedAt.getTime() !== row.updatedAt.getTime()) return null;
			for (const [key, value] of Object.entries(update.$set || {})) setValue(row, key, value);
			return row;
		},
	};
	const context = load(['validDateOrNull', 'timestampsDiffer', 'isLocalChangeNewer', 'importVersionGuard', 'normalizeImportedTimestamps', 'pullFromGit'], {
		LOCAL_CHANGE_GRACE_MS: 1000,
		Note,
		Memory: { find: async () => [], findOne: async () => null },
		findMarkdownFiles: () => ['notes/a.md'],
		containedRepoPath: (...parts) => path.join(...parts),
		fs: { constants: fs.constants, openSync: () => 1, readFileSync: () => 'remote content', closeSync: () => {} },
		fileSha: () => 'remote-sha',
		parseMarkdownFile: () => ({ type: 'note', title: 'remote', body: 'remote content', tags: [] }),
		getFileGitDates: async () => { row.content = 'new local edit'; row.updatedAt = new Date(9000); return { createdAt: new Date(3000), updatedAt: new Date(3000) }; },
		marked: { parse: (text) => text },
		striptags: (text) => text,
		syncMutation: (callback) => callback(undefined),
		trashDeletedGitItems: async () => {},
		recordConflict: (summary, type, relPath, reason) => { summary.conflicts = (summary.conflicts || 0) + 1; conflicts.push({ type, relPath, reason }); },
	});
	const summary = { imported_files: 0, conflicts: 0 };
	await context.pullFromGit({}, '/virtual', '', { _id: 'repo' }, 'user', 'host', {}, summary);
	assert.equal(row.content, 'new local edit');
	assert.equal(row.updatedAt.getTime(), 9000);
	assert.equal(summary.imported_files, 0);
	assert.equal(summary.conflicts, 1);
	assert.equal(conflicts[0].reason, 'Changed locally while syncing');
});

test('Git import does not overwrite a memory edited during the git-history await', async () => {
	const row = { _id: 'memory', title: 'old', content: 'old', updatedAt: new Date(1000), git_source: { last_sha: 'old', last_synced_at: new Date(2000), origin: 'import' } };
	const Memory = {
		find: async () => [],
		findOne: async () => structuredClone(row),
		findOneAndUpdate: async (filter, update) => {
			if (filter.updatedAt.getTime() !== row.updatedAt.getTime()) return null;
			for (const [key, value] of Object.entries(update.$set || {})) setValue(row, key, value);
			return row;
		},
	};
	const context = load(['validDateOrNull', 'timestampsDiffer', 'isLocalChangeNewer', 'importVersionGuard', 'normalizeImportedTimestamps', 'pullFromGit'], {
		LOCAL_CHANGE_GRACE_MS: 1000,
		Note: { find: async () => [], findOne: async () => null },
		Memory,
		findMarkdownFiles: () => ['memories/a.md'],
		containedRepoPath: (...parts) => path.join(...parts),
		fs: { constants: fs.constants, openSync: () => 1, readFileSync: () => 'remote memory', closeSync: () => {} },
		fileSha: () => 'remote-sha',
		parseMarkdownFile: () => ({ type: 'memory', title: 'remote', body: 'remote memory', tags: [] }),
		getFileGitDates: async () => { row.content = 'new local memory edit'; row.updatedAt = new Date(9000); return { createdAt: new Date(3000), updatedAt: new Date(3000) }; },
		marked: { parse: (text) => text },
		striptags: (text) => text,
		syncMutation: (callback) => callback(undefined),
		trashDeletedGitItems: async () => {},
		recordConflict: (summary, type, relPath, reason) => { summary.conflicts = (summary.conflicts || 0) + 1; },
	});
	const summary = { imported_files: 0, conflicts: 0 };
	await context.pullFromGit({}, '/virtual', '', { _id: 'repo' }, 'user', 'host', {}, summary);
	assert.equal(row.content, 'new local memory edit');
	assert.equal(row.updatedAt.getTime(), 9000);
	assert.equal(summary.conflicts, 1);
});

test('Git export acknowledges only the captured version and leaves a concurrent edit pending', async () => {
	let clock = 5000;
	class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
	const row = { _id: 'note', title: 'Title', content: 'snapshot A', updatedAt: new Date(4000), git_source: { repo_id: 'repo', file_path: 'notes/a.md', last_synced_at: new Date(0), last_sha: 'old' } };
	const files = new Map();
	let pushed = 0;
	const Note = {
		findOneAndUpdate: async (filter, update) => {
			if (filter.updatedAt.getTime() !== row.updatedAt.getTime()) return null;
			for (const [key, value] of Object.entries(update.$set || {})) setValue(row, key, value);
			return row;
		},
	};
	const context = load(['isLocalChangeNewer', 'pushToGit'], {
		Date: ClockDate,
		LOCAL_CHANGE_GRACE_MS: 1000,
		Note,
		Memory: {},
		GitRepo: { countDocuments: async () => 1 },
		findPushCandidates: async (model) => (model === Note ? [structuredClone(row)] : []),
		cleanRepoPath: (value, fallback) => value || fallback,
		noteToMarkdown: (note) => note.content,
		fileSha: (text) => crypto.createHash('sha1').update(text).digest('hex'),
		containedRepoPath: (...parts) => path.join(...parts),
		syncLease: { getStore: () => null },
		syncMutation: (callback) => callback(undefined),
		repoAuthUrl: () => 'synthetic-remote',
		fs: { constants: fs.constants, existsSync: () => true, mkdirSync: () => {}, openSync: (filename) => filename, writeFileSync: (filename, value) => files.set(filename, value), closeSync: () => {} },
	});
	const git = {
		addConfig: async () => {}, add: async () => {}, status: async () => ({ files: ['a.md'] }), commit: async () => {},
		push: async () => { pushed++; if (pushed === 1) { clock = 10000; row.content = 'new local B'; row.updatedAt = new Date(clock); } clock = 12000; },
	};
	const summary = { skipped: 0, exported_files: 0, conflict_paths: new Set() };
	await context.pushToGit(git, '/virtual', '', { _id: 'repo', project: 'project' }, 'user', 'host', '', summary);
	assert.equal(files.get('/virtual/notes/a.md'), 'snapshot A');
	assert.equal(row.content, 'new local B');
	assert.equal(row.updatedAt.getTime(), 10000);
	assert.equal(context.isLocalChangeNewer(row), true);
	assert.equal(row.git_source.last_sha, 'old');
	assert.equal(summary.exported_files, 0);

	files.clear();
	const nextSummary = { skipped: 0, exported_files: 0, conflict_paths: new Set() };
	await context.pushToGit(git, '/virtual', '', { _id: 'repo', project: 'project' }, 'user', 'host', '', nextSummary);
	assert.equal(files.get('/virtual/notes/a.md'), 'new local B');
	assert.equal(nextSummary.exported_files, 1);
	assert.equal(row.git_source.last_sha, crypto.createHash('sha1').update('new local B').digest('hex'));
});