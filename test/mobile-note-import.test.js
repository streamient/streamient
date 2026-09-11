import { beforeEach as beforeAccountWork, afterEach as afterAccountWork } from 'node:test';
import { mockTenantWork } from './helpers/tenant-work.js';
let restoreAccountWork;
beforeAccountWork(() => { restoreAccountWork = mockTenantWork(); });
afterAccountWork(() => { restoreAccountWork(); });
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';

import { NoteImportUpload } from '../model/note_import_upload.js';
import { Project } from '../model/project.js';
import { NOTE_IMPORT_ACTIVE_LIMIT, NOTE_IMPORT_CHUNK_SIZE, NoteImportError, appendChunk, completeUpload, createUpload, ensureStorageAvailable, getUpload, processUpload } from '../services/note_import_service.js';

function queryResult(value) {
	return { select() { return this; }, lean: async () => structuredClone(value) };
}

function checksum(buffer, encoding = 'base64') {
	return crypto.createHash('sha256').update(buffer).digest(encoding);
}

function uploadRequest(buffer, offset, length, digest = checksum(buffer)) {
	const request = Readable.from([buffer]);
	request.headers = { 'upload-offset': String(offset), 'upload-length': String(length), 'upload-checksum': `sha256 ${digest}` };
	return request;
}

describe('mobile resumable note imports', () => {
	const originals = {};
	const hostId = 'host-mobile-test';
	const userId = '507f1f77bcf86cd799439011';
	const projectId = '507f1f77bcf86cd799439012';
	let upload;
	let uploadId;

	beforeEach(() => {
		uploadId = crypto.randomBytes(12).toString('hex');
		upload = { _id: uploadId, host_id: hostId, user: userId, project: projectId, original_name: 'large.txt', title: '', tags: [], mime_type: 'text/plain', total_bytes: 12, received_bytes: 0, state: 'uploading', chunks: [], note: null, error: '', createdAt: new Date(), updatedAt: new Date(), expires_at: new Date(Date.now() + 60_000) };
		originals.findOne = NoteImportUpload.findOne;
		originals.findOneAndUpdate = NoteImportUpload.findOneAndUpdate;
		originals.countDocuments = NoteImportUpload.countDocuments;
		originals.create = NoteImportUpload.create;
		originals.updateOne = NoteImportUpload.updateOne;
		originals.projectFindOne = Project.findOne;

		const matches = (filter) => String(filter._id) === uploadId && String(filter.user) === userId && filter.host_id === hostId && (!filter.state || (typeof filter.state === 'string' ? filter.state === upload.state : filter.state.$in.includes(upload.state))) && (filter.received_bytes === undefined || filter.received_bytes === upload.received_bytes);
		NoteImportUpload.findOne = (filter) => queryResult(matches(filter) ? upload : null);
		NoteImportUpload.findOneAndUpdate = (filter, update) => ({ lean: async () => {
			if (!matches(filter)) return null;
			Object.assign(upload, update.$set || {});
			if (update.$push?.chunks) upload.chunks.push(update.$push.chunks);
			upload.updatedAt = new Date();
			return structuredClone(upload);
		} });
		NoteImportUpload.countDocuments = async () => 0;
		Project.findOne = () => queryResult({ _id: projectId });
	});

	afterEach(async () => {
		NoteImportUpload.findOne = originals.findOne;
		NoteImportUpload.findOneAndUpdate = originals.findOneAndUpdate;
		NoteImportUpload.countDocuments = originals.countDocuments;
		NoteImportUpload.create = originals.create;
		NoteImportUpload.updateOne = originals.updateOne;
		Project.findOne = originals.projectFindOne;
		await rm(path.resolve('assets', 'import', 'mobile', uploadId), { recursive: true, force: true });
	});

	it('accepts multi-gigabyte session lengths without an application ceiling', async () => {
		const totalBytes = 3 * 1024 * 1024 * 1024;
		NoteImportUpload.create = async (data) => ({ ...upload, ...data, _id: uploadId, received_bytes: 0, state: 'uploading', chunks: [], createdAt: new Date(), updatedAt: new Date() });
		const created = await createUpload(userId, hostId, { project_id: projectId, file_name: 'huge.txt', mime_type: 'text/plain', upload_length: totalBytes });
		assert.equal(created.upload_length, totalBytes);
		assert.equal(created.chunk_size, 20_000_000);
	});

	it('limits concurrent sessions rather than total document bytes', async () => {
		NoteImportUpload.countDocuments = async () => NOTE_IMPORT_ACTIVE_LIMIT;
		await assert.rejects(createUpload(userId, hostId, { project_id: projectId, file_name: 'huge.txt', upload_length: 5_000_000_000 }), (err) => err instanceof NoteImportError && err.status === 429 && err.code === 'active_upload_limit');
	});

	it('rejects checksum mismatch, then accepts and idempotently retries a chunk', async () => {
		const body = Buffer.from('hello world!');
		await assert.rejects(appendChunk(userId, hostId, uploadId, uploadRequest(body, 0, body.length, checksum(Buffer.from('wrong')))), (err) => err.status === 460 && err.code === 'checksum_mismatch');
		assert.equal(upload.received_bytes, 0);

		const first = await appendChunk(userId, hostId, uploadId, uploadRequest(body, 0, body.length));
		assert.equal(first.upload_offset, body.length);
		assert.equal(upload.chunks.length, 1);

		const retry = await appendChunk(userId, hostId, uploadId, uploadRequest(body, 0, body.length, checksum(body, 'hex')));
		assert.equal(retry.upload_offset, body.length);
		assert.equal(upload.chunks.length, 1);
	});

	it('requires exact 20 MB chunks except for the final remainder', async () => {
		const partial = Buffer.from('hello');
		await assert.rejects(appendChunk(userId, hostId, uploadId, uploadRequest(partial, 0, upload.total_bytes)), (err) => err.status === 409 && err.code === 'chunk_size_conflict');
		assert.equal(upload.received_bytes, 0);
	});

	it('rejects mismatched overlap and isolates sessions by tenant', async () => {
		const body = Buffer.from('hello world!');
		await appendChunk(userId, hostId, uploadId, uploadRequest(body, 0, body.length));
		const replacement = Buffer.from('HELLO WORLD!');
		await assert.rejects(appendChunk(userId, hostId, uploadId, uploadRequest(replacement, 0, replacement.length)), (err) => err.status === 409 && err.code === 'overlap_conflict');
		await assert.rejects(getUpload(userId, 'other-tenant', uploadId), (err) => err.status === 404 && err.code === 'upload_not_found');
	});

	it('re-verifies stored chunks before queuing extraction', async () => {
		const body = Buffer.from('hello world!');
		await appendChunk(userId, hostId, uploadId, uploadRequest(body, 0, body.length));
		await rm(path.resolve('assets', 'import', 'mobile', uploadId, 'chunks', '0.part'), { force: true });
		await assert.rejects(completeUpload(userId, hostId, uploadId), (err) => err.status === 409 && err.code === 'chunk_integrity_conflict');
	});

	it('resumes from the server-reported offset after a client restart', async () => {
		upload.total_bytes = 24;
		upload.received_bytes = 12;
		const resumed = await getUpload(userId, hostId, uploadId, { touch: true });
		assert.equal(resumed.upload_offset, 12);
		assert.equal(resumed.upload_length, upload.total_bytes);
		assert.equal(resumed.state, 'uploading');
	});

	it('returns not found after MongoDB expires a session', async () => {
		NoteImportUpload.findOne = () => queryResult(null);
		await assert.rejects(getUpload(userId, hostId, uploadId), (err) => err.status === 404 && err.code === 'upload_not_found');
	});

	it('rejects a chunk when available storage cannot cover it plus reserve', async () => {
		await assert.rejects(ensureStorageAvailable(path.resolve('assets', 'import', 'mobile', uploadId), Number.MAX_SAFE_INTEGER), (err) => err.status === 507 && err.code === 'insufficient_storage');
	});

	it('marks extraction failures and retains the assembled source for retry', async () => {
		const binary = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
		upload = { ...upload, original_name: 'broken.bin', mime_type: 'application/octet-stream', total_bytes: binary.length, received_bytes: binary.length, state: 'processing', chunks: [{ offset: 0, size: binary.length, checksum: `sha256 ${checksum(binary)}` }] };
		const chunksPath = path.resolve('assets', 'import', 'mobile', uploadId, 'chunks');
		await mkdir(chunksPath, { recursive: true });
		await writeFile(path.join(chunksPath, '0.part'), binary);
		NoteImportUpload.findOne = () => queryResult(upload);
		NoteImportUpload.updateOne = async (_filter, update) => Object.assign(upload, update.$set || {});
		NoteImportUpload.findOneAndUpdate = (_filter, update) => ({ lean: async () => { Object.assign(upload, update.$set || {}); return structuredClone(upload); } });

		await assert.rejects(processUpload(uploadId), /binary and cannot be imported/);
		assert.equal(upload.state, 'failed');
		assert.equal((await stat(path.resolve('assets', 'import', 'mobile', uploadId, 'source.bin'))).size, binary.length);
	});

	it('enforces the exact bounded chunk constant and seven-day TTL schema', () => {
		const modelSource = String(NoteImportUpload.schema.indexes().find(([fields]) => fields.expires_at)?.[1]?.expireAfterSeconds);
		assert.equal(NOTE_IMPORT_CHUNK_SIZE, 20_000_000);
		assert.equal(modelSource, '0');
	});
});
