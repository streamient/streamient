import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import pug from 'pug';

function localPath(relativePath) {
	return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

class UrlListHarness {
	constructor(type = 'url', endpoint = 'urls') {
		this.type = type;
		this.rows = [];
		this.requests = [];
		this.errors = [];
		this.root = { scrollTop: 240 };
		this.list = {
			querySelector: (selector) => selector === '.' + type + '-item' ? this.rows[0] : selector === '.' + type + '-empty' ? { remove() {} } : this.rows.find((row) => selector.includes('"' + row.dataset.id + '"')),
			querySelectorAll: () => this.rows,
			insertBefore: (row, next) => this.rows.splice(next ? this.rows.indexOf(next) : this.rows.length, 0, row),
			replaceChildren: () => { throw new Error('Unexpected list reload'); },
		};
		const document = {
			activeElement: null,
			getElementById: (id) => id === endpoint + '-list' ? this.list : this.root,
			createElement: () => {
				const template = { content: {} };
				Object.defineProperty(template, 'innerHTML', { set: (html) => { template.content.firstElementChild = this.row(html); } });
				return template;
			},
		};
		this.context = vm.createContext({
			window: {}, document, currentProjectId: 'project-one', CSS: { escape: (value) => value },
			api: async (method, path) => { this.requests.push([method, path]); return this.response; },
			showError: (message) => this.errors.push(message),
		});
		vm.runInContext(readFileSync(localPath('public/js/list_items.js'), 'utf8'), this.context);
		const source = readFileSync(localPath('public/js/urls.js'), 'utf8');
		vm.runInContext(source.replace('window.__sections.urls = { mount: mount, unmount: unmount };', 'listEl = document.getElementById("urls-list"); itemUpdater = window.StreamientListItems.create({ list: listEl, type: "url", endpoint: "urls", bind: bindUrlItem, sortField: "createdAt" }); window.handlers = { onModalSaved, onModalDeleted, onUrlUpdated, onUrlDeleted };'), this.context);
		this.handlers = this.context.window.handlers;
		if (type !== 'url') {
			this.context.type = type;
			this.context.endpoint = endpoint;
			vm.runInContext('const shared = window.StreamientListItems.create({ list: document.getElementById(endpoint + "-list"), type, endpoint, bind() {} }); window.handlers = { onUrlUpdated: shared.update, onUrlDeleted: shared.remove };', this.context);
			this.handlers = this.context.window.handlers;
		}
	}
	row(html) {
		const checkbox = { checked: false, focused: false, focus() { this.focused = true; }, matches: () => true };
		const row = {
			dataset: { id: html.match(/data-id="([^"]+)"/)[1] }, html, checkbox,
			querySelector: () => checkbox,
			addEventListener() {},
			contains: (element) => element === checkbox,
			replaceWith: (next) => this.rows.splice(this.rows.indexOf(row), 1, next),
			remove: () => this.rows.splice(this.rows.indexOf(row), 1),
		};
		return row;
	}
	url(id, updatedAt = '2026-09-17T05:00:00Z', extra = {}) {
		return { _id: id, url: 'https://example.com', project: 'project-one', createdAt: '2026-09-17T04:00:00Z', updatedAt, html: `<div data-id="${id}">${updatedAt}</div>`, ...extra };
	}
}

describe('URLs section UI', () => {
	it('applies one rem horizontal padding to every section', () => {
		const source = readFileSync(localPath('views/layout.pug'), 'utf8');

		assert.match(source, /#page-content\.px-3/);
	});

	it('uses a contrast-safe crawl badge in dark mode', () => {
		const source = pug.renderFile(localPath('views/ajax/url_item.pug'), { url: { _id: 'one', crawl_enabled: true } });

		assert.match(source, /class="badge text-bg-success mt-1"/);
		assert.doesNotMatch(source, /class="badge bg-success mt-1"/);
	});
	it('inserts the saved response immediately and reconciles duplicate/socket updates without reloading', async () => {
		const harness = new UrlListHarness();
		const saved = harness.url('one');
		harness.handlers.onModalSaved({ detail: { type: 'urls', id: saved._id, url: saved } });
		assert.equal(harness.rows.length, 1);
		const original = harness.rows[0];
		original.checkbox.checked = true;
		await harness.handlers.onUrlUpdated({ detail: saved });
		assert.equal(harness.rows[0], original);
		await harness.handlers.onUrlUpdated({ detail: harness.url('one', '2026-09-17T06:00:00Z') });
		assert.equal(harness.rows.length, 1);
		assert.equal(harness.rows[0].checkbox.checked, true);
		assert.equal(harness.root.scrollTop, 240);
		assert.deepEqual(harness.requests, []);
	});
	it('rejects stale updates, removes moved records, and never resurrects deleted records from delayed responses', async () => {
		const harness = new UrlListHarness();
		await harness.handlers.onUrlUpdated({ detail: harness.url('one', '2026-09-17T06:00:00Z') });
		const current = harness.rows[0];
		await harness.handlers.onUrlUpdated({ detail: harness.url('one') });
		assert.equal(harness.rows[0], current);
		await harness.handlers.onUrlUpdated({ detail: harness.url('one', '2026-09-17T07:00:00Z', { project: 'other' }) });
		assert.equal(harness.rows.length, 0);
		let resolve;
		harness.response = new Promise((done) => { resolve = done; });
		const pending = harness.handlers.onUrlUpdated({ detail: { _id: 'two' } });
		harness.handlers.onModalDeleted({ detail: { type: 'urls', id: 'two' } });
		resolve({ url: harness.url('two') });
		await pending;
		assert.equal(harness.rows.length, 0);
	});
	it('retains the list when item reconciliation fails', async () => {
		const harness = new UrlListHarness();
		await harness.handlers.onUrlUpdated({ detail: harness.url('one') });
		const current = harness.rows[0];
		harness.context.api = async () => { throw new Error('Offline'); };
		await harness.handlers.onUrlUpdated({ detail: { _id: 'one' } });
		assert.equal(harness.rows[0], current);
		assert.match(harness.errors[0], /Offline/);
	});

	it('shares stable-ID updates across note, memory and email lists, keeping focus, selection and deletion ordering', async () => {
		for (const [type, endpoint] of [['note', 'notes'], ['memory', 'memories'], ['email', 'emails']]) {
			const harness = new UrlListHarness(type, endpoint);
			await harness.handlers.onUrlUpdated({ detail: harness.url('one') });
			const first = harness.rows[0];
			first.checkbox.checked = true;
			harness.context.document.activeElement = first.checkbox;
			await harness.handlers.onUrlUpdated({ detail: harness.url('one', '2026-09-17T06:00:00Z') });
			assert.equal(harness.rows[0].checkbox.checked, true);
			assert.equal(harness.rows[0].checkbox.focused, true);
			assert.equal(harness.root.scrollTop, 240);
			harness.handlers.onUrlDeleted({ detail: { _id: 'one', updatedAt: '2026-09-17T07:00:00Z' } });
			await harness.handlers.onUrlUpdated({ detail: harness.url('one', '2026-09-17T06:00:00Z') });
			assert.equal(harness.rows.length, 0);
			await harness.handlers.onUrlUpdated({ detail: harness.url('one', '2026-09-17T08:00:00Z') });
			assert.equal(harness.rows.length, 1);
			harness.handlers.onUrlDeleted({ detail: { _id: 'one', updatedAt: '2026-09-17T07:00:00Z' } });
			assert.equal(harness.rows.length, 1);
			const source = readFileSync(localPath('public/js/' + endpoint + '.js'), 'utf8');
			assert.ok(source.includes("addWindowListener('" + type + ":updated', itemUpdater.update)"));
			assert.doesNotMatch(source, /addWindowListener\('batch-done'/);
		}
	});

	it('reuses the AJAX section from the full-page route', () => {
		const source = readFileSync(localPath('views/urls.pug'), 'utf8');

		assert.match(source, /include ajax\/section\/urls/);
	});
});
