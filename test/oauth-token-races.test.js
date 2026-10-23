import config from '../config.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from '../model/mongoose.js';
import { OAuthAuthorizationCode } from '../model/oauth_authorization_code.js';
import { OAuthRefreshToken } from '../model/oauth_refresh_token.js';
import { OAuthConsent } from '../model/oauth_consent.js';
import { OAuthClient } from '../model/oauth_client.js';
import { AuditLog } from '../model/audit_log.js';
import { exchangeAuthorizationCode, exchangeRefreshToken, issueAuthorizationCode, issueTokenPair, revokeConsent, approveConsent } from '../services/oauth_service.js';
import { getMcpEndpointUrl } from '../modules/oauth.js';
import { mockTenantWork } from './helpers/tenant-work.js';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const challenge = (value) => crypto.createHash('sha256').update(value).digest('base64url');
const verifier = 'a'.repeat(43);
const client = { client_id: 'race-client', client_name: 'Race client', registration_source: 'manual' };
function codeRow() { return { _id: new mongoose.Types.ObjectId(), client_id: client.client_id, redirect_uri: 'https://example.com/callback', code_challenge_method: 'S256', code_challenge: challenge(verifier), expires_at: new Date(Date.now() + 60000), host_id: 'race-host', user: new mongoose.Types.ObjectId(), tenant: new mongoose.Types.ObjectId(), resource: getMcpEndpointUrl(), scope: 'mcp:read', ...client }; }
const exchange = () => exchangeAuthorizationCode({ code: 'test-code', clientId: client.client_id, redirectUri: 'https://example.com/callback', codeVerifier: verifier });

test('authorization code conditional consumption admits exactly one concurrent exchange after validation', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const row = codeRow();
	const originals = [OAuthAuthorizationCode.findOne, OAuthAuthorizationCode.findOneAndUpdate, OAuthConsent.updateOne, OAuthClient.updateOne];
	t.after(() => { [OAuthAuthorizationCode.findOne, OAuthAuthorizationCode.findOneAndUpdate, OAuthConsent.updateOne, OAuthClient.updateOne] = originals; });
	OAuthAuthorizationCode.findOne = async () => ({ ...row });
	let consumed = false;
	OAuthAuthorizationCode.findOneAndUpdate = async (filter) => { assert.equal(filter.used_at, null); assert.ok(filter.expires_at.$gt instanceof Date); if (consumed) return null; consumed = true; return row; };
	OAuthConsent.updateOne = OAuthClient.updateOne = async () => ({ matchedCount: 1 });
	await assert.rejects(exchangeAuthorizationCode({ code: 'test-code', clientId: client.client_id, redirectUri: row.redirect_uri, codeVerifier: 'invalid' }), /PKCE/);
	assert.equal(consumed, false);
	const results = await Promise.allSettled([exchange(), exchange()]);
	assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
	assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});

test('isolated MongoDB code races and transactional refresh rotation rollback', { skip: process.env.STREAMIENT_OAUTH_INTEGRATION !== '1', timeout: 30000 }, async (t) => {
	assert.ok(process.env.MONGO_URI, 'explicit MongoDB URI required');
	const dbName = `streamient_oauth_test_${crypto.randomUUID().replaceAll('-', '')}`;
	await mongoose.connect(process.env.MONGO_URI, { ...config.mongoOptions, dbName });
	assert.equal(mongoose.connection.name, dbName);
	const restore = mockTenantWork();
	t.mock.method(AuditLog, 'create', async () => ({}));
	t.after(async () => { restore(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
	await Promise.all([OAuthAuthorizationCode.init(), OAuthRefreshToken.init(), OAuthConsent.init(), OAuthClient.init()]);
	const row = codeRow();
	const consent = await OAuthConsent.create({ ...row, scopes: ['mcp:read'] });
	await OAuthAuthorizationCode.create({ ...row, code_hash: hash('test-code') });
	const results = await Promise.allSettled(Array.from({ length: 8 }, exchange));
	assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
	const refreshRow = { ...row, _id: new mongoose.Types.ObjectId(), token_hash: hash('refresh-code') };
	await OAuthRefreshToken.create(refreshRow);
	await assert.rejects(exchangeRefreshToken({ refreshToken: 'refresh-code', client: { ...client, client_id: 'wrong' } }), /not issued/);
	assert.equal((await OAuthRefreshToken.findById(refreshRow._id)).rotated_at, undefined);
	const originalCreate = OAuthRefreshToken.create;
	OAuthRefreshToken.create = async () => { throw new Error('replacement write failed'); };
	try { await assert.rejects(exchangeRefreshToken({ refreshToken: 'refresh-code', client }), /replacement write failed/); } finally { OAuthRefreshToken.create = originalCreate; }
	assert.equal((await OAuthRefreshToken.findById(refreshRow._id)).rotated_at, undefined);
	assert.equal(await OAuthRefreshToken.countDocuments(), 1);
	const rotated = await Promise.allSettled(Array.from({ length: 8 }, () => exchangeRefreshToken({ refreshToken: 'refresh-code', client })));
	assert.equal(rotated.filter((r) => r.status === 'fulfilled').length, 1);
	assert.equal(await OAuthRefreshToken.countDocuments(), 2);
	const previous = await OAuthRefreshToken.findById(refreshRow._id);
	assert.ok(previous.rotated_at);
	assert.equal(previous.replaced_by_token_hash, hash(rotated.find((r) => r.status === 'fulfilled').value.refresh_token));
	const pendingCode = await issueAuthorizationCode({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, redirectUri: row.redirect_uri, scopes: ['mcp:read'], resource: row.resource, codeChallenge: challenge(verifier) });
	await revokeConsent(consent._id, row.user, row.host_id, { channel: 'api' });
	await assert.rejects(exchangeAuthorizationCode({ code: pendingCode, clientId: client.client_id, redirectUri: row.redirect_uri, codeVerifier: verifier }), /invalid or expired/);
	await assert.rejects(exchangeRefreshToken({ refreshToken: rotated.find((r) => r.status === 'fulfilled').value.refresh_token, client }), /invalid or expired/);
	await assert.rejects(issueTokenPair({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, scopes: ['mcp:read'], resource: row.resource }), /revoked/);
	await assert.rejects(issueAuthorizationCode({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, redirectUri: row.redirect_uri, scopes: ['mcp:read'], resource: row.resource, codeChallenge: challenge(verifier) }), /revoked/);
	await OAuthConsent.updateOne({ _id: consent._id }, { $set: { scopes: ['mcp:read', 'mcp:write'] } });
	const regranted = await approveConsent({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, requestedScopes: ['mcp:read'], resource: row.resource, redirectUri: row.redirect_uri, ctx: { channel: 'api' } });
	assert.equal(String(regranted._id), String(consent._id));
	assert.deepEqual(regranted.scopes, ['mcp:read']);
	const extended = await approveConsent({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, requestedScopes: ['mcp:write'], resource: row.resource, redirectUri: row.redirect_uri, ctx: { channel: 'api' } });
	assert.deepEqual(new Set(extended.scopes), new Set(['mcp:read', 'mcp:write']));
	assert.equal(await OAuthConsent.countDocuments(), 1);
	const reconnected = await issueAuthorizationCode({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, redirectUri: row.redirect_uri, scopes: ['mcp:read'], resource: row.resource, codeChallenge: challenge(verifier) });
	await exchangeAuthorizationCode({ code: reconnected, clientId: client.client_id, redirectUri: row.redirect_uri, codeVerifier: verifier });


});


test('revoked consent denies code exchange and token issuance before creating refresh tokens', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const row = codeRow();
	t.mock.method(OAuthAuthorizationCode, 'findOne', async () => row);
	t.mock.method(OAuthAuthorizationCode, 'findOneAndUpdate', async () => row);
	t.mock.method(OAuthConsent, 'updateOne', async (filter, update) => { assert.equal(filter.revoked_at, null); assert.equal(update.$inc.__v, 1); return { matchedCount: 0 }; });
	const create = t.mock.method(OAuthRefreshToken, 'create', async () => { throw new Error('Must not create token'); });
	await assert.rejects(exchange(), /revoked/);
	await assert.rejects(issueTokenPair({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, scopes: ['mcp:read'], resource: row.resource }), /revoked/);
	await assert.rejects(issueAuthorizationCode({ userId: row.user, tenantId: row.tenant, host_id: row.host_id, client, redirectUri: row.redirect_uri, scopes: ['mcp:read'], resource: row.resource, codeChallenge: challenge(verifier) }), /revoked/);
	assert.equal(create.mock.callCount(), 0);
});
