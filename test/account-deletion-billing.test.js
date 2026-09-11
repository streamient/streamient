import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkAccountDeletionBilling, cancelAccountTrackingSubscriptions, isDeletionTrackingSubscription, getSubscriptionCancellationPortalStatus } from '../services/billing_service.js';

const host = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const tenant = { host_id: host, owner: 'bbbbbbbbbbbbbbbbbbbbbbbb', beta_enrolled_at: new Date() };
const settings = { billing: { enabled: false }, stripe: { secretKey: 'test', freePriceId: 'free', proPriceId: 'pro', betaCouponId: 'beta' } };
const free = { id: 'sub_free', status: 'active', items: { data: [{ price: { id: 'free', unit_amount: 0 } }] } };
const beta = { id: 'sub_beta', status: 'active', metadata: { beta_user: 'true', host_id: host }, items: { data: [{ price: { id: 'pro', unit_amount: 9900 } }] }, discounts: [{ source: { coupon: { id: 'beta', percent_off: 100, duration: 'forever', valid: true } } }] };
const paid = { id: 'sub_paid', status: 'active', items: { data: [{ price: { id: 'pro', unit_amount: 9900 } }] } };
function fixture(subscriptions = [], schedules = []) {
	return { config: settings, user: { stripe_customer_id: host }, stripe: { customers: { retrieve: async () => ({ id: host, metadata: { host_id: host } }) }, subscriptions: { list: async () => ({ data: subscriptions, has_more: false }), cancel: async (id) => { subscriptions.find((item) => item.id === id).status = 'canceled'; } }, subscriptionSchedules: { list: async () => ({ data: schedules, has_more: false }) } } };
}
describe('account deletion Stripe gate', () => {
	for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'unknown']) it(`blocks paid ${status}`, async () => {
		await assert.rejects(checkAccountDeletionBilling(tenant, fixture([{ ...paid, status }])), { code: 'subscription_not_canceled' });
	});
	it('scheduled cancellation remains blocked', async () => { await assert.rejects(checkAccountDeletionBilling(tenant, fixture([{ ...paid, cancel_at_period_end: true }])), { code: 'subscription_not_canceled' }); });
	it('permits terminal subscriptions and no subscriptions', async () => {
		for (const list of [[], [{ ...paid, status: 'canceled' }], [{ ...paid, status: 'incomplete_expired' }]]) assert.equal((await checkAccountDeletionBilling(tenant, fixture(list))).eligible, true);
	});
	it('only exempts the verified zero-price tracking subscription', async () => {
		assert.deepEqual((await checkAccountDeletionBilling(tenant, fixture([free]))).tracking_ids, ['sub_free']);
		assert.equal(isDeletionTrackingSubscription(beta, tenant, settings), false);
		assert.equal(isDeletionTrackingSubscription({ ...free, items: { data: [{ price: { id: 'free', unit_amount: 100 } }] } }, tenant, settings), false);
	});
	it('cancels tracking subscriptions and verifies again', async () => {
		const options = fixture([structuredClone(free)]);
		const expired = [];
		options.stripe.checkout = { sessions: { list: async () => ({ data: [{ id: 'checkout-open' }], has_more: false }), expire: async (id) => expired.push(id) } };
		assert.deepEqual((await cancelAccountTrackingSubscriptions(tenant, options)).tracking_ids, []);
		assert.deepEqual(expired, ['checkout-open']);
	});
	it('checks subsequent pages for a paid subscription', async () => {
		const options = fixture();
		options.stripe.subscriptions.list = async (params) => params.starting_after ? { data: [paid], has_more: false } : { data: [free], has_more: true };
		await assert.rejects(checkAccountDeletionBilling(tenant, options), { code: 'subscription_not_canceled' });
	});
	it('checks subsequent schedule pages', async () => {
		const options = fixture();
		options.stripe.subscriptionSchedules.list = async (params) => params.starting_after ? { data: [{ id: 'future', status: 'not_started' }], has_more: false } : { data: [{ id: 'old', status: 'completed' }], has_more: true };
		await assert.rejects(checkAccountDeletionBilling(tenant, options), { code: 'subscription_not_canceled' });
	});
	it('fails closed on malformed pagination and Stripe errors', async () => {
		for (const load of [async () => ({ data: [], has_more: true }), async () => { throw new Error('Stripe offline'); }]) {
			const options = fixture(); options.stripe.subscriptions.list = load;
			await assert.rejects(checkAccountDeletionBilling(tenant, options), { code: 'billing_unavailable' });
		}
	});
	it('allows an unbilled deployment but rejects missing Stripe configuration for known billing', async () => {
		const config = { ...settings, stripe: { ...settings.stripe, secretKey: '' } };
		assert.equal((await checkAccountDeletionBilling(tenant, { config, user: {} })).eligible, true);
		await assert.rejects(checkAccountDeletionBilling(tenant, { config, user: { stripe_customer_id: host } }), { code: 'billing_unavailable' });
		await assert.rejects(checkAccountDeletionBilling(tenant, { config, user: { subscription_status: 'active' } }), { code: 'billing_unavailable' });
		assert.equal((await checkAccountDeletionBilling(tenant, { config, user: { subscription_status: 'trialing', trial_source: 'no_card' } })).eligible, true);
	});
	it('reports actual portal cancellation configuration', async () => {
		for (const enabled of [true, false]) {
			const portal = { active: true, features: { subscription_cancel: { enabled } } };
			const stripe = { billingPortal: { configurations: { retrieve: async () => portal, list: async () => ({ data: [portal] }) } } };
			assert.equal((await getSubscriptionCancellationPortalStatus({ stripe })).enabled, enabled);
		}
	});
});
