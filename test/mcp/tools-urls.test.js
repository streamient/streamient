import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';
import { urlTools } from '../../apps/mcp/tools/urls.js';

describe('MCP Tools — URLs', () => {
    let api, tools;

    beforeEach(() => {
        api = createMockApi({
            get: async (path) => {
                if (path.includes('?')) return { urls: [FIXTURES.url] };
                return { url: FIXTURES.url };
            },
            post: async (path, body) => {
                if (path === '/urls/search') return { results: [FIXTURES.url] };
                return { url: { ...FIXTURES.url, ...body } };
            },
            put: async (_path, body) => ({ url: { ...FIXTURES.url, ...body } }),
            delete: async () => ({}),
        });
        tools = urlTools(api, FIXTURES.project._id);
    });

    it('save_url — calls POST /urls', async () => {
        const result = await tools.save_url.handler({
            url: 'https://example.com',
            project_id: FIXTURES.project._id,
        });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/urls');
        assert.equal(api.lastCall.body.url, 'https://example.com');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(parsed.url);
    });

    it('save_url — passes optional fields', async () => {
        await tools.save_url.handler({
            url: 'https://docs.example.com',
            title: 'Docs',
            description: 'Documentation site',
            crawl_enabled: true,
            project_id: FIXTURES.project._id,
        });
        assert.equal(api.lastCall.body.title, 'Docs');
        assert.equal(api.lastCall.body.crawl_enabled, true);
    });

    it('save_url — defaults to default project when no project_id', async () => {
        await tools.save_url.handler({ url: 'https://test.com' });
        assert.equal(api.lastCall.body.project, FIXTURES.project._id);
    });

    it('list_urls — calls GET /urls with query params', async () => {
        const result = await tools.list_urls.handler({
            project_id: FIXTURES.project._id,
            page: 1,
            limit: 5,
        });
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes('project='));
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
    });

    it('list_urls — works with no params', async () => {
        await tools.list_urls.handler({});
        assert.equal(api.lastCall.method, 'GET');
    });

    it('search_urls — calls POST /urls/search', async () => {
        const result = await tools.search_urls.handler({ query: 'example' });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/urls/search');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
    });

    it('search_urls — passes optional per_page and requests searchable body fields for excerpts', async () => {
        await tools.search_urls.handler({ query: 'example', per_page: 3 });
        assert.equal(api.lastCall.body.options.perPage, 3);
        assert.equal(api.lastCall.body.options.exclude_fields, 'embedding');
    });

    it('read_url — calls GET /urls/:id', async () => {
        const result = await tools.read_url.handler({ id: FIXTURES.url._id });
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes(FIXTURES.url._id));
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.id, FIXTURES.url._id);
        assert.equal(parsed.host_id, undefined);
    });

    it('update_url — calls PUT /urls/:id, excludes id from body', async () => {
        const result = await tools.update_url.handler({
            id: FIXTURES.url._id,
            title: 'Updated Title',
            crawl_enabled: true,
        });
        assert.equal(api.lastCall.method, 'PUT');
        assert.ok(api.lastCall.path.includes(FIXTURES.url._id));
        assert.equal(api.lastCall.body.title, 'Updated Title');
        assert.equal(api.lastCall.body.id, undefined);
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.title, 'Updated Title');
    });

    it('delete_url — calls DELETE /urls/:id', async () => {
        const result = await tools.delete_url.handler({ id: FIXTURES.url._id });
        assert.equal(api.lastCall.method, 'DELETE');
        assert.ok(api.lastCall.path.includes(FIXTURES.url._id));
        assert.equal(result.content[0].text, 'URL deleted');
    });
});
