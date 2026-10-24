import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applySubscriptionDeletedEvent, applySubscriptionUpdatedEvent } from '../services/billing_service.js';

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

function matchesFilter(state, filter) {
	if (filter.stripe_subscription_id && state.stripe_subscription_id !== filter.stripe_subscription_id) return false;
	for (const clause of filter.$or || []) {
		if (clause.stripe_subscription_event_at?.$exists === false) {
			if (state.stripe_subscription_event_at === undefined || state.stripe_subscription_event_at === null) return true;
		}
		if (clause.stripe_subscription_event_at?.$lt !== undefined) {
			const current = state.stripe_subscription_event_at;
			if (current === undefined || current === null || current < clause.stripe_subscription_event_at.$lt) return true;
		}
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
		// Checkout already stored the active subscription; the first updated
		// event for it must not be blocked by the guard.
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_new', subscription_status: 'active' });
		const user = await applySubscriptionUpdatedEvent(sub('active', 'sub_new'), 100, { userModel });

		assert.ok(user);
		assert.equal(user.subscription_status, 'active');
		assert.equal(userModel.state.stripe_subscription_event_at, 100);
	});

	it('rejects an event whose timestamp equals the recorded one (strict ordering)', async () => {
		const userModel = makeUserModel({ stripe_subscription_id: 'sub_1', subscription_status: 'active', stripe_subscription_event_at: 100 });
		const user = await applySubscriptionUpdatedEvent(sub('past_due'), 100, { userModel });

		assert.equal(user, null);
		assert.equal(userModel.state.subscription_status, 'active');
	});
});