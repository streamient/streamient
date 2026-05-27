import { PlaywrightCrawler } from 'crawlee';
import { ensureCollections, indexDocument } from '../modules/typesense.js';
import { Url } from '../model/url.js';

const SKIP_URL_TOKEN_RE = /(^|[\/_.\-?=&])(login|log-in|signin|sign-in|signon|sso|oauth|auth|authenticate)([\/_.\-?=&]|$)/i;

const STEP_LIMIT = 500;

function shouldSkipCrawledUrl(rawUrl) {
	if (!rawUrl) return true;
	try {
		const parsed = new URL(rawUrl);
		const haystack = `${parsed.pathname}${parsed.search}`.toLowerCase();
		return SKIP_URL_TOKEN_RE.test(haystack);
	} catch {
		return SKIP_URL_TOKEN_RE.test(String(rawUrl || '').toLowerCase());
	}
}

function normalizeCrawlUrl(rawUrl) {
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

/**
* Crawl one step (up to STEP_LIMIT pages) of a site and index results into Typesense.
* State (frontier / visited) is persisted on the Url doc so multi-step crawls
* resume on subsequent scheduler ticks until the whole site is covered.
*/
export async function crawlSite(urlDoc) {
	const urlId = urlDoc._id?.toString?.() || String(urlDoc._id);
	const hostId = urlDoc.host_id;
	const projectId = urlDoc.project.toString();
	const pages = [];
	let indexedCount = 0;

	// Immediate crawl can run before scheduled indexing has created collections.
	// Ensure all collections (including pages) exist before indexing crawl output.
	await ensureCollections(hostId);

	const existingFrontier = Array.isArray(urlDoc.crawl_frontier) ? urlDoc.crawl_frontier : [];
	const existingVisited = Array.isArray(urlDoc.crawl_visited) ? urlDoc.crawl_visited : [];
	const frontier = existingFrontier.length ? existingFrontier : [normalizeCrawlUrl(urlDoc.url)];
	const visited = new Set(existingVisited);
	const batch = frontier.slice(0, STEP_LIMIT);
	const carryOver = frontier.slice(STEP_LIMIT);

	const visitedInRun = new Map();
	const discoveredInRun = new Set();

	const crawler = new PlaywrightCrawler({
		maxRequestsPerCrawl: STEP_LIMIT,
		maxConcurrency: 3,
		requestHandlerTimeoutSecs: 30,

		async requestHandler({ request, page, enqueueLinks, response }) {
			const currentUrl = request.loadedUrl || request.url;
			const statusCode = response?.status?.() || null;
			if (statusCode && statusCode >= 400) return;
			if (shouldSkipCrawledUrl(currentUrl)) return;

			const title = await page.title();
			const textContent = await page.evaluate(() => {
				const el = document.querySelector('main, article, [role="main"], .content, #content, body');
				return el ? el.innerText.replace(/\s+/g, ' ').trim().slice(0, 50000) : '';
			});

			const normalizedCurrent = normalizeCrawlUrl(currentUrl);
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

			// Only follow links on the same host; skip URLs we've already crawled
			// (prior steps) or already queued (this run or persisted frontier).
			await enqueueLinks({
				strategy: 'same-hostname',
				transformRequestFunction: (req) => {
					if (shouldSkipCrawledUrl(req.url)) return false;
					const normalized = normalizeCrawlUrl(req.url);
					if (visited.has(normalized)) return false;
					if (discoveredInRun.has(normalized)) return false;
					discoveredInRun.add(normalized);
					return req;
				},
			});
		},

		failedRequestHandler({ request }) {
			console.warn(`Crawl failed: ${request.url}`);
		},
	});

	await crawler.run(batch);

	// Deduplicate by URL before indexing. Crawler request count can be higher than unique URLs.
	const uniquePages = new Map();
	for (const pageData of pages) {
		const docId = `${urlId}_${Buffer.from(pageData.url).toString('base64url')}`;
		if (!uniquePages.has(docId)) {
			uniquePages.set(docId, pageData);
		}
	}

	// Index all unique crawled pages
	for (const [docId, pageData] of uniquePages) {
		try {
			await indexDocument(hostId, 'pages', {
				id: docId,
				url: pageData.url,
				parent_url_id: urlId,
				title: pageData.title,
				text_content: pageData.text_content,
				project_id: projectId,
				crawled_at: Math.floor(Date.now() / 1000),
			});
			indexedCount++;
		} catch (err) {
			console.error(`Page index error (${pageData.url}):`, err.message);
		}
	}

	// Merge step results into persistent state.
	for (const normalized of visitedInRun.keys()) visited.add(normalized);
	const newFrontier = [
		...carryOver.filter((u) => !visited.has(u)),
		...[...discoveredInRun].filter((u) => !visited.has(u)),
	];
	const partial = newFrontier.length > 0;

	const update = partial
		? {
			crawl_frontier: newFrontier,
			crawl_visited: [...visited],
			crawl_partial: true,
		}
		: {
			crawl_frontier: [],
			crawl_visited: [],
			crawl_partial: false,
			last_crawled: new Date(),
		};

	await Url.updateOne({ _id: urlId, host_id: hostId }, { $set: update });

	console.log(
		`Crawled ${pages.length} requests for ${urlDoc.url}; indexed ${indexedCount} unique pages; ` +
		`${partial ? `frontier remaining: ${newFrontier.length}` : 'crawl complete'}`,
	);
	return indexedCount;
}

/**
* Re-crawl all URLs with crawl_enabled.
*/
export async function reindexAll() {
	const urls = await Url.find({ crawl_enabled: true });
	console.log(`Reindexing ${urls.length} crawl-enabled URLs`);

	for (const urlDoc of urls) {
		try {
			await crawlSite(urlDoc);
		} catch (err) {
			console.error(`Reindex error for ${urlDoc.url}:`, err.message);
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
	console.log(`Reindexing ${urls.length} due crawl-enabled URLs`);

	let crawled = 0;
	for (const urlDoc of urls) {
		try {
			await crawlSite(urlDoc);
			crawled++;
		} catch (err) {
			console.error(`Reindex due error for ${urlDoc.url}:`, err.message);
		}
	}

	return crawled;
}
