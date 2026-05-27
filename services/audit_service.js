import { AuditLog } from '../model/audit_log.js';

const SENSITIVE_KEYS = new Set([
    'password', 'token', 'secret', 'totp_secret', 'access_tokens', 'api_key',
    'openai_api_key', 'gemini_api_key', 'byo_ai',
    'stripe_customer_id', 'stripe_subscription_id', 'verification_token',
]);

const SKIP_DIFF_KEYS = new Set(['updatedAt', '__v', 'is_indexed']);

/**
 * Fire-and-forget audit log write. Never throws, never blocks.
 */
export function log(params) {
    AuditLog.create(params).catch((err) => {
        console.error('Audit log write error:', err.message);
    });
}

/**
 * Compute a shallow diff between two plain objects.
 * Returns { before: {...}, after: {...} } with only changed fields.
 */
export function diffSnapshot(before, after) {
    if (!before || !after) return null;

    const b = typeof before.toObject === 'function' ? before.toObject() : { ...before };
    const a = typeof after.toObject === 'function' ? after.toObject() : { ...after };

    const diff = { before: {}, after: {} };
    const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);

    for (const key of allKeys) {
        if (SKIP_DIFF_KEYS.has(key)) continue;
        if (key === '_id') continue;

        const bVal = mask(key, b[key]);
        const aVal = mask(key, a[key]);

        if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
            diff.before[key] = bVal;
            diff.after[key] = aVal;
        }
    }

    if (Object.keys(diff.before).length === 0) return null;
    return diff;
}

/**
 * Query audit logs with filters and pagination.
 */
export async function query({
    host_id,
    user_id,
    resource,
    action,
    channel,
    mcp_client,
    q,
    from,
    to,
    page = 1,
    per_page = 50,
} = {}) {
    const filter = {};

    if (host_id) filter.host_id = host_id;
    if (user_id) filter.user_id = user_id;
    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (channel) filter.channel = channel;
    if (mcp_client) filter.mcp_client = { $regex: mcp_client, $options: 'i' };

    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    if (q) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { resource_id: { $regex: escaped, $options: 'i' } },
            { token_label: { $regex: escaped, $options: 'i' } },
            { mcp_client: { $regex: escaped, $options: 'i' } },
        ];
    }

    const skip = (page - 1) * per_page;

    const [logs, total] = await Promise.all([
        AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(per_page)
            .lean(),
        AuditLog.countDocuments(filter),
    ]);

    return {
        logs,
        total,
        page,
        pages: Math.ceil(total / per_page),
    };
}

function mask(key, value) {
    if (SENSITIVE_KEYS.has(key)) return '[REDACTED]';
    return value;
}
