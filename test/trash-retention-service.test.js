import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildTrashRetentionQuery, runTrashRetentionCleanup } from '../services/trash_retention_service.js';

function fakeRetentionModel(type, doc, observations) {
	let served = false;
	return {
		find: (query) => {
			if (!observations.queries[type]) observations.queries[type] = [];
			observations.queries[type].push(query);
			const chain = {
				select: (fields) => {
					assert.equal(fields, '_id host_id');
					return chain;
				},
				limit: (limit) => {
					observations.limits.push(limit);
					return chain;
				},
				read: (preference) => {
					observations.reads.push({ type, preference });
					return chain;
				},
				lean: async () => {
					observations.leans.push(type);
					if (served) return [];
					served = true;
					return [doc];
				},
			};
			return chain;
		},
		findOneAndDelete: (query) => ({ lean: async () => { observations.deletes.push({ type, query }); return doc; } }),
	};
}

describe('trash retention service', () => {
	it('deletes all four trash models, preserves spam retention, and uses replica candidates and atomic delete results', async () => {
		const now = new Date('2026-02-01T02:30:00.000Z');
		const observations = { queries: {}, limits: [], reads: [], leans: [], deletes: [] };
		const models = {};
		for (const [type, tsType] of [['notes', 'notes'], ['memories', 'memory'], ['urls', 'urls'], ['emails', 'emails']]) {
			models[type] = { model: fakeRetentionModel(type, { _id: `${type}-1`, host_id: `host-${type}` }, observations), tsType };
		}
		const searchCalls = [];
		const graphCalls = [];

		const summary = await runTrashRetentionCleanup({
			now,
			models,
			batchSize: 25,
			removeSearchDocuments: async (hostId, type, ids) => {
				searchCalls.push({ hostId, type, ids });
				if (type === 'urls') throw new Error('temporary Typesense failure');
			},
			removeGraphLinks: async (hostId, ids) => graphCalls.push({ hostId, ids }),
		});

		assert.equal(summary.deleted, 4);
		assert.equal(summary.cutoff.toISOString(), '2026-01-02T02:30:00.000Z');
		assert.deepEqual(observations.queries.notes[0], { in_trash: true, trashed_at: { $lte: summary.cutoff } });
		assert.deepEqual(observations.queries.memories[0], observations.queries.notes[0]);
		assert.deepEqual(observations.queries.urls[0], observations.queries.notes[0]);
		assert.deepEqual(observations.queries.emails[0], buildTrashRetentionQuery('emails', summary.cutoff));
		assert.equal(observations.reads.length, 0);
		assert.ok(observations.reads.every((item) => item.preference === 'primary'));
		assert.deepEqual(new Set(observations.leans), new Set(['notes', 'memories', 'urls', 'emails']));
		assert.equal(observations.deletes.length, 4);
		assert.equal(searchCalls.length, 4);
		assert.equal(graphCalls.length, 4);
		assert.equal(summary.errors.length, 1);
		assert.equal(summary.errors[0].operation, 'typesense_cleanup');
	});

	it('removes search documents even when graph cleanup fails', async () => {
		const observations = { queries: {}, limits: [], reads: [], leans: [], deletes: [] };
		const models = { notes: { model: fakeRetentionModel('notes', { _id: 'note-1', host_id: 'host-1' }, observations), tsType: 'notes' } };
		let searchCleanup = 0;

		const summary = await runTrashRetentionCleanup({
			models,
			removeSearchDocuments: async () => { searchCleanup++; },
			removeGraphLinks: async () => { throw new Error('graph unavailable'); },
		});

		assert.equal(summary.deleted, 1);
		assert.equal(searchCleanup, 1);
		assert.equal(summary.errors[0].operation, 'graph_cleanup');
	});
});
