import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { HOST_SCOPED_MODELS } from '../services/account_cleanup_service.js';

it('covers every host-scoped Mongoose model in the deletion inventory', async () => {
	const inventoried = new Set(Object.values(HOST_SCOPED_MODELS));
	const directory = new URL('../model/', import.meta.url);
	for (const file of await readdir(directory)) {
		if (!file.endsWith('.js') || file === 'mongoose.js') continue;
		for (const value of Object.values(await import(new URL(file, directory)))) {
			if (!value?.schema?.path?.('host_id') || ['User', 'Tenant'].includes(value.modelName)) continue;
			assert.ok(inventoried.has(value), `Account deletion omits ${value.modelName}`);
		}
	}
});
