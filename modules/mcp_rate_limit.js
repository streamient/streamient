import crypto from 'node:crypto';
import { getClientIp } from '../middleware/rate_limit.js';
export { getClientIp } from '../middleware/rate_limit.js';
import rateLimit from 'express-rate-limit';
import { getCache, getMongoCoordinator, getRateLimitStore } from './cache.js';
import { createLogger } from './logger.js';

const log = createLogger('mcp-rate-limit');

const CONCURRENCY_TTL_MS = 5 * 60 * 1000;

const READ_ONLY_RETRIEVAL_TOOL_NAMES = new Set([
	'search_knowledge',
	'search_notes',
	'recall_memory',
	'search_memory',
	'search_urls',
	'search_emails',
]);

const HEAVY_TOOL_NAMES = new Set([
	'chat',
	'ingest_email',
	'trigger_git_sync',
]);

const HEAVY_TOOL_PATTERNS = [
	/^search_/,
	/_search$/,
	/^bulk_/,
	/^delete_/,
	/_delete_/,
	/^remove_/,
	/_remove_/,
	/trash/,
];

let memoryFallbackLogged = false;
const requestLimiters = new Map();
const memoryCounters = new Map();
const memoryConcurrency = new Map();

function hashValue(value) {
	return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getBooleanEnv(name) {
	const value = process.env[name];
	if (value === undefined || value === null || value === '') {
		throw new Error(`McpRateLimit.getConfig(), missing required env '${name}'`);
	}
	return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function getIntegerEnv(name, options = {}) {
	const value = process.env[name];
	if (value === undefined || value === null || value === '') {
		throw new Error(`McpRateLimit.getConfig(), missing required env '${name}'`);
	}

	const normalizedValue = String(value).trim();
	const min = typeof options.min === 'number' ? options.min : 0;
	if (!/^\d+$/.test(normalizedValue)) {
		throw new Error(`McpRateLimit.getConfig(), env '${name}' must be an integer >= ${min}`);
	}

	const parsed = Number(normalizedValue);
	if (!Number.isSafeInteger(parsed) || parsed < min) {
		throw new Error(`McpRateLimit.getConfig(), env '${name}' must be an integer >= ${min}`);
	}
	return parsed;
}

export function getConfig() {
	return {
		enabled: getBooleanEnv('MCP_RATE_LIMIT_ENABLED'),
		windowMs: getIntegerEnv('MCP_RATE_LIMIT_WINDOW_MS', { min: 1 }),
		ipFloodPerMinute: getIntegerEnv('MCP_IP_FLOOD_PER_MINUTE'),
		unauthPerMinute: getIntegerEnv('MCP_UNAUTH_PER_MINUTE'),
		authPerMinute: getIntegerEnv('MCP_AUTH_PER_MINUTE'),
		heavyToolPerMinute: getIntegerEnv('MCP_HEAVY_TOOL_PER_MINUTE'),
		sseOpenPerMinute: getIntegerEnv('MCP_SSE_OPEN_PER_MINUTE'),
		toolConcurrency: getIntegerEnv('MCP_TOOL_CONCURRENCY'),
		heavyToolConcurrency: getIntegerEnv('MCP_HEAVY_TOOL_CONCURRENCY'),
	};
}

export function getRequestPath(request) {
	return (request.originalUrl || request.url || request.path || '').split('?')[0] || '/';
}

function getCacheStore(prefix) {
	try {
		return getRateLimitStore(prefix, getConfig().windowMs);
	} catch (err) {
		if (!memoryFallbackLogged) {
			memoryFallbackLogged = true;
			log.warn({ err }, 'MCP rate limit Memcached setup failed; using memory fallback');
		}
		return undefined;
	}
}

function createNoopLimiter() {
	return function noopRateLimiter(_request, _response, next) {
		return next();
	};
}

function setRateLimitHeaders(response) {
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
	response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Token, Access-Token, X-Project-Id, Mcp-Session-Id');
	response.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate, RateLimit, RateLimit-Policy, Retry-After');
}

export function shouldSkipCommon(request) {
	const path = getRequestPath(request);
	return request.method === 'OPTIONS' || path === '/health' || path === '/info' || path.startsWith('/.well-known/');
}

export function isSseOpen(request) {
	return request.method === 'GET' && getRequestPath(request) === '/sse';
}

function getBearerToken(request) {
	const authHeader = request.headers?.authorization || '';
	if (!/^(Bearer|Token)\s+/i.test(authHeader)) return null;
	return authHeader.replace(/^(Bearer|Token)\s+/i, '').trim();
}

function getBasicAuthName(request) {
	const authHeader = request.headers?.authorization || '';
	if (!/^Basic\s+/i.test(authHeader)) return null;

	try {
		const decoded = Buffer.from(authHeader.replace(/^Basic\s+/i, '').trim(), 'base64').toString('utf8');
		const separatorIndex = decoded.indexOf(':');
		return separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
	} catch {
		return null;
	}
}

function getCredential(request) {
	const bearerToken = getBearerToken(request);
	if (bearerToken) return { type: 'bearer', value: bearerToken };

	const accessToken = request.headers?.['x-access-token'] ||
		request.headers?.['access-token'] ||
		request.headers?.access_token ||
		request.query?.access_token ||
		request.query?.['access-token'];
	if (accessToken) return { type: 'access', value: accessToken };

	const apiKey = request.query?.api_key || request.query?.apiKey;
	if (apiKey) return { type: 'api-key', value: apiKey };

	const basicName = getBasicAuthName(request);
	if (basicName) return { type: 'basic', value: basicName };

	return null;
}

function makeKey(product, type, value) {
	return `${product}:${type}:${hashValue(`${product}:${type}:${value}`)}`;
}

export function getCredentialOrIpKey(product, request) {
	const credential = getCredential(request);
	if (credential) return makeKey(product, credential.type, credential.value);
	return makeKey(product, 'ip', getClientIp(request));
}

export function getAuthContextRateLimitKey(product, request, authContext) {
	if (authContext?.mode === 'oauth' && authContext.tokenClaims?.sub) {
		return makeKey(product, 'user', authContext.tokenClaims.sub);
	}

	return getCredentialOrIpKey(product, request);
}

export function getApiClientRateLimitKey(product, apiClient) {
	if (apiClient?.auth?.token) return makeKey(product, apiClient.auth.scheme || 'token', apiClient.auth.token);
	if (apiClient?.accessToken) return makeKey(product, 'access', apiClient.accessToken);
	if (apiClient?.apiKey) return makeKey(product, 'api-key', apiClient.apiKey);
	if (apiClient?.userInfo?.id) return makeKey(product, 'user', apiClient.userInfo.id);
	if (apiClient?.userInfo?._id) return makeKey(product, 'user', apiClient.userInfo._id);
	return makeKey(product, 'process', process.pid);
}

function createRequestLimiter(product, name, limit, keyGenerator, skip, options = {}) {
	const rateLimitConfig = getConfig();
	if (!rateLimitConfig.enabled) return createNoopLimiter();

	const cacheKey = `${product}:${name}:${limit}:${rateLimitConfig.windowMs}`;
	if (requestLimiters.has(cacheKey)) return requestLimiters.get(cacheKey);

	const limiter = rateLimit({
		windowMs: rateLimitConfig.windowMs,
		limit,
		keyGenerator,
		store: getCacheStore(`mcp:${product}:${name}`),
		passOnStoreError: true,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		skip,
		...options,
		handler: function handleRateLimit(request, response) {
			setRateLimitHeaders(response);
			log.warn({ product, bucket: name, method: request.method, path: getRequestPath(request) }, 'MCP rate limit exceeded');
			return response.status(429).json({
				success: false,
				error: 'Rate limit exceeded. Please slow down and try again later.',
			});
		},
	});

	requestLimiters.set(cacheKey, limiter);
	return limiter;
}

export function createIpFloodLimiter(product) {
	return createRequestLimiter(product, 'ip-flood', getConfig().ipFloodPerMinute, function keyByIp(request) {
		return makeKey(product, 'ip', getClientIp(request));
	}, function skipIpFlood(request) {
		return shouldSkipCommon(request) || isSseOpen(request);
	});
}

export function createUnauthLimiter(product) {
	return createRequestLimiter(product, 'unauth', getConfig().unauthPerMinute, function keyByUnauthIp(request) {
		return makeKey(product, 'ip', getClientIp(request));
	}, function skipUnauth(request) {
		return shouldSkipCommon(request);
	}, { skipSuccessfulRequests: true, requestWasSuccessful: (_request, response) => response.statusCode !== 401 });
}

export function createSseOpenLimiter(product) {
	return createRequestLimiter(product, 'sse-open', getConfig().sseOpenPerMinute, function keyByCredentialOrIp(request) {
		return getCredentialOrIpKey(product, request);
	}, function skipSseOpen(request) {
		return shouldSkipCommon(request) || !isSseOpen(request);
	});
}

export function createAuthenticatedRequestLimiter(product) {
	return createRequestLimiter(product, 'auth', getConfig().authPerMinute, function keyByAuthContext(request) {
		return request.mcpRateLimitKey || getCredentialOrIpKey(product, request);
	}, function skipAuth(request) {
		return shouldSkipCommon(request) || isSseOpen(request);
	});
}

function runExpressLimiter(limiter, request, response) {
	return new Promise(function runLimiter(resolve, reject) {
		limiter(request, response, function done(error) {
			if (error) return reject(error);
			return resolve(!response.headersSent);
		});
	});
}

export async function consumeAuthenticatedRequest(product, limiter, request, response, authContext) {
	if (!getConfig().enabled) return true;

	request.mcpRateLimitKey = getAuthContextRateLimitKey(product, request, authContext);
	return await runExpressLimiter(limiter, request, response);
}

function getMemoryCounter(key, windowMs) {
	const now = Date.now();
	let counter = memoryCounters.get(key);
	if (!counter || counter.resetAt <= now) {
		counter = { count: 0, resetAt: now + windowMs };
		memoryCounters.set(key, counter);
	}
	return counter;
}

async function consumeCounter(product, name, key, limit, windowMs) {
	if (!getConfig().enabled) return { allowed: true, count: 0 };
	if (limit <= 0) return { allowed: false, count: 0 };

	const counterKey = `rl:mcp:${product}:${name}:${key}`;

	try {
		const count = await getCache().increment(counterKey, { ttlMs: windowMs });
		if (Number.isFinite(count)) return { allowed: count <= limit, count };
	} catch (err) {
		if (!memoryFallbackLogged) {
			memoryFallbackLogged = true;
			log.warn({ err }, 'MCP rate limit counter Memcached failed; using memory fallback');
		}
	}

	const counter = getMemoryCounter(counterKey, windowMs);
	counter.count++;
	return { allowed: counter.count <= limit, count: counter.count };
}

async function acquireConcurrency(product, name, key, limit, coordinator) {
	if (!getConfig().enabled) return { allowed: true, semaphoreKey: null };
	if (limit <= 0) return { allowed: false, semaphoreKey: null };

	const semaphoreKey = `rl:mcp:${product}:concurrency:${name}:${key}`;

	try {
		const lease = await (coordinator || getMongoCoordinator()).acquireSemaphore(semaphoreKey, limit, { ttlMs: CONCURRENCY_TTL_MS });
		return lease ? { allowed: true, lease } : { allowed: false, semaphoreKey };
	} catch (err) {
		if (name === 'heavy-tool') {
			log.warn({ err }, 'MCP MongoDB heavy-tool concurrency failed; failing closed');
			return { allowed: false, semaphoreKey, unavailable: true };
		}
		if (!memoryFallbackLogged) {
			memoryFallbackLogged = true;
			log.warn({ err }, 'MCP MongoDB concurrency failed; using memory fallback');
		}
	}

	const memoryCount = memoryConcurrency.get(semaphoreKey) || 0;
	if (memoryCount >= limit) return { allowed: false, semaphoreKey, memory: true };
	memoryConcurrency.set(semaphoreKey, memoryCount + 1);
	return { allowed: true, semaphoreKey, memory: true };
}

async function releaseConcurrency(lock, coordinator) {
	if (!lock || (!lock.lease && !lock.semaphoreKey)) return;

	if (lock.memory) {
		const memoryCount = memoryConcurrency.get(lock.semaphoreKey) || 0;
		if (memoryCount <= 1) {
			memoryConcurrency.delete(lock.semaphoreKey);
		} else {
			memoryConcurrency.set(lock.semaphoreKey, memoryCount - 1);
		}
		return;
	}

	try {
		await (coordinator || getMongoCoordinator()).releaseSemaphore(lock.lease);
	} catch (err) {
		log.warn({ err }, 'MCP MongoDB concurrency release failed');
	}
}

export function isHeavyToolName(toolName) {
	if (READ_ONLY_RETRIEVAL_TOOL_NAMES.has(toolName)) return false;
	return HEAVY_TOOL_NAMES.has(toolName) || HEAVY_TOOL_PATTERNS.some((pattern) => pattern.test(toolName));
}

function buildToolLimitResult(toolName, error) {
	return {
		content: [{
			type: 'text',
			text: JSON.stringify({ success: false, error, tool: toolName }, null, 2),
		}],
		isError: true,
	};
}

export async function runToolWithLimits(options) {
	const rateLimitConfig = getConfig();
	if (!rateLimitConfig.enabled) return await options.run();

	const product = options.product;
	const toolName = options.toolName;
	const rateLimitKey = options.rateLimitKey || makeKey(product, 'process', process.pid);
	const isHeavy = isHeavyToolName(toolName);

	if (isHeavy) {
		const heavyStatus = await consumeCounter(product, 'heavy-tool', rateLimitKey, rateLimitConfig.heavyToolPerMinute, rateLimitConfig.windowMs);
		if (!heavyStatus.allowed) {
			log.warn({ product, tool: toolName }, 'MCP heavy-tool rate limit exceeded');
			return buildToolLimitResult(toolName, 'Rate limit exceeded. Please slow down and try again later.');
		}
	}

	const concurrencyName = isHeavy ? 'heavy-tool' : 'tool';
	const concurrencyLimit = isHeavy ? rateLimitConfig.heavyToolConcurrency : rateLimitConfig.toolConcurrency;
	const lock = await acquireConcurrency(product, concurrencyName, rateLimitKey, concurrencyLimit, options.coordinator);
	if (!lock.allowed) {
		log.warn({ product, tool: toolName, bucket: concurrencyName }, 'MCP tool concurrency limit exceeded');
		return buildToolLimitResult(toolName, lock.unavailable ? 'MCP concurrency service unavailable. Please try again later.' : 'Too many concurrent MCP tool calls. Please wait and try again.');
	}

	try {
		return await options.run();
	} finally {
		await releaseConcurrency(lock, options.coordinator);
	}
}

export default {
	createIpFloodLimiter,
	createAuthenticatedRequestLimiter,
	createSseOpenLimiter,
	createUnauthLimiter,
	consumeAuthenticatedRequest,
	getApiClientRateLimitKey,
	getAuthContextRateLimitKey,
	getClientIp,
	getConfig,
	getCredentialOrIpKey,
	isHeavyToolName,
	isSseOpen,
	runToolWithLimits,
	shouldSkipCommon,
};
