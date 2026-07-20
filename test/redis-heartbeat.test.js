import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startRedisHeartbeat } from '../modules/redis_heartbeat.js';
import { attachSocketRedisClientHandlers } from '../modules/socket.js';

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

class FakeRedisClient extends EventEmitter {
	constructor() {
		super();
		this.status = 'ready';
		this.pingCount = 0;
	}

	async ping() {
		this.pingCount += 1;
		return 'PONG';
	}
}

describe('Redis heartbeat', () => {
	it('covers Socket.IO bridge clients', () => {
		const client = new FakeRedisClient();

		attachSocketRedisClientHandlers(client, 'Socket.IO bridge publisher');

		assert.ok(client._healthCheckInterval);
		client.emit('end');
		assert.equal(client._healthCheckInterval, null);
	});

	it('keeps ready clients active and stops after the client ends', async () => {
		const client = new FakeRedisClient();
		const timer = startRedisHeartbeat(client, 10);

		assert.equal(startRedisHeartbeat(client, 10), timer);
		await wait(35);
		assert.ok(client.pingCount >= 2);

		client.status = 'reconnecting';
		const reconnectingCount = client.pingCount;
		await wait(25);
		assert.equal(client.pingCount, reconnectingCount);

		client.emit('end');
		assert.equal(client._healthCheckInterval, null);
		const endedCount = client.pingCount;
		client.status = 'ready';
		await wait(25);
		assert.equal(client.pingCount, endedCount);
	});
});
