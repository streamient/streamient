import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from '../model/mongoose.js';
import { maintainGitSyncLock } from '../services/git_sync_service.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(t) {
	t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: 1000 });
	const lock = { key: 'git-sync:repo', token: 'owner-a', expiresAt: new Date(1100) };
	const updates = [];
	let owner = lock.token;
	let released = false;
	const coordinator = {
		namespace: 'test',
		collection: { updateOne: async (filter, update, options) => {
			updates.push({ filter, update, options });
			return { matchedCount: filter.token === owner ? 1 : 0 };
		} },
		releaseLock: async (value) => { released = value.token === owner; },
	};
	const lease = maintainGitSyncLock(lock, { coordinator, ttlMs: 100, heartbeatMs: 20 });
	t.after(() => lease.close());
	return { lease, lock, updates, coordinator, replace: () => { owner = 'owner-b'; }, released: () => released };
}

test('renews a long-running lease and aborts permanently when ownership changes', async (t) => {
	const state = fixture(t);
	for (let i = 0; i < 10; i++) { t.mock.timers.tick(20); await flush(); }
	assert.equal(state.lease.signal.aborted, false);
	assert.equal(state.lock.expiresAt.getTime(), 1300);
	assert.equal(state.updates.length, 10);
	state.replace();
	t.mock.timers.tick(20);
	await flush();
	assert.equal(state.lease.signal.aborted, true);
	assert.throws(state.lease.assert, /lease lost/);
	await state.lease.close();
	assert.equal(state.released(), false);
});

test('a hung renewal cannot outlive its last confirmed deadline', async (t) => {
	const state = fixture(t);
	let finish;
	state.coordinator.collection.updateOne = () => new Promise((resolve) => { finish = resolve; });
	t.mock.timers.tick(20);
	t.mock.timers.tick(81);
	assert.equal(state.lease.signal.aborted, true);
	finish({ matchedCount: 1 });
	await flush();
	assert.equal(state.lock.expiresAt.getTime(), 1100);
	assert.throws(state.lease.assert, /lease lost/);
});

test('each database mutation fences ownership in the same transaction, and refuses lost leases', async (t) => {
	const state = fixture(t);
	const transaction = mongoose.connection.transaction;
	t.after(() => { mongoose.connection.transaction = transaction; });
	mongoose.connection.transaction = (callback) => callback('write-session');
	let writes = 0;
	await state.lease.write(async (session) => { assert.equal(session, 'write-session'); writes++; });
	assert.equal(state.updates[0].options.session, 'write-session');
	assert.equal(state.updates[0].filter.token, 'owner-a');
	assert.deepEqual(state.updates[0].filter.expires_at, { $gt: new Date(1000) });
	state.replace();
	await assert.rejects(state.lease.write(async () => { writes++; }), /lease lost/);
	assert.equal(writes, 1);
});
