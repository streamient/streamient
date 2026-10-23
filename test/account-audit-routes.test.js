import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Execute the registered handlers with deterministic service doubles, without Stripe or MongoDB.
function handler(file, start, end, dependencies) {
	let route;
	const source = readFileSync(new URL(`../routes/${file}`, import.meta.url), 'utf8');
	const code = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))).replace("await import('../modules/stripe.js')", 'await importStripe()');
	new Function('router', ...Object.keys(dependencies), code)({ get: (path, fn) => { route = fn; }, post: (path, fn) => { route = fn; } }, ...Object.values(dependencies));
	return route;
}
function response() {
	return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, redirect(value) { this.location = value; return this; }, clearCookie(value) { this.cleared = value; }, send(value) { this.body = value; return this; }, format(types) { return types[this.html ? 'html' : 'json'](); } };
}
const log = { error() {} };

test('billing success only applies a completed checkout for the resolved host owner and its stored customer', async () => {
	const owner = { _id: 'owner', host_id: 'host', stripe_customer_id: 'cus_owner', subscription_status: 'incomplete' };
	const checkout = { status: 'complete', mode: 'subscription', metadata: { streamient_user_id: 'owner' }, customer: 'cus_owner', subscription: 'sub_owner' };
	const subscription = { id: 'sub_owner', customer: 'cus_owner', status: 'active' };
	for (const change of [
		{},
		{ checkout: { metadata: { streamient_user_id: 'foreign' } } },
		{ checkout: { metadata: { kumbukum_user_id: 'owner' } } },
		{ checkout: { customer: 'cus_foreign' } },
		{ checkout: { customer: null } },
		{ checkout: { status: 'open' } },
		{ checkout: { mode: 'payment' } },
		{ checkout: { subscription: null } },
		{ subscription: { customer: 'cus_foreign' } },
		{ subscription: { customer: null } },
		{ subscription: { status: 'incomplete' } },
		{ owner: { host_id: 'foreign' } },
		{ owner: { stripe_customer_id: null } },
	]) {
		const applied = [];
		const route = handler('billing.js', "router.get('/billing/success'", "router.get('/billing/cancel'", {
			getBillingUserForHost: async (host, actor) => { assert.equal(host, 'host'); assert.equal(actor, 'member'); return { ...owner, ...change.owner }; },
			importStripe: async () => ({ getStripe: () => ({ checkout: { sessions: { retrieve: async () => ({ ...checkout, ...change.checkout }) } }, subscriptions: { retrieve: async () => ({ ...subscription, ...change.subscription }) } }) }),
			applySubscriptionToUser: async (...args) => applied.push(args), log,
		});
		const res = response();
		await route({ host_id: 'host', userId: 'member', query: { session_id: 'input-id' } }, res);
		assert.equal(res.location, '/dashboard');
		assert.equal(applied.length, Object.keys(change).length ? 0 : 1, JSON.stringify(change));
		if (applied.length) assert.deepEqual(applied[0], ['owner', subscription, 'cus_owner']);
	}
});

test('2FA setup cannot replace a secret enabled between lookup and update', async () => {
	for (const enabled of [false, true]) {
		const stored = { enabled: false, secret: 'original' };
		const route = handler('auth.js', "router.post('/2fa/setup'", "router.post('/2fa/confirm'", {
			User: {
				findById: () => ({ select: () => ({ lean: async () => { stored.enabled = enabled; return { email: 'me@example.com' }; } }) }),
				updateOne: async (filter, update) => {
					assert.deepEqual(filter, { _id: 'me', totp_enabled: { $ne: true } });
					if (stored.enabled) return { matchedCount: 0 };
					stored.secret = update.$set.totp_secret;
					return { matchedCount: 1 };
				},
			}, generateSecret: () => 'new-secret', generateURI: () => 'otpauth', log,
		});
		const res = response();
		await route({ session: { userId: 'me' } }, res);
		assert.equal(stored.secret, enabled ? 'original' : 'new-secret');
		assert.equal(res.statusCode, enabled ? 409 : 200);
		assert.equal(res.body.secret, enabled ? undefined : 'new-secret');
	}
});

test('logout marks the current SID and disconnects its sockets before destroying it, for HTML and JSON', async () => {
	for (const html of [false, true]) for (const failure of [null, 'marker', 'disconnect', 'destroy']) {
		const calls = [];
		const route = handler('auth.js', "router.post('/logout'", '// ---- Render auth pages', {
			revokeCurrentUserSession: async (sid) => { calls.push('marker'); assert.equal(sid, 'current'); if (failure === 'marker') throw Error('write failed'); },
			publicSessionId: (sid) => `public:${sid}`,
			disconnectSessionSockets: async (ids) => { calls.push('disconnect'); assert.deepEqual(ids, ['public:current']); if (failure === 'disconnect') throw Error('disconnect failed'); }, log,
		});
		const req = { sessionID: 'current', accepts: () => html, session: { destroy: (done) => { calls.push('destroy'); done(failure === 'destroy' ? Error('destroy failed') : null); } } };
		const res = response();
		res.html = html;
		await route(req, res);
		assert.deepEqual(calls, failure === 'marker' ? ['marker'] : failure === 'disconnect' ? ['marker', 'disconnect'] : ['marker', 'disconnect', 'destroy']);
		assert.equal(res.statusCode, failure ? 500 : 200);
		assert.equal(res.cleared, failure ? undefined : 'connect.sid');
		if (!failure) assert.equal(html ? res.location : res.body.message, html ? '/login' : 'Logged out');
	}
});
