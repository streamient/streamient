import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const [section, singular, load, more] of [['notes', 'note', 'loadNotes', 'loadMoreNotes'], ['memories', 'memory', 'loadMemories', 'loadMoreMemories'], ['urls', 'url', 'loadUrls', 'loadMoreUrls'], ['emails', 'email', 'loadEmails', 'loadMore']]) {
	it(section + ' continues after removing the first 50 records or inserting a new head item', async () => {
		const dataset = Array.from({ length: 120 }, (_, index) => ({ _id: String(index + 1) }));
		const rows = [];
		const offsets = [];
		const list = { querySelectorAll(selector) { assert.equal(selector, '.' + singular + '-item'); return rows; } };
		const context = vm.createContext({
			window: {}, currentProjectId: null,
			document: { getElementById: () => list },
			api: async (method, path) => {
				const params = new URL(path, 'https://s.n.lan').searchParams;
				assert.ok(params.has('offset'));
				const offset = Number(params.get('offset'));
				offsets.push(offset);
				return { [section]: dataset.slice(offset, offset + Number(params.get('limit'))) };
			},
			showError(message) { throw new Error(message); },
		});
		const source = readFileSync(new URL('../public/js/' + section + '.js', import.meta.url), 'utf8');
		context.rows = rows;
		vm.runInContext(source.replace('window.__sections.' + section + ' = { mount: mount, unmount: unmount };', `listEl = document.getElementById('list'); itemUpdater = { reset() { rows.length = 0; }, apply(item) { if (!rows.some(row => row._id === item._id)) rows.push(item); }, empty() {} }; window.pagination = { load: ${load}, more: ${more} };`), context);
		await context.window.pagination.load();
		assert.equal(rows.length, 50);
		dataset.splice(0, 50);
		rows.splice(0, 50);
		await context.window.pagination.more();
		assert.equal(offsets.at(-1), 0);
		assert.equal(rows[0]._id, '51');
		assert.equal(rows[49]._id, '100');
		await context.window.pagination.load();
		const newHead = { _id: 'new' };
		dataset.unshift(newHead);
		rows.unshift(newHead);
		await context.window.pagination.more();
		assert.equal(offsets.at(-1), 51);
		assert.equal(rows[51]._id, '101');
		assert.equal(new Set(rows.map(item => item._id)).size, rows.length);
	});
}
