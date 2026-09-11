import { assertTenantAvailable, acquireTenantWork } from './tenancy.js';
import { Server } from 'socket.io';
import { createAdapter as createMongoAdapter } from '@socket.io/mongo-adapter';
import { Emitter as MongoEmitter } from '@socket.io/mongo-emitter';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import mongoose from '../db.js';
import { resolveActiveTenantContext } from './tenancy.js';
import * as OtelRuntime from './otel_runtime.js';
import { createLogger } from './logger.js';

const log = createLogger('socket');

let io;
let socketMongoClient;
let socketMongoCollection;
let socketMongoCollectionPromise;
let socketMongoEmitter;
let emailCountsHandler;

const SOCKET_ALLOWED_AUDIENCES = new Set(['streamient-api', 'kumbukum-api', 'streamient-socket']);
const SOCKET_MONGO_COLLECTION = 'socketio';
const SOCKET_MONGO_TTL_SECONDS = 3600;

function usesMongoSocketTransport() {
	return config.socketIO?.adapter === 'mongodb';
}

async function getSocketMongoClient(socketConfig) {
	if (socketConfig.mongoUrl === config.mongoUri) return mongoose.connection.getClient();
	if (socketMongoClient) return socketMongoClient;
	socketMongoClient = new MongoClient(socketConfig.mongoUrl);
	try {
		await socketMongoClient.connect();
	} catch (err) {
		socketMongoClient = null;
		throw err;
	}
	return socketMongoClient;
}

async function getSocketMongoCollection() {
	if (socketMongoCollection) return socketMongoCollection;
	if (socketMongoCollectionPromise) return socketMongoCollectionPromise;
	socketMongoCollectionPromise = (async () => {
		const socketConfig = config.socketIO || {};
		const mongoClient = await getSocketMongoClient(socketConfig);
		const collection = mongoClient.db().collection(SOCKET_MONGO_COLLECTION);
		await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: SOCKET_MONGO_TTL_SECONDS, background: true });
		socketMongoCollection = collection;
		return collection;
	})().catch((err) => {
		socketMongoCollectionPromise = null;
		throw err;
	});
	return socketMongoCollectionPromise;
}

async function ensureMongoEmitter() {
	if (socketMongoEmitter) return socketMongoEmitter;
	socketMongoEmitter = new MongoEmitter(await getSocketMongoCollection(), '/', { addCreatedAtField: true });
	return socketMongoEmitter;
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

function publishTenantEvent(host_id, event, data) {
	if (!usesMongoSocketTransport()) return;
	ensureMongoEmitter()
		.then((emitter) => emitter.to(`tenant:${host_id}`).emit(event, data))
		.catch((err) => {
			log.warn({ err }, 'Socket.IO MongoDB emitter failed');
		});
}

export function getIO() {
	return io;
}

export async function disconnectTenantSockets(hostId) {
	if (io) return io.in(`account:${hostId}`).in(`tenant:${hostId}`).disconnectSockets(true);
	if (usesMongoSocketTransport()) (await ensureMongoEmitter()).in(`account:${hostId}`).in(`tenant:${hostId}`).disconnectSockets(true);
}

export async function deleteTenantSocketPackets(hostId) {
	if (!usesMongoSocketTransport()) return;
	const collection = await getSocketMongoCollection();
	// Keep transport control messages long enough for every replica to observe
	// the disconnect. Remove buffered customer payloads and recovery sessions.
	await collection.deleteMany({ $or: [{ 'data.opts.rooms': `tenant:${hostId}`, 'data.packet': { $exists: true } }, { 'data.rooms': `tenant:${hostId}`, 'data.sid': { $exists: true } }] });
}

export async function setupSocketIO(httpServer, sessionMiddleware, handlers = {}) {
	return OtelRuntime.createCustomSpan('socketio.setup', async (span) => {
		emailCountsHandler = handlers.emailCountsHandler || emailCountsHandler;
		span.setAttribute('server.mode', process.env.SERVER_MODE || 'app');
		span.setAttribute('service.app', process.env.STREAMIENT_APP || 'web');
		span.setAttribute('socket.adapter', config.socketIO.adapter);
		span.setAttribute('socket.mongodb.enabled', usesMongoSocketTransport());

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
				skipMiddlewares: false,
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
				const identity = getSocketIdentity(socket);
			if (identity.hostId) { await assertTenantAvailable(identity.hostId); socket.join(`account:${identity.hostId}`); }
			next();
			} catch (err) {
				next(new Error(err.message || 'Socket authentication failed'));
			}
		});

		if (usesMongoSocketTransport()) {
			const mongoCollection = await getSocketMongoCollection();
			io.adapter(createMongoAdapter(mongoCollection, { addCreatedAtField: true }));
			log.info({ collection: SOCKET_MONGO_COLLECTION }, 'Socket.IO MongoDB adapter connected');
		}

		io.on('connection', (socket) => {
			OtelRuntime.createCustomSpan('socketio.connection', (connectionSpan) => {
				connectionSpan.setAttribute('socket.id', socket.id);
				connectionSpan.setAttribute('server.mode', process.env.SERVER_MODE || 'app');
				connectionSpan.setAttribute('service.app', process.env.STREAMIENT_APP || 'web');
			});
			log.info({ socketId: socket.id, app: process.env.STREAMIENT_APP || 'web' }, 'Socket.IO client connected');

			socket.on('subscribe', async (room, userId, hostId, app = '') => {
				const authorizedRoom = resolveAuthorizedSubscribeRoom(getSocketIdentity(socket), room, userId, hostId);
			try { await assertTenantAvailable(hostId); } catch { socket.disconnect(true); return; }
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
 * replication lag in clustered setups (MongoDB replica set or Typesense
 * cluster). Default 0 ms; set a positive delay only when needed.
 */
export function emitToTenant(host_id, event, data) {
	if (io) {
		emitToTenantRoom(host_id, event, data);
		if (event === 'counts:refresh') emitEmailCounts(host_id, data || {});
		return;
	}

	publishTenantEvent(host_id, event, data);
}
