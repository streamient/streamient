import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import router from '../routes/api.js';
import { SearchFilters } from '../modules/search_filters.js';
import { SearchResults } from '../modules/search_results.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';

class SearchApi {
	static async request(path, body = {}) {
		const handler = router.stack.find((layer) => layer.route?.path === path).route.stack.at(-1).handle;
		const response = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
		await handler({ body, host_id: 'tenant-one' }, response);
		return response;
	}
}
afterEach(() => mock.restoreAll());

describe('search filter API routing', () => {
	it('routes quick and knowledge type-only requests through shared filtered search', async () => {
		const list = mock.method(SearchResults.prototype, 'list', async (input) => ({ filters: SearchFilters.parse(input), items: [], results: { notes: { found: 0, hits: [] } }, total: 0, page: 1, pages: 1 }));
		for (const path of ['/search/quick', '/search/knowledge']) {
			const result = await SearchApi.request(path, { query: 'type:note,memory tag:api', project_id: '507f1f77bcf86cd799439011' });
			assert.equal(result.statusCode, 200);
			assert.deepEqual(list.mock.calls.at(-1).arguments[0].types, ['memory', 'notes']);
			assert.equal(list.mock.calls.at(-1).arguments[0].query, '');
			assert.deepEqual(list.mock.calls.at(-1).arguments[0].tags, ['api']);
		}
		assert.equal((await SearchApi.request('/search/quick', { types: ['email'] })).statusCode, 200);
		assert.deepEqual(list.mock.calls.at(-1).arguments[0].types, ['emails']);
		assert.equal((await SearchApi.request('/search/quick', { query: 'type:' })).statusCode, 400);
		await assert.rejects(SearchApi.request('/search/knowledge', { query: 'type:unknown' }), { status: 400 });
	});
	it('intersects type-specific endpoints with requested types instead of expanding their scope', async () => {
		const list = mock.method(SearchResults.prototype, 'list', async (input, allowedTypes) => {
			assert.deepEqual(input.types, ['emails']);
			assert.equal(allowedTypes.length, 1);
			return { results: {}, page: 1 };
		});
		for (const [path, type] of [['/notes/search', 'notes'], ['/memories/search', 'memory'], ['/urls/search', 'urls']]) {
			const result = await SearchApi.request(path, { query: 'type:email' });
			assert.deepEqual(result.body.results, { found: 0, page: 1, hits: [] });
			assert.deepEqual(list.mock.calls.at(-1).arguments[1], [type]);
		}
	});
});

describe('project count API', () => {
	it('returns uncached tenant-scoped counts and exposes failures instead of empty success', async () => {
		for (const Model of [Note, Memory, Url, Email]) mock.method(Model, 'aggregate', async (pipeline) => {
			assert.deepEqual(pipeline[0], { $match: { host_id: 'tenant-one', in_trash: { $ne: true } } });
			return [{ _id: 'project-one', count: 7 }];
		});
		const result = await SearchApi.request('/counts');
		assert.equal(result.headers['Cache-Control'], 'no-store');
		assert.deepEqual(result.body['project-one'], { notes: 7, memory: 7, urls: 7, emails: 7 });
		mock.method(Note, 'aggregate', async () => { throw new Error('Database unavailable'); });
		const failure = await SearchApi.request('/counts');
		assert.equal(failure.statusCode, 500);
		assert.match(failure.body.error, /Unable to refresh/);
		assert.equal(failure.headers['Cache-Control'], 'no-store');
	});
});
