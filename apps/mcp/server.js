import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

import mcpConfig from './config.js';
import { ApiClient } from './lib/api-client.js';
import { authenticateHttpRequest, checkRequestScopes } from './lib/http-auth.js';
import { noteTools } from './tools/notes.js';
import { memoryTools } from './tools/memory.js';
import { urlTools } from './tools/urls.js';
import { emailTools } from './tools/emails.js';
import { projectTools } from './tools/projects.js';
import { graphTools } from './tools/graph.js';
import { gitSyncTools } from './tools/git_sync.js';
import { applyToolProfile, MCP_TOOL_PROFILES } from './tools/profile.js';
import { MCP_SERVER_INSTRUCTIONS } from './instructions.js';
import { buildProtectedResourceMetadata, getRequestExternalBaseUrl, getRequiredScopesForTool } from '../../modules/oauth.js';
import McpRateLimit from '../../modules/mcp_rate_limit.js';
import { recordException, setupExpressErrorHandler as setupOtelExpressErrorHandler } from './tracing.js';
import { createLogger } from '../../modules/logger.js';

const PORT = mcpConfig.port;
const API_BASE_URL = mcpConfig.apiBaseUrl;
const MCP_PRODUCT = 'kumbukum';
const log = createLogger('mcp');
// Default project id + feature flags change rarely, so cache them long enough
// to stay warm across a user's session and normal gaps between calls. 60s was
// short enough that spaced-out calls always missed and re-paid the two upstream
// API lookups every time.
const BOOTSTRAP_TTL_MS = Number(process.env.MCP_BOOTSTRAP_TTL_MS) || 600_000;
const bootstrapCache = new Map();

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
  const level = event?.success === false ? 'warn' : 'info';
  log[level]({ event: 'mcp_tool_call', ...event }, `mcp tool ${event?.tool || ''} ${event?.success === false ? 'failed' : 'ok'}`.trim());
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

async function resolveBootstrap(api, { projectId, cacheKey }) {
  const now = Date.now();
  if (cacheKey) {
    const cached = bootstrapCache.get(cacheKey);
    if (cached && cached.expires > now) return { ...cached.value, cacheHit: true };
  }
  const defaultProjectId = await resolveDefaultProjectId(api, projectId);
  let emailFeatureEnabled = true;
  let gitSyncFeatureEnabled = true;
  try {
    const { features } = await api.get('/features');
    emailFeatureEnabled = features?.email_ingest !== false;
    gitSyncFeatureEnabled = features?.git_sync !== false;
  } catch {
    emailFeatureEnabled = true;
    gitSyncFeatureEnabled = true;
  }
  const value = { defaultProjectId, emailFeatureEnabled, gitSyncFeatureEnabled };
  if (cacheKey) {
    bootstrapCache.set(cacheKey, { value, expires: now + BOOTSTRAP_TTL_MS });
  }
  return { ...value, cacheHit: false };
}

function logMcpRequest(event) {
  const level = event?.success === false ? 'error' : 'info';
  log[level]({ event: 'mcp_request', ...event }, `mcp ${event?.transport || 'http'} ${event?.method || ''}`.trim());
}

function buildToolMeta(name, tool) {
  return {
    ...(tool._meta || {}),
    securitySchemes: [
      { type: 'oauth2', scopes: getRequiredScopesForTool(name) },
    ],
  };
}

async function createServer(apiAuth, { projectId, oauthClientId, cacheKey, toolProfile = MCP_TOOL_PROFILES.FULL, rateLimitKey = null } = {}) {
  const api = new ApiClient(API_BASE_URL, apiAuth);
  const toolRateLimitKey = rateLimitKey || McpRateLimit.getApiClientRateLimitKey(MCP_PRODUCT, api);
  const bootstrapStart = Date.now();
  const { defaultProjectId, emailFeatureEnabled, gitSyncFeatureEnabled, cacheHit } =
    await resolveBootstrap(api, { projectId, cacheKey });
  const bootstrapMs = Date.now() - bootstrapStart;

  const server = new McpServer({
    name: 'kumbukum',
    version: '0.1.0',
    instructions: MCP_SERVER_INSTRUCTIONS,
  });

  // Register all tools, wrapping handlers to inject MCP client identity
  let allTools = {
    ...noteTools(api, defaultProjectId),
    ...memoryTools(api, defaultProjectId),
    ...urlTools(api, defaultProjectId),
    ...(emailFeatureEnabled ? emailTools(api, defaultProjectId) : {}),
    ...projectTools(api),
    ...graphTools(api),
    ...(gitSyncFeatureEnabled ? gitSyncTools(api, defaultProjectId) : {}),
  };
  allTools = applyToolProfile(allTools, toolProfile);

  for (const [name, tool] of Object.entries(allTools)) {
    const originalHandler = tool.handler;
    const wrappedHandler = async (params, extra) => {
      const started = Date.now();
      const cv = server.server.getClientVersion();
      const client = cv ? `${cv.name || 'unknown'}/${cv.version || '?'}` : (oauthClientId || 'unknown');
      api.setMcpClient(client);
      try {
        const result = await McpRateLimit.runToolWithLimits({
          product: MCP_PRODUCT,
          rateLimitKey: toolRateLimitKey,
          toolName: name,
          run: () => originalHandler(params, extra),
        });
        logToolTelemetry({
          tool: name,
          client,
          duration_ms: Date.now() - started,
          args_chars: JSON.stringify(params || {}).length,
          args_estimated_tokens: estimateTokens(JSON.stringify(params || {})),
          requested_per_page: params?.per_page || params?.limit || null,
          success: !result?.isError,
          result: summarizeToolResult(result),
          error: result?.isError ? 'tool_error_envelope' : undefined,
        });
        return result;
      } catch (err) {
        recordException(err);
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
    server.registerTool(name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
      _meta: buildToolMeta(name, tool),
    }, wrappedHandler);
  }

  return { server, bootstrapMs, bootstrapCacheHit: cacheHit };
}

// Determine transport mode
const transportArg = process.argv[2];

if (transportArg === '--stdio' || !transportArg) {
  // stdio transport (default for Claude Desktop etc.)
  const token = process.env['ACCESS-TOKEN'];
  if (!token) {
    log.error('ACCESS-TOKEN environment variable required for stdio transport');
    process.exit(1);
  }

  const projectId = process.env['PROJECT-ID'] || null;
  try {
    const { server } = await createServer(token, { projectId });
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (err) {
    recordException(err);
    log.error({ err }, 'Fatal error starting Kumbukum MCP stdio server');
    process.exit(1);
  }
} else {
  // HTTP/SSE transport
  const app = express();

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

  app.get('/.well-known/oauth-protected-resource/mcp/app', (req, res) => {
	const baseUrl = getRequestExternalBaseUrl(req);
	res.json(buildProtectedResourceMetadata(`${baseUrl}/mcp/app`));
  });

  app.get('/.well-known/oauth-protected-resource/sse', (req, res) => {
	const baseUrl = getRequestExternalBaseUrl(req);
	res.json(buildProtectedResourceMetadata(`${baseUrl}/sse`));
  });

  app.use(McpRateLimit.createIpFloodLimiter(MCP_PRODUCT));
  app.use(McpRateLimit.createUnauthLimiter(MCP_PRODUCT));
  app.use(McpRateLimit.createSseOpenLimiter(MCP_PRODUCT));
  app.use(express.json());

  // SSE endpoint
  const sseTransports = new Map();

  app.get('/sse', async (req, res) => {
    try {
      const authContext = authenticateHttpRequest(req);
      if (!authContext.ok) return sendAuthResponse(res, authContext.response);

      const projectId = req.headers['x-project-id'] || null;
      const oauthClientId = authContext.tokenClaims?.client_name || authContext.tokenClaims?.client_id || null;
      const authKey = authKeyForContext(authContext);
      const rateLimitKey = McpRateLimit.getAuthContextRateLimitKey(MCP_PRODUCT, req, authContext);
      const cacheKey = `${authKey}:${projectId || ''}`;
      const { server } = await createServer(authContext.apiAuth, { projectId, oauthClientId, cacheKey, rateLimitKey });
      const transport = new SSEServerTransport('/messages', res);
      sseTransports.set(transport.sessionId, {
		server,
		transport,
		authKey,
		mode: authContext.mode,
		rateLimitKey,
	});

      res.on('close', () => {
        sseTransports.delete(transport.sessionId);
      });

      await server.connect(transport);
    } catch (err) {
      recordException(err);
      log.error({ err }, 'Error starting Kumbukum MCP SSE connection');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.post('/messages', async (req, res) => {
    try {
      const authContext = authenticateHttpRequest(req);
      if (!authContext.ok) return sendAuthResponse(res, authContext.response);
      if (!await McpRateLimit.consumeAuthenticatedRequest(MCP_PRODUCT, req, res, authContext)) return;
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
      log.error({ err }, 'Error handling Kumbukum MCP SSE message');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Streamable HTTP endpoint — stateless (no sessions)
  // Shared handler for all methods on /mcp and /mcp/app
  const handleMcp = (toolProfile = MCP_TOOL_PROFILES.FULL) => async (req, res) => {
    const requestStart = Date.now();
    const mcpMethod = req.body?.method || req.method;
    try {
      const authContext = authenticateHttpRequest(req);
      if (!authContext.ok) return sendAuthResponse(res, authContext.response);
      const rateLimitKey = McpRateLimit.getAuthContextRateLimitKey(MCP_PRODUCT, req, authContext);
      if (!await McpRateLimit.consumeAuthenticatedRequest(MCP_PRODUCT, req, res, authContext)) return;
	const scopeResponse = checkRequestScopes(authContext, req.body);
	if (scopeResponse) return sendAuthResponse(res, scopeResponse);

      const projectId = req.headers['x-project-id'] || null;
      const oauthClientId = authContext.tokenClaims?.client_name || authContext.tokenClaims?.client_id || null;
      const cacheKey = `${authKeyForContext(authContext)}:${projectId || ''}`;
      const { server, bootstrapMs, bootstrapCacheHit } = await createServer(authContext.apiAuth, { projectId, oauthClientId, cacheKey, toolProfile, rateLimitKey });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      logMcpRequest({
        method: mcpMethod,
        transport: 'streamable-http',
        duration_ms: Date.now() - requestStart,
        bootstrap_ms: bootstrapMs,
        bootstrap_cache_hit: bootstrapCacheHit,
        tool_profile: toolProfile,
        success: true,
      });
    } catch (err) {
      recordException(err);
      log.error({ err }, 'Error handling Kumbukum MCP HTTP request');
      logMcpRequest({
        method: mcpMethod,
        transport: 'streamable-http',
        duration_ms: Date.now() - requestStart,
        tool_profile: toolProfile,
        success: false,
        error: err?.message || 'unknown',
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  const handleFullMcp = handleMcp(MCP_TOOL_PROFILES.FULL);
  const handleAppMcp = handleMcp(MCP_TOOL_PROFILES.APP);

  app.post('/mcp', handleFullMcp);
  app.get('/mcp', handleFullMcp);
  app.delete('/mcp', handleFullMcp);
  app.post('/mcp/app', handleAppMcp);
  app.get('/mcp/app', handleAppMcp);
  app.delete('/mcp/app', handleAppMcp);

  setupOtelExpressErrorHandler(app);

  app.listen(PORT, () => {
    log.info({ port: PORT, sse: `/sse`, http: `/mcp`, app: `/mcp/app` }, `Kumbukum MCP server running on port ${PORT}`);
  });
}
