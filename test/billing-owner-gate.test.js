import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { requireBillingOwner } from '../routes/billing.js';

function makeReq(role, acceptsHtml) {
	return { memberRole: role, accepts: (type) => acceptsHtml && type === 'html' };
}

describe('billing owner-only gate', () => {
	it('allows the account owner', () => {
		let next = false;
		requireBillingOwner(makeReq('owner', true), {}, () => { next = true; });
		assert.equal(next, true);
	});

	it('denies an ordinary member and redirects HTML to subscription settings', () => {
		let next = false;
		const res = { location: undefined, redirect(value) { this.location = value; } };
		requireBillingOwner(makeReq('member', true), res, () => { next = true; });
		assert.equal(next, false);
		assert.equal(res.location, '/settings/subscription');
	});

	it('denies an admin with a 403 for JSON', () => {
		let next = false;
		const res = { statusCode: undefined, body: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
		requireBillingOwner(makeReq('admin', false), res, () => { next = true; });
		assert.equal(next, false);
		assert.equal(res.statusCode, 403);
		assert.equal(res.body.code, 'billing_owner_required');
	});

	it('is wired into the billing route chain after browser auth and before checkout', () => {
		const source = readFileSync(new URL('../routes/billing.js', import.meta.url), 'utf8');
		const webhookIndex = source.indexOf("'/billing/webhook'");
		const gateIndex = source.indexOf("router.use('/billing', requireAuth, requireTenant, requireBrowserSession, requireBillingOwner");
		const checkoutIndex = source.indexOf("router.get('/billing/checkout'");

		assert.ok(webhookIndex >= 0);
		assert.ok(gateIndex > webhookIndex);
		assert.ok(checkoutIndex > gateIndex);
	});
});