import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { requireOAuthScopes } from '../middleware/auth.js';
import { User } from '../model/user.js';
import { migrateAccessTokenHashes } from '../scripts/migrate-access-token-hashes.mjs';

const api = readFileSync(new URL('../routes/api.js', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../middleware/auth.js', import.meta.url), 'utf8');
function response() {
	return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, set() {} };
}

test('OAuth bridge requests enforce required scopes', () => {
	const res = response();
	requireOAuthScopes('mcp:write')({ authMethod: 'mcp-bridge', oauthScopes: 'mcp:read' }, res, () => assert.fail('scope bypass'));
	assert.equal(res.statusCode, 403);
	let accepted = false;
	requireOAuthScopes('mcp:write')({ authMethod: 'mcp-bridge', oauthScopes: 'mcp:read mcp:write' }, response(), () => { accepted = true; });
	assert.equal(accepted, true);
});

test('members cannot create or delete OAuth clients', async () => {
	const registrations = [];
	const context = { router: { post: (...args) => registrations.push(args), delete: (...args) => registrations.push(args) }, teamService: { canManageTeam: (role) => ['owner', 'admin'].includes(role) } };
	const manager = api.slice(api.indexOf('function requireTeamManager('), api.indexOf('function requireRestrictedSettingsAccess('));
	const routes = api.slice(api.indexOf("router.post('/oauth/clients'"), api.indexOf('// ---- Access Tokens ----'));
	vm.runInNewContext(manager + routes, context);
	for (const [, middleware] of registrations) {
		const res = response();
		await middleware({ memberRole: 'member' }, res, () => assert.fail('member accepted'));
		assert.equal(res.statusCode, 403);
	}
	assert.equal(registrations.length, 2);
});

test('new tokens return plaintext once but store only a hash and serialize no secrets', async () => {
	let handler;
	const user = new User({ email: 'token@example.com' });
	user.save = async () => {};
	const context = { router: { post: (path, fn) => { handler = fn; } }, User: { findById: () => user }, queryForSave: (value) => value, crypto, log: { error: () => assert.fail('token creation failed') } };
	vm.runInNewContext(api.slice(api.indexOf("router.post('/tokens'"), api.indexOf("router.delete('/tokens/:id'")), context);
	const res = response();
	await handler({ body: { name: 'test' }, userId: 'user' }, res);
	assert.equal(res.statusCode, 201);
	assert.equal(user.access_tokens[0].token, undefined);
	assert.equal(user.access_tokens[0].token_hash, crypto.createHash('sha256').update(res.body.token).digest('hex'));
	assert.equal(user.toSafe().access_tokens[0].token_hash, undefined);
	assert.equal(user.toSafe().access_tokens[0].token, undefined);
});

for (const legacy of [false, true]) test(`${legacy ? 'legacy' : 'hashed'} tokens authenticate`, async () => {
	const token = 'personal-token';
	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
	const calls = [];
	const user = { _id: 'user', host_id: 'host', access_tokens: [{ name: 'test', ...(legacy ? { token } : { token_hash: tokenHash }) }] };
	const context = { crypto, User: { findOneAndUpdate(filter) { calls.push(filter); return { select() { return this; }, lean: async () => filter[legacy ? 'access_tokens.token' : 'access_tokens.token_hash'] === (legacy ? token : tokenHash) ? user : null }; } }, ensureOwnerMembershipForUser: async () => {}, applyTenantContext: async () => true, acceptAuthenticatedRequest: (req, res, next) => next() };
	const requireAuth = vm.runInNewContext('(' + auth.slice(auth.indexOf('export async function requireAuth('), auth.indexOf('export function requireOAuthScopes(')).replace('export ', '') + ')', context);
	const req = { method: 'GET', headers: { authorization: `Token ${token}` }, accepts: () => false };
	let accepted = false;
	await requireAuth(req, response(), () => { accepted = true; });
	assert.equal(accepted, true);
	assert.equal(req.tokenLabel, 'test');
	assert.equal(calls.length, legacy ? 2 : 1);
	assert.equal(calls[0]['access_tokens.token_hash'], tokenHash);
});

test('token migration is dry-run by default and idempotent without replacing the token array', async () => {
	const entry = { _id: 'token-id', token: 'secret', name: 'test' };
	const collection = { async *find() { if (entry.token) yield { _id: 'user-id', access_tokens: [entry] }; }, async updateOne(filter, update) {
		assert.equal(filter.access_tokens.$elemMatch.token, 'secret');
		assert.equal(filter.access_tokens.$elemMatch._id, entry._id);
		entry.token_hash = update.$set['access_tokens.$.token_hash'];
		assert.ok(Object.hasOwn(update.$unset, 'access_tokens.$.token'));
		delete entry.token;
		return { modifiedCount: 1 };
	} };
	assert.equal((await migrateAccessTokenHashes({ collection })).modified, 0);
	assert.equal(entry.token, 'secret');
	assert.equal((await migrateAccessTokenHashes({ collection, apply: true })).modified, 1);
	assert.equal(entry.token_hash, crypto.createHash('sha256').update('secret').digest('hex'));
	assert.equal((await migrateAccessTokenHashes({ collection, apply: true })).modified, 0);
});
