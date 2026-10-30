import test from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';
import { accountWork } from '../modules/tenancy.js';
import { CrawlPublication } from '../model/crawl_publication.js';
import { CrawlState } from '../model/crawl_state.js';

test('collection setup cache avoids tenant writes, retries failures, and isolates hosts', async (t) => {
	const original = Typesense.Client;
	const acquire = accountWork.acquire;
	let locks = 0;
	let requests = 0;
	let fail = true;
	const names = new Set();
	accountWork.acquire = async () => { locks++; return async () => {}; };
	Typesense.Client = class {
		collections(name) { return { retrieve: async () => { requests++; if (!name) return [...names].map((name) => ({ name })); if (fail) throw new Error('offline'); names.add(name); return { fields: [] }; }, update: async () => {} }; }
	};
	t.after(() => { Typesense.Client = original; accountWork.acquire = acquire; });
	const ts = await import(`../modules/typesense.js?setup-audit=${Date.now()}`);
	await assert.rejects(ts.ensureCollections('one'), /offline/);
	fail = false;
	await Promise.all([ts.ensureCollections('one'), ts.ensureCollections('one')]);
	const previous = { locks, requests };
	await ts.ensureCollections('one');
	assert.equal(locks, previous.locks);
	assert.equal(requests, previous.requests + 1);
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
	const findPublications = CrawlPublication.find;
	CrawlPublication.find = () => ({ lean: async () => [] });
	t.after(() => { CrawlPublication.find = findPublications; });
	let query;
	Url.find = (filter) => { query = filter; return { sort() { return this; }, lean: async () => [] }; };
	t.after(() => { Url.find = original; });
	const { reindexDue } = await import('../modules/crawler.js');
	assert.equal(await reindexDue(), 0);
	assert.deepEqual(query.in_trash, { $ne: true });
	assert.equal(query.crawl_enabled, true);
});

test('publishing a trashed URL deletes only pages captured before claiming', async (t) => {
	const original = Typesense.Client;
	const acquire = accountWork.acquire;
	const deletes = [];
	const pages = new Set(['old-page']);
	accountWork.acquire = async () => async () => {};
	Typesense.Client = class { collections(name) { return {
		retrieve: async () => ({ fields: [] }), update: async () => {},
		documents: () => ({
			export: async () => [...pages].map((id) => JSON.stringify({ id })).join('\n'),
			search: async () => ({ hits: [] }),
			delete: async (params) => { deletes.push({ name, filter: params.filter_by }); if (params.filter_by === 'id:=[`old-page`]') pages.delete('old-page'); return {}; },
			import: async (docs) => docs.map(() => ({ success: true })),
		}),
	}; } };
	t.after(() => { Typesense.Client = original; accountWork.acquire = acquire; });
	const ts = await import(`../modules/typesense.js?trash-url-audit=${Date.now()}`);
	const model = { findOneAndUpdate: (_query, _update, options) => ({ select() { return this; }, lean: async () => { if (options.returnDocument === 'before') { pages.add('restored-new-page'); return {}; } return { _id: 'url' }; } }) };
	const result = await ts.publishClaimedDocuments('tenant', 'urls', model, [{ _id: 'url', in_trash: true, url: 'https://example.com', updatedAt: new Date() }]);
	assert.equal(result[0].success, true);
	assert.deepEqual([...pages], ['restored-new-page']);
	assert.ok(deletes.some((call) => call.name === ts.buildCollectionName('pages', 'tenant') && call.filter === 'id:=[`old-page`]'));
});

test('reindex fences in-flight setup and failed recreation cannot leave a cache hit', async (t) => {
	let release;
	let started;
	const ready = new Promise((resolve) => { started = resolve; });
	let requests = 0;
	let drops = 0;
	let blocked = true;
	let failCreate = true;
	const names = new Set();
	t.mock.method(accountWork, 'acquire', async () => async () => {});
	const original = Typesense.Client;
	Typesense.Client = class { collections(name) { return {
		retrieve: async () => { requests++; if (!name) return [...names].map((name) => ({ name })); names.add(name); if (blocked) { blocked = false; started(); await new Promise((resolve) => { release = resolve; }); } return { fields: [] }; },
		update: async () => {}, delete: async () => { drops++; },
		create: async () => { if (failCreate) throw new Error('rebuild offline'); },
	}; } };
	t.after(() => { Typesense.Client = original; });
	const ts = await import(`../modules/typesense.js?rebuild-audit=${Date.now()}`);
	const first = ts.ensureCollections('host');
	await ready;
	const second = ts.ensureCollections('host');
	const rebuilding = ts.reindexHost('host', { Note: {} });
	assert.equal(drops, 0);
	const during = ts.ensureCollections('host');
	const pending = Promise.allSettled([first, second, rebuilding, during]);
	release();
	for (const result of await pending) {
		assert.equal(result.status, 'rejected');
		assert.match(result.reason.message, /rebuild offline/);
	}
	const before = requests;
	failCreate = false;
	await Promise.all([ts.ensureCollections('host'), ts.ensureCollections('host')]);
	assert.equal(requests - before, before);
	const after = requests;
	await ts.ensureCollections('host');
	assert.equal(requests, after + 1);
});

test('a warm process repairs collections destroyed by another process', async (t) => {
 const original = Typesense.Client;
 const names = new Set();
 let creates = 0;
 t.mock.method(accountWork, 'acquire', async () => async () => {});
 Typesense.Client = class { collections(name) { return {
  retrieve: async () => { if (!name) return [...names].map((name) => ({ name })); if (!names.has(name)) throw { httpStatus: 404 }; return { fields: [] }; },
  create: async (schema) => { names.add(schema.name); creates++; }, update: async () => {},
 }; } };
 t.after(() => { Typesense.Client = original; });
 const first = await import(`../modules/typesense.js?process-first=${Date.now()}`);
 const second = await import(`../modules/typesense.js?process-second=${Date.now()}`);
 await first.ensureCollections('host');
 await second.ensureCollections('host');
 const before = creates;
 names.clear();
 await first.ensureCollections('host');
 assert.equal(creates, before * 2);
 await second.ensureCollections('host');
 assert.equal(creates, before * 2);
});

test('warm validation and subsequent callers wait for a superseding rebuild', async (t) => {
 const original = Typesense.Client;
 const names = new Set();
 let releaseProbe, probeStarted, releaseDrop, dropStarted;
 const probing = new Promise((resolve) => { probeStarted = resolve; });
 const dropping = new Promise((resolve) => { dropStarted = resolve; });
 let blockProbe = false;
 let blockDrop = true;
 t.mock.method(accountWork, 'acquire', async () => async () => {});
 Typesense.Client = class { collections(name) { return {
  retrieve: async () => { if (!name) { if (blockProbe) { blockProbe = false; probeStarted(); await new Promise((resolve) => { releaseProbe = resolve; }); return []; } return [...names].map((name) => ({ name })); } names.add(name); return { fields: [] }; },
  update: async () => {},
  delete: async () => { if (blockDrop) { blockDrop = false; dropStarted(); await new Promise((resolve) => { releaseDrop = resolve; }); } names.delete(name); },
  create: async (schema) => { names.add(schema.name); },
 }; } };
 t.after(() => { Typesense.Client = original; });
 const ts = await import(`../modules/typesense.js?warm-overlap=${Date.now()}`);
 await ts.ensureCollections('host');
 blockProbe = true;
 let settled = 0;
 const warm = ts.ensureCollections('host').then(() => { settled++; });
 await probing;
 const rebuild = ts.reindexHost('host', {});
 releaseProbe();
 await dropping;
 const next = ts.ensureCollections('host').then(() => { settled++; });
 await new Promise((resolve) => setImmediate(resolve));
 assert.equal(settled, 0);
 releaseDrop();
 await Promise.all([warm, next, rebuild]);
 assert.equal(settled, 2);
});
