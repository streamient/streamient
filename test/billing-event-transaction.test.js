import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { applySubscriptionPlanEvent } from '../services/billing_service.js';

async function runTransaction(callback) {
	const session = await mongoose.connection.startSession();
	try {
		return await session.withTransaction(() => callback(session));
	} finally {
		await session.endSession();
	}
}

test('subscription User/Tenant publication is atomic and cancellation wins ties', { skip: process.env.STREAMIENT_BILLING_INTEGRATION !== '1', timeout: 30000 }, async (t) => {
	assert.ok(process.env.MONGO_URI);
	const dbName = `streamient_billing_test_${crypto.randomUUID().replaceAll('-', '')}`;
	await mongoose.connect(process.env.MONGO_URI, { ...config.mongoOptions, dbName });
	t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
	await Promise.all([User.init(), Tenant.init()]);

	const tenant = await Tenant.create({ owner: new mongoose.Types.ObjectId(), host_id: 'billing-host', name: 'Billing', plan: 'pro' });
	const user = await User.create({
		email: 'billing@example.invalid',
		name: 'Billing',
		password: 'integration-only',
		is_active: true,
		host_id: 'billing-host',
		tenant: tenant._id,
		stripe_subscription_id: 'sub_1',
		subscription_status: 'active',
	});
	const sub = (status) => ({ id: 'sub_1', status, trial_end: null });
	const publish = (terminal, created) => runTransaction((session) => applySubscriptionPlanEvent(sub(terminal ? 'canceled' : 'active'), created, { terminal, session }));

	// Active update then a same-second cancellation: cancellation must win the tie.
	await publish(false, 100);
	await publish(true, 100);
	const canceled = await User.findById(user._id).select('+stripe_subscription_id +stripe_subscription_event_at').lean();
	assert.equal(canceled.subscription_status, 'canceled');
	assert.equal(canceled.stripe_subscription_event_at, 100);
	assert.equal((await Tenant.findById(tenant._id).lean()).plan, 'free');

	// A delayed older active event must not republish pro.
	await publish(false, 90);
	assert.equal((await Tenant.findById(tenant._id).lean()).plan, 'free');
	assert.equal((await User.findById(user._id).lean()).subscription_status, 'canceled');

	// A Tenant write failure rolls back the User write in the same transaction.
	const original = Tenant.updateOne;
	Tenant.updateOne = async () => { throw new Error('tenant write failed'); };
	try {
		await assert.rejects(publish(false, 200), /tenant write failed/);
	} finally {
		Tenant.updateOne = original;
	}
	const afterRollback = await User.findById(user._id).select('+stripe_subscription_event_at').lean();
	assert.equal(afterRollback.subscription_status, 'canceled');
	assert.equal(afterRollback.stripe_subscription_event_at, 100);
});