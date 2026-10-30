import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../model/user.js';

// Neither hash nor legacy lookup may authorize a revoked token.
test('token authentication uses atomic matches for hash and legacy tokens', async (t) => {
	t.mock.method(User, 'findOne', () => { throw new Error('non-atomic token lookup must not run'); });
	t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => {
		assert.deepEqual(filter, filter['access_tokens.token_hash'] ? { 'access_tokens.token_hash': crypto.createHash('sha256').update('revoked').digest('hex'), is_active: true } : { 'access_tokens.token': 'revoked', is_active: true });
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
