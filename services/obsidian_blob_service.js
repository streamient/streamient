import crypto from 'node:crypto';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, statfs } from 'node:fs/promises';
import { once } from 'node:events';

import config from '../config.js';
import { queryForSave } from '../model/mongoose.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';

export const OBSIDIAN_UPLOAD_CHUNK_SIZE = 20_000_000;
export const OBSIDIAN_UPLOAD_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
export const OBSIDIAN_UPLOAD_ACTIVE_LIMIT = 4;

const STORAGE_RESERVE_BYTES = 100_000_000n;
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export class ObsidianBlobError extends Error {
	constructor(message, status = 400, code = 'invalid_upload') {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function cleanSegment(value) {
	const segment = String(value || '');
	if (!/^[a-zA-Z0-9_-]+$/.test(segment)) throw new ObsidianBlobError('Invalid storage identifier', 400, 'invalid_storage_id');
	return segment;
}

function storageRoot() {
	return path.resolve(config.obsidian.vaultsDir);
}

function uploadDir(hostId, uploadId) {
	return path.join(storageRoot(), 'uploads', cleanSegment(hostId), cleanSegment(uploadId));
}

function uploadChunkPath(hostId, uploadId, offset) {
	return path.join(uploadDir(hostId, uploadId), `${offset}.part`);
}

function blobDir(hostId, sha256) {
	if (!/^[a-f0-9]{64}$/.test(sha256)) throw new ObsidianBlobError('Invalid SHA-256', 400, 'invalid_checksum');
	// Each writer owns its ciphertext directory; the unique blob record deduplicates content.
	return path.join(storageRoot(), 'blobs', cleanSegment(hostId), `${sha256}-${crypto.randomUUID()}`);
}

function blobChunkPath(blob, chunk) {
	return path.join(storageRoot(), blob.storage_key, chunk.file_name);
}

function encryptionKey() {
	const raw = config.obsidian.encryptionKey;
	if (!raw) throw new ObsidianBlobError('OBSIDIAN_VAULT_ENCRYPTION_KEY is not configured', 503, 'encryption_key_missing');
	if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
	if (Buffer.byteLength(raw, 'utf8') === 32) return Buffer.from(raw, 'utf8');
	throw new ObsidianBlobError('OBSIDIAN_VAULT_ENCRYPTION_KEY must be 32 bytes or 64 hexadecimal characters', 503, 'invalid_encryption_key');
}

function expiryDate() {
	return new Date(Date.now() + OBSIDIAN_UPLOAD_INACTIVITY_MS);
}

function normalizeSha256(value) {
	const raw = String(value || '').trim().toLowerCase();
	const match = raw.match(/^sha-?256(?:=|\s+)(.+)$/i);
	const normalized = (match?.[1] || raw).trim().toLowerCase();
	if (!/^[a-f0-9]{64}$/.test(normalized)) throw new ObsidianBlobError('A hexadecimal SHA-256 checksum is required', 400, 'invalid_checksum');
	return normalized;
}

function normalizeChunkChecksum(value) {
	const raw = String(value || '').trim();
	const match = raw.match(/^sha-?256(?:=|\s+)(.+)$/i);
	return (match?.[1] || raw).trim();
}

function checksumMatches(value, digest) {
	const expected = normalizeChunkChecksum(value);
	return expected.toLowerCase() === digest.hex || expected === digest.base64;
}

function safeLength(value, name) {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 0) throw new ObsidianBlobError(`${name} must be a non-negative safe integer`, 400, 'invalid_length');
	return parsed;
}

function publicUpload(upload) {
	if (!upload) return null;
	return {
		id: String(upload._id),
		connection_id: String(upload.connection),
		path: upload.path,
		mime_type: upload.mime_type,
		upload_length: upload.total_bytes,
		upload_offset: upload.received_bytes,
		chunk_size: OBSIDIAN_UPLOAD_CHUNK_SIZE,
		sha256: upload.sha256,
		state: upload.state,
		blob_id: upload.blob ? String(upload.blob) : null,
		error: upload.error || null,
		expires_at: upload.expires_at,
	};
}

function ownershipFilter(id, userId, hostId) {
	return { _id: id, user: userId, host_id: hostId };
}

async function ensureStorageAvailable(targetPath, requestedBytes) {
	await mkdir(targetPath, { recursive: true });
	const storage = await statfs(targetPath, { bigint: true });
	const available = storage.bavail * storage.bsize;
	if (available < BigInt(requestedBytes) + STORAGE_RESERVE_BYTES) throw new ObsidianBlobError('Insufficient storage for this chunk', 507, 'insufficient_storage');
}

async function encryptRequestChunk(req, destination, maximumBytes) {
	const key = encryptionKey();
	const iv = crypto.randomBytes(IV_BYTES);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	const hash = crypto.createHash('sha256');
	const output = createWriteStream(destination, { flags: 'wx' });
	let size = 0;
	try {
		for await (const value of req) {
			const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
			size += chunk.length;
			if (size > maximumBytes) throw new ObsidianBlobError(`Chunks may not exceed ${OBSIDIAN_UPLOAD_CHUNK_SIZE} bytes`, 413, 'chunk_too_large');
			hash.update(chunk);
			const encrypted = cipher.update(chunk);
			if (encrypted.length && !output.write(encrypted)) await once(output, 'drain');
		}
		const final = cipher.final();
		if (final.length && !output.write(final)) await once(output, 'drain');
		output.end();
		await once(output, 'finish');
	} catch (err) {
		output.destroy();
		await rm(destination, { force: true }).catch(() => {});
		throw err;
	}
	const digest = hash.digest();
	return {
		size,
		checksum: digest.toString('hex'),
		digest: { hex: digest.toString('hex'), base64: digest.toString('base64') },
		iv: iv.toString('hex'),
		tag: cipher.getAuthTag().toString('hex'),
	};
}

async function encryptBufferChunk(value, destination) {
	const key = encryptionKey();
	const iv = crypto.randomBytes(IV_BYTES);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
	const output = createWriteStream(destination, { flags: 'wx' });
	output.end(encrypted);
	await once(output, 'finish');
	return {
		offset: 0,
		size: value.length,
		checksum: crypto.createHash('sha256').update(value).digest('hex'),
		iv: iv.toString('hex'),
		tag: cipher.getAuthTag().toString('hex'),
	};
}

async function *plainChunkStream(filePath, chunk) {
	const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(chunk.iv, 'hex'));
	decipher.setAuthTag(Buffer.from(chunk.tag, 'hex'));
	for await (const encrypted of createReadStream(filePath)) {
		const plain = decipher.update(encrypted);
		if (plain.length) yield plain;
	}
	const final = decipher.final();
	if (final.length) yield final;
}

async function hashUpload(upload) {
	const hash = crypto.createHash('sha256');
	const chunks = [...upload.chunks].sort((left, right) => left.offset - right.offset);
	let offset = 0;
	for (const chunk of chunks) {
		if (chunk.offset !== offset) throw new ObsidianBlobError(`Upload incomplete at offset ${offset}`, 409, 'upload_incomplete');
		for await (const plain of plainChunkStream(uploadChunkPath(upload.host_id, upload._id, chunk.offset), chunk)) hash.update(plain);
		offset += chunk.size;
	}
	if (offset !== upload.total_bytes) throw new ObsidianBlobError(`Upload incomplete at offset ${offset}`, 409, 'upload_incomplete');
	return hash.digest('hex');
}

export async function createUpload(userId, hostId, data) {
	const totalBytes = safeLength(data.total_bytes ?? data.upload_length, 'upload_length');
	if (config.obsidian.maxFileBytes && totalBytes > config.obsidian.maxFileBytes) throw new ObsidianBlobError('File exceeds the configured Obsidian sync limit', 413, 'file_too_large');
	const active = await ObsidianUpload.countDocuments({ host_id: hostId, user: userId, state: 'uploading' });
	if (active >= OBSIDIAN_UPLOAD_ACTIVE_LIMIT) throw new ObsidianBlobError(`At most ${OBSIDIAN_UPLOAD_ACTIVE_LIMIT} uploads may be active`, 429, 'active_upload_limit');
	const upload = await ObsidianUpload.create({
		host_id: hostId,
		user: userId,
		connection: data.connection_id,
		path: data.path,
		mime_type: String(data.mime_type || 'application/octet-stream').slice(0, 200),
		total_bytes: totalBytes,
		sha256: normalizeSha256(data.sha256),
		expires_at: expiryDate(),
	});
	await mkdir(uploadDir(hostId, upload._id), { recursive: true });
	return publicUpload(upload);
}

export async function getUpload(userId, hostId, id) {
	const upload = await ObsidianUpload.findOne(ownershipFilter(id, userId, hostId)).lean();
	if (!upload) throw new ObsidianBlobError('Upload not found', 404, 'upload_not_found');
	return publicUpload(upload);
}

export async function appendUploadChunk(userId, hostId, id, req) {
	const offset = safeLength(req.headers['upload-offset'], 'Upload-Offset');
	const uploadLength = safeLength(req.headers['upload-length'], 'Upload-Length');
	const suppliedChecksum = req.headers['upload-checksum'] || req.headers['x-upload-checksum'] || req.headers.digest;
	const upload = await queryForSave(ObsidianUpload.findOne(ownershipFilter(id, userId, hostId)));
	if (!upload) throw new ObsidianBlobError('Upload not found', 404, 'upload_not_found');
	if (upload.state !== 'uploading') throw new ObsidianBlobError(`Upload is ${upload.state}`, 409, 'invalid_state');
	if (uploadLength !== upload.total_bytes) throw new ObsidianBlobError('Upload-Length does not match the session', 409, 'length_conflict');
	if (offset < upload.received_bytes) {
		const existing = upload.chunks.find((chunk) => chunk.offset === offset);
		if (!existing || !checksumMatches(suppliedChecksum, { hex: existing.checksum, base64: '' })) throw new ObsidianBlobError('Chunk retry does not match stored data', 409, 'chunk_integrity_conflict');
		req.resume?.();
		return publicUpload(upload);
	}
	if (offset !== upload.received_bytes) throw new ObsidianBlobError(`Expected offset ${upload.received_bytes}`, 409, 'offset_conflict');
	const remaining = upload.total_bytes - offset;
	const maximumBytes = Math.min(OBSIDIAN_UPLOAD_CHUNK_SIZE, remaining);
	await ensureStorageAvailable(uploadDir(hostId, upload._id), maximumBytes);
	const temporary = path.join(uploadDir(hostId, upload._id), `${offset}.${crypto.randomUUID()}.tmp`);
	const stored = await encryptRequestChunk(req, temporary, maximumBytes);
	if (stored.size !== maximumBytes && remaining > OBSIDIAN_UPLOAD_CHUNK_SIZE) {
		await rm(temporary, { force: true });
		throw new ObsidianBlobError(`Non-final chunks must be exactly ${OBSIDIAN_UPLOAD_CHUNK_SIZE} bytes`, 409, 'invalid_chunk_size');
	}
	if (stored.size !== maximumBytes) {
		await rm(temporary, { force: true });
		throw new ObsidianBlobError(`Expected ${maximumBytes} bytes`, 409, 'invalid_chunk_size');
	}
	if (!checksumMatches(suppliedChecksum, stored.digest)) {
		await rm(temporary, { force: true });
		throw new ObsidianBlobError('Chunk checksum does not match', 409, 'chunk_integrity_conflict');
	}
	const fileName = `${offset}.part`;
	await rename(temporary, uploadChunkPath(hostId, upload._id, offset));
	upload.chunks.push({ offset, size: stored.size, checksum: stored.checksum, iv: stored.iv, tag: stored.tag, file_name: fileName });
	upload.received_bytes += stored.size;
	upload.expires_at = expiryDate();
	await upload.save();
	return publicUpload(upload);
}

export async function completeUpload(userId, hostId, id) {
	const upload = await queryForSave(ObsidianUpload.findOne(ownershipFilter(id, userId, hostId)));
	if (!upload) throw new ObsidianBlobError('Upload not found', 404, 'upload_not_found');
	if (upload.state === 'complete') return publicUpload(upload);
	if (upload.state !== 'uploading') throw new ObsidianBlobError(`Upload is ${upload.state}`, 409, 'invalid_state');
	if (upload.received_bytes !== upload.total_bytes) throw new ObsidianBlobError(`Upload incomplete at offset ${upload.received_bytes}`, 409, 'upload_incomplete');
	const sha256 = await hashUpload(upload);
	if (sha256 !== upload.sha256) {
		upload.state = 'failed';
		upload.error = 'Whole-file checksum does not match';
		await upload.save();
		throw new ObsidianBlobError(upload.error, 409, 'file_integrity_conflict');
	}
	let blob = await ObsidianBlob.findOne({ host_id: hostId, sha256 }).read('primary').lean();
	if (!blob) {
		const destination = blobDir(hostId, sha256);
		let installed = false;
		await mkdir(path.dirname(destination), { recursive: true });
		try {
			await rename(uploadDir(hostId, upload._id), destination);
			installed = true;
			blob = await ObsidianBlob.create({
				host_id: hostId,
				sha256,
				total_bytes: upload.total_bytes,
				mime_type: upload.mime_type,
				storage_key: path.relative(storageRoot(), destination),
				chunks: upload.chunks,
			});
		} catch (err) {
			blob = await ObsidianBlob.findOne({ host_id: hostId, sha256 }).read('primary').lean();
			if (!blob) throw err;
			if (installed && blob.storage_key !== path.relative(storageRoot(), destination)) await rm(destination, { recursive: true, force: true });
			await rm(uploadDir(hostId, upload._id), { recursive: true, force: true }).catch(() => {});
		}
	} else {
		await rm(uploadDir(hostId, upload._id), { recursive: true, force: true }).catch(() => {});
	}
	upload.state = 'complete';
	upload.blob = blob._id;
	upload.error = '';
	await upload.save();
	return publicUpload(upload);
}

export async function storeBuffer(hostId, value, mimeType = 'application/octet-stream') {
	const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
	if (config.obsidian.maxFileBytes && buffer.length > config.obsidian.maxFileBytes) throw new ObsidianBlobError('File exceeds the configured Obsidian sync limit', 413, 'file_too_large');
	const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
	const existing = await ObsidianBlob.findOne({ host_id: hostId, sha256 }).read('primary').lean();
	if (existing) return existing;
	const temporary = path.join(storageRoot(), 'server', cleanSegment(hostId), crypto.randomUUID());
	await mkdir(temporary, { recursive: true });
	const chunks = [];
	try {
		for (let offset = 0; offset < buffer.length; offset += OBSIDIAN_UPLOAD_CHUNK_SIZE) {
			const plain = buffer.subarray(offset, Math.min(offset + OBSIDIAN_UPLOAD_CHUNK_SIZE, buffer.length));
			const fileName = `${offset}.part`;
			const encrypted = await encryptBufferChunk(plain, path.join(temporary, fileName));
			chunks.push({ ...encrypted, offset, file_name: fileName });
		}
		const destination = blobDir(hostId, sha256);
		let installed = false;
		await mkdir(path.dirname(destination), { recursive: true });
		try {
			await rename(temporary, destination);
			installed = true;
			return await ObsidianBlob.create({
				host_id: hostId,
				sha256,
				total_bytes: buffer.length,
				mime_type: mimeType,
				storage_key: path.relative(storageRoot(), destination),
				chunks,
			});
		} catch (err) {
			const raced = await ObsidianBlob.findOne({ host_id: hostId, sha256 }).read('primary').lean();
			if (!raced) throw err;
			if (installed && raced.storage_key !== path.relative(storageRoot(), destination)) await rm(destination, { recursive: true, force: true });
			await rm(temporary, { recursive: true, force: true });
			return raced;
		}
	} catch (err) {
		await rm(temporary, { recursive: true, force: true }).catch(() => {});
		throw err;
	}
}

export async function cancelUpload(userId, hostId, id) {
	const upload = await ObsidianUpload.findOneAndUpdate(
		{ ...ownershipFilter(id, userId, hostId), state: { $in: ['uploading', 'failed'] } },
		{ $set: { state: 'canceled', expires_at: expiryDate() } },
		{ returnDocument: 'after' },
	);
	if (!upload) throw new ObsidianBlobError('Upload cannot be canceled', 409, 'invalid_state');
	await rm(uploadDir(hostId, id), { recursive: true, force: true });
	return publicUpload(upload);
}

export async function deleteConnectionUploads(hostId, connectionId) {
	const uploads = await ObsidianUpload.find({ host_id: hostId, connection: connectionId }).select('_id').lean();
	for (const upload of uploads) await rm(uploadDir(hostId, upload._id), { recursive: true, force: true }).catch(() => {});
	if (uploads.length) await ObsidianUpload.deleteMany({ _id: { $in: uploads.map((upload) => upload._id) }, host_id: hostId });
	return uploads.length;
}

export async function *readBlob(blobOrId, hostId) {
	const blob = typeof blobOrId === 'object' && blobOrId?.chunks
		? blobOrId
		: await ObsidianBlob.findOne({ _id: blobOrId, host_id: hostId }).lean();
	if (!blob) throw new ObsidianBlobError('Blob not found', 404, 'blob_not_found');
	for (const chunk of [...blob.chunks].sort((left, right) => left.offset - right.offset)) {
		for await (const plain of plainChunkStream(blobChunkPath(blob, chunk), chunk)) yield plain;
	}
}

export async function readBlobBuffer(blobOrId, hostId, maximumBytes = config.obsidian.maxFileBytes) {
	const chunks = [];
	let size = 0;
	for await (const chunk of readBlob(blobOrId, hostId)) {
		size += chunk.length;
		if (maximumBytes && size > maximumBytes) throw new ObsidianBlobError('Blob is too large to buffer', 413, 'blob_too_large');
		chunks.push(chunk);
	}
	return Buffer.concat(chunks, size);
}

export async function materializeBlob(blob, hostId) {
	const temporaryDir = path.join(storageRoot(), 'extract', cleanSegment(hostId));
	await mkdir(temporaryDir, { recursive: true });
	const filePath = path.join(temporaryDir, `${crypto.randomUUID()}.tmp`);
	const output = createWriteStream(filePath, { flags: 'wx' });
	try {
		for await (const chunk of readBlob(blob, hostId)) {
			if (!output.write(chunk)) await once(output, 'drain');
		}
		output.end();
		await once(output, 'finish');
		return { filePath, cleanup: () => rm(filePath, { force: true }) };
	} catch (err) {
		output.destroy();
		await rm(filePath, { force: true }).catch(() => {});
		throw err;
	}
}

export async function deleteBlob(blob) {
	if (!blob) return;
	await rm(path.join(storageRoot(), blob.storage_key), { recursive: true, force: true });
	await ObsidianBlob.deleteOne({ _id: blob._id, host_id: blob.host_id });
}

export async function cleanupOrphanedUploads(now = new Date()) {
	const uploads = await ObsidianUpload.find({ expires_at: { $lte: now } }).select('_id host_id').lean();
	for (const upload of uploads) await rm(uploadDir(upload.host_id, upload._id), { recursive: true, force: true }).catch(() => {});
	if (uploads.length) await ObsidianUpload.deleteMany({ _id: { $in: uploads.map((upload) => upload._id) } });
	const root = path.join(storageRoot(), 'uploads');
	let removed = uploads.length;
	const hosts = await readdir(root, { withFileTypes: true }).catch(() => []);
	for (const host of hosts) {
		if (!host.isDirectory()) continue;
		const hostPath = path.join(root, host.name);
		const directories = await readdir(hostPath, { withFileTypes: true }).catch(() => []);
		const ids = directories.filter((entry) => entry.isDirectory() && /^[a-f0-9]{24}$/i.test(entry.name)).map((entry) => entry.name);
		if (!ids.length) continue;
		const active = await ObsidianUpload.find({ _id: { $in: ids }, host_id: host.name }).select('_id').lean();
		const activeIds = new Set(active.map((upload) => String(upload._id)));
		for (const id of ids) {
			if (activeIds.has(id)) continue;
			await rm(path.join(hostPath, id), { recursive: true, force: true });
			removed++;
		}
	}
	return removed;
}

export const __test = { normalizeSha256, checksumMatches, safeLength, encryptionKey, storageRoot };
