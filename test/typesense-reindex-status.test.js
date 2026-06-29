import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildReindexStatus } from '../modules/typesense.js';

const counts = {
	db_records: 12,
	indexed_records: 5,
	not_indexed_records: 7,
	by_type: {
		notes: { db_records: 3, indexed_records: 1, not_indexed_records: 2 },
		memory: { db_records: 4, indexed_records: 2, not_indexed_records: 2 },
		urls: { db_records: 2, indexed_records: 1, not_indexed_records: 1 },
		emails: { db_records: 3, indexed_records: 1, not_indexed_records: 2 },
	},
};

describe('Typesense reindex status', () => {
	it('returns idle when no reindex state exists', () => {
		assert.deepEqual(buildReindexStatus(null, 0, counts), {
			status: 'idle',
			total_queued: 0,
			indexed: 0,
			remaining: 0,
			message: 'Search index is idle.',
			counts,
		});
	});

	it('returns queued before indexing starts', () => {
		assert.deepEqual(buildReindexStatus({ total_queued: 12, started_at: '2026-06-11T23:00:00.000Z' }, 12, counts), {
			status: 'queued',
			indexed: 0,
			remaining: 12,
			total_queued: 12,
			started_at: '2026-06-11T23:00:00.000Z',
			message: 'Reindexing is queued for 12 items.',
			counts,
		});
	});

	it('returns progress after indexing starts', () => {
		assert.deepEqual(buildReindexStatus({ total_queued: 12, started_at: '2026-06-11T23:00:00.000Z' }, 7, counts), {
			status: 'progress',
			indexed: 5,
			remaining: 7,
			total_queued: 12,
			started_at: '2026-06-11T23:00:00.000Z',
			message: 'Reindexing... 5 items indexed, 7 remaining.',
			counts,
		});
	});

	it('returns complete when no items remain', () => {
		const completeCounts = {
			...counts,
			indexed_records: 12,
			not_indexed_records: 0,
		};

		assert.deepEqual(buildReindexStatus({ total_queued: 1, started_at: '2026-06-11T23:00:00.000Z' }, 0, completeCounts), {
			status: 'complete',
			indexed: 1,
			remaining: 0,
			total_queued: 1,
			started_at: '2026-06-11T23:00:00.000Z',
			message: 'Reindex complete. Indexed 1 item.',
			counts: completeCounts,
		});
	});
});
