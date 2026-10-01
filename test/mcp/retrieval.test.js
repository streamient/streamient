import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMcpToolCatalog } from '../../apps/mcp/tools/catalog.js';
import { MCP_SERVER_INSTRUCTIONS } from '../../apps/mcp/instructions.js';
import { createMockApi } from './helpers/mock-api.js';

const searchNames = ['search_knowledge', 'search_notes', 'recall_memory', 'search_memory', 'search_urls', 'search_emails'];

for (const name of searchNames) {
	test(`${name}: defaults, overrides and scoped pagination preserve the search contract`, async () => {
		const api = createMockApi({ post: async () => ({ results: { found: 8, out_of: 8, page: 2, hits: [{ document: { id: 'record-a', project_id: 'project-a', content: 'Evidence' } }] } }) });
		const tool = createMcpToolCatalog(api)[name];
		assert.equal(tool.inputSchema.per_page.parse(undefined), 5);
		assert.match(tool.description, /defaults to 5/);
		for (const limit of [undefined, 1, 9]) {
			const result = await tool.handler({ query: 'release', project_id: 'project-a', page: 2, tags: ['build'], ...(limit === undefined ? {} : { per_page: limit }) });
			assert.equal(api.lastCall.body.per_page ?? api.lastCall.body.options.perPage, limit ?? 5);
			if (tool.inputSchema.project_id) {
				assert.equal(api.lastCall.body.project_id, 'project-a');
				assert.equal(api.lastCall.body.page, 2);
				assert.deepEqual(api.lastCall.body.tags, ['build']);
			}
			assert.deepEqual(result.content, []);
			assert.equal(result.structuredContent.data.page, 2);
			assert.equal(result.structuredContent.data.hits[0].excerpt, 'Evidence');
			assert.equal(result.structuredContent.data.hits[0].content, undefined);
		}
		if (tool.inputSchema.project_id) {
			await tool.handler({ query: 'release', project_id: 'project-b' });
			assert.equal(api.lastCall.body.project_id, 'project-b');
			await tool.handler({ query: 'release' });
			assert.equal(api.lastCall.body.project_id, undefined);
		}
	});
}

test('server guidance and published template require evidence, correction and useful context', () => {
	const template = readFileSync(new URL('../../docs/mcp/agents.md', import.meta.url), 'utf8');
	for (const instructions of [MCP_SERVER_INSTRUCTIONS, template]) {
		for (const requirement of [/five results per collection/, /Read the full records/, /history before the suspected change/, /does not establish user approval/, /user decision/, /verified outcome/, /unverified inference/, /Update an existing record/, /trivial turns/]) assert.match(instructions, requirement);
		assert.doesNotMatch(instructions, /one specific retrieval call|Read only the top exact item|defaults to `?1\b/);
	}
});
