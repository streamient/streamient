import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pug from 'pug';
import swagger from '../swagger.js';

describe('shared search UI contract', () => {
	it('renders accessible filters, selection and all four actions without placeholders', () => {
		const html = pug.renderFile(new URL('../views/ajax/section/search.pug', import.meta.url).pathname, { projects: [{ _id: 'source', name: 'Source' }] });
		assert.doesNotMatch(html, /<h1/);
		for (const id of ['search-query', 'search-project', 'search-tags', 'search-select-page', 'search-select-all']) assert.ok(html.includes('id="' + id + '"'));
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
		assert.doesNotMatch(updater + action, /location\.reload|location\.href|navigateTo|loadSection|load\(|\/search\/results|batch-done/);
		assert.doesNotMatch(script, /innerHTML\s*=\s*['"`]</);
	});
	it('documents filters, signed selections and bounded partial outcomes', () => {
		for (const path of ['/search/results', '/search/selection', '/search/actions', '/search/item']) assert.ok(swagger.paths[path].post.responses[400]);
		assert.equal(swagger.paths['/search/actions'].post.requestBody.content['application/json'].schema.properties.items.maxItems, 50);
		assert.deepEqual(swagger.components.schemas.SearchSelectionItem.required, ['id', 'type', 'version', 'ticket']);
		for (const path of ['/search/knowledge', '/notes/search', '/memories/search', '/urls/search']) assert.ok(swagger.paths[path].post.requestBody.content['application/json'].schema.properties.tags);
	});
});
