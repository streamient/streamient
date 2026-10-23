import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import csrfProtection, { browserCsrfProtection } from '../middleware/csrf.js';
import { requireAuth, generateToken } from '../middleware/auth.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { accountWork } from '../modules/tenancy.js';

const token = 'a'.repeat(64);
function check(overrides = {}) {
	const req = { method: 'POST', path: '/api/v1/notes', session: { userId: 'user', csrfToken: token }, headers: { host: 's.n.lan', origin: 'https://s.n.lan', 'x-csrf-token': token }, ...overrides };
	const res = { locals: {}, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
	let accepted = false;
	csrfProtection(req, res, () => { accepted = true; });
	return { req, res, accepted };
}

describe('browser CSRF protection', () => {
	it('rejects missing, malformed and foreign-origin proof before mutation', () => {
		for (const headers of [{ host: 's.n.lan' }, { host: 's.n.lan', 'x-csrf-token': 'b'.repeat(64) }, { host: 's.n.lan', 'x-csrf-token': 'é'.repeat(64) }, { host: 's.n.lan', 'x-csrf-token': token, origin: 'https://evil.test' }, { host: 's.n.lan', 'x-csrf-token': token, origin: 'null' }, { host: 's.n.lan', 'x-csrf-token': token, 'sec-fetch-site': 'cross-site' }]) {
			const result = check({ headers });
			assert.equal(result.accepted, false);
			assert.equal(result.res.statusCode, 403);
		}
	});
	it('does not exempt a cookie session merely because it has a bearer header', () => {
		assert.equal(check({ headers: { authorization: 'Bearer invalid', host: 's.n.lan' } }).accepted, false);
	});
	it('authenticates tokens independently even with incidental cookies and blocks rejected requests before writes', async () => {
		const original = { find: User.findById, update: User.findByIdAndUpdate, memberships: TenantMember.find, acquire: accountWork.acquire };
		let holds = 0;
		let writes = 0;
		const userId = '507f1f77bcf86cd799439011';
		const tenantId = '507f1f77bcf86cd799439012';
		User.findById = () => ({ select: () => ({ lean: async () => ({ _id: userId, is_active: true }) }) });
		User.findByIdAndUpdate = async () => { writes++; };
		TenantMember.find = () => ({ populate: () => ({ lean: async () => [{ _id: 'membership', role: 'owner', tenant: { _id: tenantId, host_id: 'host', name: 'Team' } }] }) });
		accountWork.acquire = async () => { holds++; return async () => {}; };
		async function authenticate(authorization, session = { userId }) {
			const req = { method: 'POST', path: '/api/v1/notes', originalUrl: '/api/v1/notes', session, headers: { host: 's.n.lan', authorization }, accepts: () => false };
			const res = { locals: {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, once() {}, end() {} };
			browserCsrfProtection(req, res, () => {});
			let accepted = false;
			await requireAuth(req, res, () => { accepted = true; });
			return { accepted, res };
		}
		try {
			assert.equal((await authenticate('Bearer invalid')).res.statusCode, 401);
			assert.equal((await authenticate(undefined)).res.statusCode, 403);
			assert.equal(holds, 0);
			assert.equal(writes, 0);
			const bearer = 'Bearer ' + generateToken(userId, 'host', tenantId);
			assert.equal((await authenticate(bearer)).accepted, true);
			assert.equal((await authenticate(bearer, {})).accepted, true);
			assert.equal(holds, 2);
			assert.equal(writes, 0);
		} finally { User.findById = original.find; User.findByIdAndUpdate = original.update; TenantMember.find = original.memberships; accountWork.acquire = original.acquire; }
	});
	it('accepts AJAX, multipart headers and native forms including OAuth consent', () => {
		assert.equal(check().accepted, true);
		assert.equal(check({ headers: { host: 's.n.lan', 'content-type': 'multipart/form-data', 'x-csrf-token': token } }).accepted, true);
		assert.equal(check({ path: '/oauth/authorize', headers: { host: 's.n.lan', origin: 'https://s.n.lan' }, body: { _csrf: token } }).accepted, true);
		assert.equal(check({ path: '/oauth/authorize', headers: { host: 's.n.lan', origin: 'null', 'sec-fetch-site': 'same-origin' }, body: { _csrf: token } }).accepted, true);
		assert.equal(check({ path: '/oauth/authorize', headers: { host: 's.n.lan', origin: 'null', 'sec-fetch-site': 'same-origin' }, body: { _csrf: 'b'.repeat(64) } }).accepted, false);
		assert.equal(check({ path: '/login', session: { csrfToken: token }, headers: { host: 'brand.example', origin: 'https://brand.example' }, body: { _csrf: token } }).accepted, true);
		assert.equal(check({ headers: { host: 's.n.lan', 'x-forwarded-host': 'evil.test', origin: 'https://evil.test', 'x-csrf-token': token } }).accepted, false);
	});
	it('keeps the session token stable across login and tabs and exempts only independent protocols', () => {
		const session = {};
		const first = check({ method: 'GET', session });
		assert.match(first.res.locals.csrf_token, /^[a-f0-9]{64}$/);
		session.userId = 'user';
		assert.equal(check({ method: 'GET', session }).res.locals.csrf_token, first.res.locals.csrf_token);
		for (const path of ['/oauth/token', '/oauth/register', '/billing/webhook']) assert.equal(check({ path, headers: {} }).accepted, true);
		assert.equal(check({ path: '/logout', headers: {} }).accepted, false);
	});
	it('adds same-origin fetch headers without leaking to other origins or damaging Request bodies', async () => {
		const calls = [];
		const window = { location: new URL('https://s.n.lan/settings'), fetch: async (...args) => { calls.push(args); } };
		vm.runInNewContext(fs.readFileSync(new URL('../public/js/csrf.js', import.meta.url), 'utf8'), { window, document: { querySelector: () => ({ content: token }) }, URL, Request, Headers });
		const input = new Request('https://s.n.lan/api/v1/notes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Token native' }, body: '{"title":"safe"}' });
		await window.fetch(input);
		assert.equal(calls[0][0], input);
		assert.equal(calls[0][1].headers.get('X-CSRF-Token'), token);
		assert.equal(calls[0][1].headers.get('Authorization'), 'Token native');
		assert.equal(await input.text(), '{"title":"safe"}');
		await window.fetch('https://external.test/send', { method: 'POST' });
		assert.deepEqual(calls[1][1], { method: 'POST' });
		const form = new FormData(); form.append('file', 'payload');
		await window.fetch('/api/v1/notes/import', { method: 'POST', body: form });
		assert.equal(calls[2][1].body, form);
		assert.equal(calls[2][1].headers.has('Content-Type'), false);
	});
});
