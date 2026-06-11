import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
	return fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

describe('record infinite scroll wiring', () => {
	it('loads the shared helper before record section scripts', () => {
		const layout = read('views/layout.pug');
		const helperIndex = layout.indexOf('/js/infinite_scroll.js');
		assert.notEqual(helperIndex, -1);

		['notes', 'memories', 'urls', 'emails', 'ecc'].forEach((name) => {
			const sectionIndex = layout.indexOf('/js/' + name + '.js');
			assert.notEqual(sectionIndex, -1);
			assert.ok(helperIndex < sectionIndex);
		});
	});

	it('exposes a shared observer plus scroll fallback helper', () => {
		const helper = read('public/js/infinite_scroll.js');

		assert.ok(helper.includes('window.kkInfiniteScroll = { create: create };'));
		assert.ok(helper.includes('new IntersectionObserver'));
		assert.ok(helper.includes("root.addEventListener('scroll'"));
		assert.ok(helper.includes("window.addEventListener('resize'"));
		assert.ok(helper.includes('kick: requestLoad'));
		assert.ok(helper.includes('destroy: destroy'));
		assert.ok(helper.includes('var loading = false;'));
		assert.ok(helper.includes('Promise.resolve(loadResult)'));
		assert.ok(helper.includes('sentinelNearRoot()) requestLoad()'));
	});

	it('paginates project record sections with the shared helper', () => {
		const sections = [
			{
				source: read('public/js/notes.js'),
				sentinel: 'notes-scroll-sentinel',
				loadMore: 'loadMoreNotes',
				appendCall: 'renderNotes(notes, true)',
			},
			{
				source: read('public/js/memories.js'),
				sentinel: 'memories-scroll-sentinel',
				loadMore: 'loadMoreMemories',
				appendCall: 'renderMemories(memories, true)',
			},
			{
				source: read('public/js/urls.js'),
				sentinel: 'urls-scroll-sentinel',
				loadMore: 'loadMoreUrls',
				appendCall: 'renderUrls(urls, true)',
			},
		];

		sections.forEach(({ source, sentinel, loadMore, appendCall }) => {
			assert.ok(source.includes('var PAGE_SIZE = 50;'));
			assert.ok(source.includes("'page=' + page"));
			assert.ok(source.includes("'limit=' + PAGE_SIZE"));
			assert.ok(source.includes('window.kkInfiniteScroll?.create'));
			assert.ok(source.includes("sentinelClass: '" + sentinel + "'"));
			assert.ok(source.includes('onLoadMore: ' + loadMore));
			assert.ok(source.includes(appendCall));
			assert.ok(source.includes('infiniteScroll?.kick()'));
		});
	});

	it('uses shared infinite scroll for email record sections only', () => {
		const emails = read('public/js/emails.js');
		const ecc = read('public/js/ecc.js');

		assert.ok(emails.includes('window.kkInfiniteScroll?.create'));
		assert.ok(emails.includes("sentinelClass: 'emails-scroll-sentinel'"));
		assert.ok(!emails.includes('new IntersectionObserver'));

		assert.ok(ecc.includes('window.kkInfiniteScroll?.create'));
		assert.ok(ecc.includes("sentinelClass: 'ecc-scroll-sentinel'"));
		assert.ok(ecc.includes('rootMarginPx: 900'));
		assert.ok(ecc.includes("activeMailbox !== 'drafts'"));
		assert.ok(ecc.includes('!detailActive'));
		assert.ok(!ecc.includes('new IntersectionObserver'));
	});

	it('gives scroll sentinels nonzero dimensions', () => {
		const css = read('public/css/app.css');

		assert.match(css, /\.kk-scroll-sentinel,\n\.emails-scroll-sentinel,\n\.ecc-scroll-sentinel\s*\{[\s\S]*min-height:\s*1px;[\s\S]*height:\s*1px;/);
	});
});
