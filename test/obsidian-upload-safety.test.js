import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import config from '../config.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { NoteImportUpload } from '../model/note_import_upload.js';
import { appendUploadChunk, cleanupOrphanedUploads, readBlobBuffer } from '../services/obsidian_blob_service.js';
import { cleanupObsidianRetention } from '../services/obsidian_sync_service.js';
import { cleanupOrphanedImportFiles } from '../services/note_import_service.js';

async function storage(t) {
	const root = await mkdtemp(path.join(os.tmpdir(), 'streamient-upload-safety-'));
	const old = { dir: config.obsidian.vaultsDir, key: config.obsidian.encryptionKey };
	config.obsidian.vaultsDir = root;
	config.obsidian.encryptionKey = 'a'.repeat(64);
	t.after(async () => { config.obsidian.vaultsDir = old.dir; config.obsidian.encryptionKey = old.key; await rm(root, { recursive: true, force: true }); });
	return root;
}
const query = (value) => ({ select() { return this; }, lean: async () => value });

test('concurrent same-offset chunk attempts preserve one decryptable chunk', async (t) => {
	const root = await storage(t);
	const id = crypto.randomBytes(12).toString('hex');
	const body = Buffer.from('identical retry');
	const checksum = crypto.createHash('sha256').update(body).digest('hex');
	const row = { _id: id, host_id: 'host', state: 'uploading', received_bytes: 0, total_bytes: body.length, chunks: [] };
	let reads = 0;
	let ready;
	const bothLoaded = new Promise((resolve) => { ready = resolve; });
	t.mock.method(ObsidianUpload, 'findOneAndUpdate', (filter, update) => ({ lean: async () => {
		if (filter.received_bytes === undefined && update.$set?.expires_at) {
			const snapshot = structuredClone(row);
			if (++reads === 2) ready();
			await bothLoaded;
			return snapshot;
		}
		if (filter.received_bytes !== undefined) {
			if (row.received_bytes !== filter.received_bytes) return null;
			row.chunks.push(update.$push.chunks);
			row.received_bytes += update.$inc.received_bytes;
		}
		return structuredClone(row);
	} }));
	const request = () => Object.assign(Readable.from([body]), { headers: { 'upload-offset': '0', 'upload-length': String(body.length), 'upload-checksum': checksum } });
	const result = await Promise.all([appendUploadChunk(id, 'host', id, request()), appendUploadChunk(id, 'host', id, request())]);
	assert.ok(result.every((value) => value.upload_offset === body.length));
	assert.equal(row.chunks.length, 1);
	assert.deepEqual(await readBlobBuffer({ storage_key: `uploads/host/${id}`, chunks: row.chunks }, 'host'), body);
});

test('upload cleanup keeps a live directory omitted by a replica', async (t) => {
	const root = await storage(t);
	const id = crypto.randomBytes(12).toString('hex');
	const directory = path.join(root, 'uploads', 'host', id);
	await mkdir(directory, { recursive: true });
	await writeFile(path.join(directory, '0.part'), 'live');
	t.mock.method(ObsidianUpload, 'find', () => { throw new Error('Replica reads cannot authorize cleanup'); });
	t.mock.method(ObsidianUpload, 'findOneAndDelete', () => query(null));
	t.mock.method(ObsidianUpload, 'findOneAndUpdate', (filter) => { assert.equal(String(filter._id), id); return query({ _id: id }); });
	assert.equal(await cleanupOrphanedUploads(), 0);
	await access(path.join(directory, '0.part'));
});

test('retention revalidates trash state atomically before clearing file content', async (t) => {
	t.mock.method(ObsidianFile, 'find', () => { throw new Error('Must not save a stale trash snapshot'); });
	t.mock.method(ObsidianFile, 'findOneAndUpdate', (filter) => { assert.equal(filter.in_trash, true); assert.ok(filter.trashed_at.$lte instanceof Date); return query(null); });
	t.mock.method(ObsidianRevision, 'deleteMany', async () => ({}));
	const adjust = t.mock.method(ObsidianConnection, 'updateOne', async () => ({}));
	assert.deepEqual(await cleanupObsidianRetention(), { purged_files: 0, deleted_blobs: 0 });
	assert.equal(adjust.mock.callCount(), 0);
});

test('mobile orphan cleanup uses current write results rather than replica absence', async (t) => {
	const id = crypto.randomBytes(12).toString('hex');
	const directory = path.resolve('assets', 'import', 'mobile', id);
	await mkdir(directory, { recursive: true });
	await writeFile(path.join(directory, 'part'), 'live');
	t.after(() => rm(directory, { recursive: true, force: true }));
	t.mock.method(NoteImportUpload, 'exists', () => { throw new Error('Replica absence is not authoritative'); });
	t.mock.method(NoteImportUpload, 'findOneAndUpdate', (filter) => query({ _id: filter._id }));
	assert.equal(await cleanupOrphanedImportFiles(), 0);
	await access(path.join(directory, 'part'));
});
