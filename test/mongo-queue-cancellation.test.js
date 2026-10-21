import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from '../model/mongoose.js';
import { MongoWorker } from '../modules/mongo_queue.js';

function fakeQueue(t) {
	const original = mongoose.connection.db;
	const row = { _id: 'job', status: 'pending', data: {}, attempts: 0, max_attempts: 2 };
	const updates = [];
	const matches = (filter) => row._id === filter._id && row.status === filter.status && (!filter.claim_owner || row.claim_owner === filter.claim_owner);
	mongoose.connection.db = { collection: () => ({
		findOneAndUpdate: async (filter, update) => { if (!matches(filter)) return null; Object.assign(row, update.$set); row.attempts++; return { ...row }; },
		findOne: async (filter) => matches(filter) ? { ...row } : null,
		updateOne: async (filter, update) => { updates.push({ filter, update }); if (!matches(filter)) return { matchedCount: 0 }; Object.assign(row, update.$set); for (const key of Object.keys(update.$unset || {})) delete row[key]; return { matchedCount: 1 }; },
	}) };
	t.after(() => { mongoose.connection.db = original; });
	return { row, updates };
}

test('timeout retains concurrency until the actual handler settles and never publishes late success', async (t) => {
	const { row, updates } = fakeQueue(t);
	const settled = Promise.withResolvers();
	let signal;
	let calls = 0;
	const worker = new MongoWorker({ queue: 'timeout', handlerTimeoutMs: 10, handler: async (job) => { signal = job.signal; calls++; await settled.promise; } });
	const running = assert.rejects(worker.processJob(row), /timed out/);
	await delay(30);
	assert.equal(signal.aborted, true);
	assert.equal(worker.activeCount, 1);
	assert.equal(row.status, 'processing');
	await worker.processJob(row);
	assert.equal(calls, 1);
	assert.equal(updates.some(({ update }) => update.$set.status === 'pending'), false);
	settled.resolve();
	await running;
	assert.equal(worker.activeCount, 0);
	assert.equal(row.status, 'pending');
	assert.equal(updates.some(({ update }) => update.$set.status === 'completed'), false);
});

test('stale claimant cannot overwrite a newer owner and shutdown awaits cancellation', async (t) => {
	const { row } = fakeQueue(t);
	const settled = Promise.withResolvers();
	const entered = Promise.withResolvers();
	let signal;
	const worker = new MongoWorker({ queue: 'timeout', handler: async (job) => { signal = job.signal; entered.resolve(); await settled.promise; } });
	const running = assert.rejects(worker.processJob(row), /Worker stopped/);
	await entered.promise;
	row.claim_owner = 'new-owner';
	let stopped = false;
	const stopping = worker.stop().then(() => { stopped = true; });
	await delay(10);
	assert.equal(signal.aborted, true);
	assert.equal(stopped, false);
	settled.resolve();
	await Promise.all([running, stopping]);
	assert.equal(row.claim_owner, 'new-owner');
	assert.equal(row.status, 'processing');
});
