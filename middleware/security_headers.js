const CONTENT_SECURITY_POLICY = "frame-ancestors 'none'";

export default function securityHeaders(_req, res, next) {
	res.set({
		'Content-Security-Policy': process.env.NODE_ENV === 'production' ? `${CONTENT_SECURITY_POLICY}; upgrade-insecure-requests` : CONTENT_SECURITY_POLICY,
		'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
		'Referrer-Policy': 'same-origin',
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '0',
	});
	next();
}
