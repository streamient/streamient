import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMcpToolCatalog } from '../../apps/mcp/tools/catalog.js';
import { startTestServer, createTestClient } from './helpers/test-server.js';
import { FIXTURES } from './helpers/fixtures.js';

const attacks = ['../settings', '../../trash', '%2e%2e%2fsettings', '..\\settings', '507f1f77bcf86cd799439011?x=1', '507F1F77BCF86CD799439011', '507f1f77bcf86cd799439011\n', ''];

test('every object ID schema rejects traversal and malformed IDs', () => {
    const tools = createMcpToolCatalog({}, { defaultProjectId: FIXTURES.project._id });
    let checked = 0;
    for (const [name, tool] of Object.entries(tools)) {
        for (const [field, schema] of Object.entries(tool.inputSchema)) {
            if (!['id', 'project_id', 'source_id', 'target_id', 'item_id', 'link_id'].includes(field)) continue;
            checked++;
            assert.equal(schema.safeParse(FIXTURES.project._id).success, true, `${name}.${field}`);
            for (const attack of attacks) assert.equal(schema.safeParse(attack).success, false, `${name}.${field}: ${attack}`);
        }
    }
    assert.ok(checked > 40);
});

test('MCP rejects traversal before calling the API', async () => {
    let calls = 0;
    const api = { get: async () => { calls++; return {}; } };
    const server = await startTestServer(api);
    const client = await createTestClient(server.url);
    try {
        for (const id of attacks) {
            const result = await client.callTool({ name: 'read_note', arguments: { id } });
            assert.equal(result.isError, true);
        }
        assert.equal(calls, 0);
    } finally {
        await client.close();
        await server.close();
    }
});

test('default project from transport cannot inject a Git API path', async () => {
    const tools = createMcpToolCatalog({}, { defaultProjectId: '../trash' });
    await assert.rejects(tools.list_git_repos.handler({}));
    await assert.rejects(tools.add_git_repo.handler({ repo_url: 'https://example.com/repo' }));
});
