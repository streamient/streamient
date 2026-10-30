import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { applySubscriptionPlanEvent, applySubscriptionToUser } from '../services/billing_service.js';

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

test('checkout apply cannot reactivate a canceled same subscription but applies a new one', { skip: process.env.STREAMIENT_BILLING_INTEGRATION !== '1', timeout: 30000 }, async (t) => {
	assert.ok(process.env.MONGO_URI);
	const dbName = `streamient_billing_test_${crypto.randomUUID().replaceAll('-', '')}`;
	await mongoose.connect(process.env.MONGO_URI, { ...config.mongoOptions, dbName });
	t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
	await Promise.all([User.init(), Tenant.init()]);

	const tenant = await Tenant.create({ owner: new mongoose.Types.ObjectId(), host_id: 'checkout-host', name: 'Checkout', plan: 'pro' });
	const user = await User.create({
		email: 'checkout@example.invalid',
		name: 'Checkout',
		password: 'integration-only',
		is_active: true,
		host_id: 'checkout-host',
		tenant: tenant._id,
		stripe_subscription_id: 'sub_1',
		subscription_status: 'active',
	});

	// The terminal deletion commits first.
	await runTransaction((session) => applySubscriptionPlanEvent({ id: 'sub_1', status: 'canceled', trial_end: null }, 500, { terminal: true, session }));

	// A checkout apply resumes from an older "active" snapshot for the SAME id:
	// it must not reactivate the canceled subscription and must not rewrite plan.
	const ignored = await applySubscriptionToUser(user._id, { id: 'sub_1', status: 'active', trial_end: null });
	assert.equal(ignored, null);
	assert.equal((await User.findById(user._id).select('+stripe_subscription_id').lean()).subscription_status, 'canceled');
	assert.equal((await Tenant.findById(tenant._id).lean()).plan, 'free');

	// A genuinely different subscription still applies over the canceled one.
	const applied = await applySubscriptionToUser(user._id, { id: 'sub_2', status: 'active', trial_end: null });
	assert.ok(applied);
	const resubscribed = await User.findById(user._id).select('+stripe_subscription_id +stripe_subscription_event_at').lean();
	assert.equal(resubscribed.subscription_status, 'active');
	assert.equal(resubscribed.stripe_subscription_id, 'sub_2');
	assert.equal(resubscribed.stripe_subscription_event_at, undefined);
	assert.equal((await Tenant.findById(tenant._id).lean()).plan, 'pro');
});

test('concurrent project creates cannot exceed the stored limit', { skip: process.env.STREAMIENT_BILLING_INTEGRATION !== '1', timeout: 30000 }, async (t) => {
	assert.ok(process.env.MONGO_URI);
	const { Project } = await import('../model/project.js');
	const { createProject } = await import('../services/project_service.js');
	const dbName = `streamient_quota_test_${crypto.randomUUID().replaceAll('-', '')}`;
	await mongoose.connect(process.env.MONGO_URI, { ...config.mongoOptions, dbName });
	t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
	await Promise.all([Tenant.init(), Project.init()]);
	const owner = new mongoose.Types.ObjectId();
	await Tenant.create({ owner, host_id: 'quota-host', name: 'Quota', limit_projects: 2 });
	const existing = await Project.create({ owner, host_id: 'quota-host', name: 'Existing' });
	const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => createProject(owner, 'quota-host', { name: `Concurrent ${i}` }, {}, { isHosted: true })));
	assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
	for (const result of results.filter((r) => r.status === 'rejected')) assert.equal(result.reason.code, 'ACCOUNT_LIMIT');
	assert.equal(await Project.countDocuments({ host_id: 'quota-host' }), 2);
	assert.ok(await Project.findById(existing._id));
});

test('concurrent team creates enforce quota and roll back new users', { skip: process.env.STREAMIENT_BILLING_INTEGRATION !== '1', timeout: 30000 }, async (t) => {
 assert.ok(process.env.MONGO_URI);
 const { TenantMember } = await import('../model/tenant_member.js');
 const { createTeamMember } = await import('../services/team_service.js');
 const dbName = `streamient_team_quota_test_${crypto.randomUUID().replaceAll('-', '')}`;
 await mongoose.connect(process.env.MONGO_URI, { ...config.mongoOptions, dbName });
 t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
 await Promise.all([User.init(), Tenant.init(), TenantMember.init()]);
 const owner = await User.create({ email: 'owner@example.test', name: 'Owner', password: 'password123', is_active: true });
 await Tenant.create({ owner: owner._id, host_id: 'team-quota', name: 'Quota', limit_users: 2 });
 const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => createTeamMember(owner._id, 'team-quota', { email: `member${i}@example.test`, name: `Member ${i}`, password: 'password123' }, {}, { isHosted: true })));
 assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
 for (const result of results.filter(r => r.status === 'rejected')) assert.equal(result.reason.code, 'ACCOUNT_LIMIT');
 assert.equal(await TenantMember.countDocuments({ host_id: 'team-quota' }), 1);
 assert.equal(await User.countDocuments({}), 2);
});
