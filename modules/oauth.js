import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config.js';

export const OAUTH_GRANT_TYPES = ['authorization_code', 'refresh_token'];
export const OAUTH_RESPONSE_TYPES = ['code'];
export const OAUTH_TOKEN_ENDPOINT_AUTH_METHODS = ['none', 'client_secret_post', 'private_key_jwt'];
export const OAUTH_CODE_CHALLENGE_METHODS = ['S256'];

export const MCP_SCOPE_DETAILS = {
	'mcp:read': {
		label: 'Read knowledge',
		description: 'List, search, and read notes, memories, URLs, projects, graph data, and chat context.',
	},
	'mcp:write': {
		label: 'Modify knowledge',
		description: 'Create, update, and delete notes, memories, URLs, and graph links.',
	},
	'mcp:email': {
		label: 'Email access',
		description: 'Read, search, ingest, and delete emails through MCP tools.',
	},
	'mcp:git': {
		label: 'Git sync access',
		description: 'Read and manage Git Sync repositories and synchronization tasks.',
	},
};

export const MCP_BASELINE_SCOPES = ['mcp:read'];
export const MCP_ALL_SCOPES = Object.keys(MCP_SCOPE_DETAILS);

export const MCP_TOOL_SCOPES = {
	create_note: ['mcp:read', 'mcp:write'],
	update_note: ['mcp:read', 'mcp:write'],
	delete_note: ['mcp:read', 'mcp:write'],
	store_memory: ['mcp:read', 'mcp:write'],
	update_memory: ['mcp:read', 'mcp:write'],
	delete_memory: ['mcp:read', 'mcp:write'],
	save_url: ['mcp:read', 'mcp:write'],
	update_url: ['mcp:read', 'mcp:write'],
	delete_url: ['mcp:read', 'mcp:write'],
	create_link: ['mcp:read', 'mcp:write'],
	delete_link: ['mcp:read', 'mcp:write'],
	ingest_email: ['mcp:read', 'mcp:email'],
	read_email: ['mcp:read', 'mcp:email'],
	list_emails: ['mcp:read', 'mcp:email'],
	search_emails: ['mcp:read', 'mcp:email'],
	get_email_thread: ['mcp:read', 'mcp:email'],
	delete_email: ['mcp:read', 'mcp:email'],
	list_git_repos: ['mcp:read', 'mcp:git'],
	get_git_repo: ['mcp:read', 'mcp:git'],
	create_git_repo: ['mcp:read', 'mcp:git'],
	update_git_repo: ['mcp:read', 'mcp:git'],
	delete_git_repo: ['mcp:read', 'mcp:git'],
	sync_git_repo: ['mcp:read', 'mcp:git'],
};

function normalizeBaseUrl(value, fallback) {
	return String(value || fallback || '').trim().replace(/\/$/, '');
}

export function getOauthIssuer() {
	return `${normalizeBaseUrl(config.appUrl, 'http://localhost:3000')}/oauth`;
}

export function getMcpBaseUrl() {
	const configuredMcpBaseUrl = process.env.MCP_BASE_URL ? config.mcpBaseUrl : null;
	return normalizeBaseUrl(configuredMcpBaseUrl || inferMcpBaseUrlFromAppUrl(), 'http://localhost:3002');
}

function inferMcpBaseUrlFromAppUrl() {
	let parsed;
	try {
		parsed = new URL(config.appUrl);
	} catch {
		return null;
	}

	if (!parsed.hostname.startsWith('app.')) return null;
	parsed.hostname = parsed.hostname.replace(/^app\./, 'mcp.');
	parsed.pathname = '';
	parsed.search = '';
	parsed.hash = '';
	return parsed.toString();
}

export function getRequestExternalBaseUrl(req) {
	const forwardedHost = req?.headers?.['x-forwarded-host'];
	const forwardedProto = req?.headers?.['x-forwarded-proto'];
	const host = String(Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req?.headers?.host || '').split(',')[0].trim();
	const proto = String(Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || req?.protocol || '').split(',')[0].trim();

	if (host) {
		return normalizeBaseUrl(`${proto || 'https'}://${host}`);
	}

	return getMcpBaseUrl();
}

export function getRequestMcpResourceUrls(req) {
	const base = getRequestExternalBaseUrl(req);
	return [base, `${base}/mcp`, `${base}/sse`];
}

export function getRequestProtectedResourceMetadataUrl(req) {
	const path = req?.path === '/mcp' || req?.path === '/sse' ? req.path : '';
	return `${getRequestExternalBaseUrl(req)}/.well-known/oauth-protected-resource${path}`;
}

export function getMcpEndpointUrl() {
	return `${getMcpBaseUrl()}/mcp`;
}

export function getMcpSseUrl() {
	return `${getMcpBaseUrl()}/sse`;
}

export function getProtectedResourceMetadataUrl(path = '') {
	const suffix = path ? `/${String(path).replace(/^\/+/, '')}` : '';
	return `${getMcpBaseUrl()}/.well-known/oauth-protected-resource${suffix}`;
}

export function getAllowedMcpResourceUrls(extraResources = []) {
	const base = getMcpBaseUrl();
	return [...new Set([base, getMcpEndpointUrl(), getMcpSseUrl(), ...extraResources].map((url) => normalizeBaseUrl(url)).filter(Boolean))];
}

export function getAuthorizationServerMetadataUrls() {
	const issuer = getOauthIssuer();
	const appBase = normalizeBaseUrl(config.appUrl, 'http://localhost:3000');
	return {
		issuer,
		oauth_authorization_server: `${appBase}/.well-known/oauth-authorization-server/oauth`,
		openid_configuration_path_inserted: `${appBase}/.well-known/openid-configuration/oauth`,
		openid_configuration_path_appended: `${issuer}/.well-known/openid-configuration`,
	};
}

export function normalizeScopeInput(scope) {
	const values = Array.isArray(scope)
		? scope
		: String(scope || '')
			.split(/\s+/)
			.filter(Boolean);

	return [...new Set(values)]
		.filter((item) => MCP_SCOPE_DETAILS[item])
		.sort();
}

export function scopeString(scope) {
	return normalizeScopeInput(scope).join(' ');
}

export function getRequiredScopesForTool(toolName) {
	return MCP_TOOL_SCOPES[toolName] || MCP_BASELINE_SCOPES;
}

export function hasRequiredScopes(grantedScopes, requiredScopes) {
	const granted = new Set(normalizeScopeInput(grantedScopes));
	return normalizeScopeInput(requiredScopes).every((scope) => granted.has(scope));
}

export function listScopeDetails(scopes) {
	return normalizeScopeInput(scopes).map((scope) => ({
		scope,
		...(MCP_SCOPE_DETAILS[scope] || { label: scope, description: scope }),
	}));
}

function signToken(payload, expiresIn) {
	return jwt.sign(payload, config.jwtSecret, {
		algorithm: 'HS256',
		expiresIn,
	});
}

export function signMcpAccessToken({ userId, tenantId, host_id, clientId, clientName, scopes, audience }) {
	const scope = scopeString(scopes);
	return signToken({
		iss: getOauthIssuer(),
		sub: String(userId),
		aud: audience,
		host_id,
		tenantId,
		client_id: clientId,
		client_name: clientName || undefined,
		scope,
		jti: crypto.randomUUID(),
		token_use: 'access',
	}, '10m');
}

export function signMcpBridgeToken({ userId, tenantId, host_id, clientId, scopes }) {
	const scope = scopeString(scopes);
	return signToken({
		iss: getMcpBaseUrl(),
		sub: String(userId),
		aud: 'kumbukum-api',
		host_id,
		tenantId,
		client_id: clientId,
		scope,
		jti: crypto.randomUUID(),
		mcp_bridge: true,
	}, '60s');
}

export function verifyMcpAccessToken(token, options = {}) {
	return jwt.verify(token, config.jwtSecret, {
		algorithms: ['HS256'],
		issuer: getOauthIssuer(),
		audience: getAllowedMcpResourceUrls(options.extraAudiences || []),
	});
}

export function verifyMcpBridgeToken(token) {
	return jwt.verify(token, config.jwtSecret, {
		algorithms: ['HS256'],
		issuer: getMcpBaseUrl(),
		audience: 'kumbukum-api',
	});
}

function escapeHeaderValue(value) {
	return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildBearerChallenge({
	resourceMetadataUrl = getProtectedResourceMetadataUrl(),
	scopes = MCP_BASELINE_SCOPES,
	error = null,
	errorDescription = null,
} = {}) {
	const parts = [`Bearer resource_metadata="${escapeHeaderValue(resourceMetadataUrl)}"`];
	const scope = scopeString(scopes);
	if (scope) parts.push(`scope="${escapeHeaderValue(scope)}"`);
	if (error) parts.push(`error="${escapeHeaderValue(error)}"`);
	if (errorDescription) parts.push(`error_description="${escapeHeaderValue(errorDescription)}"`);
	return parts.join(', ');
}

export function buildProtectedResourceMetadata(resource) {
	return {
		resource,
		authorization_servers: [getOauthIssuer()],
		scopes_supported: MCP_ALL_SCOPES,
		bearer_methods_supported: ['header'],
	};
}

export function isAllowedMcpResource(resource) {
	return getAllowedMcpResourceUrls().includes(String(resource || '').replace(/\/$/, ''));
}

export function sha256Base64Url(value) {
	return crypto.createHash('sha256').update(String(value)).digest('base64url');
}
