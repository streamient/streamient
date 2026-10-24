import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyCheckoutSubscriptionPlan } from '../services/billing_service.js';

// Faithful-enough simulation of the conditional findOneAndUpdate filter and the
// aggregation-pipeline update, mirroring real MongoDB semantics for the fields
// this service touches. `$$REMOVE` drops the field; `$ne` matches any value
// (including a missing one) that is not equal; the `$cond` keeps the event fence
// only when the matched document's stripe_subscription_id equals the incoming id.
function makeUserModel(initial) {
	const state = { _id: 'user-1', host_id: 'host-1', ...initial };
	const calls = [];
	return {
		calls,
		state,
		findOneAndUpdate(filter, pipeline, options) {
			calls.push({ filter, pipeline, options });
			if (!matchesCheckoutFilter(state, filter)) return null;
			applyCheckoutPipeline(state, pipeline);
			return { ...state };
		},
	};
}

function matchesCheckoutFilter(state, filter) {
	if (String(filter._id) !== String(state._id)) return false;
	return filter.$or.some((clause) => {
		if (clause.stripe_subscription_id?.$ne !== undefined) {
			return state.stripe_subscription_id !== clause.stripe_subscription_id.$ne;
		}
		return state.stripe_subscription_id === clause.stripe_subscription_id && state.subscription_status !== clause.subscription_status.$ne;
	});
}

function applyCheckoutPipeline(state, pipeline) {
	for (const stage of pipeline) {
		// A single `$set` stage evaluates every expression against the document
		// as it was BEFORE the stage, so capture the pre-stage subscription id.
		const originalStripeSubscriptionId = state.stripe_subscription_id;
		for (const [field, expr] of Object.entries(stage.$set || {})) {
			if (field === 'stripe_subscription_event_at' && expr?.$cond) {
				const [cond, keep] = expr.$cond;
				const subscriptionId = cond.$eq[1];
				const same = cond.$eq[0] === '$stripe_subscription_id' && originalStripeSubscriptionId === subscriptionId;
				const current = state[field];
				const kept = same && keep?.$ifNull && current !== undefined && current !== null;
				if (!kept) delete state[field];
				continue;
			}
			state[field] = expr;
		}
	}
}

function makeTenantModel() {
	const plans = [];
	return {
		plans,
		updateOne(filter, update, options) { plans.push({ filter, update, options }); return { matchedCount: 1 }; },
	};
}

const activeSub = (id) => ({ id, status: 'active', trial_end: null });

test('checkout apply never reactivates a canceled same subscription (deletion already committed)', async () => {
	const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'canceled', stripe_subscription_event_at: 500 });
	const tenantModel = makeTenantModel();
	const user = await applyCheckoutSubscriptionPlan('user-1', activeSub('sub_1'), undefined, { userModel, tenantModel });

	assert.equal(user, null);
	assert.equal(userModel.state.subscription_status, 'canceled');
	assert.equal(userModel.state.stripe_subscription_id, 'sub_1');
	assert.equal(userModel.state.stripe_subscription_event_at, 500);
	assert.equal(tenantModel.plans.length, 0);
});

test('checkout apply allows a legitimate different subscription over a canceled one and clears the fence', async () => {
	const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'canceled', stripe_subscription_event_at: 500 });
	const tenantModel = makeTenantModel();
	const user = await applyCheckoutSubscriptionPlan('user-1', activeSub('sub_2'), undefined, { userModel, tenantModel });

	assert.ok(user);
	assert.equal(userModel.state.subscription_status, 'active');
	assert.equal(userModel.state.stripe_subscription_id, 'sub_2');
	assert.equal(userModel.state.stripe_subscription_event_at, undefined);
	assert.deepEqual(tenantModel.plans[0].update, { $set: { plan: 'pro' } });
});

test('checkout apply keeps the event fence when re-applying the current active subscription', async () => {
	const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 100 });
	const tenantModel = makeTenantModel();
	const user = await applyCheckoutSubscriptionPlan('user-1', activeSub('sub_1'), undefined, { userModel, tenantModel });

	assert.ok(user);
	assert.equal(userModel.state.subscription_status, 'active');
	assert.equal(userModel.state.stripe_subscription_event_at, 100);
	assert.deepEqual(tenantModel.plans[0].update, { $set: { plan: 'pro' } });
});

test('checkout apply clears the fence for a first-time subscription (no prior subscription)', async () => {
	const userModel = makeUserModel({ stripe_subscription_id: undefined, subscription_status: 'incomplete' });
	const tenantModel = makeTenantModel();
	const user = await applyCheckoutSubscriptionPlan('user-1', activeSub('sub_1'), undefined, { userModel, tenantModel });

	assert.ok(user);
	assert.equal(userModel.state.subscription_status, 'active');
	assert.equal(userModel.state.stripe_subscription_id, 'sub_1');
	assert.equal(userModel.state.stripe_subscription_event_at, undefined);
	assert.deepEqual(tenantModel.plans[0].update, { $set: { plan: 'pro' } });
});

test('checkout apply publishes user and tenant in the same transaction session', async () => {
	const session = { marker: 'txn' };
	const userOptions = [];
	const tenantOptions = [];
	const userModel = {
		findOneAndUpdate(filter, pipeline, options) { userOptions.push(options); return { host_id: 'host-1' }; },
	};
	const tenantModel = {
		updateOne(filter, update, options) { tenantOptions.push(options); return { matchedCount: 1 }; },
	};
	await applyCheckoutSubscriptionPlan('user-1', activeSub('sub_1'), undefined, { userModel, tenantModel, session });

	assert.equal(userOptions[0].session, session);
	assert.equal(tenantOptions[0].session, session);
});
