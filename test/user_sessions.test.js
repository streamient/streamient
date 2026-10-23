import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from '../model/mongoose.js';
import { describeUserAgent, isSessionRevoked, listUserSessions, publicSessionId, revokeOtherUserSessions, revokeUserSession } from '../services/user_session_service.js';

const me = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

function withSessions(rows, fn) {
	const store = rows.map((row) => ({ ...row, session: JSON.stringify(row.session) }));
	const markers = new Map();
	const sessions = {
		find: (query) => ({ toArray: async () => store.filter((row) => new RegExp(query.session.$regex).test(row.session)) }),
		deleteMany: async ({ _id }) => { for (const id of _id.$in) store.splice(store.findIndex((row) => row._id === id), 1); },
	};
	const revoked = {
		createIndex: async () => {},
		findOne: async ({ _id }) => markers.has(_id) ? { _id } : null,
		bulkWrite: async (ops) => { for (const { updateOne } of ops) markers.set(updateOne.filter._id, updateOne.update.$set); },
	};
	const original = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
	Object.defineProperty(mongoose.connection, 'db', { configurable: true, value: { collection: (name) => name === 'revoked_sessions' ? revoked : sessions } });
	return fn(store, markers).finally(() => original ? Object.defineProperty(mongoose.connection, 'db', original) : delete mongoose.connection.db);
}

const rows = () => [
	{ _id: 'current', lastModified: new Date('2026-10-23T10:00:00Z'), session: { userId: me, userAgent: chrome, ip: '1.2.3.4', lastLoginRecordedAt: '2026-10-20T10:00:00Z' } },
	{ _id: 'phone', lastModified: new Date('2026-10-22T10:00:00Z'), session: { userId: me, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1' } },
	{ _id: 'admin', session: { userId: me, impersonating: true } },
	{ _id: 'theirs', session: { userId: other } },
];

describe('login sessions', () => {
	it('labels common browsers without exposing raw session IDs', () => {
		assert.equal(describeUserAgent(chrome), 'Chrome on Windows');
		assert.equal(describeUserAgent(rows()[1].session.userAgent), 'Safari on iOS');
		assert.equal(describeUserAgent(''), 'Unknown device');
		assert.match(publicSessionId('current'), /^[a-f0-9]{32}$/);
	});
	it('lists only the user’s own non-impersonation sessions, current first', () => withSessions(rows(), async () => {
		const list = await listUserSessions(me, 'current');
		assert.deepEqual(list.map((s) => s.id), [publicSessionId('current'), publicSessionId('phone')]);
		assert.equal(list[0].current, true);
		assert.equal(list[0].device, 'Chrome on Windows');
		assert.deepEqual(await listUserSessions('not-an-id', 'current'), []);
	}));
	it('revokes one own session but never the current, another user’s or an impersonation session', () => withSessions(rows(), async (store) => {
		for (const sid of ['current', 'theirs', 'admin']) assert.deepEqual(await revokeUserSession(me, publicSessionId(sid), 'current'), []);
		assert.deepEqual(await revokeUserSession(me, publicSessionId('phone'), 'current'), ['phone']);
		assert.deepEqual(store.map((row) => row._id), ['current', 'admin', 'theirs']);
	}));
	it('signs out all other own sessions, keeps the current one and marks revoked sessions so a late save cannot revive them', () => withSessions(rows(), async (store) => {
		assert.deepEqual(await revokeOtherUserSessions(me, 'current'), ['phone']);
		assert.deepEqual(store.map((row) => row._id), ['current', 'admin', 'theirs']);
		assert.equal(await isSessionRevoked(publicSessionId('phone')), true);
		assert.equal(await isSessionRevoked(publicSessionId('current')), false);
		assert.equal(await isSessionRevoked(''), false);
	}));
});
