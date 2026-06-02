import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';
import { memoryTools } from '../../apps/mcp/tools/memory.js';

describe('MCP Tools — Memory', () => {
    let api, tools;

    beforeEach(() => {
        api = createMockApi({
            get: async (path) => {
                if (path.includes('tags/suggest')) return { tags: FIXTURES.tags };
                return { memory: FIXTURES.memory };
            },
            post: async (path) => {
                if (path === '/memories/search') return { results: [FIXTURES.memory] };
                if (path === '/search/knowledge') return { results: FIXTURES.searchResults };
                if (path === '/chat') return { reply: 'test reply', intent: 'search' };
                return { memory: FIXTURES.memory };
            },
            put: async (_path, body) => ({ memory: { ...FIXTURES.memory, ...body } }),
            delete: async () => ({}),
        });
        tools = memoryTools(api, FIXTURES.project._id);
    });

    it('store_memory — calls POST /memories', async () => {
        const result = await tools.store_memory.handler({
            title: 'Remember this',
            content: 'Important fact',
            project_id: FIXTURES.project._id,
        });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/memories');
        assert.equal(api.lastCall.body.title, 'Remember this');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(parsed.title);
    });

    it('store_memory — passes optional tags and source', async () => {
        await tools.store_memory.handler({
            title: 'Tagged',
            content: 'With tags',
            tags: ['a', 'b'],
            source: 'test',
            project_id: FIXTURES.project._id,
        });
        assert.deepEqual(api.lastCall.body.tags, ['a', 'b']);
        assert.equal(api.lastCall.body.source, 'test');
    });

    it('store_memory — defaults to default project when no project_id', async () => {
        await tools.store_memory.handler({ title: 'No Project', content: 'test' });
        assert.equal(api.lastCall.body.project, FIXTURES.project._id);
    });

    it('recall_memory — calls POST /memories/search', async () => {
        const result = await tools.recall_memory.handler({ query: 'important' });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/memories/search');
        assert.equal(api.lastCall.body.query, 'important');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
    });

    it('recall_memory — passes optional per_page as options.perPage', async () => {
        await tools.recall_memory.handler({ query: 'important', per_page: 3 });
        assert.equal(api.lastCall.body.options.perPage, 3);
    });

    it('recall_memory — requests searchable body fields for excerpts', async () => {
        await tools.recall_memory.handler({ query: 'important' });
        assert.equal(api.lastCall.body.options.exclude_fields, 'embedding');
    });

    it('search_memory — same behaviour as recall_memory', async () => {
        const result = await tools.search_memory.handler({ query: 'facts' });
        assert.equal(api.lastCall.path, '/memories/search');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
    });

    it('search_memory — passes optional per_page as options.perPage', async () => {
        await tools.search_memory.handler({ query: 'facts', per_page: 3 });
        assert.equal(api.lastCall.body.options.perPage, 3);
    });

    it('search_memory — requests searchable body fields for excerpts', async () => {
        await tools.search_memory.handler({ query: 'facts' });
        assert.equal(api.lastCall.body.options.exclude_fields, 'embedding');
    });

    it('read_memory — calls GET /memories/:id', async () => {
        const result = await tools.read_memory.handler({ id: FIXTURES.memory._id });
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes(FIXTURES.memory._id));
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.id, FIXTURES.memory._id);
        assert.equal(parsed.host_id, undefined);
    });

    it('update_memory — calls PUT /memories/:id, excludes id from body', async () => {
        const result = await tools.update_memory.handler({
            id: FIXTURES.memory._id,
            title: 'Updated Memory',
        });
        assert.equal(api.lastCall.method, 'PUT');
        assert.ok(api.lastCall.path.includes(FIXTURES.memory._id));
        assert.equal(api.lastCall.body.title, 'Updated Memory');
        assert.equal(api.lastCall.body.id, undefined);
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.title, 'Updated Memory');
    });

    it('delete_memory — calls DELETE /memories/:id', async () => {
        const result = await tools.delete_memory.handler({ id: FIXTURES.memory._id });
        assert.equal(api.lastCall.method, 'DELETE');
        assert.ok(api.lastCall.path.includes(FIXTURES.memory._id));
        assert.equal(result.content[0].text, 'Memory deleted');
    });

    it('suggest_memory_tags — calls GET /memories/tags/suggest', async () => {
        const result = await tools.suggest_memory_tags.handler({});
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes('tags/suggest'));
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
    });

    it('search_knowledge — calls POST /search/knowledge', async () => {
        const result = await tools.search_knowledge.handler({ query: 'everything' });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/search/knowledge');
        assert.equal(api.lastCall.body.query, 'everything');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(parsed.notes);
        assert.ok(parsed.memories);
        assert.ok(parsed.urls);
    });

    it('search_knowledge — passes optional project_id and per_page', async () => {
        await tools.search_knowledge.handler({
            query: 'test',
            project_id: FIXTURES.project._id,
            per_page: 3,
        });
        assert.equal(api.lastCall.body.project_id, FIXTURES.project._id);
        assert.equal(api.lastCall.body.per_page, 3);
    });

    it('search_knowledge — requests searchable body fields for excerpts', async () => {
        await tools.search_knowledge.handler({ query: 'test' });
        assert.deepEqual(api.lastCall.body.options.exclude_fields, {
            notes: 'embedding',
            memory: 'embedding',
            urls: 'embedding',
            emails: 'embedding',
            pages: 'embedding',
        });
    });

    it('chat — calls POST /chat', async () => {
        const result = await tools.chat.handler({ query: 'find my notes' });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/chat');
        assert.equal(api.lastCall.body.query, 'find my notes');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(parsed.reply);
    });

    it('chat — passes conversation_id and project_id', async () => {
        await tools.chat.handler({
            query: 'continue',
            conversation_id: 'conv-123',
            project_id: FIXTURES.project._id,
        });
        assert.equal(api.lastCall.body.conversation_id, 'conv-123');
        assert.equal(api.lastCall.body.project_id, FIXTURES.project._id);
    });
});
