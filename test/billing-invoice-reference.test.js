import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import config from '../config.js';
import { getStripe } from '../modules/stripe.js';
import { User } from '../model/user.js';
import { handleWebhook } from '../services/billing_service.js';
import { mockTenantWork } from './helpers/tenant-work.js';

afterEach(() => mock.restoreAll());
test('invoice failures use legacy and current subscription references, including expanded IDs', async () => {
	const original = config.stripe.secretKey;
	config.stripe.secretKey = 'sk_test_local_fixture';
	const restore = mockTenantWork();
	try {
		const stripe = getStripe();
		let object;
		mock.method(stripe.webhooks, 'constructEvent', () => ({ type: 'invoice.payment_failed', created: 123, data: { object } }));
		mock.method(User, 'findOne', () => ({ select: () => ({ lean: async () => ({ host_id: 'host' }) }) }));
		const apply = mock.method(User, 'findOneAndUpdate', async () => null);
		for (const reference of [{ subscription: 'sub_1' }, { parent: { subscription_details: { subscription: 'sub_1' } } }, { parent: { subscription_details: { subscription: { id: 'sub_1' } } } }]) {
			object = { object: 'invoice', customer: 'cus_1', ...reference };
			await handleWebhook('', 'signature');
			assert.equal(apply.mock.calls.at(-1).arguments[0].stripe_subscription_id, 'sub_1');
		}
		assert.equal(apply.mock.calls.length, 3);
	} finally { restore(); config.stripe.secretKey = original; }
});
