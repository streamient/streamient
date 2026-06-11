import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildReindexStatus } from '../modules/typesense.js';

describe('Typesense reindex status', () => {
	it('returns idle when no reindex state exists', () => {
		assert.deepEqual(buildReindexStatus(null, 0), {
			status: 'idle',
			total_queued: 0,
			indexed: 0,
			remaining: 0,
			message: 'Search index is idle.',
		});
	});

	it('returns queued before indexing starts', () => {
		assert.deepEqual(buildReindexStatus({ total_queued: 12, started_at: '2026-06-11T23:00:00.000Z' }, 12), {
			status: 'queued',
			indexed: 0,
			remaining: 12,
			total_queued: 12,
			started_at: '2026-06-11T23:00:00.000Z',
			message: 'Reindexing is queued for 12 items.',
		});
	});

	it('returns progress after indexing starts', () => {
		assert.deepEqual(buildReindexStatus({ total_queued: 12, started_at: '2026-06-11T23:00:00.000Z' }, 7), {
			status: 'progress',
			indexed: 5,
			remaining: 7,
			total_queued: 12,
			started_at: '2026-06-11T23:00:00.000Z',
			message: 'Reindexing... 5 items indexed, 7 remaining.',
		});
	});

	it('returns complete when no items remain', () => {
		assert.deepEqual(buildReindexStatus({ total_queued: 1, started_at: '2026-06-11T23:00:00.000Z' }, 0), {
			status: 'complete',
			indexed: 1,
			remaining: 0,
			total_queued: 1,
			started_at: '2026-06-11T23:00:00.000Z',
			message: 'Reindex complete. Indexed 1 item.',
		});
	});
});
