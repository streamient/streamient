import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { slimSearchResults } from '../../apps/mcp/tools/search-results.js';
import { mcpJson } from '../../apps/mcp/tools/output.js';

function assertNoRawBodyFields(value) {
	if (Array.isArray(value)) {
		for (const item of value) assertNoRawBodyFields(item);
		return;
	}
	if (!value || typeof value !== 'object') return;
	for (const field of ['content', 'text_content', 'attachment_text_content']) {
		assert.equal(value[field], undefined, `raw body field leaked: ${field}`);
	}
	for (const nested of Object.values(value)) assertNoRawBodyFields(nested);
}

describe('MCP Search Results', () => {
	it('slims a single Typesense collection response', () => {
		const result = slimSearchResults({
			facet_counts: [],
			found: 1,
			hits: [
				{
					document: { id: 'note-1', title: 'Note 1', text_content: 'Useful body text' },
					highlight: {},
					highlights: [],
					text_match_info: { score: '123' },
					vector_distance: 0.12,
				},
			],
			out_of: 9,
			page: 1,
			request_params: { q: 'test' },
			search_cutoff: false,
			search_time_ms: 3,
		});

		assert.deepEqual(result, {
			found: 1,
			out_of: 9,
			page: 1,
			hits: [{ id: 'note-1', title: 'Note 1', excerpt: 'Useful body text', score: '123', vector_distance: 0.12 }],
		});
	});

	it('slims multi-collection Typesense responses', () => {
		const result = slimSearchResults({
			notes: {
				found: 1,
				hits: [{ document: { id: 'note-1', title: 'Note 1', text_content: 'Note excerpt' }, vector_distance: 0.12 }],
				out_of: 2,
				page: 1,
				request_params: { q: 'test' },
			},
			memory: {
				found: 0,
				hits: [],
				out_of: 0,
				page: 1,
				request_params: { q: 'test' },
			},
		});

		assert.deepEqual(result, {
			notes: {
				found: 1,
				out_of: 2,
				page: 1,
				hits: [{ id: 'note-1', title: 'Note 1', excerpt: 'Note excerpt', read_tool: 'read_note', vector_distance: 0.12 }],
			},
			memory: {
				found: 0,
				out_of: 0,
				page: 1,
				hits: [],
			},
		});
	});

	it('preserves simple array results from non-Typesense mocks', () => {
		const result = slimSearchResults([{ id: 'raw-1', title: 'Raw 1' }]);
		assert.deepEqual(result, [{ id: 'raw-1', title: 'Raw 1' }]);
	});

	it('adds bounded excerpts to raw search result arrays', () => {
		const result = slimSearchResults([
			{
				id: 'memory-1',
				title: 'Memory 1',
				content: `${'a'.repeat(1300)} tail`,
				text_content: 'raw text must be removed',
				attachment_text_content: 'raw attachment must be removed',
			},
		], { type: 'memory' });

		assert.equal(result[0].content, undefined);
		assert.equal(result[0].text_content, undefined);
		assert.equal(result[0].attachment_text_content, undefined);
		assert.equal(result[0].excerpt.length, 1203);
		assert.equal(result[0].excerpt.endsWith('...'), true);
		assert.equal(result[0].read_tool, 'read_memory');
	});

	it('keeps excerpts but strips raw body fields from nested search output', () => {
		const result = slimSearchResults({
			notes: {
				found: 1,
				hits: [{ document: { id: 'note-1', title: 'Note 1', content: 'raw html', text_content: 'Note excerpt' } }],
			},
			emails: {
				found: 1,
				hits: [{
					document: {
						id: 'email-1',
						subject: 'Email 1',
						text_content: 'Email excerpt',
						attachment_text_content: 'Attachment excerpt',
					},
				}],
			},
		});

		assert.equal(result.notes.hits[0].excerpt, 'raw html');
		assert.equal(result.emails.hits[0].excerpt, 'Email excerpt');
		assertNoRawBodyFields(result);
	});

	it('returns compact JSON text while preserving structuredContent', () => {
		const result = mcpJson({ title: 'Compact', nested: { value: true } });

		assert.deepEqual(result.structuredContent, {
			data: { title: 'Compact', nested: { value: true } },
		});
		assert.equal(result.content[0].text, '{"title":"Compact","nested":{"value":true}}');
	});

	it('slims grouped Typesense responses to source documents', () => {
		const result = slimSearchResults({
			found: 1,
			grouped_hits: [
				{
					group_key: ['note-1'],
					hits: [
						{
							document: { id: 'note-1_chunk_1', source_id: 'note-1', title: 'Note 1', text_content: 'Chunk body' },
							vector_distance: 0.12,
						},
					],
				},
			],
			out_of: 2,
			page: 1,
		});

		assert.deepEqual(result, {
			found: 1,
			out_of: 2,
			page: 1,
			hits: [{ id: 'note-1', source_id: 'note-1', title: 'Note 1', excerpt: 'Chunk body', vector_distance: 0.12 }],
		});
	});
});
