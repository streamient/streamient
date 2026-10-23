import test from 'node:test';
import assert from 'node:assert/strict';
import { Email } from '../model/email.js';
import { migrateEmailMessageIdIndex } from '../scripts/migrate-email-message-id-index.mjs';

test('Message-ID uniqueness uses a supported nonempty tenant index', () => {
	const [key, options] = Email.schema.indexes().find(([, entry]) => entry.name === 'host_message_id_unique');
	assert.deepEqual(key, { host_id: 1, message_id: 1 });
	assert.equal(options.unique, true);
	assert.deepEqual(options.partialFilterExpression, { message_id: { $type: 'string', $gt: '' } });
});

test('index migration is dry by default and builds before dropping only global uniqueness', async () => {
	const calls = [];
	const collection = {
		listIndexes: () => ({ toArray: async () => [{ name: 'message_id_1', key: { message_id: 1 }, unique: true }, { name: 'other', key: { host_id: 1 } }] }),
		createIndex: async (...args) => calls.push(['create', ...args]),
		dropIndex: async (name) => calls.push(['drop', name]),
	};
	assert.deepEqual((await migrateEmailMessageIdIndex({ collection })).drop, ['message_id_1']);
	assert.equal(calls.length, 0);
	await migrateEmailMessageIdIndex({ apply: true, collection });
	assert.equal(calls[0][0], 'create');
	assert.deepEqual(calls[1], ['drop', 'message_id_1']);
	calls.length = 0;
	collection.createIndex = async () => { throw Object.assign(new Error('existing duplicates'), { code: 11000 }); };
	await assert.rejects(migrateEmailMessageIdIndex({ apply: true, collection }), /existing duplicates/);
	assert.deepEqual(calls, []);
});
