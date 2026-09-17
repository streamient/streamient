import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import mongoose from '../model/mongoose.js';
import { MongoWorker } from '../modules/mongo_queue.js';

function setup(t, collection, options = {}) {
	const original = mongoose.connection.db;
	mongoose.connection.db = { collection: () => collection };
	const worker = new MongoWorker({ queue: 'poll-test', appInstance: 'test', handler: async () => {}, ...options });
	worker.running = true;
	t.after(async () => { await worker.stop(); mongoose.connection.db = original; });
	return worker;
}

function cursor(toArray) {
	return { sort(value) { assert.deepEqual(value, { scheduled_at: 1 }); return this; }, limit(value) { assert.ok(value > 0); return this; }, toArray };
}

test('overlapping sweep triggers coalesce into one prompt follow-up', async (t) => {
	let count = 0;
	const pending = Promise.withResolvers();
	const worker = setup(t, { find: (filter, options) => {
		assert.equal(filter.app_instance, 'test');
		assert.equal(filter.queue, 'poll-test');
		assert.equal(filter.status, 'pending');
		assert.ok(filter.scheduled_at.$lte instanceof Date);
		assert.equal(options.maxTimeMS, 10000);
		count++;
		return cursor(() => count === 1 ? pending.promise : Promise.resolve([]));
	} });
	const calls = [worker.sweepPendingJobs(), worker.sweepPendingJobs(), worker.sweepPendingJobs()];
	assert.equal(count, 1);
	pending.resolve([]);
	await Promise.all(calls);
	assert.equal(count, 2);
	assert.equal(worker.sweepPromise, null);
});

test('claim reservations enforce concurrency before database responses; lost/error claims release slots', async (t) => {
	const pending = Promise.withResolvers();
	let claims = 0;
	const worker = setup(t, { findOneAndUpdate: async () => { claims++; return pending.promise; } });
	const first = worker.processJob({ _id: 'one' });
	await worker.processJob({ _id: 'two' });
	assert.equal(claims, 1);
	assert.equal(worker.activeCount, 1);
	await worker.stop();
	pending.resolve(null);
	await first;
	assert.equal(worker.activeCount, 0);
	mongoose.connection.db.collection = () => ({ findOneAndUpdate: async () => { throw new Error('database unavailable'); } });
	await assert.rejects(worker.processJob({ _id: 'one' }), /database unavailable/);
	assert.equal(worker.activeCount, 0);
	assert.ok(worker.sweepRetryAt > Date.now());
});

test('backlog drains promptly in scheduled order, future jobs wait, retries retain delay', async (t) => {
	const now = Date.now();
	const jobs = [0, 1, 2, 3].map((n) => ({ _id: String(n), status: 'pending', scheduled_at: new Date(now - 1000 + n), data: {}, attempts: 0, max_attempts: 3 }));
	jobs.push({ _id: 'future', status: 'pending', scheduled_at: new Date(now + 60000), data: {}, attempts: 0, max_attempts: 3 });
	const handled = [];
	let live = 0;
	let peak = 0;
	const worker = setup(t, {
		find: (filter) => {
			const result = cursor(async () => jobs.filter((job) => job.status === 'pending' && job.scheduled_at <= filter.scheduled_at.$lte).sort((a, b) => a.scheduled_at - b.scheduled_at).slice(0, result.size));
			result.limit = (n) => { result.size = n; return result; };
			return result;
		},
		findOneAndUpdate: async (filter) => {
			await turn();
			const job = jobs.find((job) => job._id === filter._id && job.status === 'pending' && job.scheduled_at <= filter.scheduled_at.$lte);
			if (!job) return null;
			job.status = 'processing'; job.attempts++;
			return { ...job };
		},
		updateOne: async (filter, update) => { Object.assign(jobs.find((job) => job._id === filter._id), update.$set); },
	}, { concurrency: 2, retryDelayMs: 60000, handler: async (job) => {
		live++; peak = Math.max(peak, live); handled.push(job.id);
		await turn(); live--;
		if (job.id === '2') throw new Error('retry later');
	} });
	await worker.sweepPendingJobs();
	for (let n = 0; n < 30 && (handled.length < 4 || worker.activeCount); n++) await turn();
	assert.deepEqual(handled, ['0', '1', '2', '3']);
	assert.equal(peak, 2);
	assert.equal(worker.activeCount, 0);
	assert.equal(jobs[2].status, 'pending');
	assert.ok(jobs[2].scheduled_at.getTime() >= now + 60000);
	assert.equal(jobs[4].attempts, 0);
	jobs[4].scheduled_at = new Date(now - 1);
	await worker.sweepPendingJobs();
	for (let n = 0; n < 10 && worker.activeCount; n++) await turn();
	assert.equal(jobs[4].status, 'completed');
});

test('sweep failures back off and can resume; stopped pending sweeps never claim', async (t) => {
	let count = 0;
	let fail = true;
	let claims = 0;
	const pending = Promise.withResolvers();
	const worker = setup(t, { find: () => cursor(async () => { count++; if (fail) throw new Error('query deadline'); return pending.promise; }), findOneAndUpdate: async () => { claims++; } });
	await assert.rejects(worker.sweepPendingJobs(), /query deadline/);
	await Promise.all([worker.sweepPendingJobs(), worker.sweepPendingJobs()]);
	assert.equal(count, 1);
	worker.sweepRetryAt = 0;
	fail = false;
	const sweep = worker.sweepPendingJobs();
	await worker.stop();
	pending.resolve([{ _id: 'late' }]);
	await sweep;
	worker.tryProcess({ _id: 'late-event' });
	worker.openChangeStream();
	assert.equal(claims, 0);
	assert.equal(count, 2);
});

test('stalled recovery never overlaps and releases its guard after failure', async (t) => {
	let count = 0;
	const pending = Promise.withResolvers();
	const worker = setup(t, { updateMany: async () => { count++; if (count === 1) return pending.promise; return { modifiedCount: 0 }; } });
	const calls = [worker.recoverStalledJobs(), worker.recoverStalledJobs()];
	assert.equal(count, 1);
	pending.reject(new Error('recovery failed'));
	for (const result of await Promise.allSettled(calls)) assert.equal(result.status, 'rejected');
	await worker.recoverStalledJobs();
	assert.equal(count, 2);
});
