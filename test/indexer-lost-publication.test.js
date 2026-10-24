import { test } from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';
import { getCache } from '../modules/cache.js';
import { mockTenantWork } from './helpers/tenant-work.js';

function pausePoint() {
	let doRelease;
	const held = new Promise((resolve) => { doRelease = resolve; });
	let doArrive;
	const arrivedP = new Promise((resolve) => { doArrive = resolve; });
	return { held, arrivedP, arrived: () => doArrive(), release: () => doRelease() };
}

// A stateful model mock that reproduces the scheduler's three document writes:
// claim (index_claim=token, before), mark (is_indexed=true), requeue
// (is_indexed=false). Each op is conditional on host_id/_id/updatedAt/index_claim.
function makeModel(state, { gateRead = false, gateClaim = false, gateMark = false } = {}) {
	const readGate = gateRead ? pausePoint() : null;
	const claimGate = gateClaim ? pausePoint() : null;
	const markGate = gateMark ? pausePoint() : null;
	let reads = 0;
	let claims = 0;
	let marks = 0;
	const model = {
		aggregate: async () => (state.exists && state.is_indexed !== true ? [{ _id: state.host_id }] : []),
		find() {
			const q = {
				sort: () => q,
				limit: () => q,
				lean: async () => {
					// Capture the snapshot before gating so a held read still sees the
					// version that existed when it started, not the edited version.
					const snapshot = {
						_id: state._id,
						host_id: state.host_id,
						project: state.project,
						title: state.title,
						text_content: state.text_content,
						tags: state.tags || [],
						updatedAt: state.updatedAt,
						is_indexed: state.is_indexed,
						index_claim: state.index_claim,
					};
					if (readGate && ++reads === 1) { readGate.arrived(); await readGate.held; }
					return [snapshot];
				},
			};
			return q;
		},
		findOneAndUpdate(filter, update, options) {
			return {
				select() { return this; },
				lean: async () => {
					const set = update?.$set || {};
					const isClaim = 'index_claim' in set;
					const isMark = set.is_indexed === true;
					const isRequeue = set.is_indexed === false;
					const versionMatches = filter.updatedAt
						? (filter.updatedAt.$exists === false ? state.updatedAt == null : state.updatedAt && filter.updatedAt.getTime() === state.updatedAt.getTime())
						: true;
					const claimMatches = filter.index_claim !== undefined ? filter.index_claim === state.index_claim : true;
					const matches = state.exists && filter.host_id === state.host_id && String(filter._id) === state._id && versionMatches && claimMatches;

					if (isClaim) {
						if (claimGate && ++claims === 1) { claimGate.arrived(); await claimGate.held; }
						if (!matches) return null;
						const before = { _id: state._id, index_claim: state.index_claim };
						state.index_claim = set.index_claim;
						return options?.returnDocument === 'before' ? before : { _id: state._id, index_claim: state.index_claim };
					}
					if (isMark) {
						if (markGate && ++marks === 1) { markGate.arrived(); await markGate.held; }
						if (!matches) return null;
						state.is_indexed = true;
						return { _id: state._id };
					}
					if (isRequeue) {
						if (!matches) return null;
						state.is_indexed = false;
						return { _id: state._id };
					}
					return null;
				},
			};
		},
	};
	return { model, readGate, claimGate, markGate };
}

// Typesense store that actually removes chunks on delete so a claim-scoped
// cleanup can be proven not to touch a newer publisher's chunks.
function fakeTypesense(store) {
	const original = Typesense.Client;
	Typesense.Client = class {
		collections() {
			return {
				retrieve: async () => ({ fields: [] }),
				update: async () => ({}),
				documents: () => ({
					delete: async ({ filter_by }) => {
						store.deletes.push(filter_by);
						const claimMatch = filter_by.match(/claim:=`([^`]*)`/);
						if (claimMatch) {
							for (const [id, chunk] of [...store.chunks]) {
								if (chunk.claim === claimMatch[1]) store.chunks.delete(id);
							}
						} else {
							store.chunks.clear();
						}
						return { num_deleted: 1 };
					},
					import: async (docs) => {
						for (const doc of docs) store.chunks.set(doc.id, { claim: doc.claim, project_id: doc.project_id });
						return docs.map(() => ({ success: true }));
					},
				}),
			};
		}
	};
	return () => { Typesense.Client = original; };
}

function baseState() {
	return { _id: '507f1f77bcf86cd799439011', host_id: 'audit-index', project: 'old', title: 'Record', text_content: 'Test', tags: [], exists: true, updatedAt: new Date(1000), is_indexed: false, index_claim: null };
}

function storeProject(store) {
	return [...store.chunks.values()].map((chunk) => chunk.project_id).filter((value, index, all) => all.indexOf(value) === index);
}

test('a stale worker that read an old version cannot remove or unmark a newer publication', async () => {
	const restore = mockTenantWork();
	const cache = getCache();
	const originalGet = cache.get;
	const originalSet = cache.set;
	cache.get = async () => null;
	cache.set = async () => {};
	const state = baseState();
	const store = { chunks: new Map(), deletes: [] };
	const restoreClient = fakeTypesense(store);
	const { model, readGate } = makeModel(state, { gateRead: true });
	const { runStreamientIndexer } = await import(`../modules/typesense.js?fence-a-after-b=${Date.now()}`);
	try {
		// A reads v1 and pauses.
		const stale = runStreamientIndexer({ Note: model });
		await readGate.arrivedP;
		// Content edited -> v2; B publishes v2 fully.
		state.project = 'new';
		state.updatedAt = new Date(2000);
		assert.equal(await runStreamientIndexer({ Note: model }), 1);
		assert.equal(state.is_indexed, true);
		const bClaim = state.index_claim;
		assert.ok(store.chunks.size > 0);
		// A resumes: its v1 claim fails, so it must not touch B's chunks or state.
		readGate.release();
		await stale;
		assert.equal(state.is_indexed, true);
		assert.equal(state.index_claim, bClaim);
		assert.equal(state.project, 'new');
		assert.deepEqual(storeProject(store), ['new']);
		// No blind (claim-less) removal ever ran.
		assert.ok(store.deletes.every((filter) => /claim:=`/.test(filter)));
	} finally {
		cache.get = originalGet;
		cache.set = originalSet;
		restoreClient();
		restore();
	}
});

test('a stale worker cannot delete the chunks a fresh worker imported before marking', async () => {
	const restore = mockTenantWork();
	const cache = getCache();
	const originalGet = cache.get;
	const originalSet = cache.set;
	cache.get = async () => null;
	cache.set = async () => {};
	const state = baseState();
	const store = { chunks: new Map(), deletes: [] };
	const restoreClient = fakeTypesense(store);
	const { model, readGate, markGate } = makeModel(state, { gateRead: true, gateMark: true });
	const { runStreamientIndexer } = await import(`../modules/typesense.js?fence-pending-mark=${Date.now()}`);
	try {
		// A reads v1 and pauses.
		const stale = runStreamientIndexer({ Note: model });
		await readGate.arrivedP;
		// Edit -> v2. B imports v2 then pauses before its mark.
		state.project = 'new';
		state.updatedAt = new Date(2000);
		const fresh = runStreamientIndexer({ Note: model });
		await markGate.arrivedP;
		// B has published v2 chunks.
		assert.equal(storeProject(store)[0], 'new');
		// A resumes: its v1 claim fails, so it removes nothing.
		readGate.release();
		await stale;
		// B's chunks are intact; B marks successfully.
		assert.equal(storeProject(store)[0], 'new');
		markGate.release();
		await fresh;
		assert.equal(state.is_indexed, true);
		assert.ok(state.index_claim);
		assert.equal(storeProject(store)[0], 'new');
	} finally {
		cache.get = originalGet;
		cache.set = originalSet;
		restoreClient();
		restore();
	}
});

test('a delayed stale cleanup only removes its own claim, never a newer publisher', async () => {
	const restore = mockTenantWork();
	const cache = getCache();
	const originalGet = cache.get;
	const originalSet = cache.set;
	cache.get = async () => null;
	cache.set = async () => {};
	const state = baseState();
	const store = { chunks: new Map(), deletes: [] };
	const restoreClient = fakeTypesense(store);
	const { model, markGate } = makeModel(state, { gateMark: true });
	const { runStreamientIndexer } = await import(`../modules/typesense.js?fence-delayed-cleanup=${Date.now()}`);
	try {
		// A claims + imports v1, then pauses before marking.
		const stale = runStreamientIndexer({ Note: model });
		await markGate.arrivedP;
		const aClaim = state.index_claim;
		assert.ok(aClaim);
		// B publishes v2 (removing A's v1 chunks) and marks.
		state.project = 'new';
		state.updatedAt = new Date(2000);
		state.is_indexed = false;
		assert.equal(await runStreamientIndexer({ Note: model }), 1);
		// C publishes v3 (removing B's v2 chunks) and marks.
		state.project = 'newest';
		state.updatedAt = new Date(3000);
		state.is_indexed = false;
		assert.equal(await runStreamientIndexer({ Note: model }), 1);
		// A resumes: mark fails, cleanup is scoped to A's claim only.
		markGate.release();
		await stale;
		assert.equal(state.is_indexed, true);
		assert.equal(state.project, 'newest');
		assert.deepEqual(storeProject(store), ['newest']);
		// A's cleanup targeted its own claim, not the newest publisher's.
		const aCleanup = store.deletes.find((filter) => filter.includes(aClaim));
		assert.ok(aCleanup, 'A cleaned up only its own claim');
		assert.ok(!store.deletes.some((filter) => filter.includes('newest')));
	} finally {
		cache.get = originalGet;
		cache.set = originalSet;
		restoreClient();
		restore();
	}
});

test('a pending stale indexer cannot resurrect a deleted row', async () => {
	const restore = mockTenantWork();
	const cache = getCache();
	const originalGet = cache.get;
	const originalSet = cache.set;
	cache.get = async () => null;
	cache.set = async () => {};
	const state = baseState();
	const store = { chunks: new Map(), deletes: [] };
	const restoreClient = fakeTypesense(store);
	const { model, readGate } = makeModel(state, { gateRead: true });
	const { runStreamientIndexer } = await import(`../modules/typesense.js?fence-delete=${Date.now()}`);
	try {
		const stale = runStreamientIndexer({ Note: model });
		await readGate.arrivedP;
		state.exists = false;
		readGate.release();
		await stale;
		assert.equal(store.chunks.size, 0);
		assert.equal(state.exists, false);
		assert.equal(await runStreamientIndexer({ Note: model }), 0);
	} finally {
		cache.get = originalGet;
		cache.set = originalSet;
		restoreClient();
		restore();
	}
});

test('unsynchronized overlap (coordinator unavailable) still converges with claim fencing', async () => {
	const restore = mockTenantWork();
	const cache = getCache();
	const originalGet = cache.get;
	const originalSet = cache.set;
	cache.get = async () => null;
	cache.set = async () => {};
	const state = baseState();
	const store = { chunks: new Map(), deletes: [] };
	const restoreClient = fakeTypesense(store);
	// Two gated models so two workers interleave without a host lock. In the
	// test harness the Mongo coordinator is absent, so every run is
	// unsynchronized — the same path a TTL-expired or failed lock would take.
	const a = makeModel(state, { gateRead: true });
	const b = makeModel(state, {});
	const { runStreamientIndexer } = await import(`../modules/typesense.js?fence-no-lock=${Date.now()}`);
	try {
		const stale = runStreamientIndexer({ Note: a.model });
		await a.readGate.arrivedP;
		state.project = 'new';
		state.updatedAt = new Date(2000);
		assert.equal(await runStreamientIndexer({ Note: b.model }), 1);
		a.readGate.release();
		await stale;
		assert.equal(state.is_indexed, true);
		assert.deepEqual(storeProject(store), ['new']);
	} finally {
		cache.get = originalGet;
		cache.set = originalSet;
		restoreClient();
		restore();
	}
});