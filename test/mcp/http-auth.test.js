import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { emailTools } from '../../apps/mcp/tools/emails.js';
import { gitSyncTools } from '../../apps/mcp/tools/git_sync.js';
import { graphTools } from '../../apps/mcp/tools/graph.js';
import { memoryTools } from '../../apps/mcp/tools/memory.js';
import { noteTools } from '../../apps/mcp/tools/notes.js';
import { applyToolProfile, MCP_TOOL_PROFILES } from '../../apps/mcp/tools/profile.js';
import { projectTools } from '../../apps/mcp/tools/projects.js';
import { urlTools } from '../../apps/mcp/tools/urls.js';
import { buildProtectedResourceMetadata, getDefaultScopesForRequestPath, getMcpAppEndpointUrl, getMcpEndpointUrl, getRequiredScopesForTool, hasRequiredScopes, signMcpAccessToken } from '../../modules/oauth.js';
import {
	authenticateHttpRequest,
	buildUnauthorizedResponse,
	checkRequestScopes,
	extractRequestAuth,
	getRequiredScopesForRequestBody,
} from '../../apps/mcp/lib/http-auth.js';

function buildScopeTestTools() {
	const api = {};
	const defaultProjectId = 'project-1';
	return {
		...noteTools(api, defaultProjectId),
		...memoryTools(api, defaultProjectId),
		...urlTools(api, defaultProjectId),
		...emailTools(api, defaultProjectId),
		...projectTools(api),
		...graphTools(api),
		...gitSyncTools(api, defaultProjectId),
	};
}

describe('MCP HTTP auth helper', () => {
	it('extracts bearer and token credentials from headers', () => {
		assert.deepEqual(
			extractRequestAuth({ authorization: 'Bearer abc' }),
			{ scheme: 'Bearer', token: 'abc' },
		);
		assert.deepEqual(
			extractRequestAuth({ authorization: 'Token def' }),
			{ scheme: 'Token', token: 'def' },
		);
	});

	it('returns a bearer challenge when credentials are missing', () => {
		const response = buildUnauthorizedResponse();
		assert.equal(response.status, 401);
		assert.ok(response.headers['WWW-Authenticate'].includes('resource_metadata='));
		assert.match(response.headers['WWW-Authenticate'], /scope="mcp:email mcp:git mcp:read mcp:write"/);
	});

	it('uses forwarded public host for auth challenges', () => {
		const result = authenticateHttpRequest({
			path: '/mcp',
			protocol: 'http',
			headers: {
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.streamient.com',
			},
		});

		assert.equal(result.ok, false);
		assert.match(result.response.headers['WWW-Authenticate'], /resource_metadata="https:\/\/mcp\.streamient\.com\/\.well-known\/oauth-protected-resource\/mcp"/);
		assert.match(result.response.headers['WWW-Authenticate'], /scope="mcp:email mcp:git mcp:read mcp:write"/);
	});

	it('uses app-profile resource metadata for /mcp/app auth challenges', () => {
		const result = authenticateHttpRequest({
			path: '/mcp/app',
			protocol: 'http',
			headers: {
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.streamient.com',
			},
		});

		assert.equal(result.ok, false);
		assert.match(result.response.headers['WWW-Authenticate'], /resource_metadata="https:\/\/mcp\.streamient\.com\/\.well-known\/oauth-protected-resource\/mcp\/app"/);
		assert.match(result.response.headers['WWW-Authenticate'], /scope="mcp:read mcp:write"/);
		assert.doesNotMatch(result.response.headers['WWW-Authenticate'], /mcp:email/);
		assert.doesNotMatch(result.response.headers['WWW-Authenticate'], /mcp:git/);
	});

	it('advertises only read and write scopes for the app-profile protected resource', () => {
		const metadata = buildProtectedResourceMetadata(getMcpAppEndpointUrl());
		assert.deepEqual(metadata.scopes_supported, ['mcp:read', 'mcp:write']);
	});

	it('authenticates valid OAuth bearer tokens and mints bridge auth', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: getMcpEndpointUrl(),
		});
		const result = authenticateHttpRequest({ headers: { authorization: `Bearer ${token}` } });
		assert.equal(result.ok, true);
		assert.equal(result.mode, 'oauth');
		assert.equal(result.tokenClaims.sub, 'user-1');
		assert.equal(result.apiAuth.scheme, 'Bearer');
		assert.ok(result.apiAuth.token);
	});

	it('authenticates OAuth tokens with request-derived public audience', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: 'https://mcp.streamient.com/mcp',
		});
		const result = authenticateHttpRequest({
			path: '/mcp',
			protocol: 'http',
			headers: {
				authorization: `Bearer ${token}`,
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.streamient.com',
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.mode, 'oauth');
	});

	it('authenticates OAuth tokens with /mcp/app audience', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: 'https://mcp.streamient.com/mcp/app',
		});
		const result = authenticateHttpRequest({
			path: '/mcp/app',
			protocol: 'http',
			headers: {
				authorization: `Bearer ${token}`,
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.streamient.com',
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.mode, 'oauth');
	});

	it('accepts personal access tokens in Bearer headers for legacy clients', () => {
		const result = authenticateHttpRequest({ headers: { authorization: 'Bearer personal-access-token' } });
		assert.equal(result.ok, true);
		assert.equal(result.mode, 'legacy');
		assert.equal(result.apiAuth, 'personal-access-token');
	});

	it('rejects JWT-shaped invalid bearer tokens as invalid OAuth tokens', () => {
		const result = authenticateHttpRequest({ headers: { authorization: 'Bearer not.valid.jwt' } });
		assert.equal(result.ok, false);
		assert.equal(result.response.status, 401);
		assert.equal(result.response.body.error, 'Invalid access token');
	});

	it('computes elevated scope requirements for write tool calls', () => {
		const required = getRequiredScopesForRequestBody({
			method: 'tools/call',
			params: { name: 'create_note' },
		});
		assert.deepEqual(required, ['mcp:read', 'mcp:write']);
	});

	it('maps every non-read-only tool to elevated OAuth scopes', () => {
		for (const [name, tool] of Object.entries(buildScopeTestTools())) {
			if (tool.annotations?.readOnlyHint !== false) continue;
			assert.notDeepEqual(getRequiredScopesForTool(name), ['mcp:read'], `${name} only requires baseline read`);
		}
	});

	it('covers every app-profile tool with /mcp/app default scopes', () => {
		const appScopes = getDefaultScopesForRequestPath('/mcp/app');
		const appTools = applyToolProfile(buildScopeTestTools(), MCP_TOOL_PROFILES.APP);

		for (const name of Object.keys(appTools)) {
			assert.equal(hasRequiredScopes(appScopes, getRequiredScopesForTool(name)), true, `${name} is not covered by app default scopes`);
		}
	});

	it('uses narrower OAuth default scopes for /mcp/app than full /mcp', () => {
		assert.deepEqual(getDefaultScopesForRequestPath('/mcp'), ['mcp:read', 'mcp:write', 'mcp:email', 'mcp:git']);
		assert.deepEqual(getDefaultScopesForRequestPath('/mcp/app'), ['mcp:read', 'mcp:write']);
	});

	it('returns insufficient_scope for write calls using read-only tokens', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: getMcpEndpointUrl(),
		});
		const authContext = authenticateHttpRequest({ headers: { authorization: `Bearer ${token}` } });
		const response = checkRequestScopes(authContext, {
			method: 'tools/call',
			params: { name: 'create_note' },
		});

		assert.equal(response.status, 403);
		assert.ok(response.headers['WWW-Authenticate'].includes('insufficient_scope'));
		assert.deepEqual(response.body.required_scopes, ['mcp:read', 'mcp:write']);
	});
});
