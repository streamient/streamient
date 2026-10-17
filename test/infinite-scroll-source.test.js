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

		['notes', 'memories', 'urls', 'emails', 'trash'].forEach((name) => {
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
				appendCall: 'urls.forEach(applyUrlItem)',
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

	it('uses shared infinite scroll for email record sections', () => {
		const emails = read('public/js/emails.js');

		assert.ok(emails.includes('window.kkInfiniteScroll?.create'));
		assert.ok(emails.includes("sentinelClass: 'emails-scroll-sentinel'"));
		assert.ok(!emails.includes('new IntersectionObserver'));
	});

	it('uses shared infinite scroll for global trash', () => {
		const trash = read('public/js/trash.js');

		assert.ok(trash.includes('var PAGE_SIZE = 50;'));
		assert.ok(trash.includes("'page=' + page"));
		assert.ok(trash.includes("'limit=' + PAGE_SIZE"));
		assert.ok(trash.includes('window.kkInfiniteScroll?.create'));
		assert.ok(trash.includes("sentinelClass: 'trash-scroll-sentinel'"));
		assert.ok(trash.includes('onLoadMore: loadMoreTrash'));
		assert.ok(trash.includes('renderTrashItems(items, true)'));
		assert.ok(trash.includes("params.push('offset=' + offset)"));
		assert.ok(trash.includes('hasMore = loadedTrashItemCount() < total'));
		assert.ok(trash.includes('infiniteScroll?.kick()'));
		assert.ok(trash.includes('infiniteScroll.destroy()'));
		assert.ok(!trash.includes('new IntersectionObserver'));
	});

	it('updates global trash mutations incrementally without page or section reloads', () => {
		const trash = read('public/js/trash.js');
		const itemMutations = trash.slice(trash.indexOf('function bindTrashItem'), trash.indexOf('function renderTrashItems'));
		const batchMutations = trash.slice(trash.indexOf("batchRestoreBtn?.addEventListener"), trash.indexOf('filterBtns.forEach'));

		assert.match(trash, /function removeTrashItems\(items\)/);
		assert.match(trash, /item\.remove\(\)/);
		assert.match(trash, /function setButtonLoading\(button, loading\)/);
		assert.match(itemMutations, /removeTrashItems\(\[item\]\)/);
		assert.match(batchMutations, /removeTrashItems\(items\)/);
		assert.match(batchMutations, /listEl\.replaceChildren\(\)/);
		assert.match(itemMutations, /showError\(/);
		assert.match(batchMutations, /showError\(/);
		assert.doesNotMatch(itemMutations, /loadTrash\(|location\.reload|loadSection|navigateTo/);
		assert.doesNotMatch(batchMutations, /loadTrash\(|location\.reload|loadSection|navigateTo/);
	});

	it('gives scroll sentinels nonzero dimensions', () => {
		const css = read('public/css/app.css');

		assert.match(css, /\.st-scroll-sentinel,\n\.emails-scroll-sentinel\s*\{[\s\S]*min-height:\s*1px;[\s\S]*height:\s*1px;/);
	});
});
