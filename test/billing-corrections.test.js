import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from '../routes/api.js';
import { Tenant } from '../modules/tenancy.js';
import { createCheckoutSession } from '../services/billing_service.js';
import { runTrialLifecycle } from '../modules/scheduler.js';
import config from '../config.js';
afterEach(() => mock.restoreAll());

test('all email routes pass the mounted feature gate for Free, Pro, trial and self-hosted', async (t) => {
 const group = express.Router();
 const start = router.stack.findIndex(layer => layer.handle.name === 'requireEmailFeatureAccess');
 assert.ok(start >= 0);
 const routes = router.stack.slice(start + 1).filter(layer => typeof layer.route?.path === 'string' && layer.route.path.startsWith('/emails'));
 group.stack = [router.stack[start], ...routes];
 // Replace only terminal service handlers: Express still dispatches the real route and group middleware.
 for (const layer of routes) mock.method(layer.route.stack.at(-1), 'handle', (_req, res) => res.sendStatus(204));
 let state;
 mock.method(Tenant, 'findOne', () => ({ select() { return this; }, lean: async () => ({ plan: state.plan }) }));
 const app = express();
 app.use((req, res, next) => { Object.assign(req, state, { host_id: 'host' }); next(); }, group);
 const server = app.listen(0, '127.0.0.1');
 await new Promise(resolve => server.once('listening', resolve));
 t.after(() => server.close());
 for (state of [
  { plan: 'free', isHosted: true, expected: 403 },
  { plan: 'pro', isHosted: true, expected: 204 },
  { plan: 'free', isHosted: false, expected: 204 },
  { plan: 'free', isHosted: true, billingUser: { subscription_status: 'trialing', trial_source: 'no_card', trial_ends_at: new Date(Date.now() + 86400000) }, expected: 204 },
  { plan: 'free', isHosted: true, billingUser: { subscription_status: 'trialing', trial_source: 'no_card', trial_ends_at: new Date(0) }, expected: 403 },
 ]) for (const layer of routes) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${layer.route.path.replace(':id', 'example')}`, { method: Object.keys(layer.route.methods)[0].toUpperCase() });
  assert.equal(response.status, state.expected, layer.route.path);
 }
});

function checkoutFixture() {
 let attempt;
 const remote = new Map();
 const keys = [];
 const userModel = {
  findOneAndUpdate(filter, pipeline) { attempt ||= pipeline[0].$set.stripe_checkout_attempt.$ifNull[1].$literal; return { select() { return this; }, lean: async () => ({ stripe_checkout_attempt: attempt }) }; },
  async updateOne(filter, update) { if (attempt?.key !== filter['stripe_checkout_attempt.key']) return; if (update.$unset) attempt = null; else attempt.session_id = update.$set['stripe_checkout_attempt.session_id']; },
 };
 const stripe = { subscriptions: { list: async () => ({ data: [], has_more: false }) }, checkout: { sessions: {
  list: async () => ({ data: [...remote.values()].filter(x => x.status === 'open'), has_more: false }),
  retrieve: async id => [...remote.values()].find(x => x.id === id),
  async create(params, options) { keys.push(options.idempotencyKey); if (!remote.has(options.idempotencyKey)) remote.set(options.idempotencyKey, { id: 'cs_one', mode: 'subscription', status: 'open', url: 'https://checkout.test/one' }); return remote.get(options.idempotencyKey); },
 } } };
 return { stripe, userModel, remote, keys, get attempt() { return attempt; } };
}
test('sequential and concurrent checkout requests reserve one payable session', async () => {
 const old = config.stripe.proPriceId;
 config.stripe.proPriceId = 'price_pro';
 try {
  const fixture = checkoutFixture();
  const user = { _id: 'owner', stripe_customer_id: 'cus_one' };
  const urls = await Promise.all(Array.from({ length: 12 }, () => createCheckoutSession(user, fixture)));
  assert.equal(new Set(urls).size, 1);
  assert.equal(fixture.remote.size, 1);
  assert.equal(new Set(fixture.keys).size, 1);
  assert.equal(await createCheckoutSession(user, fixture), urls[0]);
  const session = [...fixture.remote.values()][0];
  session.status = 'complete'; session.url = null;
  await assert.rejects(createCheckoutSession(user, fixture), /complete/);
  assert.equal(fixture.remote.size, 1);
 } finally { config.stripe.proPriceId = old; }
});
test('lost Stripe response retains the reservation and recovers the same session', async () => {
 const old = config.stripe.proPriceId;
 config.stripe.proPriceId = 'price_pro';
 try {
  const fixture = checkoutFixture();
  const create = fixture.stripe.checkout.sessions.create;
  fixture.stripe.checkout.sessions.create = async (...args) => { await create(...args); throw new Error('connection lost'); };
  const user = { _id: 'owner', stripe_customer_id: 'cus_one' };
  await assert.rejects(createCheckoutSession(user, fixture), /connection lost/);
  fixture.stripe.checkout.sessions.create = create;
  assert.equal(await createCheckoutSession(user, fixture), 'https://checkout.test/one');
  assert.equal(fixture.remote.size, 1);
  fixture.remote.set('competing', { mode: 'subscription', status: 'open', url: 'other' });
  await assert.rejects(createCheckoutSession(user, fixture), /Multiple open/);
 } finally { config.stripe.proPriceId = old; }
});
for (const confirmed of [true, false]) test(`reminder retry with confirmed nondelivery=${confirmed}`, async () => {
 const now = new Date();
 const user = { _id: 'trial', trial_ends_at: new Date(now.getTime() + 3.5 * 86400000) };
 let claim = null;
 let calls = 0;
 const userModel = {
  find: async filter => filter.trial_reminder_3d_sent_at === null && !claim ? [user] : [],
  updateOne: async (filter, update) => {
   if (update.$unset) { assert.equal(filter.trial_reminder_3d_sent_at, claim); claim = null; return { matchedCount: 1 }; }
   if (claim) return { matchedCount: 0 };
   claim = update.$set.trial_reminder_3d_sent_at; return { matchedCount: 1 };
  },
 };
 const options = { now, userModel, send3DayEmail: async () => { if (++calls === 1) throw Object.assign(new Error('mail failure'), confirmed ? { responseCode: 451 } : { command: 'DATA' }); return { accepted: ['user@example.com'] }; } };
 await runTrialLifecycle(options);
 await Promise.all(Array.from({ length: 8 }, () => runTrialLifecycle(options)));
 assert.equal(calls, confirmed ? 2 : 1);
});

test('hosted team quota rejects before creating a user, and both inserts share the transaction', async () => {
 const { User } = await import('../model/user.js');
 const { TenantMember } = await import('../model/tenant_member.js');
 const { TeamInvite } = await import('../model/team_invite.js');
 const { AuditLog } = await import('../model/audit_log.js');
 const { default: mongoose } = await import('../model/mongoose.js');
 const { createTeamMember } = await import('../services/team_service.js');
 const session = {};
 let limit = 1;
 let created = 0;
 mock.method(mongoose.connection, 'transaction', async callback => callback(session));
 mock.method(Tenant, 'findOne', async () => ({ _id: 'tenant', name: 'Team' }));
 mock.method(Tenant, 'findOneAndUpdate', (_filter, _update, options) => {
  assert.equal(options.session, session);
  return { lean: async () => ({ owner: 'owner', limit_users: limit }) };
 });
 mock.method(User, 'findOne', () => ({ lean: async () => null }));
 mock.method(TenantMember, 'countDocuments', () => ({ session(value) { assert.equal(value, session); return this; }, read: async () => 0 }));
 mock.method(User, 'create', async ([data], options) => { assert.equal(options.session, session); created++; return [{ ...data, _id: 'new' }]; });
 mock.method(User, 'updateOne', async (_filter, _update, options) => { assert.equal(options.session, session); return { matchedCount: 1 }; });
 mock.method(TenantMember, 'create', async ([data], options) => { assert.equal(options.session, session); return [{ ...data, _id: 'membership' }]; });
 mock.method(TeamInvite, 'deleteMany', async () => ({}));
 mock.method(AuditLog, 'create', async () => ({}));
 const data = { email: 'new@example.test', name: 'New', password: 'password123' };
 await assert.rejects(createTeamMember('owner', 'host', data, {}, { isHosted: true }), { code: 'ACCOUNT_LIMIT' });
 assert.equal(created, 0);
 limit = 2;
 assert.equal((await createTeamMember('owner', 'host', data, {}, { isHosted: true })).user._id, 'new');
 assert.equal(created, 1);
});

test('checkout adopts a preexisting open session and fences completion and expiry', async () => {
 const old = config.stripe.proPriceId;
 config.stripe.proPriceId = 'price_pro';
 try {
  const fixture = checkoutFixture();
  const user = { _id: 'owner', stripe_customer_id: 'cus_one' };
  const existing = { id: 'cs_legacy', mode: 'subscription', status: 'open', url: 'https://checkout.test/legacy' };
  fixture.remote.set('legacy', existing);
  assert.equal(await createCheckoutSession(user, fixture), existing.url);
  assert.equal(fixture.keys.length, 0);
  existing.status = 'complete';
  await assert.rejects(createCheckoutSession(user, fixture), /already complete/);
  existing.status = 'expired';
  await assert.rejects(createCheckoutSession(user, fixture), /expired/);
  assert.equal(await createCheckoutSession(user, fixture), 'https://checkout.test/one');
  assert.equal(fixture.keys.length, 1);
  [...fixture.remote.values()].find(x => x.id === 'cs_one').status = 'expired';
  fixture.attempt.params.expires_at = 0;
  await assert.rejects(createCheckoutSession(user, fixture), /expired/);
  assert.equal(fixture.attempt, null);
 } finally { config.stripe.proPriceId = old; }
});

test('created checkout ID is persisted and expired sessions are retrieved rather than replayed', async () => {
 const old = config.stripe.proPriceId;
 config.stripe.proPriceId = 'price_pro';
 try {
  const fixture = checkoutFixture();
  const create = fixture.stripe.checkout.sessions.create;
  fixture.stripe.checkout.sessions.create = async (...args) => structuredClone(await create(...args));
  const user = { _id: 'owner', stripe_customer_id: 'cus_one' };
  await createCheckoutSession(user, fixture);
  assert.equal(fixture.attempt.session_id, 'cs_one');
  [...fixture.remote.values()][0].status = 'expired';
  await assert.rejects(createCheckoutSession(user, fixture), /expired/);
  assert.equal(fixture.keys.length, 1);
  assert.equal(fixture.attempt, null);
 } finally { config.stripe.proPriceId = old; }
});

for (const status of ['canceled', 'incomplete_expired']) test(`completed checkout with ${status} subscription permits one concurrent replacement`, async () => {
 const old = config.stripe.proPriceId;
 config.stripe.proPriceId = 'price_pro';
 try {
  const fixture = checkoutFixture();
  const user = { _id: 'owner', stripe_customer_id: 'cus_one', subscription_status: status };
  await createCheckoutSession(user, fixture);
  const previous = fixture.attempt.key;
  const session = [...fixture.remote.values()][0];
  Object.assign(session, { status: 'complete', subscription: 'sub_old', url: null });
  let arrived = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  fixture.stripe.subscriptions.retrieve = async id => {
   assert.equal(id, 'sub_old');
   if (++arrived === 8) release();
   await barrier;
   return { id, status };
  };
  const create = fixture.stripe.checkout.sessions.create;
  fixture.stripe.checkout.sessions.create = async (...args) => {
   const result = await create(...args);
   result.id = 'cs_replacement';
   return result;
  };
  const urls = await Promise.all(Array.from({ length: 8 }, () => createCheckoutSession(user, fixture)));
  assert.equal(new Set(urls).size, 1);
  assert.equal(fixture.remote.size, 2);
  assert.notEqual(fixture.attempt.key, previous);
  assert.equal(new Set(fixture.keys.slice(1)).size, 1);
  assert.equal(fixture.attempt.session_id, 'cs_replacement');
 } finally { config.stripe.proPriceId = old; }
});

for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'unknown', 'lookup-failed']) test(`completed checkout preserves reservation when subscription is ${status}`, async () => {
 const old = config.stripe.proPriceId;
 config.stripe.proPriceId = 'price_pro';
 try {
  const fixture = checkoutFixture();
  const user = { _id: 'owner', stripe_customer_id: 'cus_one' };
  await createCheckoutSession(user, fixture);
  const key = fixture.attempt.key;
  Object.assign([...fixture.remote.values()][0], { status: 'complete', subscription: { id: 'sub_old' } });
  fixture.stripe.subscriptions.retrieve = async id => {
   assert.equal(id, 'sub_old');
   if (status === 'lookup-failed') throw new Error('Stripe unavailable');
   return { id, status };
  };
  await assert.rejects(createCheckoutSession(user, fixture), /complete|Stripe unavailable/);
  assert.equal(fixture.attempt.key, key);
  assert.equal(fixture.remote.size, 1);
 } finally { config.stripe.proPriceId = old; }
});

test('late terminal confirmation cannot clear a replacement reservation or bypass a new active subscription', async () => {
 const old = config.stripe.proPriceId;
 config.stripe.proPriceId = 'price_pro';
 try {
  const fixture = checkoutFixture();
  const user = { _id: 'owner', stripe_customer_id: 'cus_one' };
  await createCheckoutSession(user, fixture);
  Object.assign([...fixture.remote.values()][0], { status: 'complete', subscription: 'sub_old', url: null });
  let releaseLate;
  let bothArrived;
  let arrivals = 0;
  const late = new Promise(resolve => { releaseLate = resolve; });
  const barrier = new Promise(resolve => { bothArrived = resolve; });
  fixture.stripe.subscriptions.retrieve = async () => {
   const position = ++arrivals;
   if (position === 2) bothArrived();
   await barrier;
   if (position === 2) await late;
   return { status: 'canceled' };
  };
  const create = fixture.stripe.checkout.sessions.create;
  fixture.stripe.checkout.sessions.create = async (...args) => {
   const result = await create(...args);
   result.id = 'cs_replacement';
   return result;
  };
  const first = createCheckoutSession(user, fixture);
  const second = createCheckoutSession(user, fixture);
  assert.equal(await first, 'https://checkout.test/one');
  const replacementKey = fixture.attempt.key;
  fixture.stripe.subscriptions.list = async () => ({ data: [{ id: 'sub_new', status: 'active' }], has_more: false });
  releaseLate();
  await assert.rejects(second, /existing subscription/);
  assert.equal(fixture.attempt.key, replacementKey);
  assert.equal(fixture.remote.size, 2);
 } finally { config.stripe.proPriceId = old; }
});
