import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
	applySubscriptionDeletedEvent,
	applySubscriptionUpdatedEvent,
	applySubscriptionPlanEvent,
	applyInvoicePaymentFailed,
} from '../services/billing_service.js';

function sub(status = 'active', id = 'sub_1') {
	return { id, status, trial_end: null };
}

/** A thenable doc that also supports the deleted handler's `.select(...)` chain. */
function doc(value) {
	return {
		select: async () => value,
		then(resolve) { resolve(value); },
	};
}

// Real MongoDB semantics: `$exists: false` matches only an ABSENT field (never a
// null one); a null field sorts before numbers so it matches `$lt`/`$lte`; an
// absent field never matches `$lt`/`$lte`.
function matchesFilter(state, filter) {
	if (filter.stripe_subscription_id && state.stripe_subscription_id !== filter.stripe_subscription_id) return false;
	if (filter.subscription_status?.$in && !filter.subscription_status.$in.includes(state.subscription_status)) return false;
	for (const clause of filter.$or || []) {
		const cond = clause.stripe_subscription_event_at;
		const current = state.stripe_subscription_event_at;
		if (cond?.$exists === false && current === undefined) return true;
		if (cond?.$lt !== undefined && (current === null || (typeof current === 'number' && current < cond.$lt))) return true;
		if (cond?.$lte !== undefined && (current === null || (typeof current === 'number' && current <= cond.$lte))) return true;
	}
	return false;
}

function makeUserModel(initial = {}) {
	const state = { _id: 'user-1', host_id: 'host-1', ...initial };
	const calls = [];
	return {
		calls,
		state,
		findOneAndUpdate(filter, update) {
			calls.push({ filter, update });
			if (!matchesFilter(state, filter)) return doc(null);
			if (update?.$set) Object.assign(state, update.$set);
			return doc({ ...state });
		},
	};
}

function makeTenantModel() {
	const plans = [];
	return {
		plans,
		updateOne(filter, update) { plans.push({ filter, update }); return { matchedCount: 1 }; },
	};
}

describe('Stripe subscription event ordering guard', () => {
	it('applies a newer updated event and records its timestamp', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'incomplete' });
		const user = await applySubscriptionUpdatedEvent(sub('active'), 200, { userModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'active');
		assert.equal(userModel.state.stripe_subscription_event_at, 200);
		assert.equal(userModel.calls[0].filter.stripe_subscription_id, 'sub_1');
		assert.deepEqual(userModel.calls[0].filter.$or, [
			{ stripe_subscription_event_at: { $lt: 200 } },
			{ stripe_subscription_event_at: { $exists: false } },
		]);
	});

	it('never reactivates a canceled subscription from a delayed older updated event', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'canceled', stripe_subscription_event_at: 300 });
		const user = await applySubscriptionUpdatedEvent(sub('active'), 100, { userModel });

		assert.equal(user, null);
		assert.equal(userModel.state.subscription_status, 'canceled');
		assert.equal(userModel.state.stripe_subscription_event_at, 300);
	});

	it('ignores out-of-order updated events (older after newer)', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'trialing' });

		const newer = await applySubscriptionUpdatedEvent({ ...sub('active'), trial_end: null }, 200, { userModel });
		assert.ok(newer);
		assert.equal(userModel.state.subscription_status, 'active');

		const older = await applySubscriptionUpdatedEvent(sub('past_due'), 100, { userModel });
		assert.equal(older, null);
		assert.equal(userModel.state.subscription_status, 'active');
		assert.equal(userModel.state.stripe_subscription_event_at, 200);
	});

	it('applies a newer deleted event and records the cancellation', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 100 });
		const user = await applySubscriptionDeletedEvent(sub('canceled'), 200, { userModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'canceled');
		assert.equal(userModel.state.subscription_status, 'canceled');
		assert.equal(userModel.state.stripe_subscription_event_at, 200);
	});

	it('ignores a stale deleted event that is older than a newer update', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 200 });
		const user = await applySubscriptionDeletedEvent(sub('canceled'), 100, { userModel });

		assert.equal(user, null);
		assert.equal(userModel.state.subscription_status, 'active');
	});

	it('applies the first event for a legitimate new subscription (no prior timestamp)', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_new', subscription_status: 'active' });
		const user = await applySubscriptionUpdatedEvent(sub('active', 'sub_new'), 100, { userModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'active');
		assert.equal(userModel.state.stripe_subscription_event_at, 100);
	});

	it('lets cancellation win a same-second tie after an update (terminal $lte)', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 100 });
		const user = await applySubscriptionDeletedEvent(sub('canceled'), 100, { userModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'canceled');
		assert.equal(userModel.state.subscription_status, 'canceled');
		assert.equal(userModel.state.stripe_subscription_event_at, 100);
	});

	it('still rejects a same-second non-terminal update (strict $lt)', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 100 });
		const user = await applySubscriptionUpdatedEvent(sub('past_due'), 100, { userModel });

		assert.equal(user, null);
		assert.equal(userModel.state.subscription_status, 'active');
	});
});

describe('subscription plan publication (User + Tenant atomic unit)', () => {
	it('publishes the user status and tenant pro plan together for an update', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'incomplete' });
		const tenantModel = makeTenantModel();
		const user = await applySubscriptionPlanEvent(sub('active'), 200, { terminal: false, userModel, tenantModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'active');
		assert.equal(tenantModel.plans.length, 1);
		assert.deepEqual(tenantModel.plans[0].update, { $set: { plan: 'pro' } });
	});

	it('does not write the tenant when the update event is stale', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'canceled', stripe_subscription_event_at: 300 });
		const tenantModel = makeTenantModel();
		const user = await applySubscriptionPlanEvent(sub('active'), 100, { terminal: false, userModel, tenantModel });

		assert.equal(user, null);
		assert.equal(tenantModel.plans.length, 0);
	});

	it('cancellation publishes the user cancellation and tenant free plan', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 100 });
		const tenantModel = makeTenantModel();
		const user = await applySubscriptionPlanEvent(sub('canceled'), 200, { terminal: true, userModel, tenantModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'canceled');
		assert.deepEqual(tenantModel.plans[0].update, { $set: { plan: 'free' } });
	});

	it('passes the transaction session to both user and tenant writes', async () => {
		const session = { marker: 'txn' };
		const userOptions = [];
		const tenantOptions = [];
		const userModel = {
			findOneAndUpdate(_filter, _update, options) { userOptions.push(options); return doc({ host_id: 'host-1' }); },
		};
		const tenantModel = {
			updateOne(_filter, _update, options) { tenantOptions.push(options); return { matchedCount: 1 }; },
		};
		await applySubscriptionPlanEvent(sub('active'), 200, { terminal: false, userModel, tenantModel, session });

		assert.equal(userOptions[0].session, session);
		assert.equal(tenantOptions[0].session, session);
	});
});

describe('invoice.payment_failed conditional past_due', () => {
	it('marks an active subscription past_due for a newer failure', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 100 });
		const user = await applyInvoicePaymentFailed('sub_1', 200, { userModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'past_due');
		assert.equal(userModel.state.stripe_subscription_event_at, 200);
	});

	it('does not restore past_due after a cancellation (delayed failure)', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'canceled', stripe_subscription_event_at: 300 });
		const user = await applyInvoicePaymentFailed('sub_1', 150, { userModel });

		assert.equal(user, null);
		assert.equal(userModel.state.subscription_status, 'canceled');
	});

	it('ignores a payment_failed older than the last applied subscription event', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 300 });
		const user = await applyInvoicePaymentFailed('sub_1', 150, { userModel });

		assert.equal(user, null);
		assert.equal(userModel.state.subscription_status, 'active');
	});
});