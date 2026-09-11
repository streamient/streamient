import { it } from 'node:test';
import assert from 'node:assert/strict';
import { deleteConversationDataForHost, buildCollectionName, assertConversationCleanupOwnership } from '../modules/typesense.js';
import { getCache } from '../modules/cache.js';

const host = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const prefix = 'convo-' + host + '-';
function fixture(count) {
	let rows = [...Array.from({ length: count }, (_, i) => ({ id: 'owned-' + i, model_id: prefix + 'former' })), { id: 'other', model_id: 'convo-bbbbbbbbbbbbbbbbbbbbbbbb-user' }];
	const calls = [];
	const documents = {
		search: async (params) => { const owned = rows.filter((row) => row.model_id.startsWith(prefix)); return { found: owned.length, hits: owned.slice(0, params.per_page).map((document) => ({ document })) }; },
		delete: async ({ filter_by }) => {
			assert.match(filter_by, /^id:=\[/);
			const ids = filter_by.slice(5, -1).split(',');
			calls.push(ids);
			const before = rows.length;
			rows = rows.filter((row) => !ids.includes(row.id));
			return { num_deleted: before - rows.length };
		},
	};
	const collections = [{ name: buildCollectionName('emails', host) }];
	const client = { collections: (name) => name ? { documents: () => documents } : { retrieve: async () => collections }, conversations: () => ({ models: () => ({ retrieve: async () => [] }) }) };
	return { client, collections, calls, rows: () => rows };
}
it('deletes only verified conversation IDs, including former-member history', async (t) => {
	t.mock.method(getCache(), 'delete', async () => {});
	const state = fixture(3);
	await deleteConversationDataForHost(host, [], { client: state.client });
	assert.deepEqual(state.rows().map((row) => row.id), ['other']);
	assert.deepEqual(state.calls[0], ['owned-0', 'owned-1', 'owned-2']);
});
it('continues large histories in bounded batches', async (t) => {
	t.mock.method(getCache(), 'delete', async () => {});
	const state = fixture(1100);
	assert.deepEqual(await deleteConversationDataForHost(host, [], { client: state.client }), { pending: true });
	assert.equal(state.calls.length, 10);
	await deleteConversationDataForHost(host, [], { client: state.client });
	assert.deepEqual(state.rows().map((row) => row.id), ['other']);
});
it('blocks ambiguous cross-product conversation ownership before deleting anything', async () => {
	const state = fixture(1);
	state.collections.push({ name: (buildCollectionName('emails', host).startsWith('mt_') ? 'st_notes_' : 'mt_emails_') + host });
	await assert.rejects(assertConversationCleanupOwnership(host, { client: state.client }), { code: 'search_ownership_unknown' });
	assert.equal(state.calls.length, 0);
});
