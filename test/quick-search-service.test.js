import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
	normalizeQuickSearchHit,
	normalizeQuickSearchResults,
	quickSearchKnowledge,
} from '../services/quick_search_service.js';

describe('Quick search service', () => {
	it('normalizes Typesense highlights into safe text segments', () => {
		const result = normalizeQuickSearchHit('emails', {
			document: {
				id: 'email-1',
				source_id: 'email-1',
				subject: 'Invoice from Acme',
				from: ['billing@acme.test'],
				text_content: 'Please review invoice 123.',
				project_id: 'project-1',
				mailbox: 'archived',
				updated_at: 1780000000,
			},
			highlights: [
				{
					field: 'subject',
					snippet: '__kk_hl_start__Invoice__kk_hl_end__ from Acme',
				},
			],
			text_match_info: { score: '42' },
		}, { emailOpenMode: 'ecc' });

		assert.equal(result.id, 'email-1');
		assert.equal(result.type, 'emails');
		assert.equal(result.title, 'Invoice from Acme');
		assert.equal(result.excerpt, 'Invoice from Acme');
		assert.deepEqual(result.highlight_segments, [
			{ text: 'Invoice', highlighted: true },
			{ text: ' from Acme', highlighted: false },
		]);
		assert.deepEqual(result.open_target, {
			kind: 'ecc',
			id: 'email-1',
			project_id: 'project-1',
			mailbox: 'archived',
		});
	});

	it('sorts and limits normalized multi-collection results', () => {
		const results = normalizeQuickSearchResults({
			notes: {
				hits: [
					{
						document: { id: 'note-1', title: 'Lower', text_content: 'Body', updated_at: 10 },
						text_match_info: { score: '1' },
					},
				],
			},
			memory: {
				hits: [
					{
						document: { id: 'memory-1', title: 'Higher', content: 'Body', updated_at: 1 },
						text_match_info: { score: '7' },
					},
				],
			},
		}, { limit: 1 });

		assert.equal(results.length, 1);
		assert.equal(results[0].id, 'memory-1');
		assert.equal(results[0]._score, undefined);
	});

	it('passes email gating and returns normalized records from injected search function', async () => {
		let receivedOptions = null;
		const result = await quickSearchKnowledge('host-1', 'invoice', {
			includeEmails: false,
			emailOpenMode: 'modal',
			searchFn: async (hostId, query, options) => {
				receivedOptions = { hostId, query, options };
				return {
					notes: {
						hits: [
							{
								document: { id: 'note-1', title: 'Invoice note', text_content: 'Invoice details' },
								text_match_info: { score: '3' },
							},
						],
					},
				};
			},
		});

		assert.equal(receivedOptions.hostId, 'host-1');
		assert.equal(receivedOptions.query, 'invoice');
		assert.equal(receivedOptions.options.includeEmails, false);
		assert.equal(result.found, 1);
		assert.equal(result.results[0].id, 'note-1');
	});
});

