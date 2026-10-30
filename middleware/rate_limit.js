import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { getRateLimitStore } from '../modules/cache.js';
import { Tenant } from '../modules/tenancy.js';
import { resolveStoredTenantLimits } from '../modules/tenant_limits.js';
import { createLogger } from '../modules/logger.js';
import { hasStreamientDemoSessionEntry } from '../services/streamient_demo_service.js';
import { isPublicAddress } from '../modules/public_url.js';

const log = createLogger('api-rate-limit');

const SEARCH_READ_API_PATHS = new Set([
	'/notes/search',
	'/memories/search',
	'/urls/search',
	'/emails/search',
	'/search/knowledge',
	'/search/all',
	'/search/quick',
	'/chat/search',
	'/mobile/search',
]);

const EXPENSIVE_API_METHOD_PATHS = new Set([
	'POST /chat',
	'POST /chat/stream',
	'POST /reindex',
	'POST /export',
	'POST /batch/delete',
	'POST /trash/restore',
	'POST /trash/batch/restore',
	'POST /trash/batch/delete',
	'DELETE /trash',
	'POST /settings/byo-ai/verify',
	'POST /settings/white-label/domain/verify',
	'POST /settings/white-label/domain/refresh',
	'POST /mobile/chat/stream',
]);

const EXPENSIVE_API_PATTERNS = [
	{ method: 'POST', pattern: /^\/urls\/[^/]+\/resync$/ },
	{ method: 'POST', pattern: /^\/git-repos\/[^/]+\/sync$/ },
	{ method: 'DELETE', pattern: /^\/trash\/[^/]+\/[^/]+$/ },
];

const UPLOAD_API_PATTERNS = [
	{ method: 'POST', pattern: /^\/notes\/import$/ },
	{ method: 'POST', pattern: /^\/settings\/white-label\/assets\/[^/]+$/ },
	{ method: 'POST', pattern: /^\/mobile\/note-imports$/ },
	{ method: 'POST', pattern: /^\/mobile\/note-imports\/[^/]+\/complete$/ },
	{ method: 'POST', pattern: /^\/obsidian\/uploads$/ },
	{ method: 'POST', pattern: /^\/obsidian\/uploads\/[^/]+\/complete$/ },
];

function hashValue(value) {
	return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getBooleanEnv(name) {
	const value = process.env[name];
	if (value === undefined || value === null || value === '') {
		throw new Error(`ApiRateLimit.getConfig(), missing required env '${name}'`);
	}
	return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function getIntegerEnv(name, options = {}) {
	const value = process.env[name];
	if (value === undefined || value === null || value === '') {
		throw new Error(`ApiRateLimit.getConfig(), missing required env '${name}'`);
	}

	const normalizedValue = String(value).trim();
	const min = typeof options.min === 'number' ? options.min : 0;
	if (!/^\d+$/.test(normalizedValue)) {
		throw new Error(`ApiRateLimit.getConfig(), env '${name}' must be an integer >= ${min}`);
	}

	const parsed = Number(normalizedValue);
	if (!Number.isSafeInteger(parsed) || parsed < min) {
		throw new Error(`ApiRateLimit.getConfig(), env '${name}' must be an integer >= ${min}`);
	}
	return parsed;
}

export function getConfig() {
	return {
		enabled: getBooleanEnv('API_RATE_LIMIT_ENABLED'),
		windowMs: getIntegerEnv('API_RATE_LIMIT_WINDOW_MS', { min: 1 }),
		generalPerMinute: getIntegerEnv('API_RATE_LIMIT_GENERAL_PER_MINUTE'),
		obsidianPerMinute: getIntegerEnv('API_RATE_LIMIT_OBSIDIAN_PER_MINUTE'),
		razunaFilesPerMinute: getIntegerEnv('API_RATE_LIMIT_RAZUNA_FILES_PER_MINUTE'),
		expensivePerMinute: getIntegerEnv('API_RATE_LIMIT_EXPENSIVE_PER_MINUTE'),
		uploadPerMinute: getIntegerEnv('API_RATE_LIMIT_UPLOAD_PER_MINUTE'),
	};
}

function firstHeaderValue(value) {
	if (Array.isArray(value)) return value[0] || '';
	return String(value || '').split(',')[0].trim();
}

function normalizeIp(value) {
	let ip = firstHeaderValue(value) || '127.0.0.1';
	if (ip.startsWith('::ffff:')) ip = ip.slice(7);
	if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']') === -1 ? undefined : ip.indexOf(']'));
	if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
	return ip || '127.0.0.1';
}

export function getRequestPath(request) {
	const rawPath = (request.originalUrl || request.url || request.path || '').split('?')[0] || '/';
	const strippedPath = rawPath.replace(/^\/api\/v1(?=\/|$)/, '') || '/';
	return strippedPath;
}

// Forwarding headers are client-controlled unless the direct peer is our own proxy on a private network.
export function getClientIp(request) {
	const peer = normalizeIp(request.socket?.remoteAddress || request.connection?.remoteAddress || '127.0.0.1');
	if (isPublicAddress(peer)) return peer;
	return normalizeIp(
		request.headers?.['cf-connecting-ip'] ||
		request.headers?.['fastly-client-ip'] ||
		request.headers?.['true-client-ip'] ||
		request.headers?.['x-real-ip'] ||
		request.headers?.['x-forwarded-for'] ||
		peer
	);
}

// Authorization headers are unverified before auth runs; key by the identity requireAuth verified, else by IP.
export function getRateLimitKey(request) {
	const userId = request.userId || request.session?.userId;
	if (userId) return `user:${hashValue(String(userId))}`;
	return `ip:${hashValue(getClientIp(request))}`;
}

function getCacheStore(prefix, windowMs) {
	try {
		return getRateLimitStore(prefix, windowMs || getConfig().windowMs);
	} catch (err) {
		log.warn({ err, prefix }, 'API rate limit Memcached store unavailable; using memory store');
		return undefined;
	}
}

export function isApiPing(request) {
	return getRequestPath(request) === '/ping';
}

export function isSearchReadApi(request) {
	return SEARCH_READ_API_PATHS.has(getRequestPath(request));
}

export function isExpensiveApi(request) {
	const method = String(request.method || 'GET').toUpperCase();
	const path = getRequestPath(request);
	if (EXPENSIVE_API_METHOD_PATHS.has(`${method} ${path}`)) return true;
	return EXPENSIVE_API_PATTERNS.some((entry) => entry.method === method && entry.pattern.test(path));
}

export function isUploadApi(request) {
	const method = String(request.method || 'GET').toUpperCase();
	const path = getRequestPath(request);
	return UPLOAD_API_PATTERNS.some((entry) => entry.method === method && entry.pattern.test(path));
}

export function isObsidianSyncApi(request) {
	return /^\/obsidian(?:\/|$)/.test(getRequestPath(request));
}

export function shouldSkipCommon(request) {
	return request.method === 'OPTIONS' || isApiPing(request) || hasStreamientDemoSessionEntry(request);
}

export function isMobileUploadChunk(request) {
	return String(request.method || '').toUpperCase() === 'PATCH' && /^(?:\/mobile\/note-imports|\/obsidian\/uploads)\/[^/]+$/.test(getRequestPath(request));
}

function createNoopLimiter() {
	return function noopRateLimiter(_request, _response, next) {
		return next();
	};
}

function createLimiter(options) {
	const rateLimitConfig = getConfig();
	if (!rateLimitConfig.enabled) return createNoopLimiter();

	return rateLimit({
		windowMs: rateLimitConfig.windowMs,
		limit: options.limit,
		keyGenerator: getRateLimitKey,
		store: getCacheStore(options.name),
		passOnStoreError: true,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		skip: options.skip,
		handler: function handleRateLimit(request, response) {
			log.warn({ key: getRateLimitKey(request), method: request.method, path: getRequestPath(request), bucket: options.name }, 'API rate limit exceeded');
			return response.status(429).json({
				error: 'Rate limit exceeded. Please slow down and try again later.',
			});
		},
	});
}

export function createExpensiveApiLimiter() {
	const rateLimitConfig = getConfig();
	return createLimiter({
		name: 'api-expensive',
		limit: rateLimitConfig.expensivePerMinute,
		skip: function skipExpensive(request) {
			return shouldSkipCommon(request) || !isExpensiveApi(request);
		},
	});
}

export function createSearchReadApiLimiter() {
	const rateLimitConfig = getConfig();
	return createLimiter({
		name: 'api-search-read',
		limit: rateLimitConfig.razunaFilesPerMinute,
		skip: function skipSearchRead(request) {
			return shouldSkipCommon(request) || !isSearchReadApi(request);
		},
	});
}

export function createUploadApiLimiter() {
	const rateLimitConfig = getConfig();
	return createLimiter({
		name: 'api-upload',
		limit: rateLimitConfig.uploadPerMinute,
		skip: function skipUpload(request) {
			return shouldSkipCommon(request) || isObsidianSyncApi(request) || !isUploadApi(request);
		},
	});
}

export function createObsidianApiLimiter() {
	const rateLimitConfig = getConfig();
	return createLimiter({
		name: 'api-obsidian',
		limit: rateLimitConfig.obsidianPerMinute,
		skip: function skipObsidian(request) {
			return shouldSkipCommon(request) || !isObsidianSyncApi(request);
		},
	});
}

export function createGeneralApiLimiter() {
	const rateLimitConfig = getConfig();
	return createLimiter({
		name: 'api-general',
		limit: rateLimitConfig.generalPerMinute,
		skip: function skipGeneral(request) {
			return shouldSkipCommon(request) || isSearchReadApi(request) || isMobileUploadChunk(request) || isObsidianSyncApi(request);
		},
	});
}

const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPT_LIMIT = 10;

/** Brute-force guard for credential endpoints: 10 attempts per 15 minutes per IP and account. Always on. */
export function createAuthAttemptLimiter(name, { view = null, account = (request) => request.body?.email, store } = {}) {
	return rateLimit({
		windowMs: AUTH_ATTEMPT_WINDOW_MS,
		limit: AUTH_ATTEMPT_LIMIT,
		keyGenerator: (request) => hashValue(`${getClientIp(request)}|${String(account(request) || '').trim().toLowerCase()}`),
		store: store || getCacheStore(name, AUTH_ATTEMPT_WINDOW_MS),
		passOnStoreError: true,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		handler: (request, response) => {
			const error = 'Too many attempts. Please wait 15 minutes and try again.';
			log.warn({ method: request.method, path: getRequestPath(request), bucket: name }, 'Auth attempt limit exceeded');
			if (view && request.is('application/x-www-form-urlencoded')) return response.status(429).render(view, { error });
			return response.status(429).json({ error });
		},
	});
}

async function resolveRequestAiDailyLimit(request) {
	if (request.aiDailyLimitPromise) return request.aiDailyLimitPromise;
	request.aiDailyLimitPromise = Tenant.findOne({ host_id: request.host_id })
		.select('plan limit_ai_workflows_per_day')
		.lean()
		.then((tenant) => {
			const limit = tenant ? resolveStoredTenantLimits(tenant).limit_ai_workflows_per_day : 0;
			request.aiDailyLimit = limit;
			return limit;
		});
	return request.aiDailyLimitPromise;
}

/** Daily hosted-account AI cap, keyed per tenant. Zero means unlimited. */
export function createAiDailyLimiter() {
	return rateLimit({
		windowMs: 24 * 60 * 60 * 1000,
		limit: async (request) => Math.max(1, await resolveRequestAiDailyLimit(request)),
		keyGenerator: (request) => `host:${request.host_id}`,
		store: getCacheStore('ai-daily'),
		passOnStoreError: true,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		skip: async (request) => {
			if (!request.isHosted || !request.host_id) return true;
			try {
				return (await resolveRequestAiDailyLimit(request)) === 0;
			} catch (err) {
				// Fail open: a broken tenant lookup must not take AI down.
				log.warn({ err, host_id: request.host_id }, 'AI daily limit skip check failed; failing open');
				return true;
			}
		},
		handler: (request, response) => {
			const limit = request.aiDailyLimit || 0;
			log.warn({ host_id: request.host_id, path: getRequestPath(request) }, 'Daily AI limit reached');
			return response.status(429).json({
				error: `Daily AI limit reached. This account allows ${limit} AI workflow${limit === 1 ? '' : 's'} per day.`,
				code: 'AI_DAILY_LIMIT',
				limit,
				upgrade_url: '/settings/subscription',
			});
		},
	});
}

/** Pre-auth guard: counts only rejected credentials per IP, so invalid tokens cannot hammer token lookups. */
export function createApiAuthFailureLimiter() {
	const rateLimitConfig = getConfig();
	if (!rateLimitConfig.enabled) return createNoopLimiter();
	return rateLimit({
		windowMs: rateLimitConfig.windowMs,
		limit: rateLimitConfig.generalPerMinute,
		keyGenerator: (request) => `auth-fail:${hashValue(getClientIp(request))}`,
		store: getCacheStore('api-auth-failure'),
		passOnStoreError: true,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		skip: shouldSkipCommon,
		requestWasSuccessful: (_request, response) => response.statusCode !== 401,
		skipSuccessfulRequests: true,
		handler: (request, response) => {
			log.warn({ method: request.method, path: getRequestPath(request), bucket: 'api-auth-failure' }, 'API auth failure limit exceeded');
			return response.status(429).json({ error: 'Rate limit exceeded. Please slow down and try again later.' });
		},
	});
}

export function createApiLimiters() {
	return [
		createExpensiveApiLimiter(),
		createUploadApiLimiter(),
		createSearchReadApiLimiter(),
		createObsidianApiLimiter(),
		createGeneralApiLimiter(),
	];
}
