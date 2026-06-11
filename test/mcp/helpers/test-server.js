/**
 * Helpers for spinning up a test MCP HTTP server and MCP client.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';

import { noteTools } from '../../../apps/mcp/tools/notes.js';
import { memoryTools } from '../../../apps/mcp/tools/memory.js';
import { urlTools } from '../../../apps/mcp/tools/urls.js';
import { emailTools } from '../../../apps/mcp/tools/emails.js';
import { projectTools } from '../../../apps/mcp/tools/projects.js';
import { graphTools } from '../../../apps/mcp/tools/graph.js';
import { gitSyncTools } from '../../../apps/mcp/tools/git_sync.js';
import { applyToolProfile, MCP_TOOL_PROFILES } from '../../../apps/mcp/tools/profile.js';
import { getRequiredScopesForTool } from '../../../modules/oauth.js';

import { FIXTURES } from './fixtures.js';

function buildToolMeta(name, tool) {
    return {
        ...(tool._meta || {}),
        securitySchemes: [
            { type: 'oauth2', scopes: getRequiredScopesForTool(name) },
        ],
    };
}

/**
 * Create an MCP server instance wired to the given api mock.
 */
export function buildMcpServer(api, { toolProfile = MCP_TOOL_PROFILES.FULL } = {}) {
    const defaultProjectId = FIXTURES.project._id;
    const server = new McpServer({
        name: 'kumbukum-test',
        version: '0.0.1',
    });

    const allTools = applyToolProfile({
        ...noteTools(api, defaultProjectId),
        ...memoryTools(api, defaultProjectId),
        ...urlTools(api, defaultProjectId),
        ...emailTools(api, defaultProjectId),
        ...projectTools(api),
        ...graphTools(api),
        ...gitSyncTools(api, defaultProjectId),
    }, toolProfile);

    for (const [name, tool] of Object.entries(allTools)) {
        server.registerTool(name, {
            description: tool.description,
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            annotations: tool.annotations,
            _meta: buildToolMeta(name, tool),
        }, tool.handler);
    }

    return server;
}

/**
 * Start an Express HTTP server with the /mcp Streamable HTTP endpoint.
 * Returns { url, close, app }.
 */
export async function startTestServer(api) {
    const app = express();
    app.use(express.json());

    app.post('/mcp', async (req, res) => {
        const server = buildMcpServer(api);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });

    app.get('/mcp', async (req, res) => {
        const server = buildMcpServer(api);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });

    app.delete('/mcp', async (req, res) => {
        const server = buildMcpServer(api);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });

    app.post('/mcp/app', async (req, res) => {
        const server = buildMcpServer(api, { toolProfile: MCP_TOOL_PROFILES.APP });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });

    app.get('/mcp/app', async (req, res) => {
        const server = buildMcpServer(api, { toolProfile: MCP_TOOL_PROFILES.APP });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });

    app.delete('/mcp/app', async (req, res) => {
        const server = buildMcpServer(api, { toolProfile: MCP_TOOL_PROFILES.APP });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });

    return new Promise((resolve) => {
        const httpServer = app.listen(0, () => {
            const port = httpServer.address().port;
            const url = `http://127.0.0.1:${port}/mcp`;
            const appUrl = `http://127.0.0.1:${port}/mcp/app`;
            resolve({
                url,
                appUrl,
                port,
                app,
                close: () => new Promise((r) => httpServer.close(r)),
            });
        });
    });
}

/**
 * Create an MCP client connected to the given test server URL.
 * Returns the connected Client instance.
 */
export async function createTestClient(serverUrl) {
    const client = new Client({ name: 'test-client', version: '0.0.1' });
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    await client.connect(transport);
    return client;
}
