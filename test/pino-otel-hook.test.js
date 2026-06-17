import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildPinoOtelHooks } from '../modules/pino_otel_hook.js';

function callHook(inputArgs, level = 30) {
	const hooks = buildPinoOtelHooks('test');
	let received = null;
	hooks.logMethod(inputArgs, function(...args) {
		received = args;
	}, level);
	return received;
}

describe('Pino OTEL hook', () => {
	it('adds body to structured stdout records without removing the pino message', () => {
		const original = { failedCount: 2, type: 'emails' };
		const received = callHook([original, 'Kumbukum indexer: failures'], 50);

		assert.equal(received[0].body, 'Kumbukum indexer: failures');
		assert.equal(received[0].failedCount, 2);
		assert.equal(received[0].type, 'emails');
		assert.equal(received[1], 'Kumbukum indexer: failures');
		assert.equal(original.body, undefined);
	});

	it('adds body to string-only stdout records', () => {
		const received = callHook(['Worker %s', 'started']);

		assert.equal(received[0].body, 'Worker started');
		assert.equal(received[1], 'Worker %s');
		assert.equal(received[2], 'started');
	});

	it('does not overwrite explicit body fields', () => {
		const received = callHook([{ body: 'existing body', status: 200 }, 'Request complete']);

		assert.equal(received[0].body, 'existing body');
		assert.equal(received[1], 'Request complete');
	});
});
