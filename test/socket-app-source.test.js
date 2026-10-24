import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Socket.IO app source', () => {
	it('renders and sends a verified socket token with tenant subscribe payload', () => {
		const authJs = fs.readFileSync(new URL('../middleware/auth.js', import.meta.url), 'utf8');
		const webJs = fs.readFileSync(new URL('../routes/web.js', import.meta.url), 'utf8');
		const layoutPug = fs.readFileSync(new URL('../views/layout.pug', import.meta.url), 'utf8');
		const appJs = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');

		assert.ok(authJs.includes("audience: 'streamient-socket'"));
		assert.ok(webJs.includes('generateSocketToken(req.userId, req.host_id, req.tenantId, req.sessionID)'));
		assert.ok(layoutPug.includes('var __user_id = "#{user_id}";'));
		assert.ok(layoutPug.includes('var __socket_token = "#{socket_token}";'));
		assert.ok(appJs.includes("'auth': { 'token': __socket_token }"));
		assert.ok(appJs.includes("socket.emit('subscribe', `tenant:${__host_id}`, __user_id, __host_id, 'web');"));
	});

	it('uses verified socket identity for room joins and email counts', () => {
		const socketJs = fs.readFileSync(new URL('../modules/socket.js', import.meta.url), 'utf8');

		assert.ok(socketJs.includes('io.engine.use(sessionMiddleware);'));
		assert.ok(socketJs.includes("throw new Error('Socket authentication required')"));
		assert.ok(socketJs.includes('resolveAuthorizedSubscribeRoom(getSocketIdentity(socket), room, userId, hostId)'));
		assert.ok(socketJs.includes('const { hostId } = getSocketIdentity(socket);'));
		assert.ok(!socketJs.includes('subscribedTenantId'));
		assert.ok(!socketJs.includes('socket.join(room);'));
	});

	it('keeps local emits immediate and uses MongoDB for out-of-process delivery', () => {
		const configJs = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
		const socketJs = fs.readFileSync(new URL('../modules/socket.js', import.meta.url), 'utf8');

		assert.ok(configJs.includes("socketEmitDelay: parseNonNegativeNumberEnv('SOCKET_EMIT_DELAY', 0)"));
		assert.ok(socketJs.includes('ensureMongoEmitter()'));
		assert.ok(socketJs.includes("emitter.to(`tenant:${host_id}`).emit(event, data)"));
		assert.doesNotMatch(socketJs, /redis/i);
	});
});
