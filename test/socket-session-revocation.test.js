import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { it } from 'node:test';
import jwt from 'jsonwebtoken';
import { io as createClient } from 'socket.io-client';
import config from '../config.js';
import mongoose from '../model/mongoose.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { accountWork } from '../modules/tenancy.js';
import { setupSocketIO, disconnectSessionSockets, disconnectMemberSockets } from '../modules/socket.js';
import { publicSessionId } from '../services/user_session_service.js';

for (const auth of ['cookie', 'token']) {
	for (const outcome of ['revoked', 'active', 'lookup failure', 'removed member']) {
		it(`${auth} socket ${outcome}: checks again after a pending handshake and gates early events`, { timeout: 4000 }, async (t) => {
			const originalAdapter = config.socketIO.adapter;
			config.socketIO.adapter = 'memory';
			t.after(() => { config.socketIO.adapter = originalAdapter; });
			const originalDb = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
			let revoked = false;
			let removed = false;
			let failLookup = false;
			let lookup;
			Object.defineProperty(mongoose.connection, 'db', { configurable: true, value: { collection: () => ({ updateOne: async () => { if (lookup) await lookup.promise; if (failLookup) throw new Error('lookup unavailable'); return { matchedCount: Number(revoked) }; } }) } });
			t.after(() => originalDb ? Object.defineProperty(mongoose.connection, 'db', originalDb) : delete mongoose.connection.db);
			const query = (value) => ({ select() { return this; }, populate() { return this; }, read() { return this; }, lean: async () => value });
			t.mock.method(User, 'findOneAndUpdate', () => query({ is_active: true }));
			t.mock.method(TenantMember, 'findOneAndUpdate', () => query(removed ? null : { role: 'owner' }));
			t.mock.method(TenantMember, 'find', () => query([{ _id: 'membership', role: 'owner', tenant: { _id: 'tenant', host_id: 'host', name: 'Test' } }]));
			const entered = Promise.withResolvers();
			const resume = Promise.withResolvers();
			t.mock.method(accountWork, 'assertAvailable', async () => { entered.resolve(); await resume.promise; });
			const server = http.createServer();
			let countRequests = 0;
			const io = await setupSocketIO(server, auth === 'cookie' ? (req, _res, next) => { req.sessionID = 'browser'; req.session = { userId: 'user', host_id: 'host' }; next(); } : null, { emailCountsHandler: async () => { countRequests++; return { total: 1 }; } });
			t.after(() => new Promise(resolve => io.close(resolve)));
			assert.equal(io.opts.connectionStateRecovery, undefined);
			const restore = t.mock.method(io.of('/').adapter, 'restoreSession', async () => ({ sid: 'previous', pid: 'previous-private', rooms: ['tenant:host'], data: {}, missedPackets: [] }));
			await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
			const packetSeen = Promise.withResolvers();
			io.on('connection', (socket) => socket.onAny(() => packetSeen.resolve()));
			const token = jwt.sign({ userId: 'user', host_id: 'host', sid: publicSessionId('browser') }, config.jwtSecret, { audience: 'streamient-socket', expiresIn: 60 });
			const client = createClient(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], reconnection: false, auth: { pid: 'previous-private', offset: 'last-packet', ...(auth === 'token' ? { token } : {}) } });
			t.after(() => client.close());
			client.on('connect', () => { client.emit('subscribe', 'tenant:host', 'user', 'host'); client.emit('email-counts:request'); });
			await entered.promise;
			lookup = Promise.withResolvers();
			revoked = outcome === 'revoked';
			removed = outcome === 'removed member';
			failLookup = outcome === 'lookup failure';
			await disconnectSessionSockets([publicSessionId('browser')]);
			if (removed) await disconnectMemberSockets('host', 'user');
			const finished = once(client, outcome === 'active' ? 'email-counts:updated' : 'disconnect');
			resume.resolve();
			await packetSeen.promise;
			assert.equal(countRequests, 0);
			assert.equal(io.of('/').adapter.rooms.has('tenant:host'), false);
			lookup.resolve();
			await finished;
			assert.equal(restore.mock.callCount(), 0);
			if (outcome === 'active') {
				assert.equal(countRequests, 1);
				assert.equal(io.of('/').adapter.rooms.get('tenant:host')?.size, 1);
				const disconnected = once(client, 'disconnect');
				await disconnectMemberSockets('host', 'user');
				await disconnected;
			} else {
				assert.equal(countRequests, 0);
				assert.equal(io.of('/').adapter.rooms.has('tenant:host'), false);
			}
		});
	}
}
