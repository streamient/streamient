import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NoteImportUpload } from '../model/note_import_upload.js';
import { MongoQueue } from '../modules/mongo_queue.js';
import { completeUpload, recoverNoteImports } from '../services/note_import_service.js';

function fixture(t, initial = {}) {
	const row = { _id: 'upload', host_id: 'host', user: 'user', project: 'project', state: 'uploading', total_bytes: 0, received_bytes: 0, chunks: [], ...initial };
	const jobs = new Map();
	const calls = [];
	let failEnqueue = false;
	const query = (value) => ({ lean: async () => structuredClone(value) });
	t.mock.method(NoteImportUpload, 'findOne', () => query(row));
	t.mock.method(NoteImportUpload, 'find', (filter) => {
		assert.equal(filter.state, 'processing');
		return { lean() { return this; }, async *cursor() { if (row.state === 'processing') yield structuredClone(row); } };
	});
	t.mock.method(NoteImportUpload, 'findOneAndUpdate', (filter, update) => ({ lean: async () => {
		if (filter.state !== row.state) return null;
		const attempt = filter.queue_attempt;
		if (typeof attempt === 'number' ? row.queue_attempt !== attempt : !attempt.$in.includes(row.queue_attempt ?? null)) return null;
		Object.assign(row, update.$set);
		if (update.$inc?.queue_attempt) row.queue_attempt = (row.queue_attempt || 0) + update.$inc.queue_attempt;
		return structuredClone(row);
	} }));
	t.mock.method(MongoQueue, 'add', async (queue, data, options) => {
		calls.push(options);
		assert.equal(queue, 'note-import');
		assert.equal(data.host_id, 'host');
		assert.equal(options.jobId, options.dedupKey);
		assert.equal(options.maxAttempts, 3);
		assert.equal(options.requeueFailed, undefined);
		assert.equal(options.requeueCompleted, undefined);
		if (failEnqueue) throw new Error('Queue unavailable');
		if (!jobs.has(options.jobId)) jobs.set(options.jobId, { status: 'pending', attempts: 0 });
	});
	t.mock.method(MongoQueue, 'getJob', async (id, options) => { assert.equal(options.queue, 'note-import'); return jobs.get(id); });
	return { row, jobs, calls, fail(value) { failEnqueue = value; } };
}

test('completion retry queues the same attempt after insertion failed after state commit', async (t) => {
	const f = fixture(t);
	f.fail(true);
	await assert.rejects(completeUpload('user', 'host', 'upload'), /Queue unavailable/);
	assert.equal(f.row.state, 'processing');
	f.fail(false);
	assert.equal((await completeUpload('user', 'host', 'upload')).state, 'processing');
	assert.equal(f.jobs.size, 1);
	assert.equal(f.calls[0].dedupKey, f.calls[1].dedupKey);
});

test('startup/periodic reconciliation recovers a crash before insertion and concurrent retries deduplicate', async (t) => {
	const f = fixture(t, { state: 'processing' });
	await Promise.all([recoverNoteImports(), recoverNoteImports(), completeUpload('user', 'host', 'upload')]);
	assert.equal(f.jobs.size, 1);
	assert.equal(f.jobs.get('upload').attempts, 0);
});

test('reconciliation propagates enqueue failure and a later pass recovers', async (t) => {
	const f = fixture(t, { state: 'processing', queue_attempt: 2 });
	f.fail(true);
	await assert.rejects(recoverNoteImports(), /Queue unavailable/);
	f.fail(false);
	await recoverNoteImports();
	assert.equal(f.jobs.has('upload:retry:2'), true);
	assert.equal(f.row.queue_attempt, 2);
});

test('recovery preserves an exhausted job and explicit retry persists one new identity', async (t) => {
	const f = fixture(t, { state: 'processing' });
	f.jobs.set('upload', { status: 'failed', attempts: 3 });
	await recoverNoteImports();
	assert.equal(f.row.state, 'failed');
	assert.equal(f.jobs.get('upload').attempts, 3);
	f.fail(true);
	await assert.rejects(completeUpload('user', 'host', 'upload'), /Queue unavailable/);
	assert.equal(f.row.queue_attempt, 1);
	f.fail(false);
	await Promise.all([completeUpload('user', 'host', 'upload'), recoverNoteImports()]);
	assert.equal(f.jobs.size, 2);
	assert.equal(f.jobs.has('upload:retry:1'), true);
	assert.equal(f.jobs.get('upload').attempts, 3);
	assert.equal(f.row.queue_attempt, 1);
});

test('concurrent explicit retries claim only one generation', async (t) => {
	const f = fixture(t, { state: 'failed', queue_attempt: 3 });
	await Promise.all([completeUpload('user', 'host', 'upload'), completeUpload('user', 'host', 'upload')]);
	assert.equal(f.row.queue_attempt, 4);
	assert.equal(f.jobs.size, 1);
	assert.equal(f.jobs.has('upload:retry:4'), true);
});

test('completed imports do not enqueue again', async (t) => {
	const f = fixture(t, { state: 'complete' });
	await completeUpload('user', 'host', 'upload');
	await recoverNoteImports();
	assert.equal(f.calls.length, 0);
});

test('an old reconciliation snapshot cannot fail a newer explicit retry', async (t) => {
	const f = fixture(t, { state: 'processing', queue_attempt: 1 });
	f.jobs.set('upload:retry:1', { status: 'failed', attempts: 3 });
	t.mock.method(MongoQueue, 'getJob', async () => {
		f.row.queue_attempt = 2;
		return { status: 'failed', attempts: 3 };
	});
	await recoverNoteImports();
	assert.equal(f.row.state, 'processing');
	assert.equal(f.row.queue_attempt, 2);
});
