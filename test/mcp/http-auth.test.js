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
	isAppRestrictedToken,
	sessionBindingKeyForContext,
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

	it('mints a fresh bridge token per request so long-lived sessions never reuse a stale 60s credential', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: getMcpEndpointUrl(),
		});
		const first = authenticateHttpRequest({ headers: { authorization: `Bearer ${token}` } });
		const second = authenticateHttpRequest({ headers: { authorization: `Bearer ${token}` } });

		assert.equal(first.ok, true);
		assert.equal(second.ok, true);
		// Each request re-mints from the validated identity instead of caching
		// the connection-time bridge, so the 60s upstream credential never ages.
		assert.notEqual(first.apiAuth.token, second.apiAuth.token);
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

	it('binds OAuth sessions to tenant, audience, and scopes — not just user and client', () => {
		const base = {
			sub: 'user-1',
			client_id: 'client-1',
			host_id: 'host-a',
			tenantId: 'tenant-a',
			aud: getMcpEndpointUrl(),
			scope: 'mcp:read',
		};
		const a = sessionBindingKeyForContext({ mode: 'oauth', tokenClaims: base });
		assert.equal(a, sessionBindingKeyForContext({ mode: 'oauth', tokenClaims: { ...base, scope: 'mcp:read' } }));

		// A different tenant for the same user+client must never share a session.
		const otherTenant = sessionBindingKeyForContext({ mode: 'oauth', tokenClaims: { ...base, host_id: 'host-b', tenantId: 'tenant-b' } });
		assert.notEqual(a, otherTenant);

		// A different audience/resource must not share the session either.
		const otherAudience = sessionBindingKeyForContext({ mode: 'oauth', tokenClaims: { ...base, aud: getMcpAppEndpointUrl() } });
		assert.notEqual(a, otherAudience);

		// A write grant differs from a read grant and must not drive a read session.
		const writeGrant = sessionBindingKeyForContext({ mode: 'oauth', tokenClaims: { ...base, scope: 'mcp:read mcp:write' } });
		assert.notEqual(a, writeGrant);
	});

	it('binds legacy PAT sessions to the exact token', () => {
		assert.equal(sessionBindingKeyForContext({ mode: 'legacy', apiAuth: 'pat-1' }), 'legacy:pat-1');
		assert.notEqual(sessionBindingKeyForContext({ mode: 'legacy', apiAuth: 'pat-1' }), sessionBindingKeyForContext({ mode: 'legacy', apiAuth: 'pat-2' }));
		assert.equal(sessionBindingKeyForContext(null), 'anon');
	});

	it('recognizes app-restricted OAuth tokens by audience', () => {
		assert.equal(isAppRestrictedToken({ mode: 'oauth', tokenClaims: { aud: getMcpAppEndpointUrl() } }), true);
		assert.equal(isAppRestrictedToken({ mode: 'oauth', tokenClaims: { aud: getMcpEndpointUrl() } }), false);
		assert.equal(isAppRestrictedToken({ mode: 'legacy', apiAuth: 'pat-1' }), false);
		assert.equal(isAppRestrictedToken(null), false);
	});
});
