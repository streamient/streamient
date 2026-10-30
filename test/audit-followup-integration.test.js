import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from '../model/mongoose.js';
import config from '../config.js';
import authRoutes from '../routes/auth.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { NoteImportUpload } from '../model/note_import_upload.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { MongoQueue, COLLECTION_NAME } from '../modules/mongo_queue.js';
import { completeUpload as completeImport, recoverNoteImports } from '../services/note_import_service.js';
import { appendUploadChunk, completeUpload as completeBlob, readBlobBuffer } from '../services/obsidian_blob_service.js';

test('isolated Mongo verifies reset consumption and upload recovery', { skip: process.env.STREAMIENT_AUDIT_INTEGRATION !== '1', timeout: 30000 }, async (t) => {
	const dbName = 'streamient_followup_test_' + crypto.randomUUID().replaceAll('-', '');
	await mongoose.connect(config.mongoUri, { ...config.mongoOptions, dbName });
	const root = await mkdtemp(path.join(os.tmpdir(), 'streamient-followup-'));
	const old = { dir: config.obsidian.vaultsDir, key: config.obsidian.encryptionKey, adapter: config.socketIO.adapter };
	config.socketIO.adapter = 'memory';
	config.obsidian.vaultsDir = root;
	config.obsidian.encryptionKey = 'b'.repeat(64);
	t.after(async () => { config.obsidian.vaultsDir = old.dir; config.obsidian.encryptionKey = old.key; config.socketIO.adapter = old.adapter; await mongoose.connection.dropDatabase(); await mongoose.disconnect(); await rm(root, { recursive: true, force: true }); });
	const host = 'followup-' + crypto.randomUUID();
	const user = await User.create({ name: 'Isolated audit test', email: 'followup@example.test', password: 'old-password', host_id: host, password_reset_token: 'single-use', password_reset_expires: new Date(Date.now() + 60000) });
	await Tenant.create({ host_id: host, name: 'Isolated audit test', owner: user._id });

	await t.test('only one actual database reset confirmation succeeds', async () => {
		const confirm = authRoutes.stack.find((layer) => layer.route?.path === '/reset-password/confirm').route.stack.at(-1).handle;
		const results = ['first-password', 'second-password'].map((password) => ({ password, req: { body: { token: 'single-use' }, session: { pendingReset: { userId: String(user._id), token: 'single-use', newPassword: password } } }, res: { render(_view, data) { this.error = data.error; }, redirect(url) { this.url = url; } } }));
		await Promise.all(results.map(({ req, res }) => confirm(req, res)));
		assert.equal(results.filter(({ res }) => res.url).length, 1);
		assert.equal(results.filter(({ res }) => res.error === 'Reset link has expired.').length, 1);
		const saved = await User.findOneAndUpdate({ _id: user._id }, { $inc: { __v: 0 } }, { returnDocument: 'after', timestamps: false }).select('+password +password_reset_token').lean();
		assert.equal(await bcrypt.compare(results.find(({ res }) => res.url).password, saved.password), true);
		assert.equal(saved.password_reset_token, undefined);
	});

	await t.test('missing import job recovers once and exhausted jobs require explicit retry', async (t) => {
		const upload = await NoteImportUpload.create({ host_id: host, user: user._id, project: user._id, original_name: 'empty.txt', total_bytes: 0, expires_at: new Date(Date.now() + 60000) });
		const enqueue = t.mock.method(MongoQueue, 'add', async () => { throw new Error('Synthetic queue insertion failure'); });
		await assert.rejects(completeImport(user._id, host, upload._id), /Synthetic queue insertion failure/);
		enqueue.mock.restore();
		await Promise.all([recoverNoteImports(), recoverNoteImports(), completeImport(user._id, host, upload._id)]);
		const jobs = mongoose.connection.db.collection(COLLECTION_NAME);
		assert.equal(await jobs.countDocuments({ queue: 'note-import', 'data.upload_id': String(upload._id) }), 1);
		await jobs.updateOne({ _id: String(upload._id) }, { $set: { status: 'failed', attempts: 3 } });
		await recoverNoteImports();
		const failed = await NoteImportUpload.findOneAndUpdate({ _id: upload._id }, { $inc: { __v: 0 } }, { returnDocument: 'after', timestamps: false }).lean();
		assert.equal(failed.state, 'failed');
		await Promise.all([completeImport(user._id, host, upload._id), completeImport(user._id, host, upload._id)]);
		assert.equal(await jobs.countDocuments({ queue: 'note-import', 'data.upload_id': String(upload._id) }), 2);
		assert.equal((await MongoQueue.getJob(String(upload._id))).attempts, 3);
		assert.equal((await MongoQueue.getJob(String(upload._id) + ':retry:1')).attempts, 0);
		const legacy = await NoteImportUpload.create({ host_id: host, user: user._id, project: user._id, original_name: 'legacy.txt', total_bytes: 0, state: 'processing', expires_at: new Date(Date.now() + 60000) });
		const legacyJob = await MongoQueue.add('note-import', { upload_id: String(legacy._id), host_id: host }, { dedupKey: String(legacy._id), maxAttempts: 3 });
		await jobs.updateOne({ _id: legacyJob._id }, { $set: { status: 'failed', attempts: 3 } });
		await recoverNoteImports();
		const legacyFailed = await NoteImportUpload.findOneAndUpdate({ _id: legacy._id }, { $inc: { __v: 0 } }, { returnDocument: 'after', timestamps: false }).lean();
		assert.equal(legacyFailed.state, 'failed');
	});

	await t.test('Obsidian completion retries real encrypted chunks after a failed save', async (t) => {
		await ObsidianBlob.createIndexes();
		const body = Buffer.from('Encrypted retry bytes');
		const sha256 = crypto.createHash('sha256').update(body).digest('hex');
		const upload = await ObsidianUpload.create({ host_id: host, user: user._id, connection: user._id, path: 'Retry.md', total_bytes: body.length, sha256, expires_at: new Date(Date.now() + 60000) });
		const req = Object.assign(Readable.from([body]), { headers: { 'upload-offset': '0', 'upload-length': String(body.length), 'upload-checksum': sha256 } });
		await appendUploadChunk(user._id, host, upload._id, req);
		const save = t.mock.method(ObsidianUpload.prototype, 'save', async () => { throw new Error('Synthetic completion save failure'); });
		await assert.rejects(completeBlob(user._id, host, upload._id), /Synthetic completion save failure/);
		save.mock.restore();
		const completed = await completeBlob(user._id, host, upload._id);
		assert.equal(completed.state, 'complete');
		const blob = await ObsidianBlob.findOneAndUpdate({ _id: completed.blob_id }, { $inc: { __v: 0 } }, { returnDocument: 'after', timestamps: false }).lean();
		assert.deepEqual(await readBlobBuffer(blob, host), body);
	});
});
