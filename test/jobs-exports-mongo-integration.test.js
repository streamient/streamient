import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from '../model/mongoose.js';
import { Tenant } from '../modules/tenancy.js';
import { MongoQueue, MongoWorker, COLLECTION_NAME } from '../modules/mongo_queue.js';
import { Export } from '../model/export.js';
import { Note } from '../model/note.js';
import { startExport, recoverExports, cleanupExpiredExports, createExportWorker, EXPORT_DIR, EXPORT_QUEUE } from '../services/export_service.js';
import { migrateExportIndexes } from '../services/export_ttl_migration_service.js';

const enabled = process.env.STREAMIENT_JOBS_EXPORTS_INTEGRATION === '1';

test('isolated Mongo queue cancellation, leases, atomic export admission, restart, and TTL cleanup', { skip: !enabled, timeout: 30000 }, async (t) => {
	assert.ok(process.env.MONGO_URI);
	const dbName = `streamient_jobs_exports_test_${randomUUID().replaceAll('-', '')}`;
	await mongoose.connect(process.env.MONGO_URI, { dbName, autoIndex: false });
	const db = mongoose.connection.db;
	assert.equal(db.databaseName, dbName);
	const workers = [];
	const hostId = `jobs-${randomUUID()}`;
	t.after(async () => {
		for (const worker of workers) await worker.stop();
		const entries = await fs.readdir(EXPORT_DIR).catch(() => []);
		for (const entry of entries) if (entry.startsWith(`export-${hostId}-`)) await fs.rm(path.join(EXPORT_DIR, entry), { force: true });
		await db.dropDatabase();
		await mongoose.disconnect();
	});
	const owner = new mongoose.Types.ObjectId();
	await Tenant.create({ host_id: hostId, name: 'Isolated test', owner });
	const queue = db.collection(COLLECTION_NAME);
	const held = Promise.withResolvers();
	const entered = Promise.withResolvers();
	let calls = 0;
	const worker = new MongoWorker({ queue: 'timeout-test', handlerTimeoutMs: 20, stalledThresholdMs: 90, handler: async () => { calls++; entered.resolve(); await held.promise; } });
	workers.push(worker);
	const job = await MongoQueue.add('timeout-test', {}, { maxAttempts: 2 });
	const processing = assert.rejects(worker.processJob(job), /timed out/);
	await entered.promise;
	await delay(120);
	const rescuer = new MongoWorker({ queue: 'timeout-test', handler: async () => {} });
	await rescuer.recoverStalledJobs();
	assert.equal((await queue.findOne({ _id: job._id })).status, 'processing', 'A live heartbeat prevents stalled reclaim');
	await worker.processJob(job);
	assert.equal(calls, 1);
	assert.equal(worker.activeCount, 1);
	held.resolve();
	await processing;
	assert.equal((await queue.findOne({ _id: job._id })).status, 'pending');
	const failed = await MongoQueue.add('timeout-test', {}, { maxAttempts: 1 });
	await queue.updateOne({ _id: failed._id }, { $set: { status: 'processing', attempts: 1, claim_owner: 'dead', lease_expires_at: new Date(0) } });
	await rescuer.recoverStalledJobs();
	assert.equal((await queue.findOne({ _id: failed._id })).status, 'failed');
	const stale = await MongoQueue.add('fence-test', {});
	const staleWorker = new MongoWorker({ queue: 'fence-test', handler: async () => { await queue.updateOne({ _id: stale._id }, { $set: { claim_owner: 'replacement' } }); } });
	await assert.rejects(staleWorker.processJob(stale), /Job claim lost/);
	assert.equal((await queue.findOne({ _id: stale._id })).claim_owner, 'replacement');
	assert.equal((await queue.findOne({ _id: stale._id })).status, 'processing');


	// Pause after the old owner checks its lease, then reclaim before its publication transaction begins.
	const fencedId = new mongoose.Types.ObjectId();
	const artifact = new mongoose.Types.ObjectId();
	await db.collection('publication_fixture').insertOne({ _id: artifact, file_path: 'winner.zip' });
	const publicationJob = await MongoQueue.add('publication-test', {});
	const checked = Promise.withResolvers();
	const resume = Promise.withResolvers();
	const oldPublisher = new MongoWorker({ queue: 'publication-test', stalledThresholdMs: 60000, handler: async ({ assertOwnership, withOwnership }) => {
		await assertOwnership();
		checked.resolve();
		await resume.promise;
		await withOwnership(async (session) => {
			await Note.create([{ _id: fencedId, host_id: hostId, owner, project: new mongoose.Types.ObjectId(), title: 'Stale note' }], { session });
			await db.collection('publication_fixture').updateOne({ _id: artifact }, { $set: { file_path: 'stale.zip' } }, { session });
		});
	} });
	workers.push(oldPublisher);
	const oldPublication = assert.rejects(oldPublisher.processJob(publicationJob), /Job claim lost/);
	await checked.promise;
	await queue.updateOne({ _id: publicationJob._id }, { $set: { lease_expires_at: new Date(0) } });
	const replacement = new MongoWorker({ queue: 'publication-test', handler: async ({ withOwnership }) => withOwnership((session) => db.collection('publication_fixture').updateOne({ _id: artifact }, { $set: { file_path: 'replacement.zip' } }, { session })) });
	await replacement.recoverStalledJobs();
	await replacement.processJob(publicationJob);
	resume.resolve();
	await oldPublication;
	assert.equal(await Note.countDocuments({ _id: fencedId }), 0, 'Stale owner cannot create a note');
	assert.equal((await db.collection('publication_fixture').findOne({ _id: artifact })).file_path, 'replacement.zip', 'Stale owner cannot overwrite the artifact pointer');
	assert.equal((await queue.findOne({ _id: publicationJob._id })).status, 'completed', 'Old failure cannot overwrite the replacement completion');


	const abortedNoteId = new mongoose.Types.ObjectId();
	const abortedJob = await MongoQueue.add('rollback-test', {});
	const abortedPublisher = new MongoWorker({ queue: 'rollback-test', handlerTimeoutMs: 10, handler: async ({ withOwnership }) => withOwnership(async (session) => {
		await Note.create([{ _id: abortedNoteId, host_id: hostId, owner, project: new mongoose.Types.ObjectId(), title: 'Cancelled transaction' }], { session });
		await delay(30);
	}) });
	await assert.rejects(abortedPublisher.processJob(abortedJob), /timed out/);
	assert.equal(await Note.countDocuments({ _id: abortedNoteId }), 0, 'Cancellation rolls back publication before commit');

	// Legacy duplicate rows are handled before the unique admission index is installed.
	const legacy = await Export.collection.insertMany([{ token: randomUUID(), host_id: 'legacy', status: 'pending' }, { token: randomUUID(), host_id: 'legacy', status: 'processing' }]);
	await Export.collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
	assert.equal((await migrateExportIndexes({ apply: true })).duplicate_exports.length, 1);
	assert.equal((await migrateExportIndexes({ apply: true })).ttl_indexes.length, 0);
	assert.equal(await Export.countDocuments({ host_id: 'legacy', status: { $in: ['pending', 'processing'] } }), 1);
	await Export.deleteMany({ host_id: 'legacy' });
	const admission = await Promise.allSettled([startExport(owner, hostId, '', ''), startExport(owner, hostId, '', '')]);
	assert.equal(admission.filter((result) => result.status === 'fulfilled').length, 1);
	assert.match(admission.find((result) => result.status === 'rejected').reason.message, /already in progress/);
	const doc = admission.find((result) => result.status === 'fulfilled').value;
	await Export.updateOne({ _id: doc._id }, { $set: { email_sent_at: new Date() } }); // Never send mail in tests.
	await Note.create({ host_id: hostId, owner, project: new mongoose.Types.ObjectId(), title: 'Archive fixture', content: '<p>hello</p>' });
	const exportWorker = createExportWorker();
	workers.push(exportWorker);
	await exportWorker.processJob(await MongoQueue.getJob(String(doc._id)));
	const ready = await Export.findById(doc._id).read('primary').lean();
	assert.equal(ready.status, 'ready');
	const archive = await fs.readFile(ready.file_path);
	assert.equal(archive.readUInt32LE(0), 0x04034b50);
	assert.ok(archive.includes(Buffer.from('notes.json')));
	assert.ok(archive.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])), 'ZIP has a completed central directory');
	// Simulate a crash after publication but before the queue acknowledgement.
	await Export.updateOne({ _id: doc._id }, { $set: { status: 'processing' } });
	await queue.updateOne({ _id: String(doc._id) }, { $set: { status: 'processing', attempts: 1, claim_owner: 'crashed', lease_expires_at: new Date(0), completed_at: null } });
	await recoverExports();
	await exportWorker.recoverStalledJobs();
	await queue.updateOne({ _id: String(doc._id) }, { $set: { scheduled_at: new Date(0) } });
	assert.equal(await queue.countDocuments({ queue: EXPORT_QUEUE, dedup_key: String(doc._id) }), 1);
	await exportWorker.processJob(await MongoQueue.getJob(String(doc._id)));
	assert.deepEqual(await fs.readFile(ready.file_path), archive, 'Retry reuses the already published immutable archive');
	await Export.updateOne({ _id: doc._id }, { $set: { expires_at: new Date(0) } });
	assert.equal(await cleanupExpiredExports(), 1);
	assert.equal(await Export.countDocuments({ _id: doc._id }), 0);
	await assert.rejects(fs.stat(ready.file_path), { code: 'ENOENT' });
});
