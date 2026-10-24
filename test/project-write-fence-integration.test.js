import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import * as cheerio from 'cheerio';
import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { Project } from '../model/project.js';
import { Email } from '../model/email.js';
import { Url } from '../model/url.js';
import { CrawlState } from '../model/crawl_state.js';
import { Note } from '../model/note.js';
import { Tenant } from '../modules/tenancy.js';
import { ingestForwardedEmail } from '../services/email_ingest_service.js';
import { crawlSite } from '../modules/crawler.js';
import { createNote } from '../services/note_service.js';

// Opt-in real-Mongo coverage of the shared project write fence across the
// email ingest, crawler, and note-import publication paths. Each path runs its
// record write inside the same transaction as the project fence, so a project
// deactivated after the lease is accepted rejects publication and strands no data.
test('project write fence integration covers ingest, crawl, and import transactions', { skip: process.env.STREAMIENT_FENCE_INTEGRATION !== '1', timeout: 60000 }, async (t) => {
	assert.ok(process.env.MONGO_URI, 'MONGO_URI is required for fence integration');
	const dbName = `streamient_fence_test_${crypto.randomUUID().replaceAll('-', '')}`;
	await mongoose.connect(process.env.MONGO_URI, { ...config.mongoOptions, dbName });
	t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
	await Promise.all([Project.init(), Email.init(), Url.init(), CrawlState.init(), Note.init(), Tenant.init()]);

	const owner = new mongoose.Types.ObjectId();
	await Tenant.create({ host_id: 'fence-host', name: 'Fence', owner });
	const project = await Project.create({ name: 'Active', host_id: 'fence-host', owner });

	// Email ingest: the Message-ID upsert shares the fence transaction and is
	// idempotent across concurrent tenants.
	const message = { messageId: '<fence@example.invalid>', from: 'sender@example.invalid', to: 'reader@example.invalid', subject: 'Fence', text: 'Body' };
	const first = await ingestForwardedEmail(owner, 'fence-host', { ...message, project: project._id }, { skipSideEffects: true });
	assert.ok(first._id);
	assert.equal(String(first.project), String(project._id));
	const repeated = await Promise.all(Array.from({ length: 4 }, () => ingestForwardedEmail(owner, 'fence-host', { ...message, project: project._id }, { skipSideEffects: true })));
	assert.ok(repeated.every((email) => String(email._id) === String(first._id)));

	// Crawler: captured states and the URL summary share the fence transaction.
	const urlDoc = await Url.create({ url: 'https://example.com', normalized_url: 'https://example.com', title: 'Crawl', project: project._id, owner, host_id: 'fence-host', crawl_enabled: true });
	class FakeCrawler {
		constructor(options) { this.options = options; }
		async run(batch) {
			for (const url of batch) {
				await this.options.requestHandler({
					request: { url, loadedUrl: url },
					response: { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
					$: cheerio.load('<html><head><title>Home</title></head><body><main>Body text</main></body></html>'),
					enqueueLinks: async () => {},
				});
			}
		}
	}
	const indexed = await crawlSite(urlDoc, { CheerioCrawler: FakeCrawler, ensureCollections: async () => {}, bulkIndexCrawledPages: async (_host, data) => ({ indexedCount: data.pages.length, attemptedCount: data.pages.length, chunkCount: data.pages.length }) });
	assert.equal(indexed, 1);
	assert.equal(await CrawlState.countDocuments({ parent_url_id: urlDoc._id, status: 'visited' }), 1);
	assert.equal((await Url.findById(urlDoc._id)).crawl_visited_count, 1);

	// Note import delegates publication to createNote, which runs the record
	// insert inside the same fence transaction (queue ownership reuse).
	const importId = new mongoose.Types.ObjectId();
	const withOwnership = (callback) => mongoose.connection.transaction(callback);
	const note = await createNote(owner, 'fence-host', { title: 'Imported', content: '<p>Imported</p>', text_content: 'Imported', project: project._id }, { channel: 'mobile', user_id: owner, idempotency_id: importId, withOwnership });
	assert.equal(String(note._id), String(importId));

	// Deactivate the project: every publication path must reject, and no
	// destination record may land.
	project.is_active = false;
	await project.save();

	await assert.rejects(ingestForwardedEmail(owner, 'fence-host', { ...message, messageId: '<fence-after@example.invalid>', project: project._id }, { skipSideEffects: true }), (err) => err.code === 'project_not_found');
	assert.equal(await Email.countDocuments({ message_id: 'fence-after@example.invalid' }), 0);

	const lateUrl = await Url.create({ url: 'https://example.org', normalized_url: 'https://example.org', title: 'Late', project: project._id, owner, host_id: 'fence-host', crawl_enabled: true });
	await assert.rejects(crawlSite(lateUrl, { CheerioCrawler: FakeCrawler, ensureCollections: async () => {}, bulkIndexCrawledPages: async () => ({ indexedCount: 0, attemptedCount: 0, chunkCount: 0 }) }), (err) => err.code === 'project_not_found');
	// The fence rejected the captured-page publication and the URL summary write.
	assert.equal(await CrawlState.countDocuments({ parent_url_id: lateUrl._id, status: 'visited' }), 0);
	assert.equal(await CrawlState.countDocuments({ parent_url_id: lateUrl._id, status: 'failed' }), 0);
	const lateUrlAfter = await Url.findById(lateUrl._id);
	assert.equal(lateUrlAfter.crawl_visited_count, 0);
	assert.equal(lateUrlAfter.last_crawled, undefined);

	await assert.rejects(createNote(owner, 'fence-host', { title: 'Late note', content: '<p>Late</p>', text_content: 'Late', project: project._id }, { channel: 'api', user_id: owner, withOwnership }), (err) => err.code === 'project_not_found');
	assert.equal(await Note.countDocuments({ host_id: 'fence-host', project: project._id, title: 'Late note' }), 0);
});