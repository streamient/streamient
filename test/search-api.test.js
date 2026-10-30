import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import router from '../routes/api.js';
import { SearchFilters } from '../modules/search_filters.js';
import { SearchResults } from '../modules/search_results.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Tenant } from '../modules/tenancy.js';
import { Email } from '../model/email.js';

class SearchApi {
	static async request(path, body = {}, context = {}) {
		const handler = router.stack.find((layer) => layer.route?.path === path).route.stack.at(-1).handle;
		const response = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
		await handler({ body, host_id: 'tenant-one', ...context }, response);
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

it('hosted Free search and counts exclude email while Pro, trials and self-hosted retain access', async () => {
	let plan = 'free';
	mock.method(Tenant, 'findOne', () => ({ select: () => ({ lean: async () => ({ plan }) }) }));
	for (const Model of [Note, Memory, Url, Email]) mock.method(Model, 'aggregate', async () => [{ _id: 'project-one', count: 1 }]);
	const seen = [];
	mock.method(SearchResults.prototype, 'list', async function () { seen.push(this.includeEmails); return { items: [], results: {}, total: 0 }; });
	for (const state of [
		{ plan: 'free', isHosted: true, expected: false },
		{ plan: 'pro', isHosted: true, expected: true },
		{ plan: 'free', isHosted: false, expected: true },
		{ plan: 'free', isHosted: true, billingUser: { subscription_status: 'trialing', trial_source: 'no_card', trial_ends_at: new Date(Date.now() + 86400000) }, expected: true },
		{ plan: 'free', isHosted: true, billingUser: { subscription_status: 'trialing', trial_source: 'no_card', trial_ends_at: new Date(0) }, expected: false },
	]) {
		plan = state.plan;
		for (const path of ['/search/quick', '/search/knowledge']) {
			await SearchApi.request(path, { query: 'type:note' }, state);
			assert.equal(seen.at(-1), state.expected);
		}
		const response = await SearchApi.request('/counts', {}, state);
		assert.equal(response.body['project-one'].emails || 0, Number(state.expected));
	}
});
