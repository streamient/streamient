import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import express from 'express';
import { MemoryStore } from 'express-rate-limit';

import * as ApiRateLimit from '../middleware/rate_limit.js';
import * as McpRateLimit from '../modules/mcp_rate_limit.js';

const ENV_KEYS = [
	'API_RATE_LIMIT_ENABLED',
	'API_RATE_LIMIT_WINDOW_MS',
	'API_RATE_LIMIT_GENERAL_PER_MINUTE',
	'API_RATE_LIMIT_OBSIDIAN_PER_MINUTE',
	'API_RATE_LIMIT_RAZUNA_FILES_PER_MINUTE',
	'API_RATE_LIMIT_EXPENSIVE_PER_MINUTE',
	'API_RATE_LIMIT_UPLOAD_PER_MINUTE',
	'MCP_RATE_LIMIT_ENABLED',
	'MCP_RATE_LIMIT_WINDOW_MS',
	'MCP_IP_FLOOD_PER_MINUTE',
	'MCP_UNAUTH_PER_MINUTE',
	'MCP_AUTH_PER_MINUTE',
	'MCP_HEAVY_TOOL_PER_MINUTE',
	'MCP_SSE_OPEN_PER_MINUTE',
	'MCP_TOOL_CONCURRENCY',
	'MCP_HEAVY_TOOL_CONCURRENCY',
];

const API_RATE_LIMIT_ENV = {
	API_RATE_LIMIT_ENABLED: 'true',
	API_RATE_LIMIT_WINDOW_MS: '60000',
	API_RATE_LIMIT_GENERAL_PER_MINUTE: '120',
	API_RATE_LIMIT_OBSIDIAN_PER_MINUTE: '3000',
	API_RATE_LIMIT_RAZUNA_FILES_PER_MINUTE: '300',
	API_RATE_LIMIT_EXPENSIVE_PER_MINUTE: '60',
	API_RATE_LIMIT_UPLOAD_PER_MINUTE: '20',
};

const MCP_RATE_LIMIT_ENV = {
	MCP_RATE_LIMIT_ENABLED: 'true',
	MCP_RATE_LIMIT_WINDOW_MS: '60000',
	MCP_IP_FLOOD_PER_MINUTE: '300',
	MCP_UNAUTH_PER_MINUTE: '30',
	MCP_AUTH_PER_MINUTE: '120',
	MCP_HEAVY_TOOL_PER_MINUTE: '30',
	MCP_SSE_OPEN_PER_MINUTE: '20',
	MCP_TOOL_CONCURRENCY: '3',
	MCP_HEAVY_TOOL_CONCURRENCY: '1',
};

let savedEnv = {};

function setEnv(values) {
	for (const [key, value] of Object.entries(values)) {
		process.env[key] = value;
	}
}

function request(options = {}) {
	return {
		method: options.method || 'GET',
		originalUrl: options.originalUrl,
		url: options.url,
		path: options.path,
		headers: options.headers || {},
		query: options.query || {},
		ip: options.ip || '203.0.113.10',
		host_id: options.host_id,
		session: options.session,
	};
}

function listen(app) {
	return new Promise(function startServer(resolve, reject) {
		const server = app.listen(0, '127.0.0.1', function listening() {
			resolve(server);
		});
		server.on('error', reject);
	});
}

function closeServer(server) {
	return new Promise(function stopServer(resolve, reject) {
		server.close(function closed(error) {
			if (error) return reject(error);
			return resolve();
		});
	});
}

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise(function createDeferred(res, rej) {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function createSemaphoreCoordinator() {
	const active = new Map();
	let sequence = 0;
	return {
		async acquireSemaphore(key, limit) {
			const slots = active.get(key) || new Map();
			for (let slot = 0; slot < limit; slot++) {
				if (slots.has(slot)) continue;
				const lease = { semaphoreKey: key, slot, token: String(++sequence) };
				slots.set(slot, lease.token);
				active.set(key, slots);
				return lease;
			}
			return null;
		},
		async releaseSemaphore(lease) {
			const slots = active.get(lease.semaphoreKey);
			if (!slots || slots.get(lease.slot) !== lease.token) return false;
			slots.delete(lease.slot);
			if (!slots.size) active.delete(lease.semaphoreKey);
			return true;
		},
	};
}

beforeEach(() => {
	savedEnv = {};
	for (const key of ENV_KEYS) {
		savedEnv[key] = process.env[key];
		delete process.env[key];
	}
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (savedEnv[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = savedEnv[key];
		}
	}
});

describe('API rate-limit helpers', () => {
	it('requires env config and reads compose-provided values', () => {
		assert.throws(() => ApiRateLimit.getConfig(), /missing required env 'API_RATE_LIMIT_ENABLED'/);

		setEnv(API_RATE_LIMIT_ENV);
		assert.deepEqual(ApiRateLimit.getConfig(), {
			enabled: true,
			windowMs: 60000,
			generalPerMinute: 120,
			obsidianPerMinute: 3000,
			razunaFilesPerMinute: 300,
			expensivePerMinute: 60,
			uploadPerMinute: 20,
		});

		setEnv({
			API_RATE_LIMIT_ENABLED: 'false',
			API_RATE_LIMIT_WINDOW_MS: '5000',
			API_RATE_LIMIT_GENERAL_PER_MINUTE: '11',
			API_RATE_LIMIT_OBSIDIAN_PER_MINUTE: '15',
			API_RATE_LIMIT_RAZUNA_FILES_PER_MINUTE: '12',
			API_RATE_LIMIT_EXPENSIVE_PER_MINUTE: '13',
			API_RATE_LIMIT_UPLOAD_PER_MINUTE: '14',
		});

		assert.deepEqual(ApiRateLimit.getConfig(), {
			enabled: false,
			windowMs: 5000,
			generalPerMinute: 11,
			obsidianPerMinute: 15,
			razunaFilesPerMinute: 12,
			expensivePerMinute: 13,
			uploadPerMinute: 14,
		});

		process.env.API_RATE_LIMIT_WINDOW_MS = '5000ms';
		assert.throws(() => ApiRateLimit.getConfig(), /env 'API_RATE_LIMIT_WINDOW_MS' must be an integer >= 1/);
	});

	it('keys by verified session user, otherwise by IP, never by unverified credentials', () => {
		const ip = '203.0.113.20';
		const ipKey = ApiRateLimit.getRateLimitKey(request({ ip }));
		assert.match(ipKey, /^ip:[a-f0-9]{64}$/);
		assert.equal(ApiRateLimit.getRateLimitKey(request({ ip, headers: { authorization: 'Bearer raw-bearer-token' } })), ipKey);
		assert.equal(ApiRateLimit.getRateLimitKey(request({ ip, headers: { authorization: `Basic ${Buffer.from('api-user:secret').toString('base64')}` } })), ipKey);
		assert.equal(ApiRateLimit.getRateLimitKey(request({ ip, headers: { 'x-access-token': 'raw-access-token' } })), ipKey);
		const userKey = ApiRateLimit.getRateLimitKey(request({ ip, session: { userId: 'user-1' } }));
		assert.match(userKey, /^user:[a-f0-9]{64}$/);
		assert.equal(userKey.includes('user-1'), false);
	});

	it('puts random bearer tokens from one IP in the same bucket', async () => {
		setEnv({ ...API_RATE_LIMIT_ENV, API_RATE_LIMIT_GENERAL_PER_MINUTE: '2' });
		const app = express();
		app.use('/api/v1', ...ApiRateLimit.createApiLimiters(), (_req, res) => res.json({ success: true }));
		const server = await listen(app);
		try {
			const base = `http://127.0.0.1:${server.address().port}/api/v1`;
			const statuses = [];
			for (let i = 0; i < 3; i += 1) statuses.push((await fetch(`${base}/projects`, { headers: { authorization: `Bearer random-${i}-${Math.random()}` } })).status);
			assert.deepEqual(statuses, [200, 200, 429]);
		} finally {
			await closeServer(server);
		}
	});

	it('limits auth attempts per IP and account email', async () => {
		const app = express();
		app.use(express.json());
		app.post('/login', ApiRateLimit.createAuthAttemptLimiter('test-auth-login', { store: new MemoryStore() }), (_req, res) => res.status(401).json({ error: 'Invalid credentials' }));
		const server = await listen(app);
		try {
			const url = `http://127.0.0.1:${server.address().port}/login`;
			const attempt = (email) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'wrong' }) });
			for (let i = 0; i < 10; i += 1) assert.equal((await attempt(i % 2 ? 'Victim@Example.com' : ' victim@example.com')).status, 401);
			const blocked = await attempt('victim@example.com');
			assert.equal(blocked.status, 429);
			assert.match((await blocked.json()).error, /Too many attempts/);
			assert.equal((await attempt('other@example.com')).status, 401);
		} finally {
			await closeServer(server);
		}
	});

	it('detects skip, search/read, expensive, and upload APIs', () => {
		const now = Date.now();
		const demoRequest = request({
			method: 'POST',
			originalUrl: '/api/v1/chat',
			host_id: 'host-demo',
			session: {
				host_id: 'host-demo',
				streamientDemoAccounts: {
					'host-demo': { activated_at: new Date(now).toISOString(), expires_at: new Date(now + (12 * 60 * 60 * 1000)).toISOString(), scene: 'overview' },
				},
			},
		});
		assert.equal(ApiRateLimit.shouldSkipCommon(request({ method: 'OPTIONS', originalUrl: '/api/v1/notes/search' })), true);
		assert.equal(ApiRateLimit.shouldSkipCommon(request({ method: 'GET', originalUrl: '/api/v1/ping' })), true);
		assert.equal(ApiRateLimit.shouldSkipCommon(demoRequest), true);
		assert.equal(ApiRateLimit.isSearchReadApi(request({ method: 'POST', originalUrl: '/api/v1/search/knowledge' })), true);
		assert.equal(ApiRateLimit.isSearchReadApi(request({ method: 'POST', path: '/notes/search' })), true);
		assert.equal(ApiRateLimit.isExpensiveApi(request({ method: 'POST', originalUrl: '/api/v1/chat' })), true);
		assert.equal(ApiRateLimit.isExpensiveApi(request({ method: 'GET', originalUrl: '/api/v1/chat' })), false);
		assert.equal(ApiRateLimit.isExpensiveApi(request({ method: 'POST', originalUrl: '/api/v1/urls/abc/resync' })), true);
		assert.equal(ApiRateLimit.isExpensiveApi(request({ method: 'POST', originalUrl: '/api/v1/git-repos/abc/sync' })), true);
		assert.equal(ApiRateLimit.isUploadApi(request({ method: 'POST', originalUrl: '/api/v1/notes/import' })), true);
		assert.equal(ApiRateLimit.isUploadApi(request({ method: 'GET', originalUrl: '/api/v1/notes/import' })), false);
		assert.equal(ApiRateLimit.isObsidianSyncApi(request({ method: 'GET', originalUrl: '/api/v1/obsidian/connections/abc/changes' })), true);
		assert.equal(ApiRateLimit.isObsidianSyncApi(request({ method: 'GET', originalUrl: '/api/v1/projects' })), false);
	});

	it('isolates Obsidian sync traffic from general and upload buckets', async () => {
		setEnv({ ...API_RATE_LIMIT_ENV, API_RATE_LIMIT_GENERAL_PER_MINUTE: '1', API_RATE_LIMIT_OBSIDIAN_PER_MINUTE: '2', API_RATE_LIMIT_UPLOAD_PER_MINUTE: '1' });
		const app = express();
		app.use('/api/v1', ...ApiRateLimit.createApiLimiters(), (_req, res) => res.json({ success: true }));
		const server = await listen(app);
		try {
			const { port } = server.address();
			const base = `http://127.0.0.1:${port}/api/v1`;
			// Unauthenticated callers are keyed by IP and the store may be a shared Memcached, so give each bucket a fresh client IP.
			const runIp = (n) => `198.51.${Math.floor(Math.random() * 250)}.${n}`;
			const obsidianHeaders = { authorization: 'Bearer obsidian-read-token', 'cf-connecting-ip': runIp(1) };
			assert.equal((await fetch(`${base}/obsidian/files/file-1/content`, { headers: obsidianHeaders })).status, 200);
			assert.equal((await fetch(`${base}/obsidian/connections/connection-1/changes`, { headers: obsidianHeaders })).status, 200);
			assert.equal((await fetch(`${base}/obsidian/projects`, { headers: obsidianHeaders })).status, 429);

			const uploadHeaders = { authorization: 'Bearer obsidian-upload-token', 'cf-connecting-ip': runIp(2), 'content-type': 'application/json' };
			assert.equal((await fetch(`${base}/obsidian/uploads`, { method: 'POST', headers: uploadHeaders, body: '{}' })).status, 200);
			assert.equal((await fetch(`${base}/obsidian/uploads/upload-1/complete`, { method: 'POST', headers: uploadHeaders, body: '{}' })).status, 200);

			const generalHeaders = { authorization: 'Bearer general-token', 'cf-connecting-ip': runIp(3) };
			assert.equal((await fetch(`${base}/projects`, { headers: generalHeaders })).status, 200);
			assert.equal((await fetch(`${base}/notes`, { headers: generalHeaders })).status, 429);
		} finally {
			await closeServer(server);
		}
	});
});

describe('MCP rate-limit helpers', () => {
	it('requires env config and reads compose-provided values', () => {
		assert.throws(() => McpRateLimit.getConfig(), /missing required env 'MCP_RATE_LIMIT_ENABLED'/);

		setEnv(MCP_RATE_LIMIT_ENV);
		assert.deepEqual(McpRateLimit.getConfig(), {
			enabled: true,
			windowMs: 60000,
			ipFloodPerMinute: 300,
			unauthPerMinute: 30,
			authPerMinute: 120,
			heavyToolPerMinute: 30,
			sseOpenPerMinute: 20,
			toolConcurrency: 3,
			heavyToolConcurrency: 1,
		});

		setEnv({
			MCP_RATE_LIMIT_ENABLED: 'false',
			MCP_RATE_LIMIT_WINDOW_MS: '7000',
			MCP_IP_FLOOD_PER_MINUTE: '1',
			MCP_UNAUTH_PER_MINUTE: '2',
			MCP_AUTH_PER_MINUTE: '3',
			MCP_HEAVY_TOOL_PER_MINUTE: '4',
			MCP_SSE_OPEN_PER_MINUTE: '5',
			MCP_TOOL_CONCURRENCY: '6',
			MCP_HEAVY_TOOL_CONCURRENCY: '7',
		});

		assert.deepEqual(McpRateLimit.getConfig(), {
			enabled: false,
			windowMs: 7000,
			ipFloodPerMinute: 1,
			unauthPerMinute: 2,
			authPerMinute: 3,
			heavyToolPerMinute: 4,
			sseOpenPerMinute: 5,
			toolConcurrency: 6,
			heavyToolConcurrency: 7,
		});

		process.env.MCP_TOOL_CONCURRENCY = '6x';
		assert.throws(() => McpRateLimit.getConfig(), /env 'MCP_TOOL_CONCURRENCY' must be an integer >= 0/);
	});

	it('builds hashed keys from OAuth users, credentials, and IP fallback', () => {
		const oauthKey = McpRateLimit.getAuthContextRateLimitKey('streamient', request(), {
			mode: 'oauth',
			tokenClaims: { sub: 'user-123' },
		});
		const apiKey = McpRateLimit.getCredentialOrIpKey('streamient', request({
			query: { api_key: 'raw-api-key' },
		}));
		const bearerKey = McpRateLimit.getCredentialOrIpKey('streamient', request({
			headers: { authorization: 'Bearer raw-bearer-token' },
		}));
		const ipKey = McpRateLimit.getCredentialOrIpKey('streamient', request({ ip: '198.51.100.44' }));

		assert.match(oauthKey, /^streamient:user:[a-f0-9]{64}$/);
		assert.match(apiKey, /^streamient:api-key:[a-f0-9]{64}$/);
		assert.match(bearerKey, /^streamient:bearer:[a-f0-9]{64}$/);
		assert.match(ipKey, /^streamient:ip:[a-f0-9]{64}$/);
		assert.equal(oauthKey.includes('user-123'), false);
		assert.equal(apiKey.includes('raw-api-key'), false);
	});

	it('detects skip paths, SSE opens, and heavy tools', () => {
		assert.equal(McpRateLimit.shouldSkipCommon(request({ method: 'OPTIONS', path: '/mcp' })), true);
		assert.equal(McpRateLimit.shouldSkipCommon(request({ method: 'GET', path: '/health' })), true);
		assert.equal(McpRateLimit.shouldSkipCommon(request({ method: 'GET', path: '/.well-known/oauth-protected-resource/mcp' })), true);
		assert.equal(McpRateLimit.shouldSkipCommon(request({ method: 'POST', path: '/messages' })), false);
		assert.equal(McpRateLimit.isSseOpen(request({ method: 'GET', path: '/sse' })), true);
		assert.equal(McpRateLimit.isSseOpen(request({ method: 'POST', path: '/sse' })), false);
		assert.equal(McpRateLimit.isHeavyToolName('search_knowledge'), false);
		assert.equal(McpRateLimit.isHeavyToolName('search_notes'), false);
		assert.equal(McpRateLimit.isHeavyToolName('recall_memory'), false);
		assert.equal(McpRateLimit.isHeavyToolName('search_memory'), false);
		assert.equal(McpRateLimit.isHeavyToolName('search_urls'), false);
		assert.equal(McpRateLimit.isHeavyToolName('search_emails'), false);
		assert.equal(McpRateLimit.isHeavyToolName('chat'), true);
		assert.equal(McpRateLimit.isHeavyToolName('ingest_email'), true);
		assert.equal(McpRateLimit.isHeavyToolName('delete_note'), true);
		assert.equal(McpRateLimit.isHeavyToolName('bulk_delete_notes'), true);
		assert.equal(McpRateLimit.isHeavyToolName('remove_git_repo'), true);
		assert.equal(McpRateLimit.isHeavyToolName('empty_trash'), true);
		assert.equal(McpRateLimit.isHeavyToolName('trigger_git_sync'), true);
		assert.equal(McpRateLimit.isHeavyToolName('list_projects'), false);
	});

	it('allows overlapping read-only searches under normal tool concurrency', async () => {
		setEnv({
			...MCP_RATE_LIMIT_ENV,
			MCP_TOOL_CONCURRENCY: '3',
			MCP_HEAVY_TOOL_CONCURRENCY: '1',
		});

		const product = 'streamient-search-concurrency-regression';
		const rateLimitKey = 'user:search-concurrency-regression';
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const first = McpRateLimit.runToolWithLimits({
			product,
			rateLimitKey,
			toolName: 'search_knowledge',
			run: async function runFirstSearch() {
				firstStarted.resolve();
				await releaseFirst.promise;
				return { content: [{ type: 'text', text: 'first search' }] };
			},
		});

		await firstStarted.promise;
		try {
			const second = await McpRateLimit.runToolWithLimits({
				product,
				rateLimitKey,
				toolName: 'search_notes',
				run: async function runSecondSearch() {
					return { content: [{ type: 'text', text: 'second search' }] };
				},
			});

			assert.equal(second?.isError, undefined);
			assert.equal(second.content[0].text, 'second search');
		} finally {
			releaseFirst.resolve();
		}

		const firstResult = await first;
		assert.equal(firstResult?.isError, undefined);
		assert.equal(firstResult.content[0].text, 'first search');
	});

	it('still rejects overlapping heavy tools at the heavy concurrency cap', async () => {
		setEnv({
			...MCP_RATE_LIMIT_ENV,
			MCP_TOOL_CONCURRENCY: '3',
			MCP_HEAVY_TOOL_CONCURRENCY: '1',
		});

		const product = 'streamient-heavy-concurrency-regression';
		const rateLimitKey = 'user:heavy-concurrency-regression';
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const coordinator = createSemaphoreCoordinator();
		const first = McpRateLimit.runToolWithLimits({
			product,
			rateLimitKey,
			coordinator,
			toolName: 'chat',
			run: async function runFirstHeavyTool() {
				firstStarted.resolve();
				await releaseFirst.promise;
				return { content: [{ type: 'text', text: 'first heavy' }] };
			},
		});

		await firstStarted.promise;
		try {
			const second = await McpRateLimit.runToolWithLimits({
				product,
				rateLimitKey,
				coordinator,
				toolName: 'chat',
				run: async function runSecondHeavyTool() {
					return { content: [{ type: 'text', text: 'second heavy' }] };
				},
			});

			assert.equal(second.isError, true);
			const payload = JSON.parse(second.content[0].text);
			assert.match(payload.error, /Too many concurrent MCP tool calls/);
			assert.equal(payload.tool, 'chat');
		} finally {
			releaseFirst.resolve();
		}

		const firstResult = await first;
		assert.equal(firstResult?.isError, undefined);
		assert.equal(firstResult.content[0].text, 'first heavy');
	});

	it('fails closed when the MongoDB heavy-tool semaphore is unavailable', async () => {
		setEnv(MCP_RATE_LIMIT_ENV);
		let ran = false;
		const result = await McpRateLimit.runToolWithLimits({
			product: 'streamient-mongo-failure',
			rateLimitKey: 'user:mongo-failure',
			toolName: 'chat',
			coordinator: { acquireSemaphore: async function() { throw new Error('MongoDB unavailable'); } },
			run: async function() { ran = true; },
		});
		assert.equal(ran, false);
		assert.equal(result.isError, true);
		assert.match(JSON.parse(result.content[0].text).error, /concurrency service unavailable/);
	});

	it('runs startup-created authenticated limiter inside request handlers', async () => {
		setEnv({
			...MCP_RATE_LIMIT_ENV,
			MCP_AUTH_PER_MINUTE: '1',
		});

		const product = 'streamient-auth-regression';
		const app = express();
		const authenticatedRequestLimiter = McpRateLimit.createAuthenticatedRequestLimiter(product);

		app.post('/mcp', async function testMcpRoute(req, res, next) {
			try {
				const authContext = {
					mode: 'oauth',
					tokenClaims: { sub: 'user-123' },
				};
				if (!await McpRateLimit.consumeAuthenticatedRequest(product, authenticatedRequestLimiter, req, res, authContext)) return;
				return res.json({ success: true });
			} catch (error) {
				return next(error);
			}
		});

		app.use(function errorHandler(error, _req, res, _next) {
			return res.status(500).json({ error: error?.code || error?.message || 'unknown' });
		});

		const server = await listen(app);
		try {
			const { port } = server.address();
			const url = `http://127.0.0.1:${port}/mcp`;
			const first = await fetch(url, { method: 'POST' });
			assert.equal(first.status, 200);
			assert.deepEqual(await first.json(), { success: true });

			const second = await fetch(url, { method: 'POST' });
			assert.equal(second.status, 429);
			const body = await second.json();
			assert.equal(body.success, false);
			assert.match(body.error, /Rate limit exceeded/);
		} finally {
			await closeServer(server);
		}
	});
});
