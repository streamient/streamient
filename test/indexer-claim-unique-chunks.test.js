import { test } from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';
import { getCache } from '../modules/cache.js';
import { mockTenantWork } from './helpers/tenant-work.js';
import { toTypesenseDocs } from '../modules/typesense.js';

function pausePoint() {
	let doRelease;
	const held = new Promise((resolve) => { doRelease = resolve; });
	let doArrive;
	const arrivedP = new Promise((resolve) => { doArrive = resolve; });
	return { held, arrivedP, arrived: () => doArrive(), release: () => doRelease() };
}

// A stateful model mock reproducing the scheduler's three document writes
// (claim, mark, requeue), each conditional on host/_id/updatedAt/index_claim.
function makeModel(state) {
	const model = {
		aggregate: async () => (state.exists && state.is_indexed !== true ? [{ _id: state.host_id }] : []),
		find() {
			const q = {
				sort: () => q,
				limit: () => q,
				lean: async () => [{
					_id: state._id,
					host_id: state.host_id,
					project: state.project,
					title: state.title,
					text_content: state.text_content,
					tags: state.tags || [],
					updatedAt: state.updatedAt,
					is_indexed: state.is_indexed,
					index_claim: state.index_claim,
				}],
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
						if (!matches) return null;
						const before = { _id: state._id, index_claim: state.index_claim };
						state.index_claim = set.index_claim;
						return options?.returnDocument === 'before' ? before : { _id: state._id, index_claim: state.index_claim };
					}
					if (isMark) {
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
	return model;
}

// A Typesense store that actually keeps chunks by their real IDs, so a
// deterministic-ID overwrite is observable. Deletes honour claim:= and id:=[...]
// filters; a claim-less source_id delete would clear everything (the blind
// removal that must never run here).
function fakeTypesense(store, { importGate = null, searchGate = null } = {}) {
	const original = Typesense.Client;
	Typesense.Client = class {
		collections() {
			return {
				retrieve: async () => ({ fields: [] }),
				update: async () => ({}),
				create: async () => ({}),
				documents: () => ({
					delete: async ({ filter_by }) => {
						store.deletes.push(filter_by);
						const claim = (String(filter_by).match(/claim:=`([^`]*)`/) || [])[1];
						const idsMatch = String(filter_by).match(/id:=\[([^\]]*)\]/);
						if (claim) {
							for (const [id, chunk] of [...store.chunks]) if (chunk.claim === claim) store.chunks.delete(id);
						} else if (idsMatch) {
							const ids = idsMatch[1].split(',').map((value) => value.replace(/^`|`$/g, ''));
							for (const id of ids) store.chunks.delete(id);
						} else {
							store.chunks.clear();
						}
						return { num_deleted: 1 };
					},
					import: async (docs) => {
						if (importGate && ++store.imports === 1) { importGate.arrived(); await importGate.held; }
						for (const doc of docs) store.chunks.set(doc.id, { ...doc });
						return docs.map(() => ({ success: true }));
					},
					search: async ({ filter_by, page = 1, per_page = 250 }) => {
						if (searchGate && ++store.searches === 1) { searchGate.arrived(); await searchGate.held; }
						const sourceId = (String(filter_by).match(/source_id:=`([^`]*)`/) || [])[1];
						const all = [...store.chunks.values()].filter((chunk) => !sourceId || chunk.source_id === sourceId);
						const slice = all.slice((page - 1) * per_page, page * per_page);
						return { found: all.length, hits: slice.map((chunk) => ({ document: { id: chunk.id, claim: chunk.claim || '' } })) };
					},
				}),
			};
		}
	};
	return () => { Typesense.Client = original; };
}

function baseState() {
	return { _id: '507f1f77bcf86cd799439011', host_id: 'claim-unique', project: 'old', title: 'Record', text_content: 'Test body', tags: [], exists: true, updatedAt: new Date(1000), is_indexed: false, index_claim: null };
}

function storeChunkClaims(store) {
	return [...store.chunks.values()].map((chunk) => chunk.claim).filter(Boolean);
}

function mockCache() {
	const cache = getCache();
	const originalGet = cache.get;
	const originalSet = cache.set;
	cache.get = async () => null;
	cache.set = async () => {};
	return () => { cache.get = originalGet; cache.set = originalSet; };
}

test('chunkTypesenseDocs generates claim-unique chunk IDs while preserving source_id', () => {
	const token = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
	const text = Array.from({ length: 6200 }, (_, i) => String(i % 10)).join('');
	const docs = toTypesenseDocs('notes', {
		_id: 'note-1',
		title: 'Large note',
		text_content: text,
		project: 'project-1',
		createdAt: new Date('2026-01-01T00:00:00Z'),
		updatedAt: new Date('2026-01-02T00:00:00Z'),
	}, token);

	assert.equal(docs.length, 3);
	assert.deepEqual(docs.map((doc) => doc.id), [`note-1_${token}`, `note-1_${token}_chunk_1`, `note-1_${token}_chunk_2`]);
	assert.ok(docs.every((doc) => doc.source_id === 'note-1'));
	assert.ok(docs.every((doc) => doc.claim === token));

	// Without a claim token, IDs stay deterministic (legacy / crawler pages).
	const legacy = toTypesenseDocs('notes', { _id: 'note-2', title: 'Legacy', text_content: 'small', project: 'p' });
	assert.equal(legacy[0].id, 'note-2');
	assert.equal(legacy[0].claim, undefined);
});

test('a worker stalled inside import cannot overwrite a newer publisher that already completed', async () => {
	const restore = mockTenantWork();
	const restoreCache = mockCache();
	const state = baseState();
	const store = { chunks: new Map(), deletes: [], imports: 0, searches: 0 };
	const importGate = pausePoint();
	const restoreClient = fakeTypesense(store, { importGate });
	const model = makeModel(state);
	const { runStreamientIndexer } = await import(`../modules/typesense.js?claim-unique-after-b=${Date.now()}`);
	try {
		// A claims v1 and stalls inside its import.
		const stale = runStreamientIndexer({ Note: model });
		await importGate.arrivedP;
		assert.ok(state.index_claim, 'A claimed a token');

		// B edits -> v2, publishes and marks complete.
		state.project = 'new';
		state.updatedAt = new Date(2000);
		state.is_indexed = false;
		assert.equal(await runStreamientIndexer({ Note: model }), 1);
		const bClaim = state.index_claim;
		assert.ok(store.chunks.size > 0, 'B published chunks');
		assert.deepEqual(storeChunkClaims(store), [bClaim]);

		// A resumes its late import with claim-unique IDs, so it must not clobber
		// B's chunks; its mark then fails and it removes only its own T1 chunks.
		importGate.release();
		await stale;

		assert.equal(state.is_indexed, true);
		assert.equal(state.index_claim, bClaim);
		assert.ok(store.chunks.size > 0, 'B chunks survive A late import');
		assert.deepEqual(storeChunkClaims(store), [bClaim], 'only B claim chunks remain');
	} finally {
		restoreClient();
		restoreCache();
		restore();
	}
});

test('a delayed legacy cleanup only deletes enumerated claim-less IDs, never a newer publisher', async () => {
	const restore = mockTenantWork();
	const restoreCache = mockCache();
	const state = baseState();
	const store = { chunks: new Map(), deletes: [], imports: 0, searches: 0 };
	// Seed pre-claim deterministic chunks (no claim field).
	store.chunks.set(state._id, { id: state._id, source_id: state._id, claim: '', text_content: 'legacy' });
	store.chunks.set(`${state._id}_chunk_1`, { id: `${state._id}_chunk_1`, source_id: state._id, claim: '', text_content: 'legacy 2' });
	const searchGate = pausePoint();
	const restoreClient = fakeTypesense(store, { searchGate });
	const model = makeModel(state);
	const { runStreamientIndexer } = await import(`../modules/typesense.js?claim-unique-legacy=${Date.now()}`);
	try {
		// A first-claims (prev claim null) and pauses inside the legacy enumeration.
		const stale = runStreamientIndexer({ Note: model });
		await searchGate.arrivedP;

		// B displaces A, publishes claim-unique chunks, and marks complete.
		state.project = 'new';
		state.updatedAt = new Date(2000);
		state.is_indexed = false;
		assert.equal(await runStreamientIndexer({ Note: model }), 1);
		const bClaim = state.index_claim;

		// A resumes: enumerates claim-less IDs and deletes only those, leaving B's
		// claim-stamped chunks intact.
		searchGate.release();
		await stale;

		assert.equal(state.is_indexed, true);
		assert.equal(state.index_claim, bClaim);
		assert.ok(store.chunks.size > 0, 'B chunks survive delayed legacy cleanup');
		assert.deepEqual(storeChunkClaims(store), [bClaim], 'legacy chunks removed, B chunks intact');
		// The legacy removal was by exact IDs, never a blind source_id delete.
		assert.ok(store.deletes.some((filter) => /id:=\[/.test(filter)), 'legacy cleanup deleted by exact ids');
		assert.ok(store.deletes.every((filter) => /claim:=`|id:=\[/.test(filter)), 'no blind source_id deletion ran');
	} finally {
		restoreClient();
		restoreCache();
		restore();
	}
});