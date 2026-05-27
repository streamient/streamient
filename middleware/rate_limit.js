import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../modules/redis.js';
import { Tenant } from '../modules/tenancy.js';
import config from '../config.js';

const PLANS = config.plans;

// Cache tenant plan in memory for the duration of the request to avoid
// multiple DB lookups when several limiters run on the same request.
async function getTenantPlan(req) {
    if (req._tenantPlan) return req._tenantPlan;
    const tenant = await Tenant.findOne({ host_id: req.host_id }).select('plan').lean();
    req._tenantPlan = tenant?.plan || 'free';
    return req._tenantPlan;
}

function isUnlimited(plan) {
    return plan === 'pro' || plan === 'free';
}

function makeRedisStore(prefix) {
    const client = getRedisClient();
    return new RedisStore({
        sendCommand: (...args) => client.call(...args),
        prefix: `rl:${prefix}:`,
    });
}

function makeRateLimitStore(prefix) {
    if (!config.socketRedis) return undefined;
    return makeRedisStore(prefix);
}

/**
 * General API rate limiter — 1-minute sliding window.
 * Starter: 60 req/min. Pro & free (self-hosted): unlimited (skipped).
 */
export function createApiLimiter() {
    return rateLimit({
        windowMs: 60 * 1000,
        limit: async (req) => {
            const plan = await getTenantPlan(req);
            return PLANS[plan]?.apiRpm || 0;
        },
        skip: async (req) => {
            const plan = await getTenantPlan(req);
            return isUnlimited(plan);
        },
        keyGenerator: (req) => req.host_id,
        store: makeRateLimitStore('api'),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Rate limit exceeded. Upgrade to Pro for unlimited access.' },
    });
}

/**
 * AI Chat rate limiter — 24-hour sliding window.
 * Starter: 50 req/day. Pro & free (self-hosted): unlimited (skipped).
 */
export function createChatLimiter() {
    return rateLimit({
        windowMs: 24 * 60 * 60 * 1000,
        limit: async (req) => {
            const plan = await getTenantPlan(req);
            return PLANS[plan]?.chatDaily || 0;
        },
        skip: async (req) => {
            const plan = await getTenantPlan(req);
            return isUnlimited(plan);
        },
        keyGenerator: (req) => req.host_id,
        store: makeRateLimitStore('chat'),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Daily AI chat limit reached. Upgrade to Pro for unlimited access.' },
    });
}

/**
 * MCP rate limiter — 1-minute sliding window.
 * Starter: 120 req/min. Pro & free (self-hosted): unlimited (skipped).
 */
export function createMcpLimiter() {
    return rateLimit({
        windowMs: 60 * 1000,
        limit: async (req) => {
            const plan = await getTenantPlan(req);
            return PLANS[plan]?.mcpRpm || 0;
        },
        skip: async (req) => {
            const plan = await getTenantPlan(req);
            return isUnlimited(plan);
        },
        keyGenerator: (req) => req.host_id,
        store: makeRateLimitStore('mcp'),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'MCP rate limit exceeded. Upgrade to Pro for unlimited access.' },
    });
}
