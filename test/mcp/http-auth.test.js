import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { signMcpAccessToken } from '../../modules/oauth.js';
import {
	authenticateHttpRequest,
	buildUnauthorizedResponse,
	checkRequestScopes,
	extractRequestAuth,
	getRequiredScopesForRequestBody,
} from '../../apps/mcp/lib/http-auth.js';

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
		assert.ok(response.headers['WWW-Authenticate'].includes('scope="mcp:read"'));
	});

	it('uses forwarded public host for auth challenges', () => {
		const result = authenticateHttpRequest({
			path: '/mcp',
			protocol: 'http',
			headers: {
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.kumbukum.com',
			},
		});

		assert.equal(result.ok, false);
		assert.match(result.response.headers['WWW-Authenticate'], /resource_metadata="https:\/\/mcp\.kumbukum\.com\/\.well-known\/oauth-protected-resource\/mcp"/);
	});

	it('uses app-profile resource metadata for /mcp/app auth challenges', () => {
		const result = authenticateHttpRequest({
			path: '/mcp/app',
			protocol: 'http',
			headers: {
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.kumbukum.com',
			},
		});

		assert.equal(result.ok, false);
		assert.match(result.response.headers['WWW-Authenticate'], /resource_metadata="https:\/\/mcp\.kumbukum\.com\/\.well-known\/oauth-protected-resource\/mcp\/app"/);
	});

	it('authenticates valid OAuth bearer tokens and mints bridge auth', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: 'http://localhost:3002/mcp',
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
			audience: 'https://mcp.kumbukum.com/mcp',
		});
		const result = authenticateHttpRequest({
			path: '/mcp',
			protocol: 'http',
			headers: {
				authorization: `Bearer ${token}`,
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.kumbukum.com',
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
			audience: 'https://mcp.kumbukum.com/mcp/app',
		});
		const result = authenticateHttpRequest({
			path: '/mcp/app',
			protocol: 'http',
			headers: {
				authorization: `Bearer ${token}`,
				host: 'mcp:3002',
				'x-forwarded-proto': 'https',
				'x-forwarded-host': 'mcp.kumbukum.com',
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

	it('returns insufficient_scope for write calls using read-only tokens', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: 'http://localhost:3002/mcp',
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
