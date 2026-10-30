import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import pug from 'pug';
import { MagicLink } from '../model/magic_link.js';
import { User, toSafeUser } from '../model/user.js';
import { requestEmailChange, confirmEmailChange } from '../services/profile_email_service.js';
const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('HTML blob responses download with a sandbox and no active content', async () => {
	const source = read('routes/obsidian_api.js');
	const fn = vm.runInNewContext('(' + source.slice(source.indexOf('async function streamBlobResponse'), source.indexOf('export async function requireObsidianAccess')) + ')', { blobService: { async *readBlob() { yield '<script>alert(1)</script>'; } } });
	let headers; let body = '';
	await fn({ set(value) { headers = value; }, write(value) { body += value; return true; }, end() {} }, { total_bytes: 25, sha256: 'hash' }, 'host', 'text/html');
	assert.equal(headers['Content-Disposition'], 'attachment');
	assert.equal(headers['Content-Security-Policy'], "sandbox; default-src 'none'");
	assert.match(body, /<script>/);
});

test('invalid personal tokens return JSON 401 for wildcard Accept', async () => {
	const source = read('middleware/auth.js');
	const fn = vm.runInNewContext('(' + source.slice(source.indexOf('export async function requireAuth'), source.indexOf('export function requireOAuthScopes')).replace('export ', '') + ')', { crypto, User: { findOneAndUpdate() { return { select() { return this; }, lean: async () => null }; } } });
	let status; let result;
	await fn({ headers: { authorization: 'Token bad' }, originalUrl: '/api/v1/profile', accepts: () => true }, { status(value) { status = value; return this; }, json(value) { result = value; }, redirect() { assert.fail('redirect'); } }, () => assert.fail('authenticated'));
	assert.equal(status, 401); assert.equal(result.error, 'Authentication required');
});

test('HyperDX user JSON round-trips hostile names without script termination', () => {
	const name = '</script><script>alert("x")</script>&';
	const html = pug.renderFile('views/includes/hyperdx.pug', { hyperdx: { enabled: true, apiKey: 'key', browserUrl: 'https://example.com', service: 'test' }, user: { _id: 'id', name, email: 'test@example.com' } });
	assert.equal((html.match(/<script/g) || []).length, 2);
	const json = html.match(/var _hdxUser = (.*);/)[1];
	assert.equal(JSON.parse(json).userName, name);
	assert.doesNotMatch(json, /[<>&]/);
	assert.match(html, /browser@0\.26\.0/); assert.match(html, /integrity="sha384-/);
	const layout = read('views/layout.pug');
	const line = layout.split('\n').find(line => line.includes('var __user_name'));
	const rendered = pug.render('script.\n\t' + line.trim(), { user: { name } });
	assert.equal((rendered.match(/<script/g) || []).length, 1);
	assert.equal(JSON.parse(rendered.match(/var __user_name = (.*);/)[1]), name);
});

test('email changes keep old address, send to new address, and bind confirmation to owner and latest request', async (t) => {
	const user = { _id: 'user', email: 'old@example.com' };
	let pending; let generated; let updateFilter;
	t.mock.method(User, 'exists', async () => null);
	t.mock.method(MagicLink, 'generate', async (id, details) => { generated = { ...details, user: id, token: 'secret' }; return generated; });
	t.mock.method(User, 'findOneAndUpdate', (filter, update) => ({ lean: async () => { updateFilter = filter; if (update.$set.pending_email_token) { pending = update.$set.pending_email_token; return user; } if (filter._id !== user._id || filter.pending_email_token !== pending || filter.email !== user.email) return null; user.email = update.$set.email; pending = null; return user; } }));
	let sent;
	await requestEmailChange(user, 'new@example.com', { sendEmail: async (...args) => { sent = args; return { accepted: ['new@example.com'] }; } });
	assert.equal(user.email, 'old@example.com'); assert.deepEqual(sent, ['new@example.com', 'secret']); assert.equal(generated.purpose, 'email_change');
	t.mock.method(MagicLink, 'verify', async (token, purpose, owner) => token === 'secret' && purpose === 'email_change' && owner === user._id ? generated : null);
	assert.equal(await confirmEmailChange('secret', 'other'), null);
	assert.equal((await confirmEmailChange('secret', 'user')).email, 'new@example.com');
	assert.equal(updateFilter.previous_email, undefined); assert.equal(updateFilter.email, 'old@example.com');
	assert.equal(await confirmEmailChange('secret', 'user'), null);
	assert.equal(toSafeUser({ pending_email_token: 'secret' }).pending_email_token, undefined);
});

test('email confirmation claims include purpose, owner, expiry and unused state', async (t) => {
	let filter;
	t.mock.method(MagicLink, 'findOneAndUpdate', (value) => { filter = value; return { lean: async () => null }; });
	await MagicLink.verify('secret', 'email_change', 'owner');
	assert.equal(filter.purpose, 'email_change'); assert.equal(filter.user, 'owner'); assert.equal(filter.used, false); assert.ok(filter.expires_at.$gt instanceof Date);
	await MagicLink.verify('secret');
	assert.deepEqual(filter.$or, [{ purpose: 'login' }, { purpose: { $exists: false } }]);
});

test('email change collision and delivery failure preserve current address', async (t) => {
	const user = { _id: 'user', email: 'old@example.com' };
	const exists = t.mock.method(User, 'exists', async () => ({ _id: 'other' }));
	await assert.rejects(requestEmailChange(user, 'taken@example.com'), { status: 409 });
	exists.mock.mockImplementation(async () => null);
	t.mock.method(MagicLink, 'generate', async () => ({ token: 'secret' }));
	t.mock.method(User, 'findOneAndUpdate', () => ({ lean: async () => user }));
	let cleanup;
	t.mock.method(User, 'updateOne', async (filter) => { cleanup = filter; });
	await assert.rejects(requestEmailChange(user, 'new@example.com', { sendEmail: async () => undefined }), /could not be sent/);
	assert.equal(cleanup.pending_email_token, 'secret'); assert.equal(user.email, 'old@example.com');
	t.mock.method(MagicLink, 'verify', async () => ({ previous_email: user.email, email: 'taken@example.com', token: 'secret' }));
	User.findOneAndUpdate = () => ({ lean: async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); } });
	assert.equal(await confirmEmailChange('secret', 'user'), null);
});

test('profile PUT returns pending confirmation and keeps the current email', async () => {
	const source = read('routes/api.js'); let handler; let requested;
	const user = { _id: 'user', email: 'old@example.com', save: async () => {}, toSafe() { return { email: this.email }; } };
	vm.runInNewContext(source.slice(source.indexOf("router.put('/profile'"), source.indexOf('// ---- OAuth ----')), { router: { put(_path, fn) { handler = fn; } }, avatarStyleValues: [], User: { findById: () => user }, queryForSave: (value) => value, requestEmailChange: async (_user, email) => { requested = email; }, log: { error: () => {} } });
	let body;
	await handler({ userId: 'user', body: { email: 'NEW@example.com' } }, { json(value) { body = value; } });
	assert.equal(requested, 'new@example.com'); assert.equal(body.email_change_pending, true); assert.equal(body.user.email, 'old@example.com');
});

test('unauthorized subscribe payloads cannot cause a database availability write', async () => {
	const source = read('modules/socket.js'); let handler;
	vm.runInNewContext(source.slice(source.indexOf("socket.on('subscribe'"), source.indexOf("socket.on('email-counts:request'")), { socket: { connected: true, on(_event, fn) { handler = fn; } }, getSocketIdentity: () => ({ hostId: 'own', userId: 'user' }), resolveAuthorizedSubscribeRoom: () => '', assertTenantAvailable: () => assert.fail('untrusted host used'), OtelRuntime: { createCustomSpan: () => assert.fail('joined') } });
	await handler('tenant:other', 'user', 'other');
});
