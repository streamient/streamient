import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { effectiveResourceLimits, isAtLimit } from '../services/subscription_access_service.js';

describe('stored account resource limits', () => {
	it('uses stored limits for every hosted plan and trial state', () => {
		const tenant = {
			plan: 'free',
			limit_projects: 3,
			limit_users: 7,
		};
		assert.deepEqual(effectiveResourceLimits(tenant, true), { projects: 3, users: 7 });

		tenant.plan = 'pro';
		assert.deepEqual(effectiveResourceLimits(tenant, true), { projects: 3, users: 7 });
		assert.deepEqual(effectiveResourceLimits({
			...tenant,
			subscription_status: 'trialing',
			trial_ends_at: new Date(Date.now() + 86_400_000),
		}, true), { projects: 3, users: 7 });
	});

	it('treats self-hosted and zero stored limits as unlimited', () => {
		assert.deepEqual(effectiveResourceLimits({ limit_projects: 1, limit_users: 1 }, false), { projects: 0, users: 0 });
		assert.deepEqual(effectiveResourceLimits({ plan: 'pro', limit_projects: 0, limit_users: 0 }, true), { projects: 0, users: 0 });
	});

	it('isAtLimit treats zero as unlimited and enforces positive limits', () => {
		assert.equal(isAtLimit(0, 1_000), false);
		assert.equal(isAtLimit(1, 0), false);
		assert.equal(isAtLimit(1, 1), true);
		assert.equal(isAtLimit(5, 5), true);
	});
});
