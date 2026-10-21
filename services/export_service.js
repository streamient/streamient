import { acquireTenantWork } from '../modules/tenancy.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { ZipArchive } from 'archiver';
import { Export } from '../model/export.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { GraphLink } from '../model/graph_link.js';
import { User } from '../model/user.js';
import { MongoQueue, MongoWorker } from '../modules/mongo_queue.js';
import { EXPORT_ADMISSION_OPTIONS } from './export_ttl_migration_service.js';
import { sendExportReadyEmail } from './email_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('export');
export const EXPORT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'export');
export const EXPORT_QUEUE = 'account-export';
const EXPIRY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['pending', 'processing'];

async function enqueueExport(doc) {
	return MongoQueue.add(EXPORT_QUEUE, { export_id: String(doc._id), host_id: doc.host_id }, { jobId: String(doc._id), dedupKey: String(doc._id), maxAttempts: 3 });
}

export async function startExport(userId, hostId, userEmail, userName) {
	const release = await acquireTenantWork(hostId);
	try {
		await Export.collection.createIndex({ host_id: 1 }, EXPORT_ADMISSION_OPTIONS);
		let doc;
		try { doc = await Export.create({ token: crypto.randomBytes(32).toString('hex'), owner: userId, host_id: hostId, user_email: userEmail, user_name: userName }); }
		catch (err) { if (err.code === 11000) throw new Error('An export is already in progress'); throw err; }
		// A crash between admission and enqueue is recovered by the scheduler.
		await enqueueExport(doc);
		return doc;
	} finally { await release(); }
}

export async function recoverExports() {
	for await (const doc of Export.find({ $or: [{ status: { $in: ACTIVE_STATUSES } }, { status: 'ready', email_sent_at: null }] }).read('primary').lean().cursor()) {
		try {
			await enqueueExport(doc);
			const existing = await MongoQueue.getJob(String(doc._id));
			if (ACTIVE_STATUSES.includes(doc.status) && (existing?.status === 'failed' || existing?.status === 'completed')) await Export.updateOne({ _id: doc._id, status: { $in: ACTIVE_STATUSES } }, { $set: { status: 'failed', error: 'Export interrupted; please retry' } });
		} catch (err) { if (err.code !== 'account_unavailable') throw err; }
	}
}

async function* jsonRecords(model, filter, signal) {
	let separator = '';
	const cursor = model.find(filter).read('primary').lean().cursor();
	try {
		yield '[';
		for await (const row of cursor) { signal?.throwIfAborted(); yield `${separator}${JSON.stringify(row)}`; separator = ','; }
		yield ']';
	} finally { await cursor.close(); }
}

export async function writeExportArchive(filePath, hostId, signal) {
	await fs.promises.mkdir(EXPORT_DIR, { recursive: true });
	const output = fs.createWriteStream(filePath, { flags: 'wx' });
	const archive = new ZipArchive({ zlib: { level: 9 } });
	const sources = [];
	const abort = () => { archive.abort(); for (const source of sources) source.destroy(signal?.reason || new Error('Export aborted')); output.destroy(signal?.reason || new Error('Export aborted')); };
	signal?.addEventListener('abort', abort, { once: true });
	archive.on('error', (err) => output.destroy(err));
	output.on('error', () => { archive.abort(); for (const source of sources) source.destroy(); });
	archive.pipe(output);
	const done = finished(output);
	try {
		signal?.throwIfAborted();
		for (const [model, name, filter] of [[Note, 'notes', { in_trash: false }], [Memory, 'memories', { in_trash: false }], [Url, 'urls', { in_trash: false }], [Email, 'emails', { in_trash: false }], [GraphLink, 'links', {}]]) {
			const source = Readable.from(jsonRecords(model, { host_id: hostId, ...filter }, signal));
			source.on('error', (err) => output.destroy(err));
			sources.push(source);
			archive.append(source, { name: `${name}.json` });
		}
		await Promise.all([archive.finalize(), done]);
		signal?.throwIfAborted();
	} catch (err) { abort(); await done.catch(() => {}); throw err; }
	finally { signal?.removeEventListener('abort', abort); }
}

export async function processExport(exportId, hostId, { signal, assertOwnership, isOwner, withOwnership = (callback) => callback(undefined), attempts = 1, maxAttempts = 3 } = {}) {
	signal?.throwIfAborted();
	const doc = await Export.findOne({ _id: exportId, host_id: hostId }).read('primary').lean();
	if (!doc || (!ACTIVE_STATUSES.includes(doc.status) && doc.status !== 'ready')) return;
	const filePath = doc.file_path || path.join(EXPORT_DIR, `export-${hostId}-${doc.token}.${crypto.randomUUID()}.zip`);
	const temporaryPath = `${filePath}.part`;
	let published = doc.status === 'ready';
	let created = false;
	try {
		if (doc.status !== 'ready') {
			await assertOwnership?.();
			await withOwnership((session) => Export.updateOne({ _id: doc._id, status: { $in: ACTIVE_STATUSES } }, { $set: { status: 'processing', error: '' } }, { session }));
			// Each attempt owns an immutable file; only its fenced metadata transaction can publish it.
			if (!await fs.promises.stat(filePath).then(() => true, (err) => { if (err.code === 'ENOENT') return false; throw err; })) {
				await writeExportArchive(temporaryPath, hostId, signal);
				signal?.throwIfAborted();
				await assertOwnership?.();
				await fs.promises.rename(temporaryPath, filePath);
				created = true;
			}
			signal?.throwIfAborted();
			await assertOwnership?.();
			const result = await withOwnership((session) => Export.updateOne({ _id: doc._id, status: { $in: ACTIVE_STATUSES } }, { $set: { file_path: filePath, status: 'ready', expires_at: new Date(Date.now() + EXPIRY_MS), error: '' } }, { session }));
			if (!result.matchedCount) throw new Error('Export publication changed');
			published = true;
		}
		if (!doc.email_sent_at) {
			const user = doc.user_email ? null : await User.findById(doc.owner).select('email name').read('primary').lean();
			signal?.throwIfAborted();
			await assertOwnership?.();
			try { await sendExportReadyEmail(doc.user_email || user?.email, doc.user_name || user?.name, doc.token); await withOwnership((session) => Export.updateOne({ _id: doc._id }, { $set: { email_sent_at: new Date() } }, { session })); }
			catch (err) { log.warn({ err, export_id: doc._id }, 'Export email failed'); }
		}
	} catch (err) {
		if (!isOwner || await isOwner()) await withOwnership((session) => Export.updateOne({ _id: doc._id, status: { $in: ACTIVE_STATUSES } }, { $set: { status: attempts < maxAttempts ? 'pending' : 'failed', error: String(err.message || err).slice(0, 1000) } }, { session }), { allowAborted: true });
		throw err;
	} finally {
		await fs.promises.rm(temporaryPath, { force: true });
		// Preserve files when commit acknowledgement is uncertain; orphan cleanup can retry later.
		if (created && !published && !await Export.exists({ file_path: filePath }).read('primary').catch(() => true)) await fs.promises.rm(filePath, { force: true });
	}
}

export function createExportWorker() {
	return new MongoWorker({ queue: EXPORT_QUEUE, concurrency: 1, handlerTimeoutMs: 60 * 60 * 1000, retryDelayMs: 30000, handler: (job) => processExport(job.data.export_id, job.data.host_id, job) });
}

export async function getExportStatus(hostId) { return Export.findOne({ host_id: hostId }).sort({ createdAt: -1 }).lean(); }

export async function getExportFile(token, hostId) {
	const doc = await Export.findOne({ token, host_id: hostId, status: 'ready' }).read('primary').lean();
	if (!doc || !doc.expires_at || doc.expires_at < new Date() || !fs.existsSync(doc.file_path)) return null;
	return doc.file_path;
}

export async function cleanupExpiredExports() {
	const indexes = await Export.collection.listIndexes().toArray().catch((err) => { if (err.code === 26) return []; throw err; });
	if (indexes.some((index) => index.key?.expires_at === 1 && index.expireAfterSeconds !== undefined)) throw new Error('Run migrate-export-indexes.mjs before export cleanup');
	const now = new Date();
	const expired = await Export.find({ status: 'ready', expires_at: { $lt: now } }).read('primary').lean();
	let cleaned = 0;
	for (const doc of expired) {
		try {
			if (doc.file_path) {
				if (path.dirname(path.resolve(doc.file_path)) !== path.resolve(EXPORT_DIR)) throw new Error('Export path is outside export directory');
				await fs.promises.unlink(doc.file_path).catch((err) => { if (err.code !== 'ENOENT') throw err; });
			}
			await Export.deleteOne({ _id: doc._id, status: 'ready', expires_at: { $lt: now } });
			cleaned++;
		} catch (err) { log.warn({ err, export_id: doc._id }, 'Export cleanup retained metadata for retry'); }
	}
	const entries = await fs.promises.readdir(EXPORT_DIR, { withFileTypes: true }).catch((err) => { if (err.code === 'ENOENT') return []; throw err; });
	for (const entry of entries) {
		if (!entry.isFile() || !/^export-.+-(?:[a-f0-9]{64}(?:\.[a-f0-9-]{36})?|[0-9]{13})\.zip(?:\.[a-f0-9-]{36})?(?:\.part)?$/.test(entry.name)) continue;
		const filePath = path.join(EXPORT_DIR, entry.name);
		const hostId = entry.name.replace(/^export-/, '').replace(/-(?:[a-f0-9]{64}(?:\.[a-f0-9-]{36})?|[0-9]{13})\.zip.*$/, '');
		if (await Export.exists({ $or: [{ file_path: filePath }, { host_id: hostId, status: { $in: ACTIVE_STATUSES } }, { host_id: hostId, expires_at: { $gte: now } }] }).read('primary')) continue;
		try { if ((await fs.promises.stat(filePath)).mtimeMs < now.getTime() - EXPIRY_MS) await fs.promises.unlink(filePath); }
		catch (err) { if (err.code !== 'ENOENT') log.warn({ err, file_path: filePath }, 'Orphan export cleanup failed'); }
	}
	return cleaned;
}
