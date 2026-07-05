import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isHostedAppUrl, isHostedHostname } from '../config.js';

describe('hosted environment detection', () => {
	it('treats production and the app.s.lan hosted dev domain as hosted', () => {
		assert.equal(isHostedAppUrl('https://app.streamient.com'), true);
		assert.equal(isHostedAppUrl('https://eu.streamient.com'), true);
		assert.equal(isHostedAppUrl('http://app.streamient.local:3000'), true);
		assert.equal(isHostedHostname('app.streamient.local'), true);
		// Local hosted-edition dev host.
		assert.equal(isHostedAppUrl('http://app.s.lan'), true);
		assert.equal(isHostedHostname('app.s.lan'), true);
	});

	it('treats bare s.lan / mcp.s.lan and generic local URLs as NOT hosted (plain dev)', () => {
		assert.equal(isHostedAppUrl('http://s.lan'), false);
		assert.equal(isHostedHostname('s.lan'), false);
		assert.equal(isHostedHostname('mcp.s.lan'), false);
		assert.equal(isHostedAppUrl('http://localhost:3000'), false);
		assert.equal(isHostedAppUrl('http://127.0.0.1:3000'), false);
		assert.equal(isHostedAppUrl('http://streamient.local:3000'), false);
		assert.equal(isHostedAppUrl('not-a-url'), false);
	});
});
