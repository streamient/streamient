import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import rateLimit from 'express-rate-limit';

import mcpConfig from './config.js';
import { ApiClient } from './lib/api-client.js';
import { authenticateHttpRequest, checkRequestScopes, extractRequestAuth } from './lib/http-auth.js';
import { noteTools } from './tools/notes.js';
import { memoryTools } from './tools/memory.js';
import { urlTools } from './tools/urls.js';
import { emailTools } from './tools/emails.js';
import { projectTools } from './tools/projects.js';
import { graphTools } from './tools/graph.js';
import { gitSyncTools } from './tools/git_sync.js';
import { MCP_SERVER_INSTRUCTIONS } from './instructions.js';
import { buildProtectedResourceMetadata, getRequestExternalBaseUrl } from '../../modules/oauth.js';
import { captureException, flush, setupExpressErrorHandler } from './sentry.js';
import { recordException, setupExpressErrorHandler as setupOtelExpressErrorHandler } from './tracing.js';

const PORT = mcpConfig.port;
const API_BASE_URL = mcpConfig.apiBaseUrl;
const MCP_TOOL_TELEMETRY = process.env.MCP_TOOL_TELEMETRY === 'true';

function estimateTokens(value) {
  return Math.ceil(String(value || '').length / 4);
}

function summarizeToolResult(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const text = content
    .filter((item) => item?.type === 'text')
    .map((item) => item.text || '')
    .join('\n');
  return {
    content_items: content.length,
    text_chars: text.length,
    estimated_tokens: estimateTokens(text),
  };
}

function logToolTelemetry(event) {
  if (!MCP_TOOL_TELEMETRY) return;
  console.log(JSON.stringify({ event: 'mcp_tool_call', ...event }));
}

function extractToken(req) {
  return extractRequestAuth(req.headers)?.token || null;
}

function authKeyForContext(authContext) {
  if (!authContext) return 'anon';
  if (authContext.mode === 'oauth') {
    return `${authContext.tokenClaims.sub}:${authContext.tokenClaims.client_id}`;
  }
  return `legacy:${authContext.apiAuth}`;
}

function sendAuthResponse(res, response) {
  if (response?.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
  }
  return res.status(response?.status || 401).json(response?.body || { error: 'Authentication required' });
}

async function resolveDefaultProjectId(api, projectIdOverride) {
  if (projectIdOverride) return projectIdOverride;
  const { projects } = await api.get('/projects');
  const def = projects?.find((p) => p.is_default);
  if (!def) throw new Error('No default project found — pass X-Project-Id header or create a default project');
  return def._id;
}

async function createServer(apiAuth, { projectId } = {}) {
  const api = new ApiClient(API_BASE_URL, apiAuth);
  const defaultProjectId = await resolveDefaultProjectId(api, projectId);
  let emailFeatureEnabled = true;
  let gitSyncFeatureEnabled = true;
  try {
    const { features } = await api.get('/features');
    emailFeatureEnabled = features?.email_ingest !== false;
    gitSyncFeatureEnabled = features?.git_sync !== false;
  } catch {
    // Fallback for older API versions: keep enabled by default.
    emailFeatureEnabled = true;
    gitSyncFeatureEnabled = true;
  }

  const server = new McpServer({
    name: 'kumbukum',
    version: '0.1.0',
    instructions: MCP_SERVER_INSTRUCTIONS,
  });

  // Register all tools, wrapping handlers to inject MCP client identity
  const allTools = {
    ...noteTools(api, defaultProjectId),
    ...memoryTools(api, defaultProjectId),
    ...urlTools(api, defaultProjectId),
    ...(emailFeatureEnabled ? emailTools(api, defaultProjectId) : {}),
    ...projectTools(api),
    ...graphTools(api),
    ...(gitSyncFeatureEnabled ? gitSyncTools(api, defaultProjectId) : {}),
  };

  for (const [name, tool] of Object.entries(allTools)) {
    const originalHandler = tool.handler;
    const wrappedHandler = async (params, extra) => {
      const started = Date.now();
      const cv = server.server.getClientVersion();
      const client = cv ? `${cv.name || 'unknown'}/${cv.version || '?'}` : 'unknown';
      if (cv) {
        api.setMcpClient(client);
      }
      try {
        const result = await originalHandler(params, extra);
        logToolTelemetry({
          tool: name,
          client,
          duration_ms: Date.now() - started,
          args_chars: JSON.stringify(params || {}).length,
          args_estimated_tokens: estimateTokens(JSON.stringify(params || {})),
          requested_per_page: params?.per_page || params?.limit || null,
          success: true,
          result: summarizeToolResult(result),
        });
        return result;
      } catch (err) {
        recordException(err);
        captureException(err, {
          tags: {
            phase: 'tool_call',
            tool: name,
            client,
          },
        });
        logToolTelemetry({
          tool: name,
          client,
          duration_ms: Date.now() - started,
          args_chars: JSON.stringify(params || {}).length,
          args_estimated_tokens: estimateTokens(JSON.stringify(params || {})),
          requested_per_page: params?.per_page || params?.limit || null,
          success: false,
          error: err?.message || 'unknown',
        });
        throw err;
      }
    };
    server.tool(name, tool.description, tool.inputSchema, wrappedHandler);
  }

  return server;
}

// Determine transport mode
const transportArg = process.argv[2];

if (transportArg === '--stdio' || !transportArg) {
  // stdio transport (default for Claude Desktop etc.)
  const token = process.env['ACCESS-TOKEN'];
  if (!token) {
    console.error('ACCESS-TOKEN environment variable required for stdio transport');
    process.exit(1);
  }

  const projectId = process.env['PROJECT-ID'] || null;
  try {
    const server = await createServer(token, { projectId });
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (err) {
    recordException(err);
    captureException(err, { tags: { phase: 'stdio_startup' } });
    console.error('Fatal error starting Kumbukum MCP stdio server:', err);
    await flush();
    process.exit(1);
  }
} else {
  // HTTP/SSE transport
  const app = express();
  app.use(express.json());

  // Health check — no auth, no rate limit
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', transport: 'http' });
  });

  app.get('/.well-known/oauth-protected-resource', (req, res) => {
	res.json(buildProtectedResourceMetadata(getRequestExternalBaseUrl(req)));
  });

  app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
	const baseUrl = getRequestExternalBaseUrl(req);
	res.json(buildProtectedResourceMetadata(`${baseUrl}/mcp`));
  });

  app.get('/.well-known/oauth-protected-resource/sse', (req, res) => {
	const baseUrl = getRequestExternalBaseUrl(req);
	res.json(buildProtectedResourceMetadata(`${baseUrl}/sse`));
  });

  // MCP rate limiter — 120 req/min per token (in-memory store)
  const mcpLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    keyGenerator: (req) => extractToken(req) || 'anon',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'MCP rate limit exceeded (120 requests/min).' },
  });
  app.use(mcpLimiter);

  // SSE endpoint
  const sseTransports = new Map();

  app.get('/sse', async (req, res) => {
    try {
      const authContext = authenticateHttpRequest(req);
      if (!authContext.ok) return sendAuthResponse(res, authContext.response);

      const projectId = req.headers['x-project-id'] || null;
      const server = await createServer(authContext.apiAuth, { projectId });
      const transport = new SSEServerTransport('/messages', res);
      sseTransports.set(transport.sessionId, {
		server,
		transport,
		authKey: authKeyForContext(authContext),
		mode: authContext.mode,
	});

      res.on('close', () => {
        sseTransports.delete(transport.sessionId);
      });

      await server.connect(transport);
    } catch (err) {
      recordException(err);
      captureException(err, { tags: { phase: 'sse_connect' } });
      console.error('Error starting Kumbukum MCP SSE connection:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.post('/messages', async (req, res) => {
    try {
      const authContext = authenticateHttpRequest(req);
      if (!authContext.ok) return sendAuthResponse(res, authContext.response);
      const sessionId = req.query.sessionId;
      const session = sseTransports.get(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.authKey !== authKeyForContext(authContext)) {
		return sendAuthResponse(res, authContext.response || { status: 401, body: { error: 'Session authentication mismatch' } });
	}
	const scopeResponse = checkRequestScopes(authContext, req.body);
	if (scopeResponse) return sendAuthResponse(res, scopeResponse);
      await session.transport.handlePostMessage(req, res);
    } catch (err) {
      recordException(err);
      captureException(err, { tags: { phase: 'sse_message' } });
      console.error('Error handling Kumbukum MCP SSE message:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Streamable HTTP endpoint — stateless (no sessions)
  // Shared handler for all methods on /mcp
  const handleMcp = async (req, res) => {
    try {
      const authContext = authenticateHttpRequest(req);
      if (!authContext.ok) return sendAuthResponse(res, authContext.response);
	const scopeResponse = checkRequestScopes(authContext, req.body);
	if (scopeResponse) return sendAuthResponse(res, scopeResponse);

      const projectId = req.headers['x-project-id'] || null;
      const server = await createServer(authContext.apiAuth, { projectId });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      recordException(err);
      captureException(err, { tags: { phase: 'streamable_http' } });
      console.error('Error handling Kumbukum MCP HTTP request:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  app.post('/mcp', handleMcp);
  app.get('/mcp', handleMcp);
  app.delete('/mcp', handleMcp);

  setupOtelExpressErrorHandler(app);
  setupExpressErrorHandler(app);

  app.listen(PORT, () => {
    console.log(`Kumbukum MCP server running on port ${PORT}`);
    console.log(`  SSE: http://localhost:${PORT}/sse`);
    console.log(`  HTTP: http://localhost:${PORT}/mcp`);
  });
}
