import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import mongoose, { hydratedQuery } from '../model/mongoose.js';
import simpleGit from 'simple-git';
import matter from 'gray-matter';
import { marked } from 'marked';
import TurndownService from 'turndown';
import striptags from 'striptags';

import { GitRepo } from '../model/git_repo.js';
import { GitSyncLog } from '../model/git_sync_log.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import * as audit from './audit_service.js';
import { encrypt, decrypt } from '../modules/encryption.js';
import { getRedisClient } from '../modules/redis.js';
import { emitToTenant } from '../modules/socket.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('git-sync');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GIT_REPOS_DIR = path.join(__dirname, '..', 'assets', 'git-repos');
fs.mkdirSync(GIT_REPOS_DIR, { recursive: true });

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const LOCAL_CHANGE_GRACE_MS = 1000;
const MAX_SYNC_RUNS = 10;
const SYNC_LOG_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

// ── Helpers ──

function repoDir(hostId, repoId) {
	return path.join(GIT_REPOS_DIR, hostId, repoId.toString());
}

export function deleteGitRepoHostDirectory(hostId) {
	const dir = path.join(GIT_REPOS_DIR, hostId);
	fs.rm(dir, { recursive: true, force: true }, () => {});
}

function cloneUrl(repoUrl, token) {
	if (!token) return repoUrl;
	try {
		const u = new URL(repoUrl);
		u.username = 'x-access-token';
		u.password = token;
		return u.toString();
	} catch {
		return repoUrl;
	}
}

function repoAuthUrl(gitRepo, token) {
	return cloneUrl(gitRepo.repo_url, token);
}

function stripAuthFromRemote(gitRepo) {
	return gitRepo.repo_url;
}

function resolveType(filePath, gitRepo) {
	const notesDir = (gitRepo.notes_path || 'notes').replace(/^\/|\/$/g, '');
	const memoriesDir = (gitRepo.memories_path || 'memories').replace(/^\/|\/$/g, '');
	const relative = filePath.replace(/\\/g, '/');
	if (relative.startsWith(`${memoriesDir}/`)) return 'memory';
	if (relative.startsWith(`${notesDir}/`)) return 'note';
	return 'note'; // default for root-level .md files
}

function parseMarkdownFile(content) {
	const { data: frontmatter, content: body } = matter(content);
	return {
		title: frontmatter.title || '',
		tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
		type: frontmatter.type || '', // 'note' | 'memory' — overrides directory mapping
		body: body.trim(),
	};
}

function noteToMarkdown(note) {
	const fm = { title: note.title };
	if (note.tags?.length) fm.tags = note.tags;
	fm.type = 'note';
	const md = turndown.turndown(note.content || '');
	return matter.stringify(md, fm);
}

function memoryToMarkdown(mem) {
	const fm = { title: mem.title };
	if (mem.tags?.length) fm.tags = mem.tags;
	fm.type = 'memory';
	return matter.stringify(mem.content || '', fm);
}

function fileSha(content) {
	return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

function createSyncSummary() {
	const startedAt = new Date();
	return {
		imported_files: 0,
		exported_files: 0,
		trashed_items: 0,
		imported_commits: 0,
		conflicts: 0,
		skipped: 0,
		started_at: startedAt,
		finished_at: null,
		duration_ms: 0,
		message: '',
		conflict_details: [],
		conflict_paths: new Set(),
	};
}

function finalizeSummary(summary, status, message = '') {
	const finishedAt = new Date();
	summary.finished_at = finishedAt;
	summary.duration_ms = finishedAt.getTime() - new Date(summary.started_at).getTime();
	summary.message = message;
	return {
		status,
		started_at: summary.started_at,
		finished_at: summary.finished_at,
		duration_ms: summary.duration_ms,
		imported_files: summary.imported_files,
		exported_files: summary.exported_files,
		trashed_items: summary.trashed_items,
		imported_commits: summary.imported_commits,
		conflicts: summary.conflicts,
		skipped: summary.skipped,
		message: summary.message,
	};
}

function recordConflict(summary, type, filePath, reason) {
	summary.conflicts++;
	summary.conflict_details.push({ type, file_path: filePath, reason });
	if (filePath) summary.conflict_paths.add(filePath);
}

function isLocalChangeNewer(doc) {
	const lastSyncedAt = doc.git_source?.last_synced_at ? new Date(doc.git_source.last_synced_at).getTime() : 0;
	const updatedAt = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
	return updatedAt > lastSyncedAt + LOCAL_CHANGE_GRACE_MS;
}

function cleanRepoPath(value, fallback) {
	const cleaned = (value || fallback).replace(/^\/|\/$/g, '');
	return cleaned || fallback;
}

function cleanSyncBase(value) {
	return (value || '/').replace(/^\/|\/$/g, '');
}

function safeFileName(value) {
	return (value || 'Untitled').replace(/[<>:"/\\|?*]/g, '_').slice(0, 100);
}

function slugTag(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function compactRun(run) {
	return {
		status: run.status,
		started_at: run.started_at,
		finished_at: run.finished_at,
		duration_ms: run.duration_ms,
		imported_files: run.imported_files,
		exported_files: run.exported_files,
		trashed_items: run.trashed_items,
		imported_commits: run.imported_commits,
		conflicts: run.conflicts,
		skipped: run.skipped,
		message: run.message,
	};
}

function syncLogDetails(summary) {
	if (!summary) return {};
	return {
		imported_files: summary.imported_files || 0,
		exported_files: summary.exported_files || 0,
		trashed_items: summary.trashed_items || 0,
		imported_commits: summary.imported_commits || 0,
		conflicts: summary.conflicts || 0,
		skipped: summary.skipped || 0,
		duration_ms: summary.duration_ms || 0,
	};
}

async function logSyncEvent(gitRepo, level, message, details = {}) {
	if (mongoose.connection.readyState !== 1) return;
	try {
		await GitSyncLog.create({
			repo: gitRepo._id,
			project: gitRepo.project,
			host_id: gitRepo.host_id,
			level,
			message,
			details,
		});
		await GitSyncLog.deleteMany({
			host_id: gitRepo.host_id,
			repo: gitRepo._id,
			createdAt: { $lt: new Date(Date.now() - SYNC_LOG_RETENTION_MS) },
		});
	} catch (err) {
		log.warn({ err, repo_id: gitRepo._id }, 'Git sync log cleanup failed');
	}
}

function syncSummaryForStorage(summary) {
	return {
		imported_files: summary.imported_files,
		exported_files: summary.exported_files,
		trashed_items: summary.trashed_items,
		imported_commits: summary.imported_commits,
		conflicts: summary.conflicts,
		skipped: summary.skipped,
		started_at: summary.started_at,
		finished_at: summary.finished_at,
		duration_ms: summary.duration_ms,
		message: summary.message,
	};
}

function validDateOrNull(value) {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function timestampsDiffer(left, right) {
	const leftDate = validDateOrNull(left);
	const rightDate = validDateOrNull(right);
	if (!leftDate || !rightDate) return true;
	return Math.abs(leftDate.getTime() - rightDate.getTime()) > 1000;
}

function gitRelativePath(syncBase, relPath) {
	const normalizedBase = cleanSyncBase(syncBase);
	return normalizedBase ? path.posix.join(normalizedBase, relPath) : relPath;
}

async function getFileGitDates(git, syncBase, relPath) {
	const output = await git.raw([
		'log',
		'--follow',
		'--format=%cI%x1f%s',
		'--',
		gitRelativePath(syncBase, relPath),
	]);
	const entries = output
		.split('\n')
		.map((line) => {
			const [rawDate, ...subjectParts] = line.trim().split('\x1f');
			return {
				date: validDateOrNull(rawDate),
				subject: subjectParts.join(' '),
			};
		})
		.filter((entry) => entry.date);
	const userEntries = entries.filter((entry) => !entry.subject.startsWith('Kumbukum sync '));
	const dates = (userEntries.length ? userEntries : entries).map((entry) => entry.date);
	const fallback = new Date();
	return {
		createdAt: dates.at(-1) || fallback,
		updatedAt: dates[0] || fallback,
	};
}

async function normalizeImportedTimestamps(Model, doc, dates, { includeCreatedAt = false } = {}) {
	const createdAt = validDateOrNull(dates?.createdAt);
	const updatedAt = validDateOrNull(dates?.updatedAt);
	const $set = {};
	if (updatedAt && timestampsDiffer(doc.updatedAt, updatedAt)) $set.updatedAt = updatedAt;
	if (includeCreatedAt && createdAt && timestampsDiffer(doc.createdAt, createdAt)) $set.createdAt = createdAt;
	if (Object.keys($set).length === 0) return;

	await Model.findByIdAndUpdate(doc._id, { $set }, { timestamps: false, overwriteImmutable: includeCreatedAt });
}

function commitDates(commitDate) {
	return { createdAt: commitDate, updatedAt: commitDate };
}

function sameStringList(left = [], right = []) {
	if (left.length !== right.length) return false;
	return left.every((value, index) => value === right[index]);
}

function importedContentMatchesGit(doc, type, parsed, title) {
	if (!doc) return false;
	if (doc.title !== title) return false;
	const expectedTags = parsed.tags?.length ? parsed.tags : ['git-sync'];
	if (!sameStringList(doc.tags || [], expectedTags)) return false;
	if (type === 'memory') return (doc.content || '') === (parsed.body || '');

	const html = marked.parse(parsed.body);
	return (doc.content || '') === html;
}

async function acquireLock(repoId, ttlSeconds = 600) {
	const redis = getRedisClient();
	const key = `git-sync:${repoId}`;
	const ok = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
	return !!ok;
}

async function releaseLock(repoId) {
	const redis = getRedisClient();
	await redis.del(`git-sync:${repoId}`);
}

// ── CRUD ──

// Existing repos predate sync_mode and relied on bidirectional push. Without this, the
// schema default (read_only) would silently disable their export on the next sync, so
// backfill them to read_write to preserve behavior. New repos default to read_only.
export async function backfillGitSyncMode() {
	const result = await GitRepo.updateMany(
		{ sync_mode: { $exists: false } },
		{ $set: { sync_mode: 'read_write' } },
		{ timestamps: false },
	);
	if (result?.modifiedCount > 0) log.info({ updates: result.modifiedCount }, 'Git repo sync_mode backfilled');
	return { sync_mode: result?.modifiedCount || 0 };
}

export async function createGitRepo(userId, hostId, data, ctx = {}) {
	const tokenEncrypted = data.auth_token ? encrypt(data.auth_token) : '';
	const repo = await GitRepo.create({
		project: data.project,
		owner: userId,
		host_id: hostId,
		name: data.name || '',
		repo_url: data.repo_url,
		branch: data.branch || 'main',
		auth_token: tokenEncrypted,
		sync_interval: data.sync_interval || 10,
		enabled: data.enabled !== false,
		sync_mode: data.sync_mode === 'read_write' ? 'read_write' : 'read_only',
		notes_path: data.notes_path || 'notes',
		memories_path: data.memories_path || 'memories',
		sync_path: data.sync_path || '/',
		trash_on_delete: data.trash_on_delete !== false,
		commit_sync_enabled: data.commit_sync_enabled !== false,
		commit_history_days: data.commit_history_days || 90,
	});
	audit.log({ action: 'create', resource: 'git_repo', resource_id: repo._id.toString(), user_id: userId, host_id: hostId, ...ctx });
	return repo;
}

export async function listGitRepos(hostId, projectId) {
	const query = { host_id: hostId };
	if (projectId) query.project = projectId;
	const repos = await GitRepo.find(query).sort({ createdAt: -1 }).lean();
	return repos.map((r) => ({ ...r, auth_token: r.auth_token ? '••••••••' : '' }));
}

export async function getGitRepo(hostId, repoId) {
	const repo = await GitRepo.findOne({ _id: repoId, host_id: hostId }).lean();
	if (repo) repo.auth_token = repo.auth_token ? '••••••••' : '';
	return repo;
}

export async function listSyncLogs(hostId, repoId, limit = 200) {
	const repo = await GitRepo.findOne({ _id: repoId, host_id: hostId }).select('_id').lean();
	if (!repo) return null;

	const since = new Date(Date.now() - SYNC_LOG_RETENTION_MS);
	return GitSyncLog.find({
		host_id: hostId,
		repo: repoId,
		createdAt: { $gte: since },
	})
		.sort({ createdAt: -1 })
		.limit(Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500))
		.lean();
}

export async function updateGitRepo(hostId, repoId, data, ctx = {}) {
	const update = {};
	if (data.name !== undefined) update.name = data.name;
	if (data.repo_url !== undefined) update.repo_url = data.repo_url;
	if (data.branch !== undefined) update.branch = data.branch;
	if (data.auth_token !== undefined) update.auth_token = data.auth_token ? encrypt(data.auth_token) : '';
	if (data.sync_interval !== undefined) update.sync_interval = data.sync_interval;
	if (data.enabled !== undefined) update.enabled = data.enabled;
	if (data.sync_mode !== undefined) update.sync_mode = data.sync_mode;
	if (data.notes_path !== undefined) update.notes_path = data.notes_path;
	if (data.memories_path !== undefined) update.memories_path = data.memories_path;
	if (data.sync_path !== undefined) update.sync_path = data.sync_path;
	if (data.trash_on_delete !== undefined) update.trash_on_delete = data.trash_on_delete;
	if (data.commit_sync_enabled !== undefined) update.commit_sync_enabled = data.commit_sync_enabled;
	if (data.commit_history_days !== undefined) update.commit_history_days = data.commit_history_days;

	const repo = await hydratedQuery(GitRepo.findOneAndUpdate(
		{ _id: repoId, host_id: hostId },
		{ $set: update },
		{ returnDocument: 'after' },
	));
	if (repo) {
		audit.log({ action: 'update', resource: 'git_repo', resource_id: repoId, host_id: hostId, ...ctx });
	}
	return repo ? { ...repo.toObject(), auth_token: repo.auth_token ? '••••••••' : '' } : null;
}

export async function deleteGitRepo(hostId, repoId, ctx = {}) {
	const repo = await GitRepo.findOneAndDelete({ _id: repoId, host_id: hostId });
	if (repo) {
		// Cleanup working directory
		const dir = repoDir(hostId, repoId);
		fs.rm(dir, { recursive: true, force: true }, () => {});
		if (mongoose.connection.readyState === 1) await GitSyncLog.deleteMany({ host_id: hostId, repo: repo._id });
		audit.log({ action: 'delete', resource: 'git_repo', resource_id: repoId, host_id: hostId, ...ctx });
	}
	return repo;
}

// ── Sync ──

async function prepareSyncRepo(repoId, userId, hostId, ctx = { channel: 'api' }) {
	const gitRepoDoc = await hydratedQuery(GitRepo.findOne({ _id: repoId, host_id: hostId }));
	if (!gitRepoDoc) throw new Error('Git repo not found');
	if (!gitRepoDoc.enabled) throw new Error('Git sync is disabled for this repo');

	const locked = ctx.skip_lock ? true : await acquireLock(repoId);
	if (!locked) throw new Error('Sync already in progress');

	try {
		const summary = createSyncSummary();
		gitRepoDoc.last_sync_status = 'in_progress';
		gitRepoDoc.last_sync_error = '';
		gitRepoDoc.last_sync_summary = syncSummaryForStorage(summary);
		await gitRepoDoc.save();
		await logSyncEvent(gitRepoDoc, 'info', 'Sync started', { channel: ctx.channel || 'api', user_id: userId });

		return { gitRepoDoc, summary };
	} catch (err) {
		if (!ctx.skip_lock) await releaseLock(repoId);
		throw err;
	}
}

export async function startSyncRepo(repoId, userId, hostId, ctx = { channel: 'api' }) {
	const prepared = await prepareSyncRepo(repoId, userId, hostId, ctx);

	setImmediate(async () => {
		try {
			await executeSyncRepo(repoId, userId, hostId, ctx, prepared.gitRepoDoc, prepared.summary);
		} catch (err) {
			log.error({ err, repo_id: repoId }, 'Git sync failed');
		} finally {
			if (!ctx.skip_lock) await releaseLock(repoId);
		}
	});

	return syncSummaryForStorage(prepared.summary);
}

export async function syncRepo(repoId, userId, hostId, ctx = { channel: 'api' }) {
	const prepared = await prepareSyncRepo(repoId, userId, hostId, ctx);
	try {
		return await executeSyncRepo(repoId, userId, hostId, ctx, prepared.gitRepoDoc, prepared.summary);
	} finally {
		if (!ctx.skip_lock) await releaseLock(repoId);
	}
}

async function executeSyncRepo(repoId, userId, hostId, ctx, gitRepoDoc, summary) {
	try {
		const token = gitRepoDoc.auth_token ? decrypt(gitRepoDoc.auth_token) : '';
		const dir = repoDir(hostId, repoId);
		const branch = gitRepoDoc.branch || 'main';

		const git = simpleGit();
		if (!fs.existsSync(path.join(dir, '.git'))) {
			await logSyncEvent(gitRepoDoc, 'info', 'Cloning repository', { branch });
			fs.mkdirSync(dir, { recursive: true });
			await git.clone(repoAuthUrl(gitRepoDoc, token), dir, ['--branch', branch]);
			const localGit = simpleGit(dir);
			await localGit.remote(['set-url', 'origin', stripAuthFromRemote(gitRepoDoc)]);
		} else {
			await logSyncEvent(gitRepoDoc, 'info', 'Fetching repository updates', { branch });
			const localGit = simpleGit(dir);
			await localGit.remote(['set-url', 'origin', stripAuthFromRemote(gitRepoDoc)]);
			await localGit.fetch(repoAuthUrl(gitRepoDoc, token), branch);
			await localGit.reset(['--hard', 'FETCH_HEAD']);
		}

		const localGit = simpleGit(dir);
		await localGit.checkout(branch).catch(() => {});

		const syncBase = cleanSyncBase(gitRepoDoc.sync_path);

		await logSyncEvent(gitRepoDoc, 'info', 'Importing markdown files', { sync_path: syncBase || '/' });
		const beforePull = syncLogDetails(summary);
		await pullFromGit(localGit, dir, syncBase, gitRepoDoc, userId, hostId, ctx, summary);
		await logSyncEvent(gitRepoDoc, 'info', 'Markdown import complete', {
			imported_files: summary.imported_files - beforePull.imported_files,
			trashed_items: summary.trashed_items - beforePull.trashed_items,
			conflicts: summary.conflicts - beforePull.conflicts,
			skipped: summary.skipped - beforePull.skipped,
		});

		if (gitRepoDoc.commit_sync_enabled !== false) {
			await logSyncEvent(gitRepoDoc, 'info', 'Importing git commits');
			const beforeCommits = syncLogDetails(summary);
			await importCommits(localGit, gitRepoDoc, userId, hostId, summary);
			await logSyncEvent(gitRepoDoc, 'info', 'Commit import complete', {
				imported_commits: summary.imported_commits - beforeCommits.imported_commits,
				skipped: summary.skipped - beforeCommits.skipped,
			});
		}

		if (gitRepoDoc.sync_mode === 'read_write') {
			await logSyncEvent(gitRepoDoc, 'info', 'Exporting local changes to Git');
			const beforePush = syncLogDetails(summary);
			await pushToGit(localGit, dir, syncBase, gitRepoDoc, userId, hostId, token, summary);
			await logSyncEvent(gitRepoDoc, 'info', 'Git export complete', {
				exported_files: summary.exported_files - beforePush.exported_files,
				skipped: summary.skipped - beforePush.skipped,
			});
		} else {
			await logSyncEvent(gitRepoDoc, 'info', 'Read-only repo: skipping export to Git');
		}

		gitRepoDoc.last_sync_status = 'success';
		gitRepoDoc.last_synced_at = new Date();
		gitRepoDoc.last_sync_error = '';
		const run = finalizeSummary(summary, 'success', summary.conflicts ? 'Sync complete with conflicts' : 'Sync complete');
		gitRepoDoc.last_sync_summary = syncSummaryForStorage(summary);
		gitRepoDoc.sync_runs = [compactRun(run), ...(gitRepoDoc.sync_runs || [])].slice(0, MAX_SYNC_RUNS);
		await gitRepoDoc.save();
		await logSyncEvent(gitRepoDoc, summary.conflicts ? 'warning' : 'success', run.message, syncLogDetails(summary));

		emitToTenant(hostId, 'counts:refresh');
		if (!ctx.skip_audit) audit.log({ action: 'import', resource: 'git_repo', resource_id: repoId, user_id: userId, host_id: hostId, ...ctx });
		return { ...syncSummaryForStorage(summary), conflict_details: summary.conflict_details };
	} catch (err) {
		finalizeSummary(summary, 'failed', err.message);
		gitRepoDoc.last_sync_status = 'failed';
		gitRepoDoc.last_sync_error = err.message;
		gitRepoDoc.last_sync_summary = syncSummaryForStorage(summary);
		gitRepoDoc.sync_runs = [compactRun({ ...summary, status: 'failed' }), ...(gitRepoDoc.sync_runs || [])].slice(0, MAX_SYNC_RUNS);
		await gitRepoDoc.save();
		await logSyncEvent(gitRepoDoc, 'error', `Sync failed: ${err.message}`, syncLogDetails(summary));
		throw err;
	}
}

async function pullFromGit(git, dir, syncBase, gitRepo, userId, hostId, ctx, summary) {
	const mdFiles = findMarkdownFiles(dir, syncBase);
	const activeFilePaths = new Set(mdFiles);

	for (const relPath of mdFiles) {
		const absPath = path.join(dir, syncBase, relPath);
		const raw = fs.readFileSync(absPath, 'utf8');
		const sha = fileSha(raw);
		const parsed = parseMarkdownFile(raw);

		const type = parsed.type || resolveType(relPath, gitRepo);

		const title = parsed.title || path.basename(relPath, '.md');

		const existingNote = await Note.findOne({ 'git_source.repo_id': gitRepo._id, 'git_source.file_path': relPath, host_id: hostId });
		const existingMemory = await Memory.findOne({ 'git_source.repo_id': gitRepo._id, 'git_source.file_path': relPath, host_id: hostId });
		const existing = existingNote || existingMemory;
		const fileDates = await getFileGitDates(git, syncBase, relPath);

		if (existing && existing.git_source?.last_sha === sha) {
			if (!isLocalChangeNewer(existing) || importedContentMatchesGit(existing, existingNote ? 'note' : 'memory', parsed, title)) {
				await normalizeImportedTimestamps(existingNote ? Note : Memory, existing, fileDates, { includeCreatedAt: existing.git_source?.origin === 'import' });
			}
			continue; // No change
		}

		if (existing) {
			if (isLocalChangeNewer(existing)) {
				recordConflict(summary, existingNote ? 'note' : 'memory', relPath, 'Both Git and Kumbukum changed since the last sync');
				continue;
			}
		}

		const now = new Date();

		if (type === 'memory') {
			if (existingMemory) {
				const update = {
					title,
					content: parsed.body,
					tags: parsed.tags,
					'git_source.last_sha': sha,
					'git_source.last_synced_at': now,
					'git_source.origin': 'import',
					updatedAt: fileDates.updatedAt,
					is_indexed: false,
				};
				const overwriteImmutable = existingMemory.git_source?.origin === 'import';
				if (overwriteImmutable) update.createdAt = fileDates.createdAt;
				await Memory.findByIdAndUpdate(existingMemory._id, {
					$set: update,
				}, { timestamps: false, overwriteImmutable });
				summary.imported_files++;
			} else {
				await Memory.create({
					title,
					content: parsed.body,
					tags: parsed.tags.length ? parsed.tags : ['git-sync'],
					project: gitRepo.project,
					owner: userId,
					host_id: hostId,
					git_source: { repo_id: gitRepo._id, file_path: relPath, last_sha: sha, last_synced_at: now, origin: 'import' },
					createdAt: fileDates.createdAt,
					updatedAt: fileDates.updatedAt,
				});
				summary.imported_files++;
			}
		} else {
			const html = marked.parse(parsed.body);
			const text = striptags(html);
			if (existingNote) {
				const update = {
					title,
					content: html,
					text_content: text,
					tags: parsed.tags,
					'git_source.last_sha': sha,
					'git_source.last_synced_at': now,
					'git_source.origin': 'import',
					updatedAt: fileDates.updatedAt,
					is_indexed: false,
				};
				const overwriteImmutable = existingNote.git_source?.origin === 'import';
				if (overwriteImmutable) update.createdAt = fileDates.createdAt;
				await Note.findByIdAndUpdate(existingNote._id, {
					$set: update,
				}, { timestamps: false, overwriteImmutable });
				summary.imported_files++;
			} else {
				await Note.create({
					title,
					content: html,
					text_content: text,
					tags: parsed.tags.length ? parsed.tags : ['git-sync'],
					project: gitRepo.project,
					owner: userId,
					host_id: hostId,
					git_source: { repo_id: gitRepo._id, file_path: relPath, last_sha: sha, last_synced_at: now, origin: 'import' },
					createdAt: fileDates.createdAt,
					updatedAt: fileDates.updatedAt,
				});
				summary.imported_files++;
			}
		}
	}

	await trashDeletedGitItems(gitRepo, hostId, activeFilePaths, summary);
}

async function trashDeletedGitItems(gitRepo, hostId, activeFilePaths, summary) {
	const query = {
		host_id: hostId,
		'git_source.repo_id': gitRepo._id,
		in_trash: { $ne: true },
	};
	const [notes, memories] = await Promise.all([
		Note.find(query),
		Memory.find({ ...query, 'git_commit.repo_id': { $exists: false } }),
	]);

	for (const note of notes) {
		const filePath = note.git_source?.file_path;
		if (!filePath || activeFilePaths.has(filePath)) continue;
		if (isLocalChangeNewer(note)) {
			recordConflict(summary, 'note', filePath, 'Git deleted the file but Kumbukum has newer local edits');
			continue;
		}
		if (!gitRepo.trash_on_delete) {
			summary.skipped++;
			continue;
		}
		await Note.findByIdAndUpdate(note._id, {
			$set: { in_trash: true, trashed_at: new Date(), is_indexed: false },
		});
		summary.trashed_items++;
	}

	for (const memory of memories) {
		const filePath = memory.git_source?.file_path;
		if (!filePath || activeFilePaths.has(filePath)) continue;
		if (isLocalChangeNewer(memory)) {
			recordConflict(summary, 'memory', filePath, 'Git deleted the file but Kumbukum has newer local edits');
			continue;
		}
		if (!gitRepo.trash_on_delete) {
			summary.skipped++;
			continue;
		}
		await Memory.findByIdAndUpdate(memory._id, {
			$set: { in_trash: true, trashed_at: new Date(), is_indexed: false },
		});
		summary.trashed_items++;
	}
}

// Ensure a brand-new item never clobbers an existing repo file: if the target path is
// already taken (by a pre-existing repo file or another item written this run), pick the
// next free `name-N.md`. Import runs before push, so the clone reflects the remote here.
function resolveNonCollidingPath(dir, syncBase, relPath) {
	if (!fs.existsSync(path.join(dir, syncBase, relPath))) return relPath;
	const dirName = path.dirname(relPath);
	const ext = path.extname(relPath);
	const base = path.basename(relPath, ext);
	const join = (name) => path.join(dirName, name).split(path.sep).join('/');
	for (let i = 2; i < 1000; i++) {
		const candidate = join(`${base}-${i}${ext}`);
		if (!fs.existsSync(path.join(dir, syncBase, candidate))) return candidate;
	}
	return join(`${base}-${crypto.randomBytes(4).toString('hex')}${ext}`);
}

async function pushToGit(git, dir, syncBase, gitRepo, userId, hostId, token, summary) {
	const notesDir = cleanRepoPath(gitRepo.notes_path, 'notes');
	const memoriesDir = cleanRepoPath(gitRepo.memories_path, 'memories');
	let hasChanges = false;
	const pendingUpdates = [];
	const enabledRepoCount = await GitRepo.countDocuments({ host_id: hostId, project: gitRepo.project, enabled: true });
	const allowLocalOnlyPush = enabledRepoCount <= 1;

	const notesToPush = await findPushCandidates(Note, gitRepo, hostId, allowLocalOnlyPush);
	const skippedLocalNotes = allowLocalOnlyPush ? 0 : await countLocalOnlyItems(Note, gitRepo, hostId);
	summary.skipped += skippedLocalNotes;

	for (const note of notesToPush) {
		const repoLinked = !!note.git_source?.repo_id;
		if (repoLinked && !isLocalChangeNewer(note)) {
			summary.skipped++;
			continue;
		}
		const md = noteToMarkdown(note);
		const sha = fileSha(md);

		let relPath = note.git_source?.file_path;
		const isNewPath = !relPath;
		if (!relPath) {
			relPath = `${notesDir}/${safeFileName(note.title)}.md`;
		}
		if (summary.conflict_paths.has(relPath)) {
			summary.skipped++;
			continue;
		}

		let absPath = path.join(dir, syncBase, relPath);

		if (note.git_source?.last_sha === sha && fs.existsSync(absPath)) {
			summary.skipped++;
			continue;
		}

		if (isNewPath) {
			relPath = resolveNonCollidingPath(dir, syncBase, relPath);
			absPath = path.join(dir, syncBase, relPath);
		}

		fs.mkdirSync(path.dirname(absPath), { recursive: true });
		fs.writeFileSync(absPath, md, 'utf8');

		pendingUpdates.push({ model: 'Note', id: note._id, relPath, sha });
		hasChanges = true;
	}

	const memoriesToPush = await findPushCandidates(Memory, gitRepo, hostId, allowLocalOnlyPush, {
		'git_commit.repo_id': { $exists: false },
	});
	const skippedLocalMemories = allowLocalOnlyPush ? 0 : await countLocalOnlyItems(Memory, gitRepo, hostId, {
		'git_commit.repo_id': { $exists: false },
	});
	summary.skipped += skippedLocalMemories;

	for (const mem of memoriesToPush) {
		const repoLinked = !!mem.git_source?.repo_id;
		if (repoLinked && !isLocalChangeNewer(mem)) {
			summary.skipped++;
			continue;
		}
		const md = memoryToMarkdown(mem);
		const sha = fileSha(md);

		let relPath = mem.git_source?.file_path;
		const isNewPath = !relPath;
		if (!relPath) {
			relPath = `${memoriesDir}/${safeFileName(mem.title)}.md`;
		}
		if (summary.conflict_paths.has(relPath)) {
			summary.skipped++;
			continue;
		}

		let absPath = path.join(dir, syncBase, relPath);

		if (mem.git_source?.last_sha === sha && fs.existsSync(absPath)) {
			summary.skipped++;
			continue;
		}

		if (isNewPath) {
			relPath = resolveNonCollidingPath(dir, syncBase, relPath);
			absPath = path.join(dir, syncBase, relPath);
		}

		fs.mkdirSync(path.dirname(absPath), { recursive: true });
		fs.writeFileSync(absPath, md, 'utf8');

		pendingUpdates.push({ model: 'Memory', id: mem._id, relPath, sha });
		hasChanges = true;
	}

	if (hasChanges) {
		const localGit = simpleGit(dir);
		await localGit.addConfig('user.email', 'sync@kumbukum.com');
		await localGit.addConfig('user.name', 'Kumbukum Sync');
		await localGit.add('.');
		const status = await localGit.status();
		if (status.files.length > 0) {
			await localGit.commit(`Kumbukum sync ${new Date().toISOString()}`);
			await localGit.push(repoAuthUrl(gitRepo, token), gitRepo.branch || 'main');
		}

		const now = new Date();
		for (const upd of pendingUpdates) {
			const Model = upd.model === 'Note' ? Note : Memory;
			await Model.findByIdAndUpdate(upd.id, {
				$set: {
					'git_source.repo_id': gitRepo._id,
					'git_source.file_path': upd.relPath,
					'git_source.last_sha': upd.sha,
					'git_source.last_synced_at': now,
					'git_source.origin': 'push',
				},
			});
			summary.exported_files++;
		}
	}
}

async function findPushCandidates(Model, gitRepo, hostId, allowLocalOnlyPush, extraQuery = {}) {
	const localOnlyFilter = {
		$or: [
			{ 'git_source.repo_id': { $exists: false } },
			{ 'git_source.repo_id': null },
		],
	};
	const repoLinkedFilter = { 'git_source.repo_id': gitRepo._id };
	const linkFilters = allowLocalOnlyPush ? [repoLinkedFilter, localOnlyFilter] : [repoLinkedFilter];
	return Model.find({
		host_id: hostId,
		project: gitRepo.project,
		in_trash: { $ne: true },
		...extraQuery,
		$or: linkFilters,
	});
}

async function countLocalOnlyItems(Model, gitRepo, hostId, extraQuery = {}) {
	return Model.countDocuments({
		host_id: hostId,
		project: gitRepo.project,
		in_trash: { $ne: true },
		...extraQuery,
		$or: [
			{ 'git_source.repo_id': { $exists: false } },
			{ 'git_source.repo_id': null },
		],
	});
}

async function importCommits(git, gitRepo, userId, hostId, summary) {
	const since = gitRepo.last_commit_synced_at
		? new Date(gitRepo.last_commit_synced_at)
		: new Date(Date.now() - (gitRepo.commit_history_days || 90) * 24 * 60 * 60 * 1000);
	const raw = await git.raw([
		'log',
		`--since=${since.toISOString()}`,
		'--reverse',
		'--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s',
	]);
	const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
	let latestCommit = null;

	for (const line of lines) {
		const parts = line.split('\x1f');
		if (parts.length < 9) {
			summary.skipped++;
			continue;
		}

		const commit = {
			sha: parts[0],
			short_sha: parts[1],
			author_name: parts[2],
			author_email: parts[3],
			authored_at: new Date(parts[4]),
			committer_name: parts[5],
			committer_email: parts[6],
			committed_at: new Date(parts[7]),
			subject: parts.slice(8).join(' '),
		};

		const existing = await Memory.findOne({
			host_id: hostId,
			'git_commit.repo_id': gitRepo._id,
			'git_commit.sha': commit.sha,
			in_trash: { $ne: true },
		});
		if (existing) {
			await normalizeImportedTimestamps(Memory, existing, commitDates(commit.committed_at), { includeCreatedAt: true });
			latestCommit = commit;
			summary.skipped++;
			continue;
		}

		const [message, files] = await Promise.all([
			git.raw(['show', '-s', '--format=%B', commit.sha]),
			git.raw(['show', '--name-status', '--format=', '--no-renames', commit.sha]),
		]);
		const changedFiles = parseNameStatus(files);
		const repoTag = slugTag(gitRepo.name || gitRepo.repo_url);
		const branchTag = slugTag(gitRepo.branch || 'main');
		const tags = ['git-sync', 'git-commit'];
		if (repoTag) tags.push(`git-repo-${repoTag}`);
		if (branchTag) tags.push(`git-branch-${branchTag}`);

		await Memory.create({
			title: `Commit ${commit.short_sha}: ${commit.subject || '(no subject)'}`,
			content: commitMemoryContent(commit, message, changedFiles, gitRepo),
			tags,
			source: 'git-sync',
			project: gitRepo.project,
			owner: userId,
			host_id: hostId,
			createdAt: commit.committed_at,
			updatedAt: commit.committed_at,
			git_commit: {
				repo_id: gitRepo._id,
				sha: commit.sha,
				short_sha: commit.short_sha,
				branch: gitRepo.branch || 'main',
				author_name: commit.author_name,
				author_email: commit.author_email,
				authored_at: commit.authored_at,
				committer_name: commit.committer_name,
				committer_email: commit.committer_email,
				committed_at: commit.committed_at,
				files: changedFiles,
			},
		});
		latestCommit = commit;
		summary.imported_commits++;
	}

	if (latestCommit) {
		gitRepo.last_commit_synced_at = latestCommit.committed_at;
		gitRepo.last_commit_sha = latestCommit.sha;
	}
}

function parseNameStatus(value) {
	return value
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [status, ...pathParts] = line.split(/\s+/);
			return { status, path: pathParts.join(' ') };
		})
		.filter((file) => file.status && file.path);
}

function commitMemoryContent(commit, message, files, gitRepo) {
	const changedFiles = files.length
		? files.map((file) => `- ${file.status}\t${file.path}`).join('\n')
		: '- No changed files reported';
	return [
		`Repository: ${gitRepo.name || gitRepo.repo_url}`,
		`Branch: ${gitRepo.branch || 'main'}`,
		`Commit: ${commit.sha}`,
		`Author: ${commit.author_name} <${commit.author_email}>`,
		`Authored: ${commit.authored_at.toISOString()}`,
		`Committer: ${commit.committer_name} <${commit.committer_email}>`,
		`Committed: ${commit.committed_at.toISOString()}`,
		'',
		'Message:',
		(message || '').trim() || commit.subject || '(no message)',
		'',
		'Changed files:',
		changedFiles,
	].join('\n');
}

function findMarkdownFiles(baseDir, syncBase) {
	const results = [];
	const root = path.join(baseDir, syncBase);
	if (!fs.existsSync(root)) return results;

	function walk(dir, prefix) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith('.')) continue;
			const fullPath = path.join(dir, entry.name);
			const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				walk(fullPath, relPath);
			} else if (entry.name.endsWith('.md')) {
				results.push(relPath);
			}
		}
	}

	walk(root, '');
	return results;
}

// ── Scheduled sync runner ──

export async function runScheduledSync() {
	const now = new Date();
	const repos = await GitRepo.find({ enabled: true }).lean();
	const summary = {
		checked: repos.length,
		due: 0,
		synced: 0,
		failed: 0,
	};

	for (const repo of repos) {
		const intervalMs = (repo.sync_interval || 10) * 60 * 1000;
		const lastSync = repo.last_synced_at ? new Date(repo.last_synced_at).getTime() : 0;
		if (now.getTime() - lastSync < intervalMs) continue;
		if (repo.last_sync_status === 'in_progress') continue;
		summary.due++;

		try {
			await syncRepo(repo._id.toString(), repo.owner.toString(), repo.host_id);
			summary.synced++;
		} catch (err) {
			summary.failed++;
			log.error({ err, repo_id: repo._id }, 'Git sync failed');
		}
	}

	return summary;
}
