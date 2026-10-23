import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from '../model/mongoose.js';
import { MongoQueue, MongoWorker, resolveJobHost } from '../modules/mongo_queue.js';
import { mockTenantWork } from './helpers/tenant-work.js';

test('enqueue and execution validate a tenant through writes despite an empty replica', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const original = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
	let row;
	let validations = 0;
	const queue = {
		createIndex: async () => {},
		insertOne: async (doc) => { row = { ...doc }; return { insertedId: doc._id }; },
		findOneAndUpdate: async (_filter, update) => { Object.assign(row, update.$set); return { ...row }; },
		updateOne: async (_filter, update) => { Object.assign(row, update.$set); return { matchedCount: 1 }; },
		deleteOne: async () => assert.fail('a valid job must not be deleted'),
	};
	const tenants = { findOne: async () => null, findOneAndUpdate: async (_filter, update) => { assert.equal(update.$set.is_active, true); validations++; return { _id: 'tenant' }; } };
	Object.defineProperty(mongoose.connection, 'db', { configurable: true, value: { collection: (name) => name === 'tenants' ? tenants : queue } });
	t.after(() => original ? Object.defineProperty(mongoose.connection, 'db', original) : delete mongoose.connection.db);
	let handled = false;
	const worker = new MongoWorker({ queue: 'replica', handler: async () => { handled = true; } });
	t.after(() => worker.stop());
	const job = await MongoQueue.add('replica', { host_id: 'active' }, { jobId: 'replica-job' });
	await worker.processJob(job);
	assert.equal(handled, true);
	assert.equal(row.status, 'completed');
	assert.equal(validations, 2);
});

test('job references return the acknowledged host without a replica lookup', async () => {
	const host = await resolveJobHost({ upload_id: '507f1f77bcf86cd799439011' }, { db: { collection: () => ({ findOne: async () => null, findOneAndUpdate: async () => ({ host_id: 'new-host' }) }) } });
	assert.equal(host, 'new-host');
});
