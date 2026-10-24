import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applySubscriptionToUser } from '../services/billing_service.js';
import { User } from '../model/user.js';
import { Tenant, accountWork } from '../modules/tenancy.js';

async function runApply(t, ownerStripeSubscriptionId, subscription) {
	const updates = [];
	t.mock.method(accountWork, 'assertAvailable', async () => {});
	t.mock.method(Tenant, 'findOneAndUpdate', async () => ({}));
	t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ host_id: 'host-1', stripe_subscription_id: ownerStripeSubscriptionId }) }) }));
	t.mock.method(User, 'findByIdAndUpdate', async (_id, update) => { updates.push(update); return { host_id: 'host-1' }; });
	await applySubscriptionToUser('user-1', subscription);
	return updates;
}

test('applySubscriptionToUser clears the event fence only for a new subscription', async (t) => {
	const updates = await runApply(t, 'sub_old', { id: 'sub_new', status: 'active', trial_end: null });

	assert.equal(updates[0].$set.stripe_subscription_id, 'sub_new');
	assert.deepEqual(updates[0].$unset, { stripe_subscription_event_at: '' });
});

test('applySubscriptionToUser keeps the event fence when re-applying the same subscription', async (t) => {
	const updates = await runApply(t, 'sub_1', { id: 'sub_1', status: 'active', trial_end: null });

	assert.equal(updates[0].$set.stripe_subscription_id, 'sub_1');
	assert.equal(updates[0].$unset, undefined);
});