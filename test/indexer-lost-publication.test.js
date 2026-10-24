import { test } from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';
import { getCache } from '../modules/cache.js';
import { mockTenantWork } from './helpers/tenant-work.js';

function indexerModel(record, { gateReads = false, exists = () => true } = {}) {
	let reads = 0;
	let loaded;
	let release;
	const firstLoaded = new Promise((resolve) => { loaded = resolve; });
	const firstHeld = new Promise((resolve) => { release = resolve; });
	const model = {
		aggregate: async () => (record.is_indexed || !exists() ? [] : [{ _id: record.host_id }]),
		find() {
			const snapshot = structuredClone(record);
			const query = {
				sort: () => query,
				limit: () => query,
				lean: async () => {
					if (gateReads && ++reads === 1) { loaded(); await firstHeld; }
					return [snapshot];
				},
			};
			return query;
		},
		async updateMany(filter, update) {
			const matches = filter.$or
				? filter.host_id === record.host_id && filter.$or.some((version) => String(version._id) === record._id && version.updatedAt.getTime() === record.updatedAt.getTime())
				: exists() && filter._id.$in.includes(record._id);
			if (matches) record.is_indexed = update.$set.is_indexed;
			return { modifiedCount: matches ? 1 : 0 };
		},
		findOneAndUpdate(filter, update) {
			const matches = exists() && filter.host_id === record.host_id && String(filter._id) === record._id && filter.updatedAt && filter.updatedAt.getTime() === record.updatedAt.getTime();
			if (matches) record.is_indexed = update.$set.is_indexed;
			return { select() { return this; }, lean: async () => (matches ? { _id: record._id } : null) };
		},
	};
	return { model, loaded: () => firstLoaded, release: () => release() };
}

function fakeTypesense(indexedProject) {
	const original = Typesense.Client;
	Typesense.Client = class {
		collections() {
			return {
				retrieve: async () => ({ fields: [] }),
				update: async () => ({}),
				documents: () => ({
					delete: async () => { indexedProject.value = null; return { num_deleted: 1 }; },
					import: async (docs) => { indexedProject.value = docs[0].project_id; return docs.map(() => ({ success: true })); },
				}),
			};
		}
	};
	return () => { Typesense.Client = original; };
}

test('a pending stale indexer cannot leave an old snapshot while Mongo reports indexed', async () => {
	const restore = mockTenantWork();
	const cache = getCache();
	const originalGet = cache.get;
	const originalSet = cache.set;
	cache.get = async () => null;
	cache.set = async () => {};
	const record = { _id: '507f1f77bcf86cd799439011', host_id: 'audit-index', project: 'old', title: 'Record', text_content: 'Test', tags: [], createdAt: new Date(0), updatedAt: new Date(1000), is_indexed: false };
	const indexedProject = { value: null };
	const restoreClient = fakeTypesense(indexedProject);
	const { model, loaded, release } = indexerModel(record, { gateReads: true });
	const { runStreamientIndexer } = await import(`../modules/typesense.js?reaudit-indexer=${Date.now()}`);
	try {
		const stale = runStreamientIndexer({ Note: model });
		await loaded();
		record.project = 'new';
		record.updatedAt = new Date(2000);
		assert.equal(await runStreamientIndexer({ Note: model }), 1);
		assert.equal(indexedProject.value, 'new');
		assert.equal(record.is_indexed, true);
		release();
		await stale;
		assert.equal(indexedProject.value, null);
		assert.equal(record.project, 'new');
		assert.equal(record.is_indexed, false);
		assert.equal(await runStreamientIndexer({ Note: model }), 1);
		assert.equal(indexedProject.value, 'new');
		assert.equal(record.is_indexed, true);
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
	let exists = true;
	const record = { _id: '507f1f77bcf86cd799439011', host_id: 'audit-index', project: 'old', title: 'Record', text_content: 'Test', tags: [], createdAt: new Date(0), updatedAt: new Date(1000), is_indexed: false };
	const indexedProject = { value: null };
	const restoreClient = fakeTypesense(indexedProject);
	const { model, loaded, release } = indexerModel(record, { gateReads: true, exists: () => exists });
	const { runStreamientIndexer } = await import(`../modules/typesense.js?reaudit-indexer-delete=${Date.now()}`);
	try {
		const stale = runStreamientIndexer({ Note: model });
		await loaded();
		exists = false;
		release();
		await stale;
		assert.equal(indexedProject.value, null);
		assert.equal(exists, false);
		assert.equal(await runStreamientIndexer({ Note: model }), 0);
	} finally {
		cache.get = originalGet;
		cache.set = originalSet;
		restoreClient();
		restore();
	}
});