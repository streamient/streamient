import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import Redis from 'ioredis';
import config from '../config.js';
import { buildRedisConnectionOptions, isTransientRedisError } from './redis_options.js';
import * as OtelRuntime from './otel_runtime.js';
import { createLogger } from './logger.js';

const log = createLogger('socket');

let io;
let bridgePublisher;
let bridgeSubscriber;
let emailCountsHandler;

const TENANT_EVENT_BRIDGE_CHANNEL = 'tenant-events';

function createRedisClient() {
	const connection = buildRedisConnectionOptions(config.redisOptions, { lazyConnect: true });
	return connection.url
		? new Redis(connection.url, connection.options)
		: new Redis(connection.options);
}

function attachRedisErrorHandler(redisClient, label) {
	redisClient.on('error', (err) => {
		if (err && !err.handled) {
			err.handled = true;
		}
		const msg = err?.message || '';
		if (isTransientRedisError(msg)) return;
		log.warn({ msg }, label);
	});
}

function emitToTenantRoom(host_id, event, data) {
	if (!io) return;
	const delay = config.socketEmitDelay;
	if (delay > 0) {
		setTimeout(() => io.to(`tenant:${host_id}`).emit(event, data), delay);
	} else {
		io.to(`tenant:${host_id}`).emit(event, data);
	}
}

function subscribedTenantId(socket) {
	for (const room of socket.rooms || []) {
		const match = String(room || '').match(/^tenant:(.+)$/);
		if (match) return match[1];
	}
	return '';
}

function emitEmailCounts(host_id, options = {}) {
	if (!host_id || !emailCountsHandler) return;
	emailCountsHandler(host_id, options)
		.then((payload) => {
			if (!payload) return;
			emitToTenantRoom(host_id, 'email-counts:updated', payload);
		})
		.catch((err) => {
			log.warn({ err, host_id }, 'Socket.IO email counts refresh failed');
		});
}

async function ensureBridgePublisher() {
	if (!config.socketRedis) return null;
	if (bridgePublisher) return bridgePublisher;

	bridgePublisher = createRedisClient();
	attachRedisErrorHandler(bridgePublisher, 'Socket.IO bridge publisher error');
	await bridgePublisher.connect();
	return bridgePublisher;
}

async function setupTenantEventBridge() {
	if (!config.socketRedis || bridgeSubscriber) return;

	bridgeSubscriber = createRedisClient();
	attachRedisErrorHandler(bridgeSubscriber, 'Socket.IO bridge subscriber error');
	bridgeSubscriber.on('message', (channel, message) => {
		if (channel !== TENANT_EVENT_BRIDGE_CHANNEL) return;
		try {
			const payload = JSON.parse(message);
			if (!payload?.host_id || !payload?.event) return;
			emitToTenantRoom(payload.host_id, payload.event, payload.data);
			if (payload.event === 'counts:refresh') emitEmailCounts(payload.host_id, payload.data || {});
		} catch (err) {
			log.warn({ err }, 'Socket.IO bridge payload error');
		}
	});
	await bridgeSubscriber.connect();
	await bridgeSubscriber.subscribe(TENANT_EVENT_BRIDGE_CHANNEL);
	log.info('Socket.IO tenant event bridge connected');
}

function publishTenantEvent(host_id, event, data) {
	ensureBridgePublisher()
		.then((publisher) => {
			if (!publisher) return;
			return publisher.publish(TENANT_EVENT_BRIDGE_CHANNEL, JSON.stringify({ host_id, event, data }));
		})
		.catch((err) => {
			log.warn({ err }, 'Socket.IO bridge publish failed');
		});
}

export function getIO() {
	return io;
}

export async function setupSocketIO(httpServer, sessionMiddleware, handlers = {}) {
	return OtelRuntime.createCustomSpan('socketio.setup', async (span) => {
		emailCountsHandler = handlers.emailCountsHandler || emailCountsHandler;
		span.setAttribute('server.mode', process.env.SERVER_MODE || 'app');
		span.setAttribute('service.app', process.env.KUMBUKUM_APP || 'web');
		span.setAttribute('socket.redis.enabled', !!config.socketRedis);

		io = new Server(httpServer, {
			cookie: false,
			transports: ['websocket'],
			pingInterval: 55000,
			pingTimeout: 60000,
			cleanupEmptyChildNamespaces: true,
			cors: { origin: '*', credentials: true },
			connectionStateRecovery: {
				// the backup duration of the sessions and the packets
				maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
				// whether to skip middlewares upon successful recovery
				skipMiddlewares: true,
			},
			tls: { rejectUnauthorized: false },
			perMessageDeflate: { threshold: 32768 },
		});

		// Redis streams adapter for horizontal scaling (multi-server only)
		if (config.socketRedis) {
			let redisClient;
			try {
				redisClient = createRedisClient();
				attachRedisErrorHandler(redisClient, 'Socket.IO Redis client error');
				await redisClient.connect();
				io.adapter(createAdapter(redisClient, { streamCount: 4, blockTimeInMs: 10_000, heartbeatInterval: 30000, heartbeatTimeout: 90000 }));
				log.info('Socket.IO Redis streams adapter connected');
			} catch (err) {
				span.recordException(err);
				log.warn({ err }, 'Socket.IO Redis adapter failed, using in-memory');
				if (redisClient) redisClient.disconnect();
			}
		}

		await setupTenantEventBridge();

		io.on('connection', (socket) => {
			OtelRuntime.createCustomSpan('socketio.connection', (connectionSpan) => {
				connectionSpan.setAttribute('socket.id', socket.id);
				connectionSpan.setAttribute('server.mode', process.env.SERVER_MODE || 'app');
				connectionSpan.setAttribute('service.app', process.env.KUMBUKUM_APP || 'web');
			});
			log.info({ socketId: socket.id, app: process.env.KUMBUKUM_APP || 'web' }, 'Socket.IO client connected');

			// Client subscribes to a tenant room
			socket.on('subscribe', (room) => {
				if (!room) return;
				OtelRuntime.createCustomSpan('socketio.subscribe', (subscribeSpan) => {
					subscribeSpan.setAttribute('socket.id', socket.id);
					subscribeSpan.setAttribute('socket.room', room);
					socket.join(room);
				});
			});

			socket.on('email-counts:request', (payload = {}) => {
				const host_id = subscribedTenantId(socket);
				if (!host_id || !emailCountsHandler) return;
				emailCountsHandler(host_id, { project: payload?.project || '' })
					.then((counts) => {
						if (counts) socket.emit('email-counts:updated', counts);
					})
					.catch((err) => {
						log.warn({ err, host_id }, 'Socket.IO email counts request failed');
					});
			});

			socket.on('disconnect', () => {
				OtelRuntime.createCustomSpan('socketio.disconnect', (disconnectSpan) => {
					disconnectSpan.setAttribute('socket.id', socket.id);
					disconnectSpan.setAttribute('server.mode', process.env.SERVER_MODE || 'app');
				});
				log.info({ socketId: socket.id, app: process.env.KUMBUKUM_APP || 'web' }, 'Socket.IO client disconnected');
			});
		});

		log.info({ mode: process.env.SERVER_MODE || 'app', app: process.env.KUMBUKUM_APP || 'web', otel: OtelRuntime.isEnabled() ? 'enabled' : 'disabled' }, 'Socket.IO initialized');
		return io;
	});
}

/**
 * Emit a CRUD event to a tenant room.
 * Delay (ms) is configurable via SOCKET_EMIT_DELAY to account for
 * replication lag in clustered setups (MongoDB ReplicaSet, Typesense
 * Cluster, Redis Sentinel). Default 500 ms; set to 0 for instant emit.
 */
export function emitToTenant(host_id, event, data) {
	if (io) {
		emitToTenantRoom(host_id, event, data);
		if (event === 'counts:refresh') emitEmailCounts(host_id, data || {});
		return;
	}

	publishTenantEvent(host_id, event, data);
}
