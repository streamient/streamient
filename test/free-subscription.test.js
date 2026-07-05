import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import {
	buildFreeSubscriptionParams,
	cancelFreeSubscriptionForUser,
	ensureFreeSubscriptionForAccountHolder,
	isFreePriceSubscription,
	resolvePlanFromSubscription,
} from '../services/billing_service.js';

const originalStripeConfig = { ...config.stripe };

beforeEach(() => {
	config.stripe.secretKey = 'sk_test_123';
	config.stripe.freePriceId = 'price_free';
	config.stripe.proPriceId = 'price_pro';
});

afterEach(() => {
	Object.assign(config.stripe, originalStripeConfig);
});

function subscriptionWithPrice(priceId, status = 'active') {
	return { id: 'sub_1', status, items: { data: [{ price: { id: priceId } }] } };
}

describe('isFreePriceSubscription', () => {
	it('matches only the configured free price', () => {
		assert.equal(isFreePriceSubscription(subscriptionWithPrice('price_free')), true);
		assert.equal(isFreePriceSubscription(subscriptionWithPrice('price_pro')), false);
		assert.equal(isFreePriceSubscription({}), false);
	});

	it('never matches when the free price is unconfigured', () => {
		config.stripe.freePriceId = '';
		assert.equal(isFreePriceSubscription(subscriptionWithPrice('price_free')), false);
		assert.equal(isFreePriceSubscription(subscriptionWithPrice('')), false);
	});
});

describe('resolvePlanFromSubscription with the free tracking price', () => {
	it('maps an entitled free-price subscription to free, not pro', () => {
		assert.equal(resolvePlanFromSubscription(subscriptionWithPrice('price_free', 'active')), 'free');
		assert.equal(resolvePlanFromSubscription(subscriptionWithPrice('price_free', 'trialing')), 'free');
	});

	it('keeps the entitled-to-pro mapping for everything else', () => {
		assert.equal(resolvePlanFromSubscription(subscriptionWithPrice('price_pro')), 'pro');
		assert.equal(resolvePlanFromSubscription(subscriptionWithPrice('price_pro', 'canceled')), 'free');
	});
});

describe('buildFreeSubscriptionParams', () => {
	it('subscribes the customer to the free price with tracking metadata', () => {
		const params = buildFreeSubscriptionParams(
			'host-1',
			{ _id: 'user-1', host_id: 'old-host' },
			{ host_id: 'host-1' },
		);
		assert.equal(params.customer, 'host-1');
		assert.deepEqual(params.items, [{ price: 'price_free' }]);
		assert.deepEqual(params.metadata, { plan: 'free', host_id: 'host-1', streamient_user_id: 'user-1' });
	});

	it('falls back to the user host_id without a tenant', () => {
		const params = buildFreeSubscriptionParams('host-2', { _id: 'user-2', host_id: 'host-2' });
		assert.equal(params.metadata.host_id, 'host-2');
	});
});

describe('ensureFreeSubscriptionForAccountHolder', () => {
	function makeStripe({ existing = [] } = {}) {
		const calls = { list: [], create: [] };
		return {
			calls,
			subscriptions: {
				list: async (params) => {
					calls.list.push(params);
					return { data: existing };
				},
				create: async (params) => {
					calls.create.push(params);
					return { id: 'sub_free_new' };
				},
			},
		};
	}

	function makeUserModel() {
		const updates = [];
		return { updates, findByIdAndUpdate: async (id, update) => updates.push({ id, update }) };
	}

	it('creates the free subscription and stores only its id on the user', async () => {
		const user = { _id: 'user-1', host_id: 'host-1', stripe_customer_id: 'host-1', subscription_status: 'incomplete' };
		const stripe = makeStripe();
		const userModel = makeUserModel();

		const id = await ensureFreeSubscriptionForAccountHolder(user, { host_id: 'host-1' }, { stripe, userModel });

		assert.equal(id, 'sub_free_new');
		assert.equal(user.stripe_free_subscription_id, 'sub_free_new');
		assert.deepEqual(stripe.calls.list[0], { customer: 'host-1', price: 'price_free', status: 'active', limit: 1 });
		assert.equal(stripe.calls.create.length, 1);
		// Never touches subscription_status / stripe_subscription_id.
		assert.deepEqual(userModel.updates, [{ id: 'user-1', update: { stripe_free_subscription_id: 'sub_free_new' } }]);
	});

	it('reuses an existing active free subscription instead of creating one', async () => {
		const user = { _id: 'user-1', host_id: 'host-1', stripe_customer_id: 'host-1' };
		const stripe = makeStripe({ existing: [{ id: 'sub_free_old' }] });
		const userModel = makeUserModel();

		const id = await ensureFreeSubscriptionForAccountHolder(user, null, { stripe, userModel });

		assert.equal(id, 'sub_free_old');
		assert.equal(stripe.calls.create.length, 0);
	});

	it('skips without any Stripe call when the id is already stored', async () => {
		const user = { _id: 'user-1', stripe_customer_id: 'host-1', stripe_free_subscription_id: 'sub_free_old' };
		const stripe = makeStripe();
		const userModel = makeUserModel();

		const id = await ensureFreeSubscriptionForAccountHolder(user, null, { stripe, userModel });

		assert.equal(id, 'sub_free_old');
		assert.equal(stripe.calls.list.length, 0);
		assert.equal(userModel.updates.length, 0);
	});

	it('returns null when Stripe or the free price is not configured', async () => {
		const user = { _id: 'user-1', stripe_customer_id: 'host-1' };
		config.stripe.freePriceId = '';
		assert.equal(await ensureFreeSubscriptionForAccountHolder(user, null, { stripe: makeStripe(), userModel: makeUserModel() }), null);

		config.stripe.freePriceId = 'price_free';
		config.stripe.secretKey = '';
		assert.equal(await ensureFreeSubscriptionForAccountHolder(user, null, { stripe: makeStripe(), userModel: makeUserModel() }), null);
	});

	it('returns null for accounts carrying a live paid subscription', async () => {
		for (const status of ['active', 'trialing', 'past_due']) {
			const user = { _id: 'user-1', stripe_customer_id: 'host-1', stripe_subscription_id: 'sub_paid', subscription_status: status };
			assert.equal(await ensureFreeSubscriptionForAccountHolder(user, null, { stripe: makeStripe(), userModel: makeUserModel() }), null);
		}
		// A canceled paid subscription no longer blocks tracking.
		const canceled = { _id: 'user-1', stripe_customer_id: 'host-1', stripe_subscription_id: 'sub_paid', subscription_status: 'canceled' };
		assert.equal(await ensureFreeSubscriptionForAccountHolder(canceled, null, { stripe: makeStripe(), userModel: makeUserModel() }), 'sub_free_new');
	});

	it('returns null when the user has no Stripe customer', async () => {
		const stripe = makeStripe();
		assert.equal(await ensureFreeSubscriptionForAccountHolder({ _id: 'user-1' }, null, { stripe, userModel: makeUserModel() }), null);
		assert.equal(stripe.calls.list.length, 0);
	});
});

describe('cancelFreeSubscriptionForUser', () => {
	function makeUserModel(user) {
		const updates = [];
		return {
			updates,
			findById: () => ({ select: async () => user }),
			findByIdAndUpdate: async (id, update) => updates.push({ id, update }),
		};
	}

	it('cancels the stored free subscription and unsets the field', async () => {
		const canceled = [];
		const stripe = { subscriptions: { cancel: async (id) => canceled.push(id) } };
		const userModel = makeUserModel({ _id: 'user-1', stripe_free_subscription_id: 'sub_free_1' });

		assert.equal(await cancelFreeSubscriptionForUser('user-1', { stripe, userModel }), true);
		assert.deepEqual(canceled, ['sub_free_1']);
		assert.deepEqual(userModel.updates, [{ id: 'user-1', update: { $unset: { stripe_free_subscription_id: '' } } }]);
	});

	it('tolerates already-canceled or missing subscriptions', async () => {
		for (const err of [
			Object.assign(new Error('No such subscription'), { code: 'resource_missing' }),
			new Error('This subscription has been canceled'),
		]) {
			const stripe = { subscriptions: { cancel: async () => { throw err; } } };
			const userModel = makeUserModel({ _id: 'user-1', stripe_free_subscription_id: 'sub_free_1' });
			assert.equal(await cancelFreeSubscriptionForUser('user-1', { stripe, userModel }), true);
			assert.equal(userModel.updates.length, 1);
		}
	});

	it('rethrows unexpected Stripe errors', async () => {
		const stripe = { subscriptions: { cancel: async () => { throw new Error('rate limited'); } } };
		const userModel = makeUserModel({ _id: 'user-1', stripe_free_subscription_id: 'sub_free_1' });
		await assert.rejects(() => cancelFreeSubscriptionForUser('user-1', { stripe, userModel }), /rate limited/);
	});

	it('no-ops when no free subscription is stored', async () => {
		const userModel = makeUserModel({ _id: 'user-1' });
		assert.equal(await cancelFreeSubscriptionForUser('user-1', { stripe: {}, userModel }), false);
		assert.equal(userModel.updates.length, 0);
	});
});
