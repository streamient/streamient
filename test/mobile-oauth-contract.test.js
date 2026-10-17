import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { authenticateClientForToken, parseAuthorizationRequest, validateAuthorizationRequest } from '../services/oauth_service.js';
import { getApiResourceUrl, MOBILE_ALL_SCOPES, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI, signMcpAccessToken, verifyApiAccessToken } from '../modules/oauth.js';
import { getRecord, listRecords, normalizeMobileTimestamp, normalizeRecord, normalizeSearchReference } from '../services/mobile_service.js';
import { OAuthAuthorizationCode } from '../model/oauth_authorization_code.js';
import { OAuthConsent } from '../model/oauth_consent.js';
import { OAuthRefreshToken } from '../model/oauth_refresh_token.js';
import { Memory } from '../model/memory.js';
import { AuditLog } from '../model/audit_log.js';

function read(relativePath) {
	return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function authorizationInput(redirectUri) {
	return { client_id: MOBILE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: MOBILE_ALL_SCOPES.join(' '), state: 'state', code_challenge: 'challenge', code_challenge_method: 'S256', resource: getApiResourceUrl() };
}

describe('Streamient Mobile OAuth and API contracts', () => {
	it('accepts the native and registered browser PKCE callbacks', async () => {
		const native = await validateAuthorizationRequest(authorizationInput(MOBILE_REDIRECT_URI), { host_id: 'host-1' });
		const local = await validateAuthorizationRequest(authorizationInput('http://localhost:5176/oauth/callback'), { host_id: 'host-1' });
		const orb = await validateAuthorizationRequest(authorizationInput('http://mobile.streamient.orb.local/oauth/callback'), { host_id: 'host-1' });

		assert.equal(native.client.token_endpoint_auth_method, 'none');
		assert.equal(local.client.client_id, MOBILE_CLIENT_ID);
		assert.equal(orb.resource, getApiResourceUrl());
		assert.deepEqual(native.scopes, [...MOBILE_ALL_SCOPES].sort());
	});

	it('rejects unregistered HTTP callbacks and non-mobile scopes', () => {
		assert.throws(() => parseAuthorizationRequest(authorizationInput('http://evil.example/oauth/callback')), (err) => err.oauthError === 'invalid_redirect_uri');
		assert.throws(() => parseAuthorizationRequest({ ...authorizationInput(MOBILE_REDIRECT_URI), scope: 'mcp:write' }), (err) => err.oauthError === 'invalid_scope');
	});

	it('registers only the configured DBH mobile origin', async () => {
		const previous = process.env.STREAMIENT_MOBILE_WEB_ORIGINS;
		process.env.STREAMIENT_MOBILE_WEB_ORIGINS = 'https://mobile.s.n.lan';
		try {
			const result = await validateAuthorizationRequest(authorizationInput('https://mobile.s.n.lan/oauth/callback'), { host_id: 'host-1' });
			assert.equal(result.client.client_id, MOBILE_CLIENT_ID);
			await assert.rejects(validateAuthorizationRequest(authorizationInput('https://mobile.s.d.lan/oauth/callback'), { host_id: 'host-1' }), /redirect_uri is not registered/);
			assert.match(read('compose.dbh.yml'), /STREAMIENT_MOBILE_WEB_ORIGINS: "https:\/\/mobile\.s\.\$\{DBH_PROFILE\}\.lan"/);
		} finally {
			if (previous === undefined) delete process.env.STREAMIENT_MOBILE_WEB_ORIGINS;
			else process.env.STREAMIENT_MOBILE_WEB_ORIGINS = previous;
		}
	});

	it('authenticates the public first-party client and verifies API audience tokens', async () => {
		const client = await authenticateClientForToken({ clientId: MOBILE_CLIENT_ID, host_id: 'host-1' });
		assert.equal(client.client_id, MOBILE_CLIENT_ID);
		assert.equal(client.token_endpoint_auth_method, 'none');
		const token = signMcpAccessToken({ userId: '507f1f77bcf86cd799439011', tenantId: '507f1f77bcf86cd799439012', host_id: 'host-1', clientId: MOBILE_CLIENT_ID, clientName: 'Streamient Mobile', scopes: MOBILE_ALL_SCOPES, audience: getApiResourceUrl() });
		const payload = verifyApiAccessToken(token);
		assert.equal(payload.client_id, MOBILE_CLIENT_ID);
		assert.equal(payload.aud, getApiResourceUrl());
	});

	it('persists first-party consent, authorization-code, and refresh-token records', () => {
		for (const Model of [OAuthConsent, OAuthAuthorizationCode, OAuthRefreshToken]) {
			const sourcePath = Model.schema.path('registration_source');
			assert.ok(sourcePath.enumValues.includes('first-party'));
		}
	});

	it('accepts mobile as an audit channel', () => {
		assert.ok(AuditLog.schema.path('channel').enumValues.includes('mobile'));
	});

	it('normalizes search and AI sources to the record summary contract', () => {
		const memory = normalizeSearchReference({ type: 'memory', id: '507f1f77bcf86cd799439011', title: 'Decision', excerpt: 'Ship it', project_id: '507f1f77bcf86cd799439012', created_at: 1_750_000_000, updated_at: 1_750_000_100 });
		const page = normalizeSearchReference({ _type: 'pages', parent_url_id: '507f1f77bcf86cd799439013', title: 'Docs', url: 'https://example.com/docs', project_id: '507f1f77bcf86cd799439012', updated_at: 1_750_000_100 });

		assert.equal(memory.type, 'memories');
		assert.equal(memory.key, `memories:${memory.id}`);
		assert.equal(memory.updated_at, '2025-06-15T15:08:20.000Z');
		assert.deepEqual(memory.metadata, { editable: false });
		assert.equal(page.type, 'urls');
		assert.equal(page.metadata.domain, 'example.com');
		assert.equal(normalizeMobileTimestamp(1_750_000_100), '2025-06-15T15:08:20.000Z');
	});

	it('decodes rich-text entities in feed and search excerpts without changing content', () => {
		const content = '<p>Fish &amp; chips</p><p>&lt;code&gt;&nbsp;&#x1F600;</p>';
		const memory = { _id: '507f1f77bcf86cd799439011', title: 'Rich memory', content };
		assert.equal(normalizeRecord('memories', memory).excerpt, 'Fish & chips <code> 😀');
		assert.equal(normalizeSearchReference({ type: 'memory', id: memory._id, content }).excerpt, 'Fish & chips <code> 😀');
		assert.equal(normalizeRecord('notes', { ...memory, text_content: '<code>literal</code> &amp;' }).excerpt, '<code>literal</code> &amp;');
		assert.equal(normalizeRecord('memories', { ...memory, content: 'literal &amp; entity' }).excerpt, 'literal &amp; entity');
		assert.equal(normalizeSearchReference({ type: 'memory', id: memory._id, excerpt: content }).excerpt, 'Fish & chips <code> 😀');
		assert.equal(normalizeSearchReference({ type: 'note', id: memory._id, excerpt: '<code>literal</code> &amp;' }).excerpt, '<code>literal</code> &amp;');
		assert.equal(memory.content, content);
	});

	it('keeps full memory detail text while compacting its feed excerpt', async (t) => {
		const text = 'Long memory & content '.repeat(30).trim();
		const content = `<p>${text.replaceAll('&', '&amp;')}</p>`;
		const memory = { _id: '507f1f77bcf86cd799439011', content };
		t.mock.method(Memory, 'findOne', () => ({ lean: async () => memory }));
		const record = await getRecord('host-1', 'memory', memory._id);
		assert.equal(record.text_content, text);
		assert.equal(record.content, content);
		assert.equal(record.excerpt.length, 261);
	});

	it('rejects invalid ObjectIDs before mixed-feed queries', async () => {
		await assert.rejects(listRecords('host-1', { projectId: 'not-an-object-id' }), (err) => err.status === 400);
		assert.equal(await getRecord('host-1', 'notes', 'not-an-object-id'), null);
	});

	it('documents mobile OAuth, resumable headers, statuses, and scoped routing', () => {
		const swagger = read('swagger.js');
		const api = read('routes/api.js');
		const cors = read('app.js');

		assert.match(swagger, /MobileOAuth/);
		assert.match(swagger, /application\/offset\+octet-stream/);
		for (const header of ['Upload-Offset', 'Upload-Length', 'Upload-Checksum', 'Upload-State']) assert.ok(swagger.includes(header));
		for (const status of ['409', '413', '460', '507']) assert.ok(swagger.includes(status));
		assert.match(api, /oauth-api[\s\S]*req\.path\.startsWith\('\/mobile'\)/);
		assert.match(cors, /capacitor:\/\/localhost/);
		assert.match(cors, /Upload-Checksum/);
	});
});
