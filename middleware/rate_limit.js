import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../modules/redis.js';
import config from '../config.js';
import { createLogger } from '../modules/logger.js';

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
]);

const EXPENSIVE_API_PATTERNS = [
	{ method: 'POST', pattern: /^\/urls\/[^/]+\/resync$/ },
	{ method: 'POST', pattern: /^\/git-repos\/[^/]+\/sync$/ },
	{ method: 'DELETE', pattern: /^\/trash\/[^/]+\/[^/]+$/ },
];

const UPLOAD_API_PATTERNS = [
	{ method: 'POST', pattern: /^\/notes\/import$/ },
	{ method: 'POST', pattern: /^\/settings\/white-label\/assets\/[^/]+$/ },
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

export function getClientIp(request) {
	return normalizeIp(
		request.headers?.['cf-connecting-ip'] ||
		request.headers?.['fastly-client-ip'] ||
		request.headers?.['true-client-ip'] ||
		request.headers?.['x-real-ip'] ||
		request.headers?.['x-forwarded-for'] ||
		request['ip'] ||
		request.connection?.remoteAddress ||
		request.socket?.remoteAddress ||
		'127.0.0.1'
	);
}

export function getRateLimitKey(request) {
	const basicAuthName = getBasicAuthName(request);
	if (basicAuthName) return `basic:${hashValue(basicAuthName)}`;

	const bearerToken = getBearerToken(request);
	if (bearerToken) return `bearer:${hashValue(bearerToken)}`;

	const accessToken = request.headers?.['x-access-token'] || request.headers?.['access-token'];
	if (accessToken) return `access:${hashValue(accessToken)}`;

	return `ip:${hashValue(getClientIp(request))}`;
}

function getRedisStore(prefix) {
	if (!config.socketRedis) return undefined;

	try {
		const redisClient = getRedisClient();
		if (!redisClient || typeof redisClient.call !== 'function') return undefined;

		return new RedisStore({
			sendCommand: (...args) => redisClient.call(...args),
			prefix: `rl:${prefix}:`,
		});
	} catch (err) {
		log.warn({ err, prefix }, 'API rate limit Redis store unavailable; using memory store');
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

export function shouldSkipCommon(request) {
	return request.method === 'OPTIONS' || isApiPing(request);
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
		store: getRedisStore(options.name),
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
			return shouldSkipCommon(request) || !isUploadApi(request);
		},
	});
}

export function createGeneralApiLimiter() {
	const rateLimitConfig = getConfig();
	return createLimiter({
		name: 'api-general',
		limit: rateLimitConfig.generalPerMinute,
		skip: function skipGeneral(request) {
			return shouldSkipCommon(request) || isSearchReadApi(request);
		},
	});
}

export function createApiLimiters() {
	return [
		createExpensiveApiLimiter(),
		createUploadApiLimiter(),
		createSearchReadApiLimiter(),
		createGeneralApiLimiter(),
	];
}

export function createApiLimiter() {
	return createGeneralApiLimiter();
}
