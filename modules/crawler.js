import { PlaywrightCrawler } from 'crawlee';
import { ensureCollections, importDocuments, removeDocumentsBySourceIds, toIndexDocs } from '../modules/typesense.js';
import { Url } from '../model/url.js';
import { CrawlState } from '../model/crawl_state.js';
import { createLogger } from './logger.js';

const log = createLogger('crawler');

const SKIP_URL_TOKEN_RE = /(^|[\/_.\-?=&])(login|log-in|signin|sign-in|signon|sso|oauth|auth|authenticate)([\/_.\-?=&]|$)/i;
const DOWNLOAD_URL_EXT_RE = /\.(?:7z|avi|bz2|dmg|doc|docx|exe|gz|iso|m4a|mov|mp3|mp4|mpeg|mpg|pdf|ppt|pptx|rar|tar|tgz|wav|webm|xls|xlsx|zip)(?:$|[?#])/i;
const DEFAULT_STEP_LIMIT = 100;
const DEFAULT_INDEX_BATCH_SIZE = 25;
const BULK_WRITE_BATCH_SIZE = 500;

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
	const headers = response?.headers?.() || {};
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
	const match = message.match(/\b(?:received|HTTP|status(?: code)?[:\s])\s*([1-5]\d\d)\b/i);
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

async function bulkWriteCrawlState(crawlStateModel, ops) {
	for (let i = 0; i < ops.length; i += BULK_WRITE_BATCH_SIZE) {
		const batch = ops.slice(i, i + BULK_WRITE_BATCH_SIZE);
		if (batch.length) await crawlStateModel.bulkWrite(batch, { ordered: false });
	}
}

async function countCrawlStates(crawlStateModel, urlDoc) {
	const filter = { host_id: urlDoc.host_id, parent_url_id: urlDoc._id };
	const [queued, visited, failed] = await Promise.all([
		crawlStateModel.countDocuments({ ...filter, status: 'queued' }),
		crawlStateModel.countDocuments({ ...filter, status: 'visited' }),
		crawlStateModel.countDocuments({ ...filter, status: 'failed' }),
	]);
	return { queued, visited, failed };
}

async function updateUrlCrawlSummary(urlModel, crawlStateModel, urlDoc) {
	const counts = await countCrawlStates(crawlStateModel, urlDoc);
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
	await urlModel.updateOne({ _id: urlDoc._id, host_id: urlDoc.host_id }, { $set: update });
	return { ...counts, partial };
}

async function resetCrawlState(urlDoc, crawlStateModel, { resetFailed = false } = {}) {
	const filter = { host_id: urlDoc.host_id, parent_url_id: urlDoc._id };
	if (resetFailed) {
		await crawlStateModel.deleteMany(filter);
		return;
	}

	await Promise.all([
		crawlStateModel.deleteMany({ ...filter, status: 'queued' }),
		crawlStateModel.deleteMany({ ...filter, status: 'visited' }),
	]);
}

async function seedInitialCrawlState(urlDoc, crawlStateModel, { reset = false, resetFailed = false } = {}) {
	const filter = { host_id: urlDoc.host_id, parent_url_id: urlDoc._id };
	if (reset) {
		await resetCrawlState(urlDoc, crawlStateModel, { resetFailed });
	} else {
		const existing = await crawlStateModel.countDocuments(filter);
		if (existing > 0) return;
	}

	const legacyVisited = Array.isArray(urlDoc.crawl_visited) ? urlDoc.crawl_visited : [];
	const legacyFrontier = Array.isArray(urlDoc.crawl_frontier) && urlDoc.crawl_frontier.length ? urlDoc.crawl_frontier : [urlDoc.url];
	const ops = buildCrawlStateBulkOps(urlDoc, { visited: legacyVisited, queued: legacyFrontier });
	await bulkWriteCrawlState(crawlStateModel, ops);
}

async function getQueuedCrawlStates(urlDoc, crawlStateModel, limit) {
	return crawlStateModel
		.find({ host_id: urlDoc.host_id, parent_url_id: urlDoc._id, status: 'queued' })
		.sort({ updatedAt: 1 })
		.limit(limit)
		.lean();
}

async function getVisitedUrlSet(urlDoc, crawlStateModel) {
	const urls = await crawlStateModel.distinct('normalized_url', {
		host_id: urlDoc.host_id,
		parent_url_id: urlDoc._id,
		status: 'visited',
	});
	return new Set(urls);
}

async function getFailedUrlSet(urlDoc, crawlStateModel) {
	const urls = await crawlStateModel.distinct('normalized_url', {
		host_id: urlDoc.host_id,
		parent_url_id: urlDoc._id,
		status: 'failed',
	});
	return new Set(urls);
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
	const removeFn = deps.removeDocumentsBySourceIds || removeDocumentsBySourceIds;
	const importFn = deps.importDocuments || importDocuments;
	const toIndexDocsFn = deps.toIndexDocs || toIndexDocs;
	const batchSize = deps.batchSize || getCrawlIndexBatchSize();
	const pageDocs = buildUniquePageSourceDocs(input);
	let indexedCount = 0;
	let chunkCount = 0;

	for (let i = 0; i < pageDocs.length; i += batchSize) {
		const batch = pageDocs.slice(i, i + batchSize);
		const sourceIds = batch.map((doc) => doc.id);
		await removeFn(hostId, 'pages', sourceIds);

		const entries = [];
		const expectedChunks = new Map();
		for (const doc of batch) {
			const chunks = toIndexDocsFn('pages', doc);
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

/**
* Crawl one step of a site and index results into Typesense.
* Crawl frontier/visited state is stored as linked CrawlState documents so the
* parent Url document never grows toward MongoDB's BSON limit.
*/
export async function crawlSite(urlDoc, deps = {}) {
	const urlId = idString(urlDoc._id);
	const hostId = urlDoc.host_id;
	const projectId = idString(urlDoc.project);
	const crawlScope = getCrawlScope(urlDoc.url);
	const stepLimit = deps.stepLimit || getCrawlStepLimit();
	const crawlerClass = deps.PlaywrightCrawler || PlaywrightCrawler;
	const urlModel = deps.Url || Url;
	const crawlStateModel = deps.CrawlState || CrawlState;
	const ensureCollectionsFn = deps.ensureCollections || ensureCollections;
	const bulkIndexPagesFn = deps.bulkIndexCrawledPages || bulkIndexCrawledPages;
	const resetFailed = deps.resetFailed === true;
	const pages = [];
	const failedInRun = new Map();

	await ensureCollectionsFn(hostId);
	await seedInitialCrawlState(urlDoc, crawlStateModel, { reset: resetFailed || urlDoc.crawl_partial !== true, resetFailed });

	const failed = await getFailedUrlSet(urlDoc, crawlStateModel);
	let queuedStates = await getQueuedCrawlStates(urlDoc, crawlStateModel, stepLimit);
	queuedStates = queuedStates.filter((state) => !failed.has(state.normalized_url));
	if (!queuedStates.length) {
		const summary = await updateUrlCrawlSummary(urlModel, crawlStateModel, urlDoc);
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
		await bulkWriteCrawlState(crawlStateModel, stateOps);
		const summary = await updateUrlCrawlSummary(urlModel, crawlStateModel, urlDoc);
		log.info({ requests: 0, url: urlDoc.url, indexed: 0, partial: summary.partial, frontierRemaining: summary.queued }, 'Crawl step complete');
		return 0;
	}

	const crawler = new crawlerClass({
		maxRequestsPerCrawl: stepLimit,
		maxRequestRetries: 0,
		maxConcurrency: 3,
		requestHandlerTimeoutSecs: 30,

		async requestHandler({ request, page, enqueueLinks, response }) {
			const currentUrl = request.loadedUrl || request.url;
			const normalizedCurrent = normalizeCrawlUrl(currentUrl);
			if (!isUrlInCrawlScope(currentUrl, crawlScope)) {
				const normalizedRequest = normalizeCrawlUrl(request.url);
				failedInRun.set(normalizedRequest, failureEntry(request.url, 'Skipped outside crawl scope', { failureType: 'skipped' }));
				return;
			}
			const statusCode = response?.status?.() || null;
			if (statusCode && statusCode >= 400) {
				failedInRun.set(normalizedCurrent, failureEntryForStatus(currentUrl, statusCode));
				return;
			}
			if (!isHtmlResponse(response)) {
				failedInRun.set(normalizedCurrent, failureEntry(currentUrl, 'Non-HTML response', { failureType: 'non_html' }));
				return;
			}
			if (shouldSkipCrawledUrl(currentUrl)) {
				failedInRun.set(normalizedCurrent, failureEntry(currentUrl, 'Skipped non-crawlable URL', { failureType: 'skipped' }));
				return;
			}

			const title = await page.title();
			const textContent = await page.evaluate(() => {
				const el = document.querySelector('main, article, [role="main"], .content, #content, body');
				return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
			});

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
	});

	await crawler.run(batch);

	const stateOps = buildCrawlStateBulkOps(urlDoc, {
		visited: [...visitedInRun.values()].map((entry) => entry.url),
		queued: [...discoveredInRun.values()],
		failed: [...failedInRun.values()],
	});
	await bulkWriteCrawlState(crawlStateModel, stateOps);
	const summary = await updateUrlCrawlSummary(urlModel, crawlStateModel, urlDoc);

	const indexResult = await bulkIndexPagesFn(hostId, {
		urlId,
		projectId,
		pages,
		crawledAt: Math.floor(Date.now() / 1000),
	});

	if (indexResult.attemptedCount > indexResult.indexedCount) {
		log.error({ attempted: indexResult.attemptedCount, indexed: indexResult.indexedCount, url: urlDoc.url }, 'Page index error');
	}

	log.info({ requests: pages.length, url: urlDoc.url, indexed: indexResult.indexedCount, partial: summary.partial, frontierRemaining: summary.queued }, 'Crawl step complete');
	return indexResult.indexedCount;
}

/**
* Re-crawl all URLs with crawl_enabled.
*/
export async function reindexAll() {
	const urls = await Url.find({ crawl_enabled: true });
	log.info({ count: urls.length }, 'Reindexing crawl-enabled URLs');

	for (const urlDoc of urls) {
		try {
			await crawlSite(urlDoc);
		} catch (err) {
			log.error({ err, url: urlDoc.url }, 'Reindex error');
		}
	}
}

/**
* Re-crawl only URLs that are due based on last_crawled age.
* This spreads crawling over time instead of a single daily spike.
*/
export async function reindexDue({ intervalHours = 24 } = {}) {
	const cutoff = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
	const urls = await Url.find({
		crawl_enabled: true,
		$or: [
			{ crawl_partial: true },
			{ last_crawled: { $exists: false } },
			{ last_crawled: null },
			{ last_crawled: { $lte: cutoff } },
		],
	}).sort({ crawl_partial: -1, last_crawled: 1 });

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
