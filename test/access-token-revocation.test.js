import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../model/user.js';

// A stale secondary may still contain a deleted token; it must never authorize the request.
test('token authentication uses the atomic token match instead of a stale user read', async (t) => {
	t.mock.method(User, 'findOne', () => { throw new Error('replica token lookup must not run'); });
	t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => {
		assert.deepEqual(filter, { 'access_tokens.token': 'revoked', is_active: true });
		assert.deepEqual(update, { $set: { is_active: true } });
		assert.equal(options.timestamps, false);
		assert.equal(options.returnDocument, 'after');
		return { select() { return this; }, lean: async () => null };
	});
	let status;
	let message;
	const res = { status(value) { status = value; return this; }, json(value) { message = value; } };
	await requireAuth({ method: 'GET', headers: { authorization: 'Token revoked' }, accepts: () => false }, res, () => assert.fail('revoked token accepted'));
	assert.equal(status, 401);
	assert.equal(message.error, 'Authentication required');
});
