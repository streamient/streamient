import test from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';
import { accountWork } from '../modules/tenancy.js';
import { CrawlState } from '../model/crawl_state.js';

test('collection setup cache avoids tenant writes, retries failures, and isolates hosts', async (t) => {
	const original = Typesense.Client;
	const acquire = accountWork.acquire;
	let locks = 0;
	let requests = 0;
	let fail = true;
	accountWork.acquire = async () => { locks++; return async () => {}; };
	Typesense.Client = class {
		collections() { return { retrieve: async () => { requests++; if (fail) throw new Error('offline'); return { fields: [] }; }, update: async () => {} }; }
	};
	t.after(() => { Typesense.Client = original; accountWork.acquire = acquire; });
	const ts = await import(`../modules/typesense.js?setup-audit=${Date.now()}`);
	await assert.rejects(ts.ensureCollections('one'), /offline/);
	fail = false;
	await Promise.all([ts.ensureCollections('one'), ts.ensureCollections('one')]);
	const previous = { locks, requests };
	await ts.ensureCollections('one');
	assert.deepEqual({ locks, requests }, previous);
	await ts.ensureCollections('two');
	assert.ok(locks > previous.locks);
});

test('URL purge deletes crawled search pages and crawl state with tenant scope', async (t) => {
	const original = Typesense.Client;
	const remove = CrawlState.deleteMany;
	const calls = [];
	Typesense.Client = class { collections(name) { return { documents: () => ({ delete: async (params) => { calls.push({ name, params }); return {}; } }) }; } };
	CrawlState.deleteMany = async (filter) => { calls.push(filter); };
	t.after(() => { Typesense.Client = original; CrawlState.deleteMany = remove; });
	const ts = await import(`../modules/typesense.js?purge-audit=${Date.now()}`);
	await ts.removeDocumentsBySourceIds('tenant', 'urls', ['64f000000000000000000001']);
	assert.equal(calls[0].name, ts.buildCollectionName('pages', 'tenant'));
	assert.equal(calls[0].params.filter_by, 'parent_url_id:=[`64f000000000000000000001`]');
	assert.deepEqual(calls[1], { host_id: 'tenant', parent_url_id: { $in: ['64f000000000000000000001'] } });
	assert.equal(calls[2].name, ts.buildCollectionName('urls', 'tenant'));
});

test('scheduled crawling excludes trashed URLs', async (t) => {
	const { Url } = await import('../model/url.js');
	const original = Url.find;
	let query;
	Url.find = (filter) => { query = filter; return { sort() { return this; }, lean: async () => [] }; };
	t.after(() => { Url.find = original; });
	const { reindexDue } = await import('../modules/crawler.js');
	assert.equal(await reindexDue(), 0);
	assert.deepEqual(query.in_trash, { $ne: true });
	assert.equal(query.crawl_enabled, true);
});

test('publishing a trashed URL removes all its crawled pages', async (t) => {
	const original = Typesense.Client;
	const acquire = accountWork.acquire;
	const deletes = [];
	accountWork.acquire = async () => async () => {};
	Typesense.Client = class { collections(name) { return {
		retrieve: async () => ({ fields: [] }), update: async () => {},
		documents: () => ({
			search: async () => ({ hits: [] }),
			delete: async (params) => { deletes.push({ name, filter: params.filter_by }); return {}; },
			import: async (docs) => docs.map(() => ({ success: true })),
		}),
	}; } };
	t.after(() => { Typesense.Client = original; accountWork.acquire = acquire; });
	const ts = await import(`../modules/typesense.js?trash-url-audit=${Date.now()}`);
	const model = { findOneAndUpdate: (_query, _update, options) => ({ select() { return this; }, lean: async () => options.returnDocument === 'before' ? {} : { _id: 'url' } }) };
	const result = await ts.publishClaimedDocuments('tenant', 'urls', model, [{ _id: 'url', in_trash: true, url: 'https://example.com', updatedAt: new Date() }]);
	assert.equal(result[0].success, true);
	assert.ok(deletes.some((call) => call.name === ts.buildCollectionName('pages', 'tenant') && call.filter === 'parent_url_id:=[`url`]'));
});
