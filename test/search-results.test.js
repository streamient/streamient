import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import pug from 'pug';
import { SearchFilters } from '../modules/search_filters.js';
import { SearchResults } from '../modules/search_results.js';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { processChat, processChatStream } from '../services/ai_chat_service.js';

const PROJECT = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439012';
const VERSION = '2026-09-16T12:00:00.000Z';

class Records {
	constructor(docs = []) { this.docs = docs; }
	matches(doc, query) {
		return Object.entries(query).every(([key, value]) => {
			if (value?.$ne !== undefined) return doc[key] !== value.$ne;
			if (value?.$all) return value.$all.every((tag) => doc[key]?.includes(tag));
			if (value?.$in) return value.$in.includes(String(doc[key]));
			return String(doc[key]) === String(value);
		});
	}
	find(query) {
		let result = this.docs.filter((doc) => this.matches(doc, query));
		const cursor = { select: () => cursor, sort: () => cursor, skip: (n) => { result = result.slice(n); return cursor; }, limit: (n) => { result = result.slice(0, n); return cursor; }, lean: async () => result };
		return cursor;
	}
	findOne(query) { return { lean: async () => this.docs.find((doc) => this.matches(doc, query)) || null }; }
	async countDocuments(query) { return this.docs.filter((doc) => this.matches(doc, query)).length; }
	static record(index, extra = {}) { return { _id: index.toString(16).padStart(24, '0'), host_id: 'tenant-one', project: PROJECT, title: 'Record ' + index, tags: ['typerelay', 'api'], updatedAt: VERSION, ...extra }; }
	static search(docs) {
		return new SearchResults('tenant-one', { models: { notes: new Records(docs), memory: new Records(), urls: new Records() }, secret: 'test-secret', search: async () => { throw new Error('Tag-only search must not require the index'); } });
	}
}

afterEach(() => mock.restoreAll());

describe('exact search filters', () => {
	it('requires membership, allows extra tags, and deduplicates typed and picker tags', () => {
		const filters = SearchFilters.parse({ query: 'tag:typerelay tag:"public api"', tags: ['typerelay'], project_id: PROJECT });
		assert.deepEqual(filters.tags, ['public api', 'typerelay']);
		assert.equal(filters.query, '');
		assert.deepEqual(SearchFilters.mongo('tenant-one', filters).tags, { $all: ['public api', 'typerelay'] });
	});
	it('rejects malformed syntax, filter injection, and wrong tag types', () => {
		assert.throws(() => SearchFilters.parse({ query: 'tag:"unfinished' }), /Complete the tag/);
		assert.throws(() => SearchFilters.parse({ project_id: 'id || true' }), /Invalid project/);
		assert.throws(() => SearchFilters.parse({ tags: 'typerelay' }), /array/);
		assert.equal(SearchFilters.typesense(SearchFilters.parse({ tags: ['a` || project_id:*'] })), 'tags:=`a\\` || project_id:*`');
	});
	it('extracts the reported AI request deterministically without consuming its tag as text', () => {
		const intent = SearchFilters.intent('show me all the records with the tag "typerelay"');
		assert.deepEqual(intent.tags, ['typerelay']);
		assert.equal(intent.query, '');
		assert.equal(SearchFilters.intent('move all records with tag typerelay to project typerelay'), null);
	});
});

describe('search selection and bulk actions', () => {
	it('keeps distinct typed records and reports unsupported types individually', async () => {
		const doc = Records.record(1);
		const models = { notes: new Records([doc]), memory: new Records([doc]), urls: new Records([doc]) };
		const search = new SearchResults('tenant-one', { models, secret: 'test-secret' });
		const filters = { tags: ['typerelay'] };
		const items = await search.selection(filters);
		assert.equal(items.length, 3);
		assert.equal(new Set(items.map((item) => item.type + ':' + item.id)).size, 3);
		for (const type of ['notes', 'memory', 'urls']) mock.method(SearchResults.operations[type], 'trash', async () => ({ ...doc, in_trash: true }));
		items.push(search.row('pages', { id: 'read-only-page', title: 'Crawled page', crawled_at: 1 }, filters));
		const outcomes = await search.apply({ filters, items, action: 'trash' });
		assert.equal(outcomes.filter((outcome) => outcome.success).length, 3);
		assert.match(outcomes[3].error, /unavailable for this record type/);
	});

	it('enforces the selected version atomically inside existing update and trash operations', async () => {
		for (const [type, Model] of [['notes', Note], ['memory', Memory], ['urls', Url], ['emails', Email]]) {
			mock.method(Model, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
			const mutation = mock.method(Model, 'findOneAndUpdate', async (filter) => {
				assert.equal(filter.host_id, 'tenant-one');
				assert.equal(filter.updatedAt.toISOString(), VERSION);
				assert.deepEqual(filter.in_trash, { $ne: true });
				return null;
			});
			await SearchResults.operations[type].update('tenant-one', PROJECT, { project: OTHER }, { expected_updated_at: VERSION });
			await SearchResults.operations[type].trash('tenant-one', PROJECT, { expected_updated_at: VERSION });
			assert.equal(mutation.mock.callCount(), 2);
		}
	});
	it('finds all tagged records across pages, excluding other projects, tenants, trash and body mentions', async () => {
		const docs = Array.from({ length: 115 }, (_, i) => Records.record(i + 1));
		docs.push(Records.record(120, { tags: ['other'], text_content: 'typerelay' }), Records.record(121, { project: OTHER }), Records.record(122, { host_id: 'other-tenant' }), Records.record(123, { in_trash: true }));
		const search = Records.search(docs);
		const input = { query: 'tag:typerelay', project_id: PROJECT, per_page: 10 };
		const first = await search.list(input);
		assert.equal(first.total, 115);
		assert.equal(first.items.length, 10);
		assert.equal(first.pages, 12);
		const second = await search.list({ ...input, page: 2 });
		assert.notEqual(first.items[0].id, second.items[0].id);
		const all = await search.selection(input);
		assert.equal(all.length, 115);
		assert.equal(new Set(all.map((item) => item.id)).size, 115);
		assert.ok(all.every((item) => item.ticket && item.version === VERSION));
	});
	it('does not match tags by substring; multiple filters intersect', async () => {
		const search = Records.search([Records.record(1), Records.record(2, { tags: ['typerelay-other', 'api'] }), Records.record(3, { tags: ['typerelay', 'other'] })]);
		assert.equal((await search.list({ tags: ['typerelay', 'api'] })).total, 1);
		assert.equal((await search.list({ tags: ['missing'] })).total, 0);
	});
	it('rejects modified tickets, changed scope, stale versions, and cross-tenant replay', async () => {
		const doc = Records.record(1);
		const search = Records.search([doc]);
		const filters = { tags: ['typerelay'], project_id: PROJECT };
		const item = (await search.list(filters)).items[0];
		const update = mock.method(SearchResults.operations.notes, 'update', async () => { throw new Error('Must not mutate'); });
		for (const request of [{ items: [{ ...item, id: OTHER }], filters }, { items: [item], filters: { tags: ['typerelay'] } }]) {
			const [outcome] = await search.apply({ ...request, action: 'add_tags', tags: ['test'] });
			assert.equal(outcome.success, false);
		}
		doc.updatedAt = '2026-09-16T12:01:00.000Z';
		assert.match((await search.apply({ filters, items: [item], action: 'add_tags', tags: ['test'] }))[0].error, /changed/);
		search.hostId = 'other-tenant';
		assert.equal((await search.apply({ filters, items: [item], action: 'add_tags', tags: ['test'] }))[0].success, false);
		assert.equal(update.mock.callCount(), 0);
	});
	it('uses existing operations once, preserves other tags, and removes rows leaving the filter', async () => {
		const doc = Records.record(1);
		const search = Records.search([doc]);
		const filters = { tags: ['typerelay'], project_id: PROJECT };
		const item = (await search.list(filters)).items[0];
		const update = mock.method(SearchResults.operations.notes, 'update', async (host, id, data, ctx) => {
			assert.equal(ctx.expected_updated_at, VERSION);
			assert.deepEqual(data.tags, ['api']);
			return { ...doc, ...data, updatedAt: '2026-09-16T12:01:00.000Z' };
		});
		const outcomes = await search.apply({ filters, items: [item, item], action: 'remove_tags', tags: ['typerelay'] });
		assert.equal(update.mock.callCount(), 1);
		assert.equal(outcomes.length, 1);
		assert.equal(outcomes[0].removed, true);
	});
	it('rejects inaccessible destinations before writing any record', async () => {
		const search = Records.search([Records.record(1)]);
		mock.method(Project, 'findOne', (filter) => {
			assert.equal(filter.host_id, 'tenant-one');
			return { select: () => ({ lean: async () => null }) };
		});
		const items = (await search.list({ tags: ['typerelay'] })).items;
		await assert.rejects(search.apply({ filters: { tags: ['typerelay'] }, items, action: 'move', project_id: OTHER }), /Destination/);
	});

	it('validates the entire batch before applying any mutation', async () => {
		const search = Records.search([Records.record(1)]);
		const item = (await search.list({ tags: ['typerelay'] })).items[0];
		const trash = mock.method(SearchResults.operations.notes, 'trash', async () => { throw new Error('Must not mutate'); });
		await assert.rejects(search.apply({ filters: { tags: ['typerelay'] }, items: [item, null], action: 'trash' }), /Every selection/);
		assert.equal(trash.mock.callCount(), 0);
	});
	it('reports partial failures without losing successful outcomes', async () => {
		const docs = [Records.record(1), Records.record(2)];
		const search = Records.search(docs);
		mock.method(SearchResults.operations.notes, 'trash', async (host, id) => {
			if (id === docs[1]._id) throw new Error('Protected record');
			return { ...docs[0], in_trash: true };
		});
		const items = (await search.list({ tags: ['typerelay'] })).items;
		const outcomes = await search.apply({ filters: { tags: ['typerelay'] }, items, action: 'trash' });
		assert.equal(outcomes[0].success, true);
		assert.equal(outcomes[1].error, 'Protected record');
	});
	it('renders safe Pug rows with stable identities and selectable controls', () => {
		const item = Records.search([]).row('notes', Records.record(1, { title: '<script>bad()</script>' }), {});
		const html = pug.renderFile(new URL('../views/ajax/search_rows.pug', import.meta.url).pathname, { items: [item] });
		assert.match(html, /data-search-key="notes:/);
		assert.match(html, /search-select/);
		assert.ok(!html.includes('<script>'));
	});
});

describe('AI exact-tag routing', () => {
	it('preserves project boundaries in both transports despite prior conversation context', async () => {
		const calls = [];
		mock.method(SearchResults.prototype, 'list', async (input) => { calls.push(input); return { total: 42, items: [] }; });
		const input = { hostId: 'tenant-one', userId: 'user-one', query: 'show me all the records with the tag "typerelay"', projectId: PROJECT, conversationId: 'old-mailtwine-conversation' };
		const result = await processChat(input);
		const stream = await processChatStream(input);
		assert.equal(result.searchFilters.project_id, PROJECT);
		assert.equal(stream.metadata.searchFilters.project_id, PROJECT);
		assert.deepEqual(calls.map((call) => call.tags), [['typerelay'], ['typerelay']]);
		assert.ok(calls.every((call) => call.query === '' && call.project_id === PROJECT));
		assert.equal(result.conversationId, null);
	});
});
