import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';
import { graphTools } from '../../apps/mcp/tools/graph.js';

const LINK_FIXTURE = {
    _id: '507f1f77bcf86cd799439099',
    source_id: FIXTURES.note._id,
    source_type: 'notes',
    target_id: FIXTURES.memory._id,
    target_type: 'memory',
    label: 'related',
};

describe('MCP Tools — Graph', () => {
    let api, tools;

    beforeEach(() => {
        api = createMockApi({
            get: async (path) => {
                if (path.startsWith('/graph')) {
                    return {
                        nodes: [
                            { id: FIXTURES.note._id, name: 'Test Note', type: 'notes' },
                            { id: FIXTURES.memory._id, name: 'Test Memory', type: 'memory' },
                        ],
                        edges: [
                            { source: FIXTURES.note._id, target: FIXTURES.memory._id, type: 'manual', label: 'related' },
                        ],
                    };
                }
                if (path.startsWith('/links/')) {
                    return { links: [LINK_FIXTURE] };
                }
                return {};
            },
            post: async (_path, body) => ({ link: { ...LINK_FIXTURE, ...body } }),
            delete: async () => ({}),
        });
        tools = graphTools(api);
    });

    // ── create_link ─────────────────────────────────────────────

    it('create_link — calls POST /links with args', async () => {
        const result = await tools.create_link.handler({
            source_id: FIXTURES.note._id,
            source_type: 'notes',
            target_id: FIXTURES.memory._id,
            target_type: 'memory',
            label: 'related',
        });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/links');
        assert.equal(api.lastCall.body.source_type, 'notes');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(parsed.source_id);
    });

    it('create_link — label is optional', async () => {
        const result = await tools.create_link.handler({
            source_id: FIXTURES.note._id,
            source_type: 'notes',
            target_id: FIXTURES.url._id,
            target_type: 'urls',
        });
        assert.equal(api.lastCall.body.label, undefined);
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(parsed.source_id);
    });

    // ── get_links ─────────────────────────────────────────────

    it('get_links — calls GET /links/:itemId', async () => {
        const result = await tools.get_links.handler({ item_id: FIXTURES.note._id });
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes(`/links/${FIXTURES.note._id}`));
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
        assert.equal(parsed.length, 1);
    });

    // ── get_graph ─────────────────────────────────────────────

    it('get_graph — calls GET /graph', async () => {
        const result = await tools.get_graph.handler({});
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.startsWith('/graph'));
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed.nodes));
        assert.ok(Array.isArray(parsed.edges));
    });

    it('get_graph — passes query params', async () => {
        await tools.get_graph.handler({
            project_id: FIXTURES.project._id,
            include_tags: false,
            include_semantic: true,
            semantic_threshold: 0.8,
        });
        assert.ok(api.lastCall.path.includes('project_id='));
        assert.ok(api.lastCall.path.includes('include_tags=false'));
        assert.ok(api.lastCall.path.includes('include_semantic=true'));
        assert.ok(api.lastCall.path.includes('semantic_threshold=0.8'));
    });

    // ── traverse_graph ────────────────────────────────────────

    it('traverse_graph — returns item links and connected IDs', async () => {
        const result = await tools.traverse_graph.handler({ item_id: FIXTURES.note._id });
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.item_id, FIXTURES.note._id);
        assert.ok(Array.isArray(parsed.links));
        assert.ok(Array.isArray(parsed.connected_item_ids));
    });

    // ── delete_link ───────────────────────────────────────────

    it('delete_link — calls DELETE /links/:id', async () => {
        const result = await tools.delete_link.handler({ link_id: LINK_FIXTURE._id });
        assert.equal(api.lastCall.method, 'DELETE');
        assert.ok(api.lastCall.path.includes(`/links/${LINK_FIXTURE._id}`));
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.message, 'Link deleted');
        assert.equal(result.structuredContent.data.message, 'Link deleted');
    });
});
