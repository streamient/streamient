import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { effectiveResourceLimits, isAtLimit } from '../services/subscription_access_service.js';

describe('plan resource limits', () => {
	const now = new Date('2026-06-19T00:00:00.000Z');

	it('caps Free (hosted) tenants at the configured limits', () => {
		const freeUser = { subscription_status: 'incomplete' };
		assert.deepEqual(effectiveResourceLimits(freeUser, 'free', true, now), config.planLimits.free);
		assert.equal(config.planLimits.free.projects, 1);
		assert.equal(config.planLimits.free.users, 5);
	});

	it('treats Pro, active trials, and self-hosted as unlimited', () => {
		const trialUser = {
			subscription_status: 'trialing',
			trial_source: 'no_card',
			trial_ends_at: new Date('2026-06-26T00:00:00.000Z'),
		};
		assert.deepEqual(effectiveResourceLimits({}, 'pro', true, now), { projects: 0, users: 0 });
		assert.deepEqual(effectiveResourceLimits(trialUser, 'free', true, now), { projects: 0, users: 0 });
		assert.deepEqual(effectiveResourceLimits(null, 'free', false, now), { projects: 0, users: 0 });
	});

	it('isAtLimit treats 0 as unlimited and enforces non-zero caps', () => {
		assert.equal(isAtLimit(1, 0), false);
		assert.equal(isAtLimit(1, 1), true);
		assert.equal(isAtLimit(5, 4), false);
		assert.equal(isAtLimit(5, 5), true);
		assert.equal(isAtLimit(0, 1000), false);
	});
});
