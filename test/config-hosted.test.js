import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isHostedAppUrl, isHostedHostname } from '../config.js';

describe('hosted environment detection', () => {
	it('treats production and the app.k.lan hosted dev domain as hosted', () => {
		assert.equal(isHostedAppUrl('https://app.kumbukum.com'), true);
		assert.equal(isHostedAppUrl('https://eu.kumbukum.com'), true);
		assert.equal(isHostedAppUrl('http://app.kumbukum.local:3000'), true);
		assert.equal(isHostedHostname('app.kumbukum.local'), true);
		// Local hosted-edition dev host.
		assert.equal(isHostedAppUrl('http://app.k.lan'), true);
		assert.equal(isHostedHostname('app.k.lan'), true);
	});

	it('treats bare k.lan / mcp.k.lan and generic local URLs as NOT hosted (plain dev)', () => {
		assert.equal(isHostedAppUrl('http://k.lan'), false);
		assert.equal(isHostedHostname('k.lan'), false);
		assert.equal(isHostedHostname('mcp.k.lan'), false);
		assert.equal(isHostedAppUrl('http://localhost:3000'), false);
		assert.equal(isHostedAppUrl('http://127.0.0.1:3000'), false);
		assert.equal(isHostedAppUrl('http://kumbukum.local:3000'), false);
		assert.equal(isHostedAppUrl('not-a-url'), false);
	});
});
