import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it } from 'node:test';

import securityHeaders from '../middleware/security_headers.js';

const originalNodeEnv = process.env.NODE_ENV;

function applyHeaders(nodeEnv) {
	process.env.NODE_ENV = nodeEnv;
	const headers = {};
	let nextCalled = false;
	securityHeaders({}, { set: (values) => Object.assign(headers, values) }, () => { nextCalled = true; });
	return { headers, nextCalled };
}

afterEach(() => {
	if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = originalNodeEnv;
});

describe('security headers', () => {
	it('prevents framing and disables unnecessary browser capabilities by default', () => {
		const { headers, nextCalled } = applyHeaders('development');

		assert.equal(headers['Content-Security-Policy'], "frame-ancestors 'none'");
		assert.equal(headers['X-Frame-Options'], 'DENY');
		assert.equal(headers['X-Content-Type-Options'], 'nosniff');
		assert.equal(headers['X-XSS-Protection'], '0');
		assert.equal(headers['Referrer-Policy'], 'same-origin');
		assert.equal(headers['Permissions-Policy'], 'camera=(), geolocation=(), microphone=()');
		assert.equal(nextCalled, true);
	});

	it('upgrades insecure subresources only in production', () => {
		assert.equal(applyHeaders('production').headers['Content-Security-Policy'], "frame-ancestors 'none'; upgrade-insecure-requests");
		assert.equal(applyHeaders('test').headers['Content-Security-Policy'], "frame-ancestors 'none'");
	});

	it('mounts globally before the health route and removes Express fingerprinting', () => {
		const appSource = readFileSync(fileURLToPath(new URL('../app.js', import.meta.url)), 'utf8');
		const securityIndex = appSource.indexOf('app.use(securityHeaders)');
		const healthIndex = appSource.indexOf("app.use('/health', healthRoutes)");

		assert.match(appSource, /app\.disable\('x-powered-by'\)/);
		assert.ok(securityIndex > 0 && healthIndex > securityIndex);
	});

	it('keeps frame protection centralized outside OAuth routes', () => {
		const oauthSource = readFileSync(fileURLToPath(new URL('../routes/oauth.js', import.meta.url)), 'utf8');

		assert.doesNotMatch(oauthSource, /denyFraming|X-Frame-Options|frame-ancestors/);
	});
});
