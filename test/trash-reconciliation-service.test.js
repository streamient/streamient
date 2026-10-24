import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { reconcileActiveTrashTenants, reconcileTrashForTenant } from '../services/trash_reconciliation_service.js';

function fakeModel(docs, observations) {
	return {
		findOneAndUpdate: (query) => ({ lean: async () => docs.find((doc) => doc.host_id === query.host_id && String(doc._id) === String(query._id)) || null }),
		find: (query) => {
			observations.queries.push(query);
			const chain = {
				read: (preference) => {
					observations.reads.push(preference);
					return chain;
				},
				lean: async () => {
					observations.leans++;
					if (query._id?.$in) {
						const ids = new Set(query._id.$in.map(String));
						return docs.filter((doc) => doc.host_id === query.host_id && ids.has(String(doc._id)));
					}
					return docs.filter((doc) => doc.host_id === query.host_id && doc.in_trash === true);
				},
			};
			return chain;
		},
		updateMany: async (query, update, options) => observations.updates.push({ query, update, options }),
	};
}

describe('trash reconciliation service', () => {
	it('classifies orphans, stale state, missing anchors, valid trash, and tenant isolation', async () => {
		const trashedAt = new Date('2026-01-01T00:00:00.000Z');
		const trashedSeconds = Math.floor(trashedAt.getTime() / 1000);
		const observations = { queries: [], reads: [], leans: 0, updates: [] };
		const docs = [
			{ _id: 'stale', host_id: 'host-1', in_trash: false, trashed_at: null },
			{ _id: 'missing-anchor', host_id: 'host-1', in_trash: true, trashed_at: trashedAt },
			{ _id: 'valid', host_id: 'host-1', in_trash: true, trashed_at: trashedAt },
			{ _id: 'missing-ts', host_id: 'host-1', in_trash: true, trashed_at: trashedAt },
			{ _id: 'cross-tenant', host_id: 'host-2', in_trash: true, trashed_at: trashedAt },
		];
		const models = { notes: { model: fakeModel(docs, observations), tsType: 'notes' } };
		const exported = [
			{ source_id: 'orphan', chunk_index: 0, in_trash: true, trashed_at: trashedSeconds },
			{ source_id: 'stale', chunk_index: 0, in_trash: true, trashed_at: trashedSeconds },
			{ source_id: 'missing-anchor', chunk_index: 1, in_trash: true, trashed_at: trashedSeconds },
			{ source_id: 'valid', chunk_index: 0, in_trash: true, trashed_at: trashedSeconds },
			{ source_id: 'valid', chunk_index: 1, in_trash: true, trashed_at: trashedSeconds },
			{ source_id: 'cross-tenant', chunk_index: 0, in_trash: true, trashed_at: trashedSeconds },
		];
		const deleteCalls = [];
		const graphCalls = [];
		const indexCalls = [];

		const dryRun = await reconcileTrashForTenant('host-1', {
			models,
			exportDocuments: async () => exported,
			removeSearchDocuments: async (...args) => deleteCalls.push(args),
			removeGraphLinks: async (...args) => graphCalls.push(args),
			indexDocuments: async (...args) => indexCalls.push(args),
			isValidId: () => true,
		});

		assert.deepEqual(dryRun.totals, {
			exported_sources: 5,
			mongo_trash: 3,
			valid: 1,
			orphans: 2,
			stale_state: 1,
			missing_anchor: 2,
			deleted: 0,
			reindexed: 0,
			graph_cleaned: 0,
			errors: 0,
		});
		assert.equal(deleteCalls.length, 0);
		assert.equal(indexCalls.length, 0);

		const applied = await reconcileTrashForTenant('host-1', {
			dryRun: false,
			models,
			exportDocuments: async () => exported,
			removeSearchDocuments: async (hostId, type, ids) => deleteCalls.push({ hostId, type, ids }),
			removeGraphLinks: async (hostId, ids) => graphCalls.push({ hostId, ids }),
			indexDocuments: async (hostId, type, indexedDocs) => {
				indexCalls.push({ hostId, type, ids: indexedDocs.map((doc) => String(doc._id)) });
				return indexedDocs.map((doc) => ({ id: String(doc._id), success: true }));
			},
			isValidId: () => true,
		});

		assert.deepEqual(deleteCalls, [{ hostId: 'host-1', type: 'notes', ids: ['orphan', 'cross-tenant'] }]);
		assert.deepEqual(graphCalls, [{ hostId: 'host-1', ids: ['orphan', 'cross-tenant'] }]);
		assert.deepEqual(new Set(indexCalls[0].ids), new Set(['stale', 'missing-anchor', 'missing-ts']));
		assert.equal(applied.totals.deleted, 2);
		assert.equal(applied.totals.reindexed, 3);
		assert.deepEqual(observations.reads, []);
		assert.ok(observations.leans > 0);
		assert.equal(observations.updates.length, 1);
		assert.deepEqual(observations.updates.map((update) => update.update.$set.is_indexed), [false]);
		assert.ok(observations.queries.every((query) => query.host_id === 'host-1'));
	});

	it('deletes orphan sources sequentially in bounded batches and records partial failure', async () => {
		const observations = { queries: [], reads: [], leans: 0, updates: [] };
		const models = { notes: { model: fakeModel([], observations), tsType: 'notes' } };
		const exported = Array.from({ length: 501 }, (_, index) => ({ source_id: `orphan-${index}`, chunk_index: 0, in_trash: true }));
		const batchSizes = [];
		let active = 0;
		let maxActive = 0;
		let call = 0;

		const summary = await reconcileTrashForTenant('host-1', {
			dryRun: false,
			batchSize: 250,
			models,
			exportDocuments: async () => exported,
			removeSearchDocuments: async (hostId, type, ids) => {
				active++;
				maxActive = Math.max(maxActive, active);
				batchSizes.push(ids.length);
				await Promise.resolve();
				active--;
				call++;
				if (call === 1) throw new Error('temporary delete failure');
			},
			removeGraphLinks: async () => {},
			indexDocuments: async () => [],
			isValidId: () => true,
		});

		assert.deepEqual(batchSizes, [250, 250, 1]);
		assert.equal(maxActive, 1);
		assert.equal(summary.totals.deleted, 251);
		assert.equal(summary.totals.graph_cleaned, 501);
		assert.equal(summary.totals.errors, 1);
	});

	it('keeps an orphan indexed when graph cleanup fails so a later run can retry', async () => {
		const observations = { queries: [], reads: [], leans: 0, updates: [] };
		let searchDeletes = 0;
		const summary = await reconcileTrashForTenant('host-1', {
			dryRun: false,
			models: { notes: { model: fakeModel([], observations), tsType: 'notes' } },
			exportDocuments: async () => [{ source_id: 'orphan', chunk_index: 0, in_trash: true }],
			removeSearchDocuments: async () => { searchDeletes++; },
			removeGraphLinks: async () => { throw new Error('graph unavailable'); },
			indexDocuments: async () => [],
			isValidId: () => true,
		});

		assert.equal(searchDeletes, 0);
		assert.equal(summary.totals.deleted, 0);
		assert.equal(summary.totals.errors, 1);
		assert.equal(summary.types.notes.errors[0].operation, 'delete_orphan_graph_links');
	});

	it('enumerates only active tenants from an ordinary replica read', async () => {
		const observations = { filter: null, select: '', read: '', lean: false };
		const query = {
			select: (fields) => {
				observations.select = fields;
				return query;
			},
			read: (preference) => {
				observations.read = preference;
				return query;
			},
			lean: async () => {
				observations.lean = true;
				return [{ host_id: 'host-1' }];
			},
		};
		const tenantModel = { find: (filter) => { observations.filter = filter; return query; } };
		const calls = [];

		await reconcileActiveTrashTenants({ tenantModel, dryRun: false, reconcileTenant: async (hostId, options) => { calls.push({ hostId, options }); return { host_id: hostId }; } });

		assert.deepEqual(observations.filter, { is_active: { $ne: false } });
		assert.equal(observations.select, 'host_id');
		assert.equal(observations.read, '');
		assert.equal(observations.lean, true);
		assert.deepEqual(calls, [{ hostId: 'host-1', options: { dryRun: false } }]);
	});
});

describe('trash reconciliation under replica lag', () => {
	it('never overwrites current restored or deleted records with stale trash candidates', async () => {
		const current = { _id: 'restored', host_id: 'host', in_trash: false, title: 'Current content' };
		const indexed = [];
		const model = {
			find: () => ({ lean: async () => [{ ...current, in_trash: true, title: 'Old content' }, { _id: 'deleted', host_id: 'host', in_trash: true }] }),
			findOneAndUpdate: (filter) => ({ lean: async () => filter._id === current._id ? current : null }),
			updateMany: async () => ({}),
		};
		await reconcileTrashForTenant('host', {
			models: { notes: { model, tsType: 'notes' } }, dryRun: false, isValidId: () => true,
			exportDocuments: async () => [{ source_id: current._id, chunk_index: 0, in_trash: true }],
			indexDocuments: async (_host, _type, docs) => { indexed.push(...docs); return docs.map((doc) => ({ id: doc._id, success: true })); },
			removeSearchDocuments: async () => {}, removeGraphLinks: async () => {},
		});
		assert.equal(indexed.length, 1);
		assert.equal(indexed[0].in_trash, false);
		assert.equal(indexed[0].title, 'Current content');
	});
});
