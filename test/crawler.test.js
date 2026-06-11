import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
	buildCrawlStateBulkOps,
	buildCrawledPageIndexDocs,
	bulkIndexCrawledPages,
	crawlSite,
	getCrawlStepLimit,
	getCrawledPageDocumentId,
	isHtmlResponse,
	shouldSkipCrawledUrl,
} from '../modules/crawler.js';

function makeUrlDoc(overrides = {}) {
	return {
		_id: '64f000000000000000000001',
		url: 'https://example.com',
		project: '64f000000000000000000002',
		owner: '64f000000000000000000003',
		host_id: 'host-1',
		crawl_partial: false,
		crawl_frontier: [],
		crawl_visited: [],
		...overrides,
	};
}

function sameId(left, right) {
	return String(left) === String(right);
}

function matchesFilter(state, filter) {
	return Object.entries(filter).every(([key, value]) => {
		if (key === 'parent_url_id') return sameId(state[key], value);
		return state[key] === value;
	});
}

function makeCrawlStateModel(initialStates = []) {
	const store = initialStates.map((state) => ({ ...state }));
	const model = {
		store,
		deleted: false,
		deletedFilters: [],
		async deleteMany(filter) {
			model.deleted = true;
			model.deletedFilters.push(filter);
			let deletedCount = 0;
			for (let i = store.length - 1; i >= 0; i--) {
				if (matchesFilter(store[i], filter)) {
					store.splice(i, 1);
					deletedCount++;
				}
			}
			return { deletedCount };
		},
		async countDocuments(filter) {
			return store.filter((state) => matchesFilter(state, filter)).length;
		},
		async distinct(field, filter) {
			return [...new Set(store.filter((state) => matchesFilter(state, filter)).map((state) => state[field]))];
		},
		find(filter) {
			return {
				sort() {
					return this;
				},
				limit(limit) {
					return {
						lean: async () => store.filter((state) => matchesFilter(state, filter)).slice(0, limit),
					};
				},
			};
		},
		async bulkWrite(ops) {
			for (const op of ops) {
				const { filter, update } = op.updateOne;
				let state = store.find((item) => matchesFilter(item, filter));
				if (!state) {
					state = { ...filter, ...(update.$setOnInsert || {}) };
					store.push(state);
				}
				if (update.$set) Object.assign(state, update.$set);
			}
			return { modifiedCount: ops.length };
		},
	};
	return model;
}

describe('crawler indexing and state', () => {
	it('uses 100 as the per-run crawl limit and disables Crawlee retries', async () => {
		assert.equal(getCrawlStepLimit({}), 100);

		const urlDoc = makeUrlDoc();
		const stateModel = makeCrawlStateModel();
		let crawlerOptions = null;
		const crawlerRuns = [];
		class FakeCrawler {
			constructor(options) {
				crawlerOptions = options;
			}
			async run(batch) {
				crawlerRuns.push(batch);
				for (const url of batch) {
					await crawlerOptions.requestHandler({
						request: { url, loadedUrl: url },
						response: { status: () => 200, headers: () => ({ 'content-type': 'text/html; charset=utf-8' }) },
						page: {
							title: async () => 'Home',
							evaluate: async () => 'Body text',
						},
						enqueueLinks: async () => {},
					});
				}
			}
		}

		await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: { updateOne: async () => {} },
			PlaywrightCrawler: FakeCrawler,
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async () => ({ indexedCount: 1, attemptedCount: 1, chunkCount: 1 }),
		});

		assert.equal(crawlerOptions.maxRequestsPerCrawl, 100);
		assert.equal(crawlerOptions.maxRequestRetries, 0);
		assert.deepEqual(crawlerRuns, [['https://example.com']]);
	});

	it('builds overlapping Typesense chunks for long crawled page bodies', () => {
		const text = Array.from({ length: 6200 }, (_, i) => String(i % 10)).join('');
		const urlId = 'url-1';
		const pageUrl = 'https://example.com/docs';
		const docs = buildCrawledPageIndexDocs({
			urlId,
			projectId: 'project-1',
			crawledAt: 123,
			pages: [{ url: pageUrl, title: 'Docs', text_content: text }],
		});
		const sourceId = getCrawledPageDocumentId(urlId, pageUrl);

		assert.equal(docs.length, 3);
		assert.deepEqual(docs.map((doc) => doc.id), [sourceId, `${sourceId}_chunk_1`, `${sourceId}_chunk_2`]);
		assert.ok(docs.every((doc) => doc.source_id === sourceId));
		assert.ok(docs.every((doc) => doc.parent_url_id === urlId));
		assert.ok(docs.every((doc) => doc.project_id === 'project-1'));
		assert.equal(docs[0].text_content, text.substring(0, 3000));
		assert.equal(docs[1].text_content, text.substring(2800, 5800));
		assert.equal(docs[2].text_content, text.substring(5600, 8600));
	});

	it('bulk indexes crawled pages by source id instead of per-page writes', async () => {
		const removeCalls = [];
		const importCalls = [];
		const result = await bulkIndexCrawledPages('host-1', {
			urlId: 'url-1',
			projectId: 'project-1',
			crawledAt: 123,
			pages: [
				{ url: 'https://example.com/a', title: 'A', text_content: 'alpha' },
				{ url: 'https://example.com/b', title: 'B', text_content: 'bravo' },
				{ url: 'https://example.com/c', title: 'C', text_content: 'charlie' },
			],
		}, {
			batchSize: 2,
			removeDocumentsBySourceIds: async (hostId, type, sourceIds) => {
				removeCalls.push({ hostId, type, sourceIds });
			},
			importDocuments: async (hostId, type, docs) => {
				importCalls.push({ hostId, type, docs });
				return docs.map(() => ({ success: true }));
			},
		});

		assert.equal(result.indexedCount, 3);
		assert.equal(removeCalls.length, 2);
		assert.equal(importCalls.length, 2);
		assert.equal(removeCalls[0].type, 'pages');
		assert.equal(removeCalls[0].sourceIds.length, 2);
		assert.equal(removeCalls[1].sourceIds.length, 1);
		assert.ok(importCalls.every((call) => call.type === 'pages'));
	});

	it('builds crawl-state bulk ops without parent crawl_frontier or crawl_visited arrays', () => {
		const urlDoc = makeUrlDoc();
		const queued = Array.from({ length: 3000 }, (_, i) => `https://example.com/page-${i}`);
		const ops = buildCrawlStateBulkOps(urlDoc, { queued });

		assert.equal(ops.length, 3000);
		assert.equal(ops[0].updateOne.filter.parent_url_id, urlDoc._id);
		assert.equal(ops[0].updateOne.update.$setOnInsert.status, 'queued');
		assert.equal(ops[0].updateOne.update.$setOnInsert.host_id, 'host-1');
		assert.equal(ops[0].updateOne.update.$setOnInsert.crawl_frontier, undefined);
		assert.equal(ops[0].updateOne.update.$setOnInsert.crawl_visited, undefined);
	});

	it('resumes partial crawls from queued crawl-state docs', async () => {
		const urlDoc = makeUrlDoc({ crawl_partial: true, crawl_frontier: ['https://legacy.example.com'] });
		const stateModel = makeCrawlStateModel([
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/start',
				url: 'https://example.com/start',
				status: 'queued',
			},
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/old',
				url: 'https://example.com/old',
				status: 'visited',
			},
		]);
		const urlUpdates = [];
		const crawlerRuns = [];
		class FakeCrawler {
			constructor(options) {
				this.options = options;
			}
			async run(batch) {
				crawlerRuns.push(batch);
				for (const url of batch) {
					await this.options.requestHandler({
						request: { url, loadedUrl: url },
						response: { status: () => 200, headers: () => ({ 'content-type': 'text/html; charset=utf-8' }) },
						page: {
							title: async () => 'Start',
							evaluate: async () => 'Body text',
						},
						enqueueLinks: async ({ transformRequestFunction }) => {
							transformRequestFunction({ url: 'https://example.com/next' });
							transformRequestFunction({ url: 'https://example.com/old' });
						},
					});
				}
			}
		}

		const indexed = await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: {
				updateOne: async (filter, update) => {
					urlUpdates.push({ filter, update });
				},
			},
			PlaywrightCrawler: FakeCrawler,
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async () => ({ indexedCount: 1, attemptedCount: 1, chunkCount: 1 }),
			stepLimit: 10,
		});

		assert.equal(indexed, 1);
		assert.equal(stateModel.deleted, false);
		assert.deepEqual(crawlerRuns, [['https://example.com/start']]);
		assert.ok(stateModel.store.some((state) => state.normalized_url === 'https://example.com/next' && state.status === 'queued'));
		assert.ok(stateModel.store.some((state) => state.normalized_url === 'https://example.com/start' && state.status === 'visited'));
		assert.equal(urlUpdates[0].update.$set.crawl_frontier.length, 0);
		assert.equal(urlUpdates[0].update.$set.crawl_visited.length, 0);
		assert.equal(urlUpdates[0].update.$set.crawl_partial, true);
	});

	it('skips binary URLs and non-HTML responses without page chunks', async () => {
		assert.equal(shouldSkipCrawledUrl('https://example.com/file.pdf'), true);
		assert.equal(shouldSkipCrawledUrl('mailto:test@example.com'), true);
		assert.equal(isHtmlResponse({ headers: () => ({ 'content-type': 'application/pdf' }) }), false);
		assert.equal(isHtmlResponse({ headers: () => ({ 'content-type': 'text/html' }) }), true);

		const urlDoc = makeUrlDoc({ url: 'https://example.com/file.pdf' });
		const stateModel = makeCrawlStateModel();
		let indexedPages = null;
		const indexed = await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: { updateOne: async () => {} },
			PlaywrightCrawler: class {
				async run() {
					throw new Error('Crawler should not run for skipped URL');
				}
			},
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async (hostId, input) => {
				indexedPages = input.pages;
				return { indexedCount: 0, attemptedCount: input.pages.length, chunkCount: 0 };
			},
			stepLimit: 10,
		});

		assert.equal(indexed, 0);
		assert.equal(indexedPages, null);
	});

	it('marks blocked responses failed without indexing page chunks', async () => {
		const urlDoc = makeUrlDoc({ url: 'https://example.com/private' });
		const stateModel = makeCrawlStateModel();
		let indexedPages = null;
		const indexed = await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: { updateOne: async () => {} },
			PlaywrightCrawler: class {
				constructor(options) {
					this.options = options;
				}
				async run(batch) {
					for (const url of batch) {
						await this.options.requestHandler({
							request: { url, loadedUrl: url },
							response: { status: () => 403, headers: () => ({ 'content-type': 'text/html' }) },
							page: {
								title: async () => 'Private',
								evaluate: async () => 'Should not be indexed',
							},
							enqueueLinks: async () => {},
						});
					}
				}
			},
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async (hostId, input) => {
				indexedPages = input.pages;
				return { indexedCount: 0, attemptedCount: input.pages.length, chunkCount: 0 };
			},
			stepLimit: 10,
		});

		assert.equal(indexed, 0);
		assert.deepEqual(indexedPages, []);
		assert.ok(stateModel.store.some((state) => state.normalized_url === 'https://example.com/private' && state.status === 'failed' && state.error === 'HTTP 403' && state.http_status === 403 && state.failure_type === 'denied'));
	});

	it('records blocked crawler errors with HTTP status metadata', async () => {
		const urlDoc = makeUrlDoc({ url: 'https://example.com/private' });
		const stateModel = makeCrawlStateModel();
		const indexed = await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: { updateOne: async () => {} },
			PlaywrightCrawler: class {
				constructor(options) {
					this.options = options;
				}
				async run(batch) {
					for (const url of batch) {
						this.options.failedRequestHandler({
							request: { url },
							error: new Error('Request blocked - received 403 status code.'),
						});
					}
				}
			},
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async (hostId, input) => ({ indexedCount: 0, attemptedCount: input.pages.length, chunkCount: 0 }),
			stepLimit: 10,
		});

		assert.equal(indexed, 0);
		assert.ok(stateModel.store.some((state) => state.normalized_url === 'https://example.com/private' && state.status === 'failed' && state.http_status === 403 && state.failure_type === 'denied'));
	});

	it('does not requeue terminal failed URLs discovered in later steps', async () => {
		const urlDoc = makeUrlDoc({ crawl_partial: true });
		const stateModel = makeCrawlStateModel([
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/start',
				url: 'https://example.com/start',
				status: 'queued',
			},
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/blocked',
				url: 'https://example.com/blocked',
				status: 'failed',
				error: 'HTTP 403',
				http_status: 403,
				failure_type: 'denied',
			},
		]);
		const transformResults = [];

		await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: { updateOne: async () => {} },
			PlaywrightCrawler: class {
				constructor(options) {
					this.options = options;
				}
				async run(batch) {
					for (const url of batch) {
						await this.options.requestHandler({
							request: { url, loadedUrl: url },
							response: { status: () => 200, headers: () => ({ 'content-type': 'text/html; charset=utf-8' }) },
							page: {
								title: async () => 'Start',
								evaluate: async () => 'Body text',
							},
							enqueueLinks: async ({ transformRequestFunction }) => {
								transformResults.push(transformRequestFunction({ url: 'https://example.com/blocked' }));
								transformResults.push(transformRequestFunction({ url: 'https://example.com/next' }));
							},
						});
					}
				}
			},
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async () => ({ indexedCount: 1, attemptedCount: 1, chunkCount: 1 }),
			stepLimit: 10,
		});

		assert.equal(transformResults[0], false);
		assert.equal(transformResults[1].url, 'https://example.com/next');
		assert.ok(stateModel.store.some((state) => state.normalized_url === 'https://example.com/blocked' && state.status === 'failed'));
		assert.ok(!stateModel.store.some((state) => state.normalized_url === 'https://example.com/blocked' && state.status === 'queued'));
		assert.ok(stateModel.store.some((state) => state.normalized_url === 'https://example.com/next' && state.status === 'queued'));
	});

	it('preserves failed states during scheduled recrawl resets', async () => {
		const urlDoc = makeUrlDoc({ crawl_partial: false });
		const stateModel = makeCrawlStateModel([
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/old-queued',
				url: 'https://example.com/old-queued',
				status: 'queued',
			},
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/old-visited',
				url: 'https://example.com/old-visited',
				status: 'visited',
			},
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/blocked',
				url: 'https://example.com/blocked',
				status: 'failed',
				error: 'HTTP 403',
				http_status: 403,
				failure_type: 'denied',
			},
		]);

		await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: { updateOne: async () => {} },
			PlaywrightCrawler: class {
				constructor(options) {
					this.options = options;
				}
				async run(batch) {
					for (const url of batch) {
						await this.options.requestHandler({
							request: { url, loadedUrl: url },
							response: { status: () => 200, headers: () => ({ 'content-type': 'text/html; charset=utf-8' }) },
							page: {
								title: async () => 'Home',
								evaluate: async () => 'Body text',
							},
							enqueueLinks: async () => {},
						});
					}
				}
			},
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async () => ({ indexedCount: 1, attemptedCount: 1, chunkCount: 1 }),
			stepLimit: 10,
		});

		assert.ok(stateModel.deletedFilters.some((filter) => filter.status === 'queued'));
		assert.ok(stateModel.deletedFilters.some((filter) => filter.status === 'visited'));
		assert.ok(!stateModel.deletedFilters.some((filter) => !filter.status));
		assert.ok(stateModel.store.some((state) => state.normalized_url === 'https://example.com/blocked' && state.status === 'failed'));
		assert.ok(!stateModel.store.some((state) => state.normalized_url === 'https://example.com/old-queued'));
		assert.ok(!stateModel.store.some((state) => state.normalized_url === 'https://example.com/old-visited'));
	});

	it('clears failed states on explicit manual reset', async () => {
		const urlDoc = makeUrlDoc({ crawl_partial: true });
		const stateModel = makeCrawlStateModel([
			{
				host_id: 'host-1',
				parent_url_id: urlDoc._id,
				normalized_url: 'https://example.com/blocked',
				url: 'https://example.com/blocked',
				status: 'failed',
				error: 'HTTP 403',
				http_status: 403,
				failure_type: 'denied',
			},
		]);

		await crawlSite(urlDoc, {
			CrawlState: stateModel,
			Url: { updateOne: async () => {} },
			PlaywrightCrawler: class {
				constructor(options) {
					this.options = options;
				}
				async run(batch) {
					for (const url of batch) {
						await this.options.requestHandler({
							request: { url, loadedUrl: url },
							response: { status: () => 200, headers: () => ({ 'content-type': 'text/html; charset=utf-8' }) },
							page: {
								title: async () => 'Home',
								evaluate: async () => 'Body text',
							},
							enqueueLinks: async () => {},
						});
					}
				}
			},
			ensureCollections: async () => {},
			bulkIndexCrawledPages: async () => ({ indexedCount: 1, attemptedCount: 1, chunkCount: 1 }),
			resetFailed: true,
			stepLimit: 10,
		});

		assert.ok(stateModel.deletedFilters.some((filter) => filter.host_id === 'host-1' && filter.parent_url_id === urlDoc._id && !filter.status));
		assert.ok(!stateModel.store.some((state) => state.normalized_url === 'https://example.com/blocked'));
		assert.ok(stateModel.store.some((state) => state.url === 'https://example.com' && state.status === 'visited'));
	});
});
