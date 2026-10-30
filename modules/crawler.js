import { acquireProjectWrite } from '../services/project_service.js';
import { validatePublicUrl, publicLookup } from './public_url.js';
import { acquireTenantWork } from './tenancy.js';
import { CheerioCrawler, Configuration } from 'crawlee';
import { randomUUID } from 'node:crypto';
import { ensureCollections, importDocuments, removeDocumentsByIds, captureCrawledPageIds, removeCrawledPages, toIndexDocs } from '../modules/typesense.js';
import { Url } from '../model/url.js';
import { CrawlPublication } from '../model/crawl_publication.js';
import { CrawlState } from '../model/crawl_state.js';
import { createLogger } from './logger.js';

const log = createLogger('crawler');

const SKIP_URL_TOKEN_RE = /(^|[\/_.\-?=&])(login|log-in|signin|sign-in|signon|sso|oauth|auth|authenticate)([\/_.\-?=&]|$)/i;
const DOWNLOAD_URL_EXT_RE = /\.(?:7z|avi|bz2|dmg|doc|docx|exe|gz|iso|m4a|mov|mp3|mp4|mpeg|mpg|pdf|ppt|pptx|rar|tar|tgz|wav|webm|xls|xlsx|zip)(?:$|[?#])/i;
const DEFAULT_STEP_LIMIT = 100;
const DEFAULT_INDEX_BATCH_SIZE = 25;
const BULK_WRITE_BATCH_SIZE = 500;
const CRAWL_STATE_CURSOR_BATCH_SIZE = 1000;

function parsePositiveInteger(value, fallback) {
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCrawlStepLimit(env = process.env) {
	return parsePositiveInteger(env.CRAWL_STEP_LIMIT, DEFAULT_STEP_LIMIT);
}

export function getCrawlIndexBatchSize(env = process.env) {
	return parsePositiveInteger(env.CRAWL_INDEX_BATCH_SIZE, DEFAULT_INDEX_BATCH_SIZE);
}

export function shouldSkipCrawledUrl(rawUrl) {
	if (!rawUrl) return true;
	try {
		const parsed = new URL(rawUrl);
		if (!/^https?:$/.test(parsed.protocol)) return true;
		const haystack = `${parsed.pathname}${parsed.search}`.toLowerCase();
		return SKIP_URL_TOKEN_RE.test(haystack) || DOWNLOAD_URL_EXT_RE.test(haystack);
	} catch {
		const text = String(rawUrl || '').toLowerCase();
		return SKIP_URL_TOKEN_RE.test(text) || DOWNLOAD_URL_EXT_RE.test(text);
	}
}

export function isHtmlResponse(response) {
	const headers = typeof response?.headers === 'function' ? response.headers() : response?.headers || {};
	const contentType = String(headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
	return !contentType || contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
}

export function normalizeCrawlUrl(rawUrl) {
	if (!rawUrl) return '';
	try {
		const parsed = new URL(rawUrl);
		parsed.hash = '';
		parsed.hostname = parsed.hostname.toLowerCase();
		if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
			parsed.pathname = parsed.pathname.replace(/\/+$/, '');
		}
		return parsed.toString();
	} catch {
		return String(rawUrl);
	}
}

export function getCrawlScope(rawUrl) {
	try {
		const parsed = new URL(normalizeCrawlUrl(rawUrl));
		let pathPrefix = parsed.pathname || '/';
		if (pathPrefix.length > 1 && pathPrefix.endsWith('/')) {
			pathPrefix = pathPrefix.replace(/\/+$/, '');
		}
		return {
			origin: parsed.origin,
			pathPrefix,
		};
	} catch {
		return null;
	}
}

export function isUrlInCrawlScope(rawUrl, scope) {
	if (!rawUrl || !scope?.origin) return false;
	try {
		const parsed = new URL(normalizeCrawlUrl(rawUrl));
		if (parsed.origin !== scope.origin) return false;
		if (scope.pathPrefix === '/') return true;
		return parsed.pathname === scope.pathPrefix || parsed.pathname.startsWith(`${scope.pathPrefix}/`);
	} catch {
		return false;
	}
}

export function getCrawledPageDocumentId(parentUrlId, pageUrl) {
	return `${parentUrlId}_${Buffer.from(pageUrl).toString('base64url')}`;
}

function idString(value) {
	return value?.toString?.() || String(value || '');
}

function crawlStateBase(urlDoc) {
	return {
		parent_url_id: urlDoc._id,
		project: urlDoc.project,
		owner: urlDoc.owner,
		host_id: urlDoc.host_id,
	};
}

function normalizeUrlEntries(urls, { skipNonCrawlable = true } = {}) {
	const seen = new Set();
	const entries = [];
	for (const url of Array.isArray(urls) ? urls : []) {
		if (skipNonCrawlable && shouldSkipCrawledUrl(url)) continue;
		const normalizedUrl = normalizeCrawlUrl(url);
		if (!normalizedUrl || seen.has(normalizedUrl)) continue;
		seen.add(normalizedUrl);
		entries.push({ url, normalized_url: normalizedUrl });
	}
	return entries;
}

function normalizeHttpStatus(value) {
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 100 && parsed <= 599 ? parsed : null;
}

function failureTypeForStatus(statusCode) {
	if (statusCode === 401 || statusCode === 403) return 'denied';
	if (statusCode === 404 || statusCode === 410) return 'not_found';
	if (statusCode >= 400) return 'http';
	return 'error';
}

function httpStatusFromError(err) {
	const message = errorMessage(err);
	const match = message.match(/\b(?:received|HTTP|response\s+code|status(?: code)?[:\s])\s*([1-5]\d\d)\b/i) || message.match(/^\s*([1-5]\d\d)\b/);
	return normalizeHttpStatus(match?.[1]);
}

function failureEntry(url, error, { httpStatus = null, failureType = '' } = {}) {
	const statusCode = normalizeHttpStatus(httpStatus);
	return {
		url,
		error,
		http_status: statusCode,
		failure_type: failureType || failureTypeForStatus(statusCode),
	};
}

function failureEntryForStatus(url, statusCode) {
	const normalizedStatus = normalizeHttpStatus(statusCode);
	return failureEntry(url, `HTTP ${normalizedStatus}`, {
		httpStatus: normalizedStatus,
		failureType: failureTypeForStatus(normalizedStatus),
	});
}

function failureEntryForError(url, err) {
	const message = errorMessage(err);
	const statusCode = httpStatusFromError(err);
	return failureEntry(url, message, {
		httpStatus: statusCode,
		failureType: statusCode ? failureTypeForStatus(statusCode) : 'error',
	});
}

export function buildCrawlStateBulkOps(urlDoc, { queued = [], visited = [], failed = [] } = {}, now = new Date()) {
	const base = crawlStateBase(urlDoc);
	const ops = [];
	const visitedEntries = normalizeUrlEntries(visited);
	const queuedEntries = normalizeUrlEntries(queued);
	const failedEntries = normalizeUrlEntries(failed.map((entry) => entry.url || entry), { skipNonCrawlable: false });
	const visitedSet = new Set(visitedEntries.map((entry) => entry.normalized_url));

	for (const entry of visitedEntries) {
		ops.push({
			updateOne: {
				filter: { host_id: base.host_id, parent_url_id: base.parent_url_id, normalized_url: entry.normalized_url },
				update: {
					$set: {
						...base,
						url: entry.url,
						status: 'visited',
						error: '',
						http_status: null,
						failure_type: '',
						last_seen: now,
						visited_at: now,
					},
					$setOnInsert: { normalized_url: entry.normalized_url },
				},
				upsert: true,
			},
		});
	}

	for (const entry of queuedEntries) {
		if (visitedSet.has(entry.normalized_url)) continue;
		ops.push({
			updateOne: {
				filter: { host_id: base.host_id, parent_url_id: base.parent_url_id, normalized_url: entry.normalized_url },
				update: {
					$setOnInsert: {
						...base,
						normalized_url: entry.normalized_url,
						url: entry.url,
						status: 'queued',
						error: '',
						http_status: null,
						failure_type: '',
						last_seen: now,
					},
				},
				upsert: true,
			},
		});
	}

	for (const entry of failedEntries) {
		const original = failed.find((item) => normalizeCrawlUrl(item.url || item) === entry.normalized_url) || {};
		ops.push({
			updateOne: {
				filter: { host_id: base.host_id, parent_url_id: base.parent_url_id, normalized_url: entry.normalized_url },
				update: {
					$set: {
						...base,
						url: entry.url,
						status: 'failed',
						error: String(original.error || 'Crawl failed').slice(0, 1000),
						http_status: normalizeHttpStatus(original.http_status),
						failure_type: String(original.failure_type || 'error'),
						last_seen: now,
						failed_at: now,
					},
					$setOnInsert: { normalized_url: entry.normalized_url },
				},
				upsert: true,
			},
		});
	}

	return ops;
}

async function bulkWriteCrawlState(crawlStateModel, ops, session) {
	for (let i = 0; i < ops.length; i += BULK_WRITE_BATCH_SIZE) {
		const batch = ops.slice(i, i + BULK_WRITE_BATCH_SIZE);
		if (batch.length) await crawlStateModel.bulkWrite(batch, { ordered: false, ...(session ? { session } : {}) });
	}
}

async function countCrawlStates(crawlStateModel, urlDoc, session) {
	const filter = { host_id: urlDoc.host_id, parent_url_id: urlDoc._id };
	const options = { timestamps: false, ...(session ? { session } : {}) };
	const queued = await crawlStateModel.updateMany({ ...filter, status: 'queued' }, { $set: { status: 'queued' } }, options);
	const visited = await crawlStateModel.updateMany({ ...filter, status: 'visited' }, { $set: { status: 'visited' } }, options);
	const failed = await crawlStateModel.updateMany({ ...filter, status: 'failed' }, { $set: { status: 'failed' } }, options);
	return { queued: queued.matchedCount, visited: visited.matchedCount, failed: failed.matchedCount };
}

async function updateUrlCrawlSummary(urlModel, crawlStateModel, urlDoc, session) {
	const counts = await countCrawlStates(crawlStateModel, urlDoc, session);
	const partial = counts.queued > 0;
	const update = {
		crawl_frontier: [],
		crawl_visited: [],
		crawl_frontier_count: counts.queued,
		crawl_visited_count: counts.visited,
		crawl_failed_count: counts.failed,
		crawl_partial: partial,
	};
	if (!partial) update.last_crawled = new Date();
	await urlModel.updateOne({ _id: urlDoc._id, host_id: urlDoc.host_id }, { $set: update }, { timestamps: false, ...(session ? { session } : {}) });
	return { ...counts, partial };
}

async function resetCrawlState(urlDoc, crawlStateModel, { resetFailed = false, session } = {}) {
	const filter = { host_id: urlDoc.host_id, parent_url_id: urlDoc._id };
	if (resetFailed) {
		await crawlStateModel.deleteMany(filter, session ? { session } : {});
		return;
	}

	await crawlStateModel.deleteMany({ ...filter, status: 'queued' }, session ? { session } : {});
	await crawlStateModel.deleteMany({ ...filter, status: 'visited' }, session ? { session } : {});
}

async function seedInitialCrawlState(urlDoc, crawlStateModel, { reset = false, resetFailed = false, session } = {}) {
	const filter = { host_id: urlDoc.host_id, parent_url_id: urlDoc._id };
	if (reset) {
		await resetCrawlState(urlDoc, crawlStateModel, { resetFailed, session });
	} else {
		const existing = (await crawlStateModel.updateMany(filter, { $inc: { __v: 0 } }, { timestamps: false, ...(session ? { session } : {}) })).matchedCount;
		if (existing > 0) return;
	}

	const legacyVisited = Array.isArray(urlDoc.crawl_visited) ? urlDoc.crawl_visited : [];
	const legacyFrontier = Array.isArray(urlDoc.crawl_frontier) && urlDoc.crawl_frontier.length ? urlDoc.crawl_frontier : [urlDoc.url];
	const ops = buildCrawlStateBulkOps(urlDoc, { visited: legacyVisited, queued: legacyFrontier });
	await bulkWriteCrawlState(crawlStateModel, ops, session);
}

async function getQueuedCrawlStates(urlDoc, crawlStateModel, limit) {
	return crawlStateModel
		.find({ host_id: urlDoc.host_id, parent_url_id: urlDoc._id, status: 'queued' })
		// This queue was just seeded/reset; stale reads must not mark it complete.

		.sort({ updatedAt: 1 })
		.limit(limit)
		.lean();
}

async function getCrawlStateUrlSet(urlDoc, crawlStateModel, status) {
	const cursor = crawlStateModel
		.find({
			host_id: urlDoc.host_id,
			parent_url_id: urlDoc._id,
			status,
		}, { normalized_url: 1, _id: 0 })

		.lean()
		.cursor({ batchSize: CRAWL_STATE_CURSOR_BATCH_SIZE });
	const urls = new Set();
	for await (const state of cursor) {
		if (state?.normalized_url) urls.add(state.normalized_url);
	}
	return urls;
}

async function getVisitedUrlSet(urlDoc, crawlStateModel) {
	return getCrawlStateUrlSet(urlDoc, crawlStateModel, 'visited');
}

async function getFailedUrlSet(urlDoc, crawlStateModel) {
	return getCrawlStateUrlSet(urlDoc, crawlStateModel, 'failed');
}

function buildUniquePageSourceDocs({ urlId, projectId, pages, crawledAt }) {
	const uniquePages = new Map();
	for (const pageData of pages) {
		const docId = getCrawledPageDocumentId(urlId, pageData.url);
		if (!uniquePages.has(docId)) {
			uniquePages.set(docId, {
				id: docId,
				url: pageData.url,
				parent_url_id: urlId,
				title: pageData.title,
				text_content: pageData.text_content,
				project_id: projectId,
				crawled_at: crawledAt,
			});
		}
	}
	return [...uniquePages.values()];
}

export function buildCrawledPageIndexDocs(input, deps = {}) {
	const toIndexDocsFn = deps.toIndexDocs || toIndexDocs;
	return buildUniquePageSourceDocs(input).flatMap((doc) => toIndexDocsFn('pages', doc));
}

export async function bulkIndexCrawledPages(hostId, input, deps = {}) {
	const removeFn = deps.removeDocumentsByIds || removeDocumentsByIds;
	const captureFn = deps.captureCrawledPageIds || captureCrawledPageIds;
	const importFn = deps.importDocuments || importDocuments;
	const toIndexDocsFn = deps.toIndexDocs || toIndexDocs;
	const batchSize = deps.batchSize || getCrawlIndexBatchSize();
	const pageDocs = buildUniquePageSourceDocs(input);
	let indexedCount = 0;
	let chunkCount = 0;

	for (let i = 0; i < pageDocs.length; i += batchSize) {
		const batch = pageDocs.slice(i, i + batchSize);
		const sourceIds = batch.map((doc) => doc.id);
		const displaced = await captureFn(hostId, input.urlId, sourceIds);
		if (input.beforeImport) await input.beforeImport(displaced);
		await removeFn(hostId, 'pages', displaced);

		const entries = [];
		const expectedChunks = new Map();
		for (const doc of batch) {
			const chunks = toIndexDocsFn('pages', doc, input.claim);
			expectedChunks.set(doc.id, chunks.length);
			for (const chunk of chunks) entries.push({ sourceId: doc.id, doc: chunk });
		}

		const results = await importFn(hostId, 'pages', entries.map((entry) => entry.doc));
		chunkCount += entries.length;

		const successCounts = new Map();
		const failedIds = new Set();
		for (let resultIndex = 0; resultIndex < entries.length; resultIndex++) {
			const entry = entries[resultIndex];
			if (results?.[resultIndex]?.success) {
				successCounts.set(entry.sourceId, (successCounts.get(entry.sourceId) || 0) + 1);
			} else {
				failedIds.add(entry.sourceId);
			}
		}

		for (const sourceId of sourceIds) {
			if ((successCounts.get(sourceId) || 0) === expectedChunks.get(sourceId) && !failedIds.has(sourceId)) {
				indexedCount++;
			}
		}
	}

	return { indexedCount, attemptedCount: pageDocs.length, chunkCount };
}

function errorMessage(err) {
	return String(err?.message || err || 'Crawl failed');
}

function isCrawlableInScope(rawUrl, scope) {
	return !shouldSkipCrawledUrl(rawUrl) && isUrlInCrawlScope(rawUrl, scope);
}

function skippedCrawlEntry(rawUrl, scope) {
	const message = shouldSkipCrawledUrl(rawUrl) ? 'Skipped non-crawlable URL' : 'Skipped outside crawl scope';
	return failureEntry(rawUrl, message, { failureType: 'skipped' });
}

async function claimActiveUrl(urlDoc, urlModel, session) {
	return urlModel.findOneAndUpdate({ _id: urlDoc._id, host_id: urlDoc.host_id, in_trash: { $ne: true }, ...(urlDoc.updatedAt ? { updatedAt: urlDoc.updatedAt } : {}) }, { $inc: { __v: 1 } }, { timestamps: false, returnDocument: 'after', ...(session ? { session } : {}) }).lean();
}

/**
 * Persist a crawl step's captured states and the parent URL summary under a
 * project write lease. Network work completes before the lease is acquired, and
 * the lease is held only across the destination-record writes.
 */
async function publishCrawlStep(urlDoc, urlModel, crawlStateModel, stateOps, deps = {}) {
	const { release, publish } = await acquireProjectWrite(urlDoc.host_id, urlDoc.project, deps);
	try {
		return await publish(async (session) => {
			if (!await claimActiveUrl(urlDoc, urlModel, session)) return null;
			if (stateOps?.length) await bulkWriteCrawlState(crawlStateModel, stateOps, session);
			return updateUrlCrawlSummary(urlModel, crawlStateModel, urlDoc, session);
		});
	} finally {
		await release();
	}
}

/**
* Crawl one step of a site and index results into Typesense.
* Crawl frontier/visited state is stored as linked CrawlState documents so the
* parent Url document never grows toward MongoDB's BSON limit.
*/
export async function crawlSite(urlDoc, deps = {}) {
	const releaseAccountWork = await acquireTenantWork(urlDoc.host_id);
	try {
	const urlId = idString(urlDoc._id);
	const hostId = urlDoc.host_id;
	const projectId = idString(urlDoc.project);
	const crawlScope = getCrawlScope(urlDoc.url);
	const stepLimit = deps.stepLimit || getCrawlStepLimit();
	const crawlerClass = deps.CheerioCrawler || CheerioCrawler;
	const urlModel = deps.Url || Url;
	const crawlStateModel = deps.CrawlState || CrawlState;
	const ensureCollectionsFn = deps.ensureCollections || ensureCollections;
	const bulkIndexPagesFn = deps.bulkIndexCrawledPages || bulkIndexCrawledPages;
	const resetFailed = deps.resetFailed === true;
	const pages = [];
	const failedInRun = new Map();

	await ensureCollectionsFn(hostId);
	const { release, publish } = await acquireProjectWrite(hostId, urlDoc.project, deps);
	let active;
	try {
		active = await publish(async (session) => {
			if (!await claimActiveUrl(urlDoc, urlModel, session)) return false;
			await seedInitialCrawlState(urlDoc, crawlStateModel, { reset: resetFailed || urlDoc.crawl_partial !== true, resetFailed, session });
			return true;
		});
	} finally { await release(); }
	if (!active) return 0;

	const failed = await getFailedUrlSet(urlDoc, crawlStateModel);
	let queuedStates = await getQueuedCrawlStates(urlDoc, crawlStateModel, stepLimit);
	if (!queuedStates.length) {
		const queued = await crawlStateModel.findOneAndUpdate({ host_id: hostId, parent_url_id: urlDoc._id, status: 'queued' }, { $set: { status: 'queued' } }, { timestamps: false, returnDocument: 'after' }).lean();
		if (queued) queuedStates = [queued];
	}
	queuedStates = queuedStates.filter((state) => !failed.has(state.normalized_url));
	if (!queuedStates.length) {
		const summary = await publishCrawlStep(urlDoc, urlModel, crawlStateModel, [], deps);
		if (!summary) return 0;
		log.info({ url: urlDoc.url, partial: summary.partial, frontierRemaining: summary.queued }, 'Crawl step skipped: no queued URLs');
		return 0;
	}

	const batch = queuedStates.map((state) => state.url).filter((url) => isCrawlableInScope(url, crawlScope));
	const skipped = queuedStates.filter((state) => !isCrawlableInScope(state.url, crawlScope));
	for (const state of skipped) {
		failedInRun.set(state.normalized_url, skippedCrawlEntry(state.url, crawlScope));
	}

	const visited = await getVisitedUrlSet(urlDoc, crawlStateModel);
	const visitedInRun = new Map();
	const discoveredInRun = new Map();

	if (!batch.length) {
		const stateOps = buildCrawlStateBulkOps(urlDoc, { failed: [...failedInRun.values()] });
		const summary = await publishCrawlStep(urlDoc, urlModel, crawlStateModel, stateOps, deps);
		if (!summary) return 0;
		log.info({ requests: 0, url: urlDoc.url, indexed: 0, partial: summary.partial, frontierRemaining: summary.queued }, 'Crawl step complete');
		return 0;
	}

	const crawler = new crawlerClass({
		maxRequestsPerCrawl: stepLimit,
		maxRequestRetries: 0,
		maxConcurrency: 3,
		requestHandlerTimeoutSecs: 30,
		ignoreSslErrors: false,
		preNavigationHooks: [async ({ request }, options) => {
			validatePublicUrl(request.url);
			options.http2 = false;
			options.dnsLookup = publicLookup;
			options.dnsCache = false;
			options.hooks = { beforeRedirect: [(redirect) => validatePublicUrl(redirect.url)] };
		}],

		async requestHandler({ request, $, enqueueLinks, response }) {
			const currentUrl = request.loadedUrl || request.url;
			const normalizedCurrent = normalizeCrawlUrl(currentUrl);
			if (!isUrlInCrawlScope(currentUrl, crawlScope)) {
				const normalizedRequest = normalizeCrawlUrl(request.url);
				failedInRun.set(normalizedRequest, failureEntry(request.url, 'Skipped outside crawl scope', { failureType: 'skipped' }));
				return;
			}
			const statusCode = normalizeHttpStatus(response?.statusCode);
			if (statusCode && statusCode >= 400) {
				failedInRun.set(normalizedCurrent, failureEntryForStatus(currentUrl, statusCode));
				return;
			}
			if (!isHtmlResponse(response) || typeof $ !== 'function') {
				failedInRun.set(normalizedCurrent, failureEntry(currentUrl, 'Non-HTML response', { failureType: 'non_html' }));
				return;
			}
			if (shouldSkipCrawledUrl(currentUrl)) {
				failedInRun.set(normalizedCurrent, failureEntry(currentUrl, 'Skipped non-crawlable URL', { failureType: 'skipped' }));
				return;
			}

			const title = $('title').first().text().trim();
			$('script, style, noscript, template, iframe').remove();
			const textContent = $('main, article, [role="main"], .content, #content, body').first().text().replace(/\s+/g, ' ').trim();

			visitedInRun.set(normalizedCurrent, {
				url: currentUrl,
				title,
				text_content: textContent,
			});
			pages.push({
				url: currentUrl,
				title,
				text_content: textContent,
			});

			await enqueueLinks({
				strategy: 'same-hostname',
				transformRequestFunction: (req) => {
					if (!isCrawlableInScope(req.url, crawlScope)) return false;
					const normalized = normalizeCrawlUrl(req.url);
					if (failed.has(normalized)) return false;
					if (failedInRun.has(normalized)) return false;
					if (visited.has(normalized)) return false;
					if (visitedInRun.has(normalized)) return false;
					if (discoveredInRun.has(normalized)) return false;
					discoveredInRun.set(normalized, req.url);
					return req;
				},
			});
		},

		failedRequestHandler({ request, error }) {
			const normalized = normalizeCrawlUrl(request.url);
			failedInRun.set(normalized, failureEntryForError(request.url, error));
			log.warn({ url: request.url }, 'Crawl failed');
		},
	}, new Configuration({
		// MongoDB owns resumable state; each run needs an isolated transient queue.
		persistStorage: false,
		storageClientOptions: { persistStorage: false, localDataDirectory: `storage/crawl-${randomUUID()}` },
	}));

	await crawler.run(batch);

	const stateOps = buildCrawlStateBulkOps(urlDoc, {
		visited: [...visitedInRun.values()].map((entry) => entry.url),
		queued: [...discoveredInRun.values()],
		failed: [...failedInRun.values()],
	});
	const indexResult = await publishCrawledPages(urlDoc, { urlId, projectId, pages, crawledAt: Math.floor(Date.now() / 1000) }, { ...deps, bulkIndexCrawledPages: bulkIndexPagesFn });
	if (!indexResult) return 0;
	const summary = await publishCrawlStep(urlDoc, urlModel, crawlStateModel, stateOps, deps);
	if (!summary) return 0;

	if (indexResult.attemptedCount > indexResult.indexedCount) {
		log.error({ attempted: indexResult.attemptedCount, indexed: indexResult.indexedCount, url: urlDoc.url }, 'Page index error');
	}

	log.info({ requests: pages.length, url: urlDoc.url, indexed: indexResult.indexedCount, partial: summary.partial, frontierRemaining: summary.queued }, 'Crawl step complete');
	return indexResult.indexedCount;
	} finally { await releaseAccountWork(); }
}

export async function cleanupCrawlPublications(deps = {}) {
	const model = deps.CrawlPublication || CrawlPublication;
	const rows = await model.find({ expires_at: { $lte: new Date() } }).lean();
	for (const candidate of rows) {
		try {
			const row = await model.findOneAndUpdate({ _id: candidate._id, expires_at: { $lte: new Date() } }, { $set: { expires_at: new Date(0) } }, { returnDocument: 'after' }).lean();
			if (!row) continue;
			await (deps.removeDocumentsByIds || removeDocumentsByIds)(row.host_id, 'pages', row.displaced_ids);
			if (row.cleanup) await (deps.removeCrawledPages || removeCrawledPages)(row.host_id, [String(row.parent_url_id)], { claim: row._id });
			if (row.finished) await model.deleteOne({ _id: row._id });
		} catch (err) { log.error({ err, claim: candidate._id }, 'Crawl cleanup retained for retry'); }
	}
}

export async function publishCrawledPages(urlDoc, input, deps = {}) {
	const model = deps.CrawlPublication || CrawlPublication;
	const urlModel = deps.Url || Url;
	const claim = randomUUID();
	const hostId = urlDoc.host_id;
	const expires = new Date(Date.now() + 10 * 60 * 1000);
	const version = urlDoc.updatedAt ? { updatedAt: urlDoc.updatedAt } : {};
	await model.create({ _id: claim, host_id: hostId, parent_url_id: urlDoc._id, expires_at: expires });
	const ownership = { _id: urlDoc._id, host_id: hostId, ...version, in_trash: { $ne: true }, crawl_claim: claim, crawl_claim_expires_at: { $gt: new Date() } };
	let completed = false;
	let importStarted = false;
	try {
		const parent = await urlModel.findOneAndUpdate({ _id: urlDoc._id, host_id: hostId, ...version, in_trash: { $ne: true }, $or: [{ crawl_claim: null }, { crawl_claim_expires_at: { $lte: new Date() } }] }, { $set: { crawl_claim: claim, crawl_claim_expires_at: expires } }, { timestamps: false, returnDocument: 'after' }).lean();
		if (!parent) return null;
		const beforeImport = async (ids) => {
			ownership.crawl_claim_expires_at.$gt = new Date();
			if (!await urlModel.findOneAndUpdate(ownership, { $inc: { __v: 1 } }, { timestamps: false, returnDocument: 'after' }).lean()) throw new Error('Crawl publication lost ownership');
			await model.updateOne({ _id: claim }, { $addToSet: { displaced_ids: { $each: ids } } });
		};
		importStarted = true;
		const result = await (deps.bulkIndexCrawledPages || bulkIndexCrawledPages)(hostId, { ...input, claim, beforeImport });
		if (result.attemptedCount > result.indexedCount) throw new Error('Crawl import incomplete');
		await beforeImport([]);
		const committed = await model.findOneAndUpdate({ _id: claim, expires_at: { $gt: new Date() } }, { $set: { finished: true, cleanup: false } }, { returnDocument: 'after' }).lean();
		if (!committed) throw new Error('Crawl publication expired');
		completed = true;
		return result;
	} finally {
		// Persist cleanup before attempting external deletion, including thrown imports and parent checks.
		const cleanup = await model.findOneAndUpdate({ _id: claim }, { $set: { cleanup: !completed, finished: completed || !importStarted, expires_at: new Date() } }, { returnDocument: 'after' }).lean();
		try {
			await (deps.removeDocumentsByIds || removeDocumentsByIds)(hostId, 'pages', cleanup?.displaced_ids || []);
			if (!completed) await (deps.removeCrawledPages || removeCrawledPages)(hostId, [String(urlDoc._id)], { claim });
			// A timed-out import can still land after deletion; retain its cleanup tombstone.
			if (completed || !importStarted) await model.deleteOne({ _id: claim });
		} catch (err) { log.error({ err, claim }, 'Crawl cleanup retained for retry'); }
		await urlModel.updateOne({ _id: urlDoc._id, host_id: hostId, crawl_claim: claim }, { $set: { crawl_claim: null, crawl_claim_expires_at: null } }, { timestamps: false });
	}
}

/**
* Re-crawl only URLs that are due based on last_crawled age.
* This spreads crawling over time instead of a single daily spike.
*/
export async function reindexDue({ intervalHours = 24 } = {}) {
	await cleanupCrawlPublications();
	const cutoff = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
	const urls = await Url.find({
		crawl_enabled: true,
		in_trash: { $ne: true },
		$or: [
			{ crawl_partial: true },
			{ last_crawled: { $exists: false } },
			{ last_crawled: null },
			{ last_crawled: { $lte: cutoff } },
		],
	}).sort({ crawl_partial: -1, last_crawled: 1 }).lean();

	if (!urls.length) return 0;
	log.info({ count: urls.length }, 'Reindexing due crawl-enabled URLs');

	let crawled = 0;
	for (const urlDoc of urls) {
		try {
			await crawlSite(urlDoc);
			crawled++;
		} catch (err) {
			log.error({ err, url: urlDoc.url }, 'Reindex due error');
		}
	}

	return crawled;
}
