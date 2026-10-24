import crypto from 'node:crypto';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const independentEndpoints = new Set(['/billing/webhook', '/oauth/token', '/oauth/register']);

export function browserCsrfProtection(req, res, next) {
	initializeToken(req, res);
	// API requests select their authentication method before the session-only check in requireAuth.
	if (req.path.startsWith('/api/v1/')) { req.csrfDeferred = true; return next(); }
	return csrfProtection(req, res, next);
}

function initializeToken(req, res) {
	if (!req.session) throw new Error('CSRF protection requires a session');
	if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
	res.locals.csrf_token = req.session.csrfToken;
}

export default function csrfProtection(req, res, next) {
	initializeToken(req, res);
	if (safeMethods.has(req.method) || independentEndpoints.has(req.path)) return next();
	const token = req.headers['x-csrf-token'] || req.body?._csrf;
	const expected = req.session.csrfToken;
	if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return res.status(403).json({ error: 'Your request could not be verified. Refresh the page and try again.', code: 'csrf_invalid' });
	if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed', code: 'csrf_origin' });
	// Browser-set and unforgeable; some navigations (e.g. OAuth consent opened from another site) send Origin: null.
	if (req.headers['sec-fetch-site'] === 'same-origin') return next();
	const source = req.headers.origin || req.headers.referer;
	if (source) {
		try {
			const origin = new URL(source);
			// Use the actual Host, never an untrusted forwarded host or a reflected client Origin. Custom domains work on their own host.
			if (!['http:', 'https:'].includes(origin.protocol) || origin.host.toLowerCase() !== String(req.headers.host || '').toLowerCase() || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) throw new Error('Origin mismatch');
		} catch { return res.status(403).json({ error: 'Cross-site requests are not allowed', code: 'csrf_origin' }); }
	}
	return next();
}
