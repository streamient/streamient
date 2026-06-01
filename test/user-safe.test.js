import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { User } from '../model/user.js';

describe('User.toSafe', () => {
	it('removes security secrets and access token values', () => {
		const user = new User({
			email: 'safe-user@example.com',
			password: 'password',
			name: 'Safe User',
			totp_secret: 'totp-secret',
			verification_token: 'verify-token',
			password_reset_token: 'reset-token',
			password_reset_expires: new Date(),
			stripe_customer_id: 'stripe-customer',
			stripe_subscription_id: 'stripe-subscription',
			access_tokens: [{ token: 'raw-token', name: 'MCP token' }],
		});

		const safe = user.toSafe();
		assert.ok(!safe.password, 'password must not be exposed');
		assert.ok(!safe.totp_secret, 'totp_secret must not be exposed');
		assert.ok(!safe.verification_token, 'verification_token must not be exposed');
		assert.ok(!safe.password_reset_token, 'password_reset_token must not be exposed');
		assert.ok(!safe.password_reset_expires, 'password_reset_expires must not be exposed');
		assert.ok(!safe.stripe_customer_id, 'stripe_customer_id must not be exposed');
		assert.ok(!safe.stripe_subscription_id, 'stripe_subscription_id must not be exposed');
		assert.equal(safe.access_tokens.length, 1);
		assert.ok(!safe.access_tokens[0].token, 'access token value must not be exposed');
		assert.equal(safe.access_tokens[0].name, 'MCP token');
	});
});
