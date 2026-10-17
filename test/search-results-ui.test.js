import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pug from 'pug';
import swagger from '../swagger.js';
import vm from 'node:vm';

describe('shared search UI contract', () => {
	it('updates visible bulk rows without inserting off-page outcomes or blocking mixed-type creation', () => {
		const script = fs.readFileSync(new URL('../public/js/search_results.js', import.meta.url), 'utf8');
		const source = script.slice(script.indexOf('const applyItem ='), script.indexOf('const refreshItem ='));
		const items = Array.from({ length: 12 }, (_, index) => ({ type: 'notes', id: String(index), version: '1' }));
		const keyOf = (item) => item.type + ':' + item.id;
		const rows = new Map(items.slice(0, 10).map((item) => [keyOf(item), item]));
		const selected = new Map(items.map((item) => [keyOf(item), item]));
		let appended = 0;
		let replaced = 0;
		const context = vm.createContext({
			root: { querySelector: () => ({ appendChild() { appended++; } }) },
			filters: { per_page: 10 }, page: 1, total: 12, generation: 1, rows, selected, keyOf,
			revisions: new Map(), refreshes: new Map(), tombstones: new Set(), updateSelection() {},
			element: (key) => items.slice(0, 10).some((item) => keyOf(item) === key) ? { contains: () => false, replaceWith() { replaced++; } } : null,
			document: { createElement: () => ({ content: { firstElementChild: {} } }) },
		});
		vm.runInContext(source + '\nglobalThis.applyItem = applyItem;', context);
		for (const item of items) context.applyItem({ ...item, success: true, item, html: '<div></div>' }, { mutation: true });
		assert.equal(replaced, 10);
		assert.equal(appended, 0);
		assert.equal(rows.size, 10);
		assert.equal(selected.size, 0);
		assert.equal(context.total, 12);
		const memory = { type: 'memory', id: 'new-memory', version: '1' };
		context.applyItem({ ...memory, success: true, item: memory, html: '<div></div>' });
		assert.equal(appended, 1);
		assert.equal(rows.size, 11);
	});

	it('renders accessible filters, selection and all four actions without placeholders', () => {
		const html = pug.renderFile(new URL('../views/ajax/section/search.pug', import.meta.url).pathname, { projects: [{ _id: 'source', name: 'Source' }], icon: () => '' });
		assert.doesNotMatch(html, /<h1/);
		for (const id of ['search-query', 'search-project', 'search-tags', 'search-types', 'search-select-all']) assert.ok(html.includes('id="' + id + '"'));
		assert.match(html, /id="search-types" multiple/);
		assert.match(html, /type:note,memory,url,email/);
		assert.doesNotMatch(html, /search-select-page/);
		assert.match(html, /class="batch-floating-bar d-none"/);
		for (const action of ['move', 'add_tags', 'remove_tags', 'trash']) assert.ok(html.includes('data-search-action="' + action + '"'));
		assert.doesNotMatch(html, /placeholder=/);
	});
	it('keeps mutations and socket reconciliation item-level; navigation is separate', () => {
		const script = fs.readFileSync(new URL('../public/js/search_results.js', import.meta.url), 'utf8');
		const updater = script.slice(script.indexOf('const applyItem ='), script.indexOf('const loadTags ='));
		const action = script.slice(script.indexOf('const runAction ='), script.indexOf('const actionDialog ='));
		assert.match(updater, /existing\.replaceWith\(next\)/);
		assert.match(updater, /existing\?\.remove\(\)/);
		assert.match(updater, /tombstones\.has\(key\)/);
		assert.match(updater, /refreshes\.get\(key\) !== sequence/);
		assert.match(updater, /focus\(\{ preventScroll: true \}\)/);
		assert.match(action, /applyItem\(outcome/);
		assert.match(action, /dispatchEvent\(new CustomEvent\('counts:refresh'\)\)/);
		assert.doesNotMatch(updater + action, /location\.reload|location\.href|navigateTo|loadSection|load\(|\/search\/results|batch-done/);
		assert.doesNotMatch(script, /innerHTML\s*=\s*['"`]</);
	});
	it('documents filters, signed selections and bounded partial outcomes', () => {
		for (const path of ['/search/results', '/search/selection', '/search/actions', '/search/item']) assert.ok(swagger.paths[path].post.responses[400]);
		assert.equal(swagger.paths['/search/actions'].post.requestBody.content['application/json'].schema.properties.items.maxItems, 50);
		assert.deepEqual(swagger.components.schemas.SearchSelectionItem.required, ['id', 'type', 'version', 'ticket']);
		for (const path of ['/search/knowledge', '/notes/search', '/memories/search', '/urls/search']) assert.ok(swagger.paths[path].post.requestBody.content['application/json'].schema.properties.tags);
		for (const path of ['/search/quick', '/search/knowledge']) assert.ok(swagger.paths[path].post.requestBody.content['application/json'].schema.properties.types);
		assert.ok(swagger.paths['/counts'].get.responses[500]);
	});
});
