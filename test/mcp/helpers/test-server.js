/**
 * Helpers for spinning up a test MCP HTTP server and MCP client.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';

import { createMcpToolCatalog } from '../../../apps/mcp/tools/catalog.js';
import { MCP_TOOL_PROFILES } from '../../../apps/mcp/tools/profile.js';
import { getRequiredScopesForTool } from '../../../modules/oauth.js';

import { FIXTURES } from './fixtures.js';
import { MCP_SERVER_INSTRUCTIONS } from '../../../apps/mcp/instructions.js';

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
        name: 'streamient-test',
        version: '0.0.1',
    }, {
        instructions: MCP_SERVER_INSTRUCTIONS,
    });

    const allTools = createMcpToolCatalog(api, { defaultProjectId, toolProfile });

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
export async function startTestServer(api, { authorize = null } = {}) {
    const app = express();
    app.use(express.json());

    const handleMcp = (toolProfile = MCP_TOOL_PROFILES.FULL) => async (req, res) => {
        if (authorize && !authorize(req)) return res.status(401).json({ error: 'Invalid access token' });
        const server = buildMcpServer(api, { toolProfile });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    };

    app.all('/mcp', handleMcp());
    app.all('/mcp/app', handleMcp(MCP_TOOL_PROFILES.APP));

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
