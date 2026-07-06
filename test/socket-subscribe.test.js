import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthorizedSubscribeRoom } from '../modules/socket.js';

describe('socket room subscriptions', () => {
	it('allows tenant rooms for the resolved socket identity', () => {
		const identity = { userId: 'user-1', hostId: 'host-1' };

		assert.equal(
			resolveAuthorizedSubscribeRoom(identity, 'tenant:host-1', 'user-1', 'host-1'),
			'tenant:host-1',
		);
	});

	it('rejects mismatched subscribe payloads and cross-tenant rooms', () => {
		const identity = { userId: 'user-1', hostId: 'host-1' };

		assert.equal(resolveAuthorizedSubscribeRoom(identity, 'tenant:host-1', 'user-2', 'host-1'), '');
		assert.equal(resolveAuthorizedSubscribeRoom(identity, 'tenant:host-1', 'user-1', 'host-2'), '');
		assert.equal(resolveAuthorizedSubscribeRoom(identity, 'tenant:host-2', 'user-1', 'host-1'), '');
		assert.equal(resolveAuthorizedSubscribeRoom(identity, 'tenant:host-2:site:site-1', 'user-1', 'host-1'), '');
	});

	it('rejects arbitrary rooms and missing subscribe identity payloads', () => {
		const identity = { userId: 'user-1', hostId: 'host-1' };

		assert.equal(resolveAuthorizedSubscribeRoom(identity, 'admin:host-1', 'user-1', 'host-1'), '');
		assert.equal(resolveAuthorizedSubscribeRoom(identity, 'tenant:host-1'), '');
		assert.equal(resolveAuthorizedSubscribeRoom({}, 'tenant:host-1', 'user-1', 'host-1'), '');
	});
});
