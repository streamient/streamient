import { beforeEach as beforeAccountWork, afterEach as afterAccountWork } from 'node:test';
import { mockTenantWork } from './helpers/tenant-work.js';
let restoreAccountWork;
beforeAccountWork(() => { restoreAccountWork = mockTenantWork(); });
afterAccountWork(() => { restoreAccountWork(); });
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';
import { getCache } from '../modules/cache.js';

describe('Typesense import handling', () => {
	it('keeps a record queued when its project changes during import, then indexes the new version', async (t) => {
		const record = { _id: '507f1f77bcf86cd799439011', host_id: 'index-race', project: 'source', title: 'Moved note', text_content: 'Content', tags: [], createdAt: new Date('2026-09-17T00:00:00Z'), updatedAt: new Date('2026-09-17T00:00:00Z'), is_indexed: false };
		const importedProjects = [];
		t.mock.method(getCache(), 'get', async () => null);
		const originalClient = Typesense.Client;
		t.after(() => { Typesense.Client = originalClient; });
		Typesense.Client = class {
			collections() {
				return { retrieve: async () => ({ fields: [] }), update: async () => ({}), documents: () => ({ delete: async () => ({ num_deleted: 1 }), import: async (docs) => {
					importedProjects.push(docs[0].project_id);
					if (importedProjects.length === 1) {
						record.project = 'destination';
						record.updatedAt = new Date('2026-09-17T00:01:00Z');
					}
					return docs.map(() => ({ success: true }));
				} }) };
			}
		};
		const Model = {
			aggregate: async () => record.is_indexed ? [] : [{ _id: record.host_id }],
			find() {
				const snapshot = structuredClone(record);
				const query = { sort: () => query, limit: () => query, lean: async () => [snapshot] };
				return query;
			},
			async updateMany(filter, update) {
				const matches = filter.$or ? filter.host_id === record.host_id && filter.$or.some((version) => String(version._id) === record._id && version.updatedAt.getTime() === record.updatedAt.getTime()) : filter._id.$in.includes(record._id);
				if (matches) record.is_indexed = update.$set.is_indexed;
				return { modifiedCount: matches ? 1 : 0 };
			},
		};
		const { runStreamientIndexer } = await import(`../modules/typesense.js?move-during-import=${Date.now()}`);
		assert.equal(await runStreamientIndexer({ Note: Model }), 0);
		assert.equal(record.is_indexed, false);
		assert.equal(await runStreamientIndexer({ Note: Model }), 1);
		assert.equal(record.is_indexed, true);
		assert.deepEqual(importedProjects, ['source', 'destination']);
	});
	it('returns per-document failures when a whole import request fails', async () => {
		const originalClient = Typesense.Client;
		Typesense.Client = class FakeTypesenseClient {
			collections() {
				return {
					documents: () => ({
						import: async () => {
							throw new Error('Typesense unavailable');
						},
					}),
				};
			}
		};

		try {
			const typesense = await import(`../modules/typesense.js?import-failure-test=${Date.now()}`);
			const results = await typesense.importDocuments('host-1', 'emails', [
				{ id: 'email-1' },
				{ id: 'email-2' },
			]);

			assert.equal(results.length, 2);
			assert.deepEqual(results.map((result) => result.success), [false, false]);
			assert.ok(results.every((result) => result.error === 'Typesense unavailable'));
		} finally {
			Typesense.Client = originalClient;
		}
	});

	it('preserves Typesense per-document import results from partial failures', async () => {
		const originalClient = Typesense.Client;
		Typesense.Client = class FakeTypesenseClient {
			collections() {
				return {
					documents: () => ({
						import: async () => {
							const err = new Error('partial import failure');
							err.importResults = [
								{ success: true },
								{ success: false, error: 'Bad field value' },
							];
							throw err;
						},
					}),
				};
			}
		};

		try {
			const typesense = await import(`../modules/typesense.js?partial-import-test=${Date.now()}`);
			const results = await typesense.importDocuments('host-1', 'emails', [
				{ id: 'email-1' },
				{ id: 'email-2' },
			]);

			assert.deepEqual(results, [
				{ success: true },
				{ success: false, error: 'Bad field value' },
			]);
		} finally {
			Typesense.Client = originalClient;
		}
	});
});
