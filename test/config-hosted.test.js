import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isHostedAppUrl, isHostedHostname } from '../config.js';

describe('hosted environment detection', () => {
	it('treats production and local hosted app domains as hosted', () => {
		assert.equal(isHostedAppUrl('https://app.kumbukum.com'), true);
		assert.equal(isHostedAppUrl('https://eu.kumbukum.com'), true);
		assert.equal(isHostedAppUrl('http://app.kumbukum.local:3000'), true);
		assert.equal(isHostedHostname('app.kumbukum.local'), true);
	});

	it('does not treat generic local URLs as hosted', () => {
		assert.equal(isHostedAppUrl('http://localhost:3000'), false);
		assert.equal(isHostedAppUrl('http://127.0.0.1:3000'), false);
		assert.equal(isHostedAppUrl('http://kumbukum.local:3000'), false);
		assert.equal(isHostedAppUrl('not-a-url'), false);
	});
});
