import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCrawledPages, cleanupCrawlPublications, bulkIndexCrawledPages } from '../modules/crawler.js';
import { publicationStore } from './helpers/crawl-publication.js';

function fixture() {
	const model = publicationStore();
	const parent = { _id: 'url', host_id: 'host', crawl_claim: null, crawl_claim_expires_at: null };
	const chunks = new Map();
	const matches = (query) => !parent.in_trash && (!query.crawl_claim || parent.crawl_claim === query.crawl_claim) && (!query.crawl_claim_expires_at || parent.crawl_claim_expires_at > query.crawl_claim_expires_at.$gt) && (!query.$or || !parent.crawl_claim || parent.crawl_claim_expires_at <= new Date());
	const deps = {
		CrawlPublication: model,
		Url: {
			findOneAndUpdate: (query, update) => ({ lean: async () => { if (!matches(query)) return null; Object.assign(parent, update.$set); return { ...parent }; } }),
			updateOne: async (query, update) => { if (parent.crawl_claim === query.crawl_claim) Object.assign(parent, update.$set); },
		},
		removeDocumentsByIds: async (_host, _type, ids) => { for (const id of ids) chunks.delete(id); },
		removeCrawledPages: async (_host, _ids, { claim }) => { for (const [id, token] of chunks) if (token === claim) chunks.delete(id); },
	};
	return { model, parent, chunks, deps };
}

for (const failure of ['later batch', 'final parent check']) test(`partial import cleanup survives ${failure} and failed deletion`, async () => {
	const { model, parent, chunks, deps } = fixture();
	const remove = deps.removeCrawledPages;
	deps.removeCrawledPages = async () => { throw new Error('search offline'); };
	deps.bulkIndexCrawledPages = async (_host, input) => {
		await input.beforeImport([]);
		chunks.set(input.claim, input.claim);
		if (failure === 'later batch') throw new Error('batch failed');
		parent.in_trash = true;
		return { indexedCount: 1, attemptedCount: 1 };
	};
	await assert.rejects(publishCrawledPages(parent, {}, deps), /batch failed|lost ownership/);
	assert.equal(chunks.size, 1);
	assert.equal(model.rows.size, 1);
	deps.removeCrawledPages = remove;
	await cleanupCrawlPublications(deps);
	assert.equal(chunks.size, 0);
	assert.equal(model.rows.size, 0);
});

test('parent ownership excludes an overlapping publisher; replacement preserves newer chunks', async () => {
	const { parent, chunks, deps } = fixture();
	let unblock;
	let entered;
	const ready = new Promise((resolve) => { entered = resolve; });
	deps.bulkIndexCrawledPages = async (_host, input) => {
		await input.beforeImport([...chunks.keys()]);
		await deps.removeDocumentsByIds('host', 'pages', [...chunks.keys()]);
		chunks.set(input.claim, input.claim);
		entered();
		await new Promise((resolve) => { unblock = resolve; });
		return { indexedCount: 1, attemptedCount: 1 };
	};
	const first = publishCrawledPages(parent, {}, deps);
	await ready;
	assert.equal(await publishCrawledPages(parent, {}, deps), null);
	unblock();
	await first;
	assert.equal(chunks.size, 1);
});

test('expired publisher cannot delete a newer claim; crash tombstone catches late imports', async () => {
	const { model, parent, chunks, deps } = fixture();
	let unblock;
	let entered;
	const ready = new Promise((resolve) => { entered = resolve; });
	let oldToken;
	deps.bulkIndexCrawledPages = async (_host, input) => {
		oldToken = input.claim;
		await input.beforeImport([]);
		entered();
		await new Promise((resolve) => { unblock = resolve; });
		chunks.set('late-old', input.claim);
		return { indexedCount: 1, attemptedCount: 1 };
	};
	const first = publishCrawledPages(parent, {}, deps);
	await ready;
	parent.crawl_claim_expires_at = new Date(0);
	model.rows.get(oldToken).expires_at = new Date(0);
	await cleanupCrawlPublications(deps);
	assert.equal(model.rows.size, 1);
	await publishCrawledPages(parent, {}, { ...deps, bulkIndexCrawledPages: async (_host, input) => { await input.beforeImport([]); chunks.set('new', input.claim); return { indexedCount: 1, attemptedCount: 1 }; } });
	unblock();
	await assert.rejects(first, /lost ownership/);
	assert.deepEqual([...chunks.keys()], ['new']);
});


test('real batch loop removes an earlier successful import when a later batch throws', async () => {
	const { parent, chunks, deps } = fixture();
	let batches = 0;
	deps.bulkIndexCrawledPages = (host, input) => bulkIndexCrawledPages(host, input, {
		batchSize: 1,
		captureCrawledPageIds: async () => [],
		removeDocumentsByIds: deps.removeDocumentsByIds,
		importDocuments: async (_host, _type, docs) => {
			if (++batches === 2) throw new Error('second batch failed');
			for (const doc of docs) chunks.set(doc.id, doc.claim);
			return docs.map(() => ({ success: true }));
		},
	});
	await assert.rejects(publishCrawledPages(parent, { urlId: 'url', projectId: 'project', crawledAt: 1, pages: ['a', 'b'].map((path) => ({ url: `https://example.com/${path}`, title: path, text_content: path })) }, deps), /second batch failed/);
	assert.equal(batches, 2);
	assert.equal(chunks.size, 0);
});
