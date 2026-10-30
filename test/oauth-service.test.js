import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import axios from 'axios';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import pug from 'pug';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import { authenticateClientForToken, buildAuthorizationServerMetadata, buildOauthUiConfig, findConsent, mapDynamicRegistrationClientResponse, parseAuthorizationRequest, validateAuthorizationRequest } from '../services/oauth_service.js';
import { MCP_APP_DEFAULT_SCOPES, MCP_DEFAULT_SCOPES, getMcpAppEndpointUrl, getMcpEndpointUrl, getOauthIssuer, listScopeDetailsForResource, signMcpAccessToken, verifyMcpAccessToken } from '../modules/oauth.js';
import { OAuthClient } from '../model/oauth_client.js';
import { OAuthConsent } from '../model/oauth_consent.js';

const oauthAuthorizeViewPath = fileURLToPath(new URL('../views/auth/oauth_authorize.pug', import.meta.url));
const clientAssertionType = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

function mockMetadataFetch(metadata) {
	const originalGet = axios.get;
	axios.get = async (url) => {
		assert.equal(String(url), metadata.client_id);
		return { data: JSON.stringify(metadata), headers: {} };
	};
	return () => { axios.get = originalGet; };
}

function mockQueryResult(result, onLean) {
	return {
		select() {
			return this;
		},
		lean(value = true) {
			onLean(value);
			return this;
		},
		then(resolve, reject) {
			return Promise.resolve(result).then(resolve, reject);
		},
	};
}

async function buildPrivateKeyJwtClient({ clientId = `https://example.com/oauth/client-${crypto.randomUUID()}.json`, includeJwks = true } = {}) {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	const publicJwk = await exportJWK(publicKey);
	publicJwk.kid = 'test-key';
	publicJwk.alg = 'RS256';
	publicJwk.use = 'sig';
	const metadata = {
		client_id: clientId,
		client_name: 'Example MCP Client',
		redirect_uris: ['http://127.0.0.1:3000/callback'],
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'private_key_jwt',
	};
	if (includeJwks) metadata.jwks = { keys: [publicJwk] };
	return { privateKey, metadata };
}

async function signClientAssertion(privateKey, clientId, options = {}) {
	const now = Math.floor(Date.now() / 1000);
	const jwt = new SignJWT({});
	jwt.setProtectedHeader({ alg: options.alg || 'RS256', kid: options.kid || 'test-key' });
	jwt.setIssuer(options.iss || clientId);
	jwt.setSubject(options.sub || clientId);
	jwt.setAudience(options.aud || `${getOauthIssuer()}/token`);
	jwt.setJti(options.jti || crypto.randomUUID());
	jwt.setIssuedAt(options.iat || now);
	if (options.includeExp !== false) jwt.setExpirationTime(options.exp || now + 60);
	return jwt.sign(privateKey);
}

describe('oauth helpers', () => {
	it('authenticates stored clients from lean query results', async () => {
		const originalFindOne = OAuthClient.findOne;
		const leanValues = [];
		const storedClient = {
			_id: 'client-record-1',
			client_id: 'kk_manual_test',
			client_name: 'Stored client',
			redirect_uris: ['https://example.com/callback'],
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
			registration_source: 'manual',
			host_id: 'host-1',
		};
		OAuthClient.findOne = () => mockQueryResult(storedClient, (value) => leanValues.push(value));

		try {
			const client = await authenticateClientForToken({ clientId: storedClient.client_id, host_id: storedClient.host_id });
			assert.equal(client.client_id, storedClient.client_id);
			assert.equal(client.registration_source, 'manual');
			assert.equal(client.doc, storedClient);
			assert.deepEqual(leanValues, []);
		} finally {
			OAuthClient.findOne = originalFindOne;
		}
	});

	it('keeps read-only consent lookup on the global lean default', async () => {
		const originalFindOne = OAuthConsent.findOne;
		const leanValues = [];
		const storedConsent = { _id: 'consent-1', scopes: ['mcp:read'] };
		OAuthConsent.findOne = () => mockQueryResult(storedConsent, (value) => leanValues.push(value));

		try {
			const consent = await findConsent({ userId: 'user-1', host_id: 'host-1', clientId: 'client-1', resource: getMcpEndpointUrl() });
			assert.equal(consent, storedConsent);
			assert.deepEqual(leanValues, [true]);
		} finally {
			OAuthConsent.findOne = originalFindOne;
		}
	});

	it('advertises DCR instead of client metadata documents for OAuth discovery', () => {
		const metadata = buildAuthorizationServerMetadata();
		const uiConfig = buildOauthUiConfig();

		assert.equal(metadata.client_id_metadata_document_supported, false);
		assert.equal(uiConfig.client_registration.client_id_metadata_document_supported, false);
		assert.equal(uiConfig.client_registration.dynamic_registration_supported, true);
		assert.equal(uiConfig.client_registration.pre_registration_supported, true);
	});

	it('parses a valid authorization request for the MCP endpoint resource', () => {
		const parsed = parseAuthorizationRequest({
			client_id: 'https://example.com/oauth/client.json',
			redirect_uri: 'http://127.0.0.1:3000/callback',
			response_type: 'code',
			scope: 'mcp:read mcp:write',
			state: 'abc123',
			code_challenge: 'challenge',
			code_challenge_method: 'S256',
			resource: getMcpEndpointUrl(),
		});

		assert.equal(parsed.client_id, 'https://example.com/oauth/client.json');
		assert.equal(parsed.redirect_uri, 'http://127.0.0.1:3000/callback');
		assert.deepEqual(parsed.scopes, ['mcp:read', 'mcp:write']);
		assert.equal(parsed.resource, getMcpEndpointUrl());
	});

	it('parses a valid authorization request for the MCP app-profile resource', () => {
		const parsed = parseAuthorizationRequest({
			client_id: 'https://example.com/oauth/client.json',
			redirect_uri: 'http://127.0.0.1:3000/callback',
			response_type: 'code',
			scope: 'mcp:read mcp:write',
			state: 'abc123',
			code_challenge: 'challenge',
			code_challenge_method: 'S256',
			resource: getMcpAppEndpointUrl(),
		});

		assert.deepEqual(parsed.scopes, ['mcp:read', 'mcp:write']);
		assert.equal(parsed.resource, getMcpAppEndpointUrl());
	});

	it('filters stale elevated scopes from the MCP app-profile resource', () => {
		const parsed = parseAuthorizationRequest({
			client_id: 'https://example.com/oauth/client.json',
			redirect_uri: 'http://127.0.0.1:3000/callback',
			response_type: 'code',
			scope: 'mcp:read mcp:write mcp:email mcp:git',
			state: 'abc123',
			code_challenge: 'challenge',
			code_challenge_method: 'S256',
			resource: getMcpAppEndpointUrl(),
		});

		assert.deepEqual(parsed.scopes, ['mcp:read', 'mcp:write']);
	});

	it('rejects app-profile authorization when no requested scope is supported', () => {
		assert.throws(
			() => parseAuthorizationRequest({
				client_id: 'https://example.com/oauth/client.json',
				redirect_uri: 'http://127.0.0.1:3000/callback',
				response_type: 'code',
				scope: 'mcp:email mcp:git',
				state: 'abc123',
				code_challenge: 'challenge',
				code_challenge_method: 'S256',
				resource: getMcpAppEndpointUrl(),
			}),
			(err) => err.oauthError === 'invalid_scope',
		);
	});

	it('defaults omitted app-profile scopes to all app tool scopes', () => {
		const parsed = parseAuthorizationRequest({
			client_id: 'https://example.com/oauth/client.json',
			redirect_uri: 'http://127.0.0.1:3000/callback',
			response_type: 'code',
			state: 'abc123',
			code_challenge: 'challenge',
			code_challenge_method: 'S256',
			resource: getMcpAppEndpointUrl(),
		});

		assert.deepEqual(parsed.scopes, [...MCP_APP_DEFAULT_SCOPES].sort());
	});

	it('uses app-profile scope descriptions for consent text', () => {
		const details = listScopeDetailsForResource(getMcpAppEndpointUrl(), ['mcp:read', 'mcp:write']);
		assert.deepEqual(details.map((item) => item.label), ['Read private knowledge', 'Modify private knowledge']);
		assert.ok(details.every((item) => !item.description.includes('URLs')));
		assert.ok(details.every((item) => !item.description.includes('emails')));
		assert.ok(details.every((item) => !item.description.includes('graph')));
	});

	it('defaults omitted full MCP endpoint scopes to full MCP scopes', () => {
		const parsed = parseAuthorizationRequest({
			client_id: 'https://example.com/oauth/client.json',
			redirect_uri: 'http://127.0.0.1:3000/callback',
			response_type: 'code',
			state: 'abc123',
			code_challenge: 'challenge',
			code_challenge_method: 'S256',
			resource: getMcpEndpointUrl(),
		});

		assert.deepEqual(parsed.scopes, [...MCP_DEFAULT_SCOPES].sort());
	});

	it('rejects authorization requests for unknown resources', () => {
		assert.throws(
			() => parseAuthorizationRequest({
				client_id: 'https://example.com/oauth/client.json',
				redirect_uri: 'http://127.0.0.1:3000/callback',
				response_type: 'code',
				code_challenge: 'challenge',
				code_challenge_method: 'S256',
				resource: 'https://evil.example.com/mcp',
			}),
			(err) => err.oauthError === 'invalid_target',
		);
	});

	it('accepts reverse-domain private-use redirect URIs for native clients', () => {
		const parsed = parseAuthorizationRequest({
			client_id: 'https://example.com/oauth/client.json',
			redirect_uri: 'com.raycast-x:/oauth/callback',
			response_type: 'code',
			code_challenge: 'challenge',
			code_challenge_method: 'S256',
			resource: getMcpEndpointUrl(),
		});

		assert.equal(parsed.redirect_uri, 'com.raycast-x:/oauth/callback');
	});

	it('rejects non-reverse-domain private-use redirect URI schemes', () => {
		assert.throws(
			() => parseAuthorizationRequest({
				client_id: 'https://example.com/oauth/client.json',
				redirect_uri: 'raycast:/oauth/callback',
				response_type: 'code',
				code_challenge: 'challenge',
				code_challenge_method: 'S256',
				resource: getMcpEndpointUrl(),
			}),
			(err) => err.oauthError === 'invalid_redirect_uri',
		);
	});

	it('signs and verifies MCP access tokens for allowed audiences', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: getMcpEndpointUrl(),
		});

		const payload = verifyMcpAccessToken(token);
		assert.equal(payload.sub, 'user-1');
		assert.equal(payload.tenantId, 'tenant-1');
		assert.equal(payload.host_id, 'host-1');
		assert.equal(payload.client_id, 'client-1');
		assert.equal(payload.aud, getMcpEndpointUrl());
	});

	it('signs and verifies MCP access tokens for the app-profile audience', () => {
		const token = signMcpAccessToken({
			userId: 'user-1',
			tenantId: 'tenant-1',
			host_id: 'host-1',
			clientId: 'client-1',
			scopes: ['mcp:read'],
			audience: getMcpAppEndpointUrl(),
		});

		const payload = verifyMcpAccessToken(token);
		assert.equal(payload.sub, 'user-1');
		assert.equal(payload.aud, getMcpAppEndpointUrl());
	});

	it('accepts metadata clients that list extra grant types when authorization_code is supported', async () => {
		const clientId = 'https://example.com/oauth/device-capable-client.json';
		const restoreFetch = mockMetadataFetch({
			client_id: clientId,
			client_name: 'Example MCP Client',
			redirect_uris: ['http://127.0.0.1:3000/callback'],
			grant_types: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
		});

		try {
			const parsed = await validateAuthorizationRequest({
				client_id: clientId,
				redirect_uri: 'http://127.0.0.1:3000/callback',
				response_type: 'code',
				code_challenge: 'challenge',
				code_challenge_method: 'S256',
				resource: getMcpEndpointUrl(),
			}, { host_id: 'host-1' });

			assert.deepEqual(parsed.client.grant_types, ['authorization_code', 'refresh_token']);
		} finally {
			restoreFetch();
		}
	});

	it('accepts private_key_jwt metadata clients with inline JWKS', async () => {
		const { metadata } = await buildPrivateKeyJwtClient();
		const restoreFetch = mockMetadataFetch(metadata);

		try {
			const parsed = await validateAuthorizationRequest({
				client_id: metadata.client_id,
				redirect_uri: 'http://127.0.0.1:3000/callback',
				response_type: 'code',
				code_challenge: 'challenge',
				code_challenge_method: 'S256',
				resource: getMcpEndpointUrl(),
			}, { host_id: 'host-1' });

			assert.equal(parsed.client.token_endpoint_auth_method, 'private_key_jwt');
			assert.equal(parsed.client.jwks.keys[0].kid, 'test-key');
		} finally {
			restoreFetch();
		}
	});

	it('omits null optional fields from dynamic registration responses', () => {
		const response = mapDynamicRegistrationClientResponse({
			client_id: 'client-1',
			client_name: 'Raycast',
			client_uri: null,
			logo_uri: null,
			redirect_uris: ['com.raycast-x:'],
			jwks: null,
			jwks_uri: null,
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
		});

		assert.equal(Object.hasOwn(response, 'client_uri'), false);
		assert.equal(Object.hasOwn(response, 'logo_uri'), false);
		assert.equal(Object.hasOwn(response, 'jwks'), false);
		assert.equal(Object.hasOwn(response, 'jwks_uri'), false);
		assert.deepEqual(response.redirect_uris, ['com.raycast-x:']);
	});

	it('authenticates private_key_jwt metadata clients with a valid client assertion', async () => {
		const { privateKey, metadata } = await buildPrivateKeyJwtClient();
		const restoreFetch = mockMetadataFetch(metadata);
		const clientAssertion = await signClientAssertion(privateKey, metadata.client_id);

		try {
			const client = await authenticateClientForToken({
				clientId: metadata.client_id,
				clientAssertionType,
				clientAssertion,
			});

			assert.equal(client.client_id, metadata.client_id);
			assert.equal(client.token_endpoint_auth_method, 'private_key_jwt');
		} finally {
			restoreFetch();
		}
	});

	it('rejects private_key_jwt metadata clients without an assertion', async () => {
		const { metadata } = await buildPrivateKeyJwtClient();
		const restoreFetch = mockMetadataFetch(metadata);

		try {
			await assert.rejects(authenticateClientForToken({ clientId: metadata.client_id }), (err) => err.oauthError === 'invalid_client' && err.status === 401);
		} finally {
			restoreFetch();
		}
	});

	it('authenticates private_key_jwt metadata clients when assertion type is omitted', async () => {
		const { privateKey, metadata } = await buildPrivateKeyJwtClient();
		const restoreFetch = mockMetadataFetch(metadata);
		const clientAssertion = await signClientAssertion(privateKey, metadata.client_id);

		try {
			const client = await authenticateClientForToken({
				clientId: metadata.client_id,
				clientAssertion,
			});

			assert.equal(client.client_id, metadata.client_id);
			assert.equal(client.token_endpoint_auth_method, 'private_key_jwt');
		} finally {
			restoreFetch();
		}
	});

	it('rejects private_key_jwt metadata clients without JWKS material', async () => {
		const { metadata } = await buildPrivateKeyJwtClient({ includeJwks: false });
		const restoreFetch = mockMetadataFetch(metadata);

		try {
			await assert.rejects(
				() => validateAuthorizationRequest({
					client_id: metadata.client_id,
					redirect_uri: 'http://127.0.0.1:3000/callback',
					response_type: 'code',
					code_challenge: 'challenge',
					code_challenge_method: 'S256',
					resource: getMcpEndpointUrl(),
				}, { host_id: 'host-1' }),
				(err) => err.oauthError === 'invalid_client_metadata',
			);
		} finally {
			restoreFetch();
		}
	});

	it('rejects private_key_jwt metadata clients with unsafe jwks_uri values', async () => {
		const { metadata } = await buildPrivateKeyJwtClient({ includeJwks: false });
		metadata.jwks_uri = 'https://127.0.0.1/jwks.json';
		const restoreFetch = mockMetadataFetch(metadata);

		try {
			await assert.rejects(
				() => validateAuthorizationRequest({
					client_id: metadata.client_id,
					redirect_uri: 'http://127.0.0.1:3000/callback',
					response_type: 'code',
					code_challenge: 'challenge',
					code_challenge_method: 'S256',
					resource: getMcpEndpointUrl(),
				}, { host_id: 'host-1' }),
				(err) => err.oauthError === 'invalid_client_metadata',
			);
		} finally {
			restoreFetch();
		}
	});

	it('rejects private_key_jwt token requests with missing or invalid assertions', async () => {
		const { privateKey, metadata } = await buildPrivateKeyJwtClient();
		const restoreFetch = mockMetadataFetch(metadata);
		const wrongAudienceAssertion = await signClientAssertion(privateKey, metadata.client_id, { aud: 'https://example.com/wrong' });
		const wrongIssuerAssertion = await signClientAssertion(privateKey, metadata.client_id, { iss: 'https://example.com/wrong' });
		const wrongSubjectAssertion = await signClientAssertion(privateKey, metadata.client_id, { sub: 'https://example.com/wrong' });
		const missingExpAssertion = await signClientAssertion(privateKey, metadata.client_id, { includeExp: false });
		const longLifetimeAssertion = await signClientAssertion(privateKey, metadata.client_id, { exp: Math.floor(Date.now() / 1000) + 3600 });
		const { privateKey: otherPrivateKey } = await buildPrivateKeyJwtClient();
		const badSignatureAssertion = await signClientAssertion(otherPrivateKey, metadata.client_id);

		try {
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType,
					clientAssertion: '',
				}),
				(err) => err.oauthError === 'invalid_client',
			);
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-saml2-bearer',
					clientAssertion: wrongAudienceAssertion,
				}),
				(err) => err.oauthError === 'invalid_client',
			);
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType,
					clientAssertion: wrongAudienceAssertion,
				}),
				(err) => err.oauthError === 'invalid_client',
			);
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType,
					clientAssertion: wrongSubjectAssertion,
				}),
				(err) => err.oauthError === 'invalid_client',
			);
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType,
					clientAssertion: wrongIssuerAssertion,
				}),
				(err) => err.oauthError === 'invalid_client',
			);
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType,
					clientAssertion: missingExpAssertion,
				}),
				(err) => err.oauthError === 'invalid_client',
			);
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType,
					clientAssertion: longLifetimeAssertion,
				}),
				(err) => err.oauthError === 'invalid_client',
			);
			await assert.rejects(
				() => authenticateClientForToken({
					clientId: metadata.client_id,
					clientAssertionType,
					clientAssertion: badSignatureAssertion,
				}),
				(err) => err.oauthError === 'invalid_client',
			);
		} finally {
			restoreFetch();
		}
	});

	it('renders the OAuth authorize template with an active tenant name', () => {
		const html = pug.renderFile(oauthAuthorizeViewPath, {
			v: 'test',
			openpanel: {},
			user: null,
			host_id: '',
			error: null,
			client: {
				client_id: 'client-1',
				client_name: 'Example App',
				client_uri: 'https://example.com',
			},
			oauth_request: {
				client_id: 'client-1',
				redirect_uri: 'http://127.0.0.1:3000/callback',
				response_type: 'code',
				scopes: ['mcp:read'],
				state: 'abc123',
				code_challenge: 'challenge',
				code_challenge_method: 'S256',
				resource: getMcpEndpointUrl(),
			},
			scope_details: [{ label: 'Read knowledge', description: 'List and search knowledge.' }],
			active_tenant: { name: 'Acme Inc' },
		});

		assert.match(html, /Example App wants to access your account/);
		assert.match(html, /Allow access to/);
		assert.match(html, /Acme Inc/);
		assert.match(html, /oauth-authorize-page/);
		assert.match(html, /oauth-meta-list/);
		assert.match(html, /OAuth consent/);
		assert.match(html, /Only authorize access if you trust this application/);
	});
});

it('rejects metadata hostnames resolving to private addresses without leaking the cause', async (t) => {
	t.mock.method(dns, 'lookup', (hostname, options, callback) => callback(null, [{ address: '10.0.0.1', family: 4 }]));
	await assert.rejects(authenticateClientForToken({ clientId: 'https://private-metadata.example/client.json' }), (err) => err.oauthError === 'invalid_client' && err.message === 'Failed to fetch client metadata');
});

it('bounds metadata cache entries and caps upstream cache lifetimes at one hour', async (t) => {
	let now = Date.now();
	let requests = 0;
	t.mock.method(Date, 'now', () => now);
	t.mock.method(axios, 'get', async (url) => {
		requests++;
		return { headers: { 'cache-control': 'max-age=999999999' }, data: JSON.stringify({ client_id: url, client_name: 'Cache test', redirect_uris: ['https://example.com/callback'], token_endpoint_auth_method: 'none' }) };
	});
	const clientId = 'https://cache.example/first.json';
	await authenticateClientForToken({ clientId });
	await authenticateClientForToken({ clientId });
	assert.equal(requests, 1);
	now += 60 * 60 * 1000 + 1;
	await authenticateClientForToken({ clientId });
	assert.equal(requests, 2);
	for (let index = 0; index < 500; index++) await authenticateClientForToken({ clientId: `https://cache.example/${index}.json` });
	await authenticateClientForToken({ clientId });
	assert.equal(requests, 503);
});
