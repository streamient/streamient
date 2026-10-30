import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import authRoutes from '../routes/auth.js';
import { User } from '../model/user.js';

const confirm = authRoutes.stack.find(layer => layer.route?.path === '/reset-password/confirm').route.stack.at(-1).handle;
const response = () => ({ render(_view, locals) { this.error = locals.error; }, redirect(url) { this.url = url; } });
const request = (newPassword = 'new-password') => ({ body: { token: 'reset-token' }, session: { pendingReset: { userId: 'owner', token: 'reset-token', newPassword } } });

test('concurrent confirmations consume the token once and store only the winning bcrypt password', async t => {
 const record = { _id: 'owner', password: 'old-hash', password_reset_token: 'reset-token', password_reset_expires: new Date(Date.now() + 60000) };
 let arrivals = 0;
 let release;
 const barrier = new Promise(resolve => { release = resolve; });
 t.mock.method(User, 'updateOne', async (filter, update) => {
  if (++arrivals === 2) release();
  await barrier;
  assert.equal(filter._id, record._id);
  assert.equal(filter.password_reset_token, 'reset-token');
  assert.ok(filter.password_reset_expires.$gt instanceof Date);
  if (record.password_reset_token !== filter.password_reset_token || !(record.password_reset_expires > filter.password_reset_expires.$gt)) return { matchedCount: 0 };
  Object.assign(record, update.$set);
  for (const field of Object.keys(update.$unset)) delete record[field];
  return { matchedCount: 1 };
 });
 const requests = [request('first-password'), request('second-password')];
 const responses = requests.map(response);
 await Promise.all(requests.map((req, i) => confirm(req, responses[i])));
 const winner = responses.findIndex(res => res.url);
 assert.equal(responses.filter(res => res.url === '/login?reset=true').length, 1);
 assert.equal(responses.filter(res => res.error === 'Reset link has expired.').length, 1);
 assert.equal(requests[winner].session.pendingReset, undefined);
 assert.equal(await bcrypt.compare(['first-password', 'second-password'][winner], record.password), true);
 assert.equal(await bcrypt.compare(['second-password', 'first-password'][winner], record.password), false);
 assert.equal(bcrypt.getRounds(record.password), 12);
 assert.equal(record.password_reset_token, undefined);
 assert.equal(record.password_reset_expires, undefined);
});

for (const state of ['expired', 'missing-expiry', 'used', 'wrong-user']) test(`reset rejects ${state} token without changing password`, async t => {
 const record = { _id: state === 'wrong-user' ? 'other' : 'owner', password: 'unchanged', password_reset_token: state === 'used' ? undefined : 'reset-token', password_reset_expires: state === 'missing-expiry' ? undefined : new Date(state === 'expired' ? 0 : Date.now() + 60000) };
 t.mock.method(User, 'updateOne', async (filter, update) => {
  const matches = record._id === filter._id && record.password_reset_token === filter.password_reset_token && record.password_reset_expires > filter.password_reset_expires.$gt;
  if (matches) Object.assign(record, update.$set);
  return { matchedCount: matches ? 1 : 0 };
 });
 const res = response();
 await confirm(request(), res);
 assert.equal(res.error, 'Reset link has expired.');
 assert.equal(record.password, 'unchanged');
});
