import { acquireTenantWork } from '../modules/tenancy.js';
import crypto from 'node:crypto';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { link, mkdir, readdir, rm, stat, statfs, unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { NoteImportUpload } from '../model/note_import_upload.js';
import { Project } from '../model/project.js';
import { MongoQueue, MongoWorker } from '../modules/mongo_queue.js';
import { detectFileType } from '../modules/file_detect.js';
import { emitToTenant } from '../modules/socket.js';
import { extractText } from './import_service.js';
import * as noteService from './note_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('note-import');

export const NOTE_IMPORT_CHUNK_SIZE = 20_000_000;
export const NOTE_IMPORT_QUEUE = 'note-import';
export const NOTE_IMPORT_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
export const NOTE_IMPORT_ACTIVE_LIMIT = 4;

const STORAGE_RESERVE_BYTES = 100_000_000n;
const IMPORT_ROOT = path.resolve(process.cwd(), 'assets', 'import', 'mobile');
const ACTIVE_STATES = ['uploading', 'processing'];

export class NoteImportError extends Error {
	constructor(message, status = 400, code = 'invalid_upload') {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function expiryDate() {
	return new Date(Date.now() + NOTE_IMPORT_INACTIVITY_MS);
}

function uploadDir(uploadId) {
	return path.join(IMPORT_ROOT, String(uploadId));
}

function chunkDir(uploadId) {
	return path.join(uploadDir(uploadId), 'chunks');
}

function chunkPath(uploadId, offset) {
	return path.join(chunkDir(uploadId), `${offset}.part`);
}

function sourcePath(upload) {
	const extension = path.extname(upload.original_name || '').slice(0, 16);
	return path.join(uploadDir(upload._id), `source${extension}`);
}

function cleanString(value, maxLength) {
	return String(value || '').trim().slice(0, maxLength);
}

function normalizeTags(tags) {
	if (!Array.isArray(tags)) return [];
	return [...new Set(tags.map((tag) => cleanString(tag, 80)).filter(Boolean))].slice(0, 50);
}

function normalizeChecksum(value) {
	const raw = String(value || '').trim();
	const match = raw.match(/^sha-?256(?:=|\s+)(.+)$/i);
	return (match?.[1] || raw).trim();
}

function checksumMatches(value, hash) {
	const expected = normalizeChecksum(value);
	if (!expected) return false;
	return expected.toLowerCase() === hash.hex.toLowerCase() || expected === hash.base64;
}

function parseSafeLength(value, headerName) {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 0) throw new NoteImportError(`${headerName} must be a non-negative safe integer`, 400, 'invalid_length');
	return parsed;
}

function publicUpload(upload) {
	if (!upload) return null;
	return {
		id: String(upload._id),
		project_id: String(upload.project),
		original_name: upload.original_name,
		title: upload.title,
		mime_type: upload.mime_type || '',
		upload_length: upload.total_bytes,
		upload_offset: upload.received_bytes,
		chunk_size: NOTE_IMPORT_CHUNK_SIZE,
		state: upload.state,
		note_id: upload.note ? String(upload.note) : null,
		error: upload.error || null,
		created_at: upload.createdAt,
		updated_at: upload.updatedAt,
		expires_at: upload.expires_at,
	};
}

function ownershipFilter(id, userId, host_id) {
	return { _id: id, user: userId, host_id };
}

export async function ensureStorageAvailable(targetPath, requestedBytes) {
	await mkdir(targetPath, { recursive: true });
	const storage = await statfs(targetPath, { bigint: true });
	const available = storage.bavail * storage.bsize;
	if (available < BigInt(requestedBytes) + STORAGE_RESERVE_BYTES) throw new NoteImportError('Insufficient storage for this chunk', 507, 'insufficient_storage');
}

async function hashAndStoreRequest(req, temporaryPath, maximumBytes) {
	const hash = crypto.createHash('sha256');
	const output = createWriteStream(temporaryPath, { flags: 'wx' });
	let size = 0;
	try {
		for await (const data of req) {
			const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
			size += chunk.length;
			if (size > maximumBytes) throw new NoteImportError(`Chunks may not exceed ${NOTE_IMPORT_CHUNK_SIZE} bytes`, 413, 'chunk_too_large');
			hash.update(chunk);
			if (!output.write(chunk)) await once(output, 'drain');
		}
		output.end();
		await once(output, 'finish');
	} catch (err) {
		output.destroy();
		await rm(temporaryPath, { force: true }).catch(() => {});
		throw err;
	}
	const digest = hash.digest();
	return { size, hash: { hex: digest.toString('hex'), base64: digest.toString('base64') } };
}

async function storedChunkMatches(uploadId, offset, size, expectedChecksum) {
	const storedPath = chunkPath(uploadId, offset);
	try {
		if ((await stat(storedPath)).size !== size) return false;
		const storedHash = crypto.createHash('sha256');
		for await (const data of createReadStream(storedPath)) storedHash.update(data);
		const digest = storedHash.digest();
		const hash = { hex: digest.toString('hex'), base64: digest.toString('base64') };
		return typeof expectedChecksum === 'object'
			? hash.hex === expectedChecksum.hex || hash.base64 === expectedChecksum.base64
			: checksumMatches(expectedChecksum, hash);
	} catch {
		return false;
	}
}

async function verifyStoredChunk(upload, offset, size, hash) {
	const recorded = upload.chunks?.find((chunk) => chunk.offset === offset);
	if (!recorded || recorded.size !== size || !checksumMatches(recorded.checksum, hash)) return false;
	return storedChunkMatches(upload._id, offset, size, hash);
}

async function verifyCompleteUpload(upload) {
	const chunks = [...upload.chunks].sort((a, b) => a.offset - b.offset);
	let expectedOffset = 0;
	for (const chunk of chunks) {
		if (chunk.offset !== expectedOffset || !await storedChunkMatches(upload._id, chunk.offset, chunk.size, chunk.checksum)) throw new NoteImportError(`Chunk integrity verification failed at offset ${expectedOffset}`, 409, 'chunk_integrity_conflict');
		expectedOffset += chunk.size;
	}
	if (expectedOffset !== upload.total_bytes) throw new NoteImportError(`Upload incomplete at offset ${expectedOffset}`, 409, 'upload_incomplete');
}

export async function createUpload(userId, host_id, data = {}) {
	const projectId = cleanString(data.project_id || data.project, 64);
	const originalName = path.basename(cleanString(data.file_name || data.original_name, 255));
	const totalBytes = parseSafeLength(data.upload_length ?? data.total_bytes, 'upload_length');
	if (!projectId) throw new NoteImportError('project_id is required');
	if (!originalName) throw new NoteImportError('file_name is required');
	const [project, activeCount] = await Promise.all([
		Project.findOne({ _id: projectId, host_id, is_active: true }).select('_id').lean(),
		NoteImportUpload.countDocuments({ user: userId, host_id, state: { $in: ACTIVE_STATES } }),
	]);
	if (!project) throw new NoteImportError('Project not found', 404, 'project_not_found');
	if (activeCount >= NOTE_IMPORT_ACTIVE_LIMIT) throw new NoteImportError(`At most ${NOTE_IMPORT_ACTIVE_LIMIT} imports may be active`, 429, 'active_upload_limit');
	const upload = await NoteImportUpload.create({
		host_id,
		user: userId,
		project: project._id,
		original_name: originalName,
		title: cleanString(data.title, 240),
		tags: normalizeTags(data.tags),
		mime_type: cleanString(data.mime_type, 160),
		total_bytes: totalBytes,
		expires_at: expiryDate(),
	});
	await mkdir(chunkDir(upload._id), { recursive: true });
	return publicUpload(upload);
}

export async function getUpload(userId, host_id, id, { touch = false } = {}) {
	const update = touch ? { $set: { last_activity_at: new Date(), expires_at: expiryDate() } } : null;
	const upload = update
		? await NoteImportUpload.findOneAndUpdate(ownershipFilter(id, userId, host_id), update, { returnDocument: 'after' }).lean()
		: await NoteImportUpload.findOne(ownershipFilter(id, userId, host_id)).lean();
	if (!upload) throw new NoteImportError('Import session not found', 404, 'upload_not_found');
	return publicUpload(upload);
}

export async function appendChunk(userId, host_id, id, req) {
	const offset = parseSafeLength(req.headers['upload-offset'], 'Upload-Offset');
	const uploadLength = parseSafeLength(req.headers['upload-length'], 'Upload-Length');
	const checksum = req.headers['upload-checksum'] || req.headers['x-upload-checksum'] || req.headers.digest;
	if (!checksum) throw new NoteImportError('A SHA-256 Upload-Checksum header is required', 400, 'checksum_required');
	const upload = await NoteImportUpload.findOne(ownershipFilter(id, userId, host_id)).lean();
	if (!upload) throw new NoteImportError('Import session not found', 404, 'upload_not_found');
	if (upload.state !== 'uploading') throw new NoteImportError(`Import is ${upload.state}`, 409, 'invalid_state');
	if (uploadLength !== upload.total_bytes) throw new NoteImportError('Upload-Length does not match the session', 409, 'length_conflict');
	if (offset > upload.received_bytes) throw new NoteImportError(`Expected offset ${upload.received_bytes}`, 409, 'offset_conflict');
	const remaining = upload.total_bytes - offset;
	const maximumBytes = Math.min(NOTE_IMPORT_CHUNK_SIZE, remaining);
	await ensureStorageAvailable(chunkDir(upload._id), maximumBytes);
	const temporaryPath = path.join(chunkDir(upload._id), `${offset}.${crypto.randomUUID()}.tmp`);
	const received = await hashAndStoreRequest(req, temporaryPath, maximumBytes);
	if (!received.size && remaining) {
		await rm(temporaryPath, { force: true });
		throw new NoteImportError('Chunk is empty', 400, 'empty_chunk');
	}
	if (!checksumMatches(checksum, received.hash)) {
		await rm(temporaryPath, { force: true });
		throw new NoteImportError('Chunk checksum mismatch', 460, 'checksum_mismatch');
	}
	if (received.size !== maximumBytes) {
		await rm(temporaryPath, { force: true });
		throw new NoteImportError(`Chunk must contain exactly ${maximumBytes} bytes`, 409, 'chunk_size_conflict');
	}
	if (offset + received.size > upload.total_bytes) {
		await rm(temporaryPath, { force: true });
		throw new NoteImportError('Chunk exceeds Upload-Length', 409, 'length_conflict');
	}
	if (offset < upload.received_bytes) {
		const matches = await verifyStoredChunk(upload, offset, received.size, received.hash);
		await rm(temporaryPath, { force: true });
		if (!matches) throw new NoteImportError('Chunk overlaps uploaded data', 409, 'overlap_conflict');
		return publicUpload(upload);
	}
	const finalPath = chunkPath(upload._id, offset);
	try {
		await link(temporaryPath, finalPath);
	} catch (err) {
		if (err?.code !== 'EEXIST') throw err;
		const matches = await storedChunkMatches(upload._id, offset, received.size, received.hash);
		if (!matches) throw new NoteImportError('A different chunk already exists at this offset', 409, 'chunk_conflict');
	} finally {
		await unlink(temporaryPath).catch(() => {});
	}
	const now = new Date();
	const updated = await NoteImportUpload.findOneAndUpdate(
		{ ...ownershipFilter(id, userId, host_id), state: 'uploading', received_bytes: offset },
		{ $set: { received_bytes: offset + received.size, last_activity_at: now, expires_at: expiryDate() }, $push: { chunks: { offset, size: received.size, checksum: `sha256 ${received.hash.base64}` } } },
		{ returnDocument: 'after' },
	).lean();
	if (updated) {
		emitToTenant(host_id, 'note-import:progress', publicUpload(updated));
		return publicUpload(updated);
	}
	const latest = await NoteImportUpload.findOne(ownershipFilter(id, userId, host_id)).lean();
	if (latest && await verifyStoredChunk(latest, offset, received.size, received.hash)) return publicUpload(latest);
	throw new NoteImportError('Upload offset changed while writing the chunk', 409, 'offset_conflict');
}

export async function completeUpload(userId, host_id, id) {
	const upload = await NoteImportUpload.findOne(ownershipFilter(id, userId, host_id)).lean();
	if (!upload) throw new NoteImportError('Import session not found', 404, 'upload_not_found');
	if (upload.state === 'processing' || upload.state === 'complete') return publicUpload(upload);
	if (!['uploading', 'failed'].includes(upload.state)) throw new NoteImportError(`Import is ${upload.state}`, 409, 'invalid_state');
	if (upload.received_bytes !== upload.total_bytes) throw new NoteImportError(`Upload incomplete at offset ${upload.received_bytes}`, 409, 'upload_incomplete');
	await verifyCompleteUpload(upload);
	const updated = await NoteImportUpload.findOneAndUpdate(
		{ ...ownershipFilter(id, userId, host_id), state: upload.state, received_bytes: upload.total_bytes },
		{ $set: { state: 'processing', error: '', last_activity_at: new Date(), expires_at: expiryDate() } },
		{ returnDocument: 'after' },
	).lean();
	if (!updated) return getUpload(userId, host_id, id);
	const dedupKey = upload.state === 'failed' ? `${updated._id}:retry:${Date.now()}` : String(updated._id);
	await MongoQueue.add(NOTE_IMPORT_QUEUE, { upload_id: String(updated._id) }, { dedupKey, maxAttempts: 3 });
	emitToTenant(host_id, 'note-import:processing', publicUpload(updated));
	return publicUpload(updated);
}

export async function cancelUpload(userId, host_id, id) {
	const upload = await NoteImportUpload.findOneAndUpdate(
		{ ...ownershipFilter(id, userId, host_id), state: { $in: ['uploading', 'failed'] } },
		{ $set: { state: 'canceled', last_activity_at: new Date(), expires_at: expiryDate() } },
		{ returnDocument: 'after' },
	).lean();
	if (!upload) {
		const existing = await NoteImportUpload.findOne(ownershipFilter(id, userId, host_id)).lean();
		if (!existing) throw new NoteImportError('Import session not found', 404, 'upload_not_found');
		throw new NoteImportError(`Import is ${existing.state}`, 409, 'invalid_state');
	}
	await rm(uploadDir(upload._id), { recursive: true, force: true });
	emitToTenant(host_id, 'note-import:canceled', publicUpload(upload));
	return publicUpload(upload);
}

async function assembleUpload(upload) {
	const chunks = [...upload.chunks].sort((a, b) => a.offset - b.offset);
	let expectedOffset = 0;
	for (const chunk of chunks) {
		if (chunk.offset !== expectedOffset) throw new Error(`Missing chunk at offset ${expectedOffset}`);
		expectedOffset += chunk.size;
	}
	if (expectedOffset !== upload.total_bytes) throw new Error(`Assembled length ${expectedOffset} does not match ${upload.total_bytes}`);
	const destinationPath = sourcePath(upload);
	await rm(destinationPath, { force: true });
	const output = createWriteStream(destinationPath, { flags: 'wx' });
	try {
		for (const chunk of chunks) {
			for await (const data of createReadStream(chunkPath(upload._id, chunk.offset))) {
				if (!output.write(data)) await once(output, 'drain');
			}
		}
		output.end();
		await once(output, 'finish');
	} catch (err) {
		output.destroy();
		await rm(destinationPath, { force: true });
		throw err;
	}
	if ((await stat(destinationPath)).size !== upload.total_bytes) throw new Error('Assembled file size mismatch');
	return destinationPath;
}

export async function processUpload(uploadId) {
	const upload = await NoteImportUpload.findOne({ _id: uploadId, state: { $in: ['processing', 'failed'] } }).lean();
	if (!upload) return;
	const releaseAccountWork = await acquireTenantWork(upload.host_id);
	try {
	await NoteImportUpload.updateOne({ _id: upload._id }, { $set: { state: 'processing', error: '', last_activity_at: new Date(), expires_at: expiryDate() } });
	try {
		const filePath = await assembleUpload(upload);
		const detected = await detectFileType(filePath);
		const { text, html } = await extractText(filePath, detected.mimeType, upload.original_name);
		if (!text && !html) throw new Error('No text content could be extracted from this file');
		const extension = path.extname(upload.original_name).toLowerCase();
		const title = upload.title || path.basename(upload.original_name, extension) || 'Untitled';
		const note = await noteService.createNote(upload.user, upload.host_id, { title, content: html, text_content: text, tags: upload.tags?.length ? upload.tags : ['imported'], project: upload.project }, { channel: 'mobile', user_id: upload.user });
		const completed = await NoteImportUpload.findOneAndUpdate({ _id: upload._id }, { $set: { state: 'complete', note: note._id, mime_type: detected.mimeType, error: '', last_activity_at: new Date(), expires_at: expiryDate() } }, { returnDocument: 'after' }).lean();
		emitToTenant(upload.host_id, 'note-import:complete', publicUpload(completed));
		emitToTenant(upload.host_id, 'counts:refresh', { project: String(upload.project) });
		await rm(uploadDir(upload._id), { recursive: true, force: true });
	} catch (err) {
		const failed = await NoteImportUpload.findOneAndUpdate({ _id: upload._id }, { $set: { state: 'failed', error: cleanString(err?.message || err, 1000), last_activity_at: new Date(), expires_at: expiryDate() } }, { returnDocument: 'after' }).lean();
		emitToTenant(upload.host_id, 'note-import:failed', publicUpload(failed));
		throw err;
	}
	} finally { await releaseAccountWork(); }
}

export function createNoteImportWorker() {
	return new MongoWorker({ queue: NOTE_IMPORT_QUEUE, concurrency: 1, stalledThresholdMs: 25 * 60 * 60 * 1000, handlerTimeoutMs: 24 * 60 * 60 * 1000, handler: async (job) => processUpload(job.data.upload_id) });
}

export async function cleanupOrphanedImportFiles() {
	await mkdir(IMPORT_ROOT, { recursive: true });
	const entries = await readdir(IMPORT_ROOT, { withFileTypes: true });
	let removed = 0;
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const exists = await NoteImportUpload.exists({ _id: entry.name });
		if (exists) continue;
		await rm(path.join(IMPORT_ROOT, entry.name), { recursive: true, force: true });
		removed++;
	}
	return removed;
}

export function logImportWorkerError(err) {
	log.error({ err }, 'Note import worker error');
}

export async function deleteImportFilesForHost(hostId) {
	const uploads = await NoteImportUpload.find({ host_id: hostId }).select('_id').read('primary').lean();
	for (const upload of uploads) await rm(uploadDir(upload._id), { recursive: true, force: true });
}
