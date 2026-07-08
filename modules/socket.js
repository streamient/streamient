import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { buildRedisConnectionOptions, isTransientRedisError } from './redis_options.js';
import { resolveActiveTenantContext } from './tenancy.js';
import * as OtelRuntime from './otel_runtime.js';
import { createLogger } from './logger.js';

const log = createLogger('socket');

let io;
let bridgePublisher;
let bridgeSubscriber;
let emailCountsHandler;
let lastRedisReconnectLogAt = 0;

const TENANT_EVENT_BRIDGE_CHANNEL = 'tenant-events';
const REDIS_RECONNECT_LOG_INTERVAL_MS = 10000;
const SOCKET_ALLOWED_AUDIENCES = new Set(['streamient-api', 'kumbukum-api', 'streamient-socket']);

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
		log.warn({ msg, label }, 'Socket.IO Redis client error');
	});

	redisClient.on('ready', () => {
		log.info({ label }, 'Socket.IO Redis client connected and ready');
	});

	redisClient.on('reconnecting', (delayMs) => {
		const now = Date.now();
		if (now - lastRedisReconnectLogAt < REDIS_RECONNECT_LOG_INTERVAL_MS) return;
		lastRedisReconnectLogAt = now;
		log.warn({ label, delay_ms: delayMs }, 'Socket.IO Redis client reconnecting');
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

function socketBearerToken(socket) {
	const authToken = socket.handshake?.auth?.token;
	if (authToken) return String(authToken).replace(/^Bearer\s+/i, '').trim();
	const header = socket.handshake?.headers?.authorization || socket.request?.headers?.authorization || '';
	return String(header).startsWith('Bearer ') ? String(header).slice(7).trim() : '';
}

async function authenticateSocketBearer(socket) {
	const token = socketBearerToken(socket);
	if (!token) throw new Error('Socket authentication required');
	const payload = jwt.verify(token, config.jwtSecret);
	if (payload.aud && !SOCKET_ALLOWED_AUDIENCES.has(payload.aud)) throw new Error('Invalid socket token audience');
	const userId = payload.userId || payload.sub;
	if (!userId) throw new Error('Invalid socket token subject');
	const context = await resolveActiveTenantContext(userId, payload.tenantId, payload.host_id);
	if (!context?.activeTenant) throw new Error('Socket token is not valid for any active account');
	socket.data.auth = {
		userId: String(userId),
		host_id: context.activeTenant.host_id,
		tenantId: context.activeTenant.tenantId,
		memberRole: context.activeTenant.role,
		method: 'bearer',
	};
	return socket.data.auth;
}

function getSocketIdentity(socket) {
	return {
		hostId: String(socket.request?.session?.host_id || socket.data.auth?.host_id || ''),
		userId: String(socket.request?.session?.userId || socket.data.auth?.userId || ''),
	};
}

export function resolveAuthorizedSubscribeRoom(identity, room, requestedUserId = '', requestedHostId = '') {
	const sessionHostId = String(identity?.hostId || '');
	const sessionUserId = String(identity?.userId || '');
	const targetRoom = String(room || '');
	const payloadUserId = String(requestedUserId || '');
	const payloadHostId = String(requestedHostId || '');

	if (!sessionHostId || !sessionUserId || !targetRoom || !payloadHostId || !payloadUserId) return '';
	if (payloadHostId !== sessionHostId) return '';
	if (payloadUserId !== sessionUserId) return '';
	if (targetRoom === `tenant:${sessionHostId}`) return targetRoom;
	return '';
}

async function ensureBridgePublisher() {
	if (!config.socketRedis) return null;
	if (bridgePublisher) return bridgePublisher;

	bridgePublisher = createRedisClient();
	attachRedisErrorHandler(bridgePublisher, 'Socket.IO bridge publisher');
	await bridgePublisher.connect();
	return bridgePublisher;
}

async function setupTenantEventBridge() {
	if (!config.socketRedis || bridgeSubscriber) return;

	bridgeSubscriber = createRedisClient();
	attachRedisErrorHandler(bridgeSubscriber, 'Socket.IO bridge subscriber');
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
		span.setAttribute('service.app', process.env.STREAMIENT_APP || 'web');
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

		if (sessionMiddleware) {
			io.engine.use(sessionMiddleware);
		}

		io.use(async (socket, next) => {
			try {
				if (!socket.request?.session?.userId || !socket.request?.session?.host_id) {
					await authenticateSocketBearer(socket);
				}
				next();
			} catch (err) {
				next(new Error(err.message || 'Socket authentication failed'));
			}
		});

		// Redis streams adapter for horizontal scaling (multi-server only)
		if (config.socketRedis) {
			let redisClient;
			try {
				redisClient = createRedisClient();
				attachRedisErrorHandler(redisClient, 'Socket.IO Redis client');
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
				connectionSpan.setAttribute('service.app', process.env.STREAMIENT_APP || 'web');
			});
			log.info({ socketId: socket.id, app: process.env.STREAMIENT_APP || 'web' }, 'Socket.IO client connected');

			socket.on('subscribe', (room, userId, hostId, app = '') => {
				const authorizedRoom = resolveAuthorizedSubscribeRoom(getSocketIdentity(socket), room, userId, hostId);
				if (!authorizedRoom) return;
				OtelRuntime.createCustomSpan('socketio.subscribe', (subscribeSpan) => {
					subscribeSpan.setAttribute('socket.id', socket.id);
					subscribeSpan.setAttribute('socket.room', authorizedRoom);
					subscribeSpan.setAttribute('socket.client_app', app);
					socket.join(authorizedRoom);
				});
			});

			socket.on('email-counts:request', (payload = {}) => {
				const { hostId } = getSocketIdentity(socket);
				if (!hostId || !emailCountsHandler) return;
				emailCountsHandler(hostId, { project: payload?.project || '' })
					.then((counts) => {
						if (counts) socket.emit('email-counts:updated', counts);
					})
					.catch((err) => {
						log.warn({ err, host_id: hostId }, 'Socket.IO email counts request failed');
					});
			});

			socket.on('disconnect', () => {
				OtelRuntime.createCustomSpan('socketio.disconnect', (disconnectSpan) => {
					disconnectSpan.setAttribute('socket.id', socket.id);
					disconnectSpan.setAttribute('server.mode', process.env.SERVER_MODE || 'app');
				});
				log.info({ socketId: socket.id, app: process.env.STREAMIENT_APP || 'web' }, 'Socket.IO client disconnected');
			});
		});

		log.info({ mode: process.env.SERVER_MODE || 'app', app: process.env.STREAMIENT_APP || 'web', otel: OtelRuntime.isEnabled() ? 'enabled' : 'disabled' }, 'Socket.IO initialized');
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
