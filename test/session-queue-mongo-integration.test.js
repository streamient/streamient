import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import MongoStore from 'connect-mongo';
import mongoose from '../model/mongoose.js';
import { MongoQueue, MongoWorker } from '../modules/mongo_queue.js';

// Explicit opt-in: run only against the development stack through dbh-run.
test('real MongoDB session touches and multi-worker queue claims', { skip: process.env.STREAMIENT_SESSION_QUEUE_INTEGRATION !== '1', timeout: 20000 }, async (t) => {
	assert.ok(process.env.MONGO_URI, 'Development MONGO_URI is required');
	const client = await MongoClient.connect(process.env.MONGO_URI);
	const dbName = `streamient_session_queue_test_${randomUUID().replaceAll('-', '')}`;
	const db = client.db(dbName);
	const originalDb = mongoose.connection.db;
	const workers = [];
	t.after(async () => { for (const worker of workers) await worker.stop(); mongoose.connection.db = originalDb; await db.dropDatabase(); await client.close(); });
	const stores = [0, 1].map(() => MongoStore.create({ client, dbName, collectionName: 'sessions', ttl: 90 * 86400, touchAfter: 60 }));
	const call = (store, method, ...args) => new Promise((resolve, reject) => store[method](...args, (error, value) => error ? reject(error) : resolve(value)));
	await call(stores[0], 'set', 'test-session', { userId: 'user', memberRole: 'owner', cookie: {} });
	const collection = db.collection('sessions');
	await collection.updateOne({ _id: 'test-session' }, { $set: { lastModified: new Date(Date.now() - 61000) } });
	const stale = await call(stores[1], 'get', 'test-session');
	const expiry = new Date(Date.now() + 92 * 86400000);
	await call(stores[0], 'set', 'test-session', { userId: 'user', memberRole: 'member', cookie: { expires: expiry } });
	stale.cookie.expires = new Date(Date.now() + 60000);
	await Promise.all(stores.map((store) => call(store, 'touch', 'test-session', stale)));
	const row = await collection.findOne({ _id: 'test-session' });
	assert.equal(row.expires.getTime(), expiry.getTime());
	assert.equal(JSON.parse(row.session).memberRole, 'member');
	await call(stores[0], 'destroy', 'test-session');
	await assert.rejects(call(stores[1], 'touch', 'test-session', stale), /Unable to find/);
	assert.equal(await collection.countDocuments(), 0);

	mongoose.connection.db = db;
	const handled = [];
	const allDone = Promise.withResolvers();
	for (let n = 0; n < 6; n++) await MongoQueue.add('integration', { number: n });
	const future = await MongoQueue.add('integration', { number: 100 }, { delay: 60000 });
	for (let n = 0; n < 2; n++) {
		const worker = new MongoWorker({ queue: 'integration', concurrency: 2, handler: async ({ data }) => { handled.push(data.number); if (handled.length === 7) allDone.resolve(); } });
		workers.push(worker);
	}
	await Promise.all(workers.map((worker) => worker.start()));
	await MongoQueue.add('integration', { number: 6 });
	await allDone.promise;
	// Wait for completion writes/refills before dropping the isolated database.
	for (let n = 0; n < 100 && workers.some((worker) => worker.activeCount || worker.sweepPromise); n++) await new Promise((resolve) => setTimeout(resolve, 10));
	assert.deepEqual([...handled].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
	assert.equal((await db.collection('mongo_queue_jobs').findOne({ _id: future._id })).status, 'pending');
	const plan = await db.collection('mongo_queue_jobs').find({ app_instance: 'streamient', queue: 'integration', status: 'pending', scheduled_at: { $lte: new Date() } }).sort({ scheduled_at: 1 }).explain('queryPlanner');
	assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /app_instance_1_queue_1_status_1_scheduled_at_1/);
});
