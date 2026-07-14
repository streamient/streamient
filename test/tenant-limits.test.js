import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import mongoose from '../model/mongoose.js';
import { Tenant, backfillTenantLimits } from '../modules/tenancy.js';
import {
	normalizeTenantLimit,
	normalizeTenantLimits,
	resolvePlanTenantLimits,
	resolveStoredTenantLimits,
} from '../modules/tenant_limits.js';

describe('stored tenant limits', () => {
	it('resolves exact defaults for every plan', () => {
		assert.deepEqual(resolvePlanTenantLimits('free'), {
			limit_projects: 1,
			limit_users: 5,
			limit_ai_workflows_per_day: 25,
		});
		assert.deepEqual(resolvePlanTenantLimits('pro'), {
			limit_projects: 0,
			limit_users: 0,
			limit_ai_workflows_per_day: 0,
		});
	});

	it('accepts whole numbers including zero and rejects invalid values', () => {
		assert.equal(normalizeTenantLimit(0, 'limit_projects'), 0);
		assert.equal(normalizeTenantLimit('12', 'limit_users'), 12);
		for (const value of [-1, 1.5, '', null, true, Number.MAX_SAFE_INTEGER + 1]) {
			assert.throws(() => normalizeTenantLimit(value, 'limit_projects'), /whole number/);
		}
	});

	it('preserves stored values and fills only missing fields', () => {
		assert.deepEqual(resolveStoredTenantLimits({
			plan: 'free',
			limit_projects: 4,
			limit_users: 0,
		}), {
			limit_projects: 4,
			limit_users: 0,
			limit_ai_workflows_per_day: 25,
		});
		assert.deepEqual(normalizeTenantLimits({
			limit_projects: 3,
			limit_users: 4,
			limit_ai_workflows_per_day: 5,
		}), {
			limit_projects: 3,
			limit_users: 4,
			limit_ai_workflows_per_day: 5,
		});
	});

	it('applies plan-aware Mongoose defaults', () => {
		const owner = new mongoose.Types.ObjectId();
		const free = new Tenant({ host_id: new mongoose.Types.ObjectId().toString(), name: 'Free', owner, plan: 'free' });
		const pro = new Tenant({ host_id: new mongoose.Types.ObjectId().toString(), name: 'Pro', owner, plan: 'pro' });
		assert.equal(free.limit_projects, 1);
		assert.equal(free.limit_users, 5);
		assert.equal(free.limit_ai_workflows_per_day, 25);
		assert.equal(pro.limit_projects, 0);
		assert.equal(pro.limit_users, 0);
		assert.equal(pro.limit_ai_workflows_per_day, 0);
	});
});

describe('tenant limit backfill', () => {
	const originalUpdateMany = Tenant.updateMany;

	afterEach(() => {
		Tenant.updateMany = originalUpdateMany;
	});

	it('updates missing fields only and is idempotent', async () => {
		const calls = [];
		Tenant.updateMany = async (filter, update, options) => {
			calls.push({ filter, update, options });
			return { modifiedCount: calls.length <= 6 ? 1 : 0 };
		};
		assert.deepEqual(await backfillTenantLimits(), { migrated: 6 });
		assert.deepEqual(await backfillTenantLimits(), { migrated: 0 });
		assert.equal(calls.length, 12);
		for (const call of calls) {
			const field = Object.keys(call.update.$set)[0];
			assert.deepEqual(call.filter[field], { $exists: false });
			assert.equal(call.options.timestamps, false);
		}
	});
});
