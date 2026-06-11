import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { startTestServer, createTestClient } from './helpers/test-server.js';
import { FIXTURES } from './helpers/fixtures.js';

describe('MCP Server — Streamable HTTP transport', () => {
    let server, client, appClient;

    before(async () => {
        const api = createMockApi({
            get: async () => ({ projects: [FIXTURES.project] }),
            post: async () => ({ note: FIXTURES.note }),
        });
        server = await startTestServer(api);
        client = await createTestClient(server.url);
        appClient = await createTestClient(server.appUrl);
    });

    after(async () => {
        try { await client?.close(); } catch {}
        try { await appClient?.close(); } catch {}
        await server?.close();
    });

    describe('initialize', () => {
        it('should report server name and version', () => {
            const info = client.getServerVersion();
            assert.equal(info.name, 'kumbukum-test');
            assert.equal(info.version, '0.0.1');
        });

        it('should advertise tools capability', () => {
            const caps = client.getServerCapabilities();
            assert.ok(caps.tools, 'tools capability should be present');
        });
    });

    describe('tools/list', () => {
        it('should list all 44 tools', async () => {
            const { tools } = await client.listTools();
            assert.equal(tools.length, 44);
        });

        it('should list the app-profile tools at /mcp/app', async () => {
            const { tools } = await appClient.listTools();
            const names = tools.map((t) => t.name);
            assert.equal(tools.length, 43);
            assert.equal(names.includes('chat'), false);
            for (const name of ['ingest_email', 'read_email', 'list_emails', 'search_emails', 'get_email_thread', 'delete_email']) {
                assert.ok(names.includes(name), `missing email tool: ${name}`);
            }
        });

        it('should include expected tool names', async () => {
            const { tools } = await client.listTools();
            const names = tools.map((t) => t.name);
            const expected = [
                'create_note', 'read_note', 'update_note', 'delete_note', 'list_notes', 'search_notes',
                'store_memory', 'recall_memory', 'search_memory', 'read_memory', 'update_memory', 'delete_memory',
                'suggest_memory_tags', 'search_knowledge', 'chat',
                'save_url', 'list_urls', 'search_urls', 'read_url', 'update_url', 'delete_url',
                'ingest_email', 'read_email', 'list_emails', 'search_emails', 'get_email_thread', 'delete_email',
                'list_projects', 'get_project', 'create_project', 'update_project', 'delete_project', 'get_project_counts',
                'create_link', 'get_links', 'get_graph', 'traverse_graph', 'delete_link',
                'list_git_repos', 'add_git_repo', 'update_git_repo', 'remove_git_repo', 'trigger_git_sync', 'git_sync_status',
            ];
            for (const name of expected) {
                assert.ok(names.includes(name), `missing tool: ${name}`);
            }
        });

        it('every tool should have a description', async () => {
            const { tools } = await client.listTools();
            for (const tool of tools) {
                assert.ok(tool.description && tool.description.length > 0, `tool ${tool.name} missing description`);
            }
        });

        it('every tool should have a valid inputSchema', async () => {
            const { tools } = await client.listTools();
            for (const tool of tools) {
                assert.equal(tool.inputSchema.type, 'object', `tool ${tool.name} inputSchema.type should be "object"`);
            }
        });

        it('every tool should include Apps SDK safety annotations', async () => {
            const { tools } = await client.listTools();
            for (const tool of tools) {
                assert.equal(typeof tool.annotations?.readOnlyHint, 'boolean', `tool ${tool.name} missing readOnlyHint`);
                assert.equal(typeof tool.annotations?.destructiveHint, 'boolean', `tool ${tool.name} missing destructiveHint`);
                assert.equal(typeof tool.annotations?.openWorldHint, 'boolean', `tool ${tool.name} missing openWorldHint`);
            }
        });

        it('every advertised app tool should include a JSON output schema', async () => {
            const { tools } = await appClient.listTools();
            for (const tool of tools) {
                assert.ok(tool.outputSchema, `tool ${tool.name} missing outputSchema`);
                assert.equal(tool.outputSchema.type, 'object');
                assert.ok(tool.outputSchema.properties?.data, `tool ${tool.name} missing outputSchema.data`);
            }
        });

        it('tools should advertise per-tool OAuth scopes for ChatGPT Apps', async () => {
            const { tools } = await appClient.listTools();
            const names = new Map(tools.map((tool) => [tool.name, tool]));
            assert.deepEqual(names.get('create_note')?._meta?.securitySchemes, [
                { type: 'oauth2', scopes: ['mcp:read', 'mcp:write'] },
            ]);
            assert.deepEqual(names.get('search_knowledge')?._meta?.securitySchemes, [
                { type: 'oauth2', scopes: ['mcp:read'] },
            ]);
        });
    });
});
