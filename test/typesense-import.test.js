import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';

describe('Typesense import handling', () => {
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
