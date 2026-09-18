import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import pug from 'pug';
import { fileURLToPath } from 'node:url';
import { createProductUpdatesRouter, isProductUpdatesEligible } from '../routes/product_updates.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('gates product updates to canonical hosted sessions', () => {
	const settings = { contentApiKey: 'content-key' };
	assert.equal(isProductUpdatesEligible({ isHosted: true, session: {} }, settings), true);
	assert.equal(isProductUpdatesEligible({ isHosted: false, session: {} }, settings), false);
	assert.equal(isProductUpdatesEligible({ isHosted: true, whiteLabelHostId: 'host-1', session: {} }, settings), false);
	assert.equal(isProductUpdatesEligible({ isHosted: true, streamientDemoContext: {}, session: {} }, settings), false);
	assert.equal(isProductUpdatesEligible({ isHosted: true, session: { impersonating: true } }, settings), false);
	assert.equal(isProductUpdatesEligible({ isHosted: true, session: {} }, { contentApiKey: '' }), false);
});

test('renders escaped server-owned modal and archive fragments', () => {
	const update = { _id: 'update-1', title: '<script>bad()</script>', excerpt: '<strong>copy</strong>', link: 'https://streamient.com/blog/update/', feature_image: 'https://cdn.example.com/image.jpg', published_at: new Date('2026-08-31T00:00:00.000Z') };
	const locals = { product_updates: { updates: [update], through_update_id: 'update-1', latest_update_id: 'update-1', next_cursor: '' }, formatDate: () => 'August 31st, 2026', icon: () => '' };
	const modal = pug.renderFile(path.join(root, 'views/ajax/product_updates_modal.pug'), locals);
	const news = pug.renderFile(path.join(root, 'views/ajax/section/news.pug'), locals);
	assert.match(modal, /id="productUpdatesModal"/);
	assert.match(modal, /data-bs-backdrop="static"/);
	assert.doesNotMatch(modal, /<script>bad\(\)<\/script>/);
	assert.match(modal, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
	assert.match(news, /id="product-updates-news"/);
	assert.match(news, /data-product-update-id="update-1"/);
	assert.match(news, /August 31st, 2026/);
	assert.doesNotMatch(news, /<strong>copy<\/strong>/);
	const layout = fs.readFileSync(path.join(root, 'views/layout.pug'), 'utf8');
	assert.match(layout, /#product-updates-drawer\.offcanvas\.offcanvas-end/);
	assert.doesNotMatch(layout, /span\.fw-semibold\.d-none\.d-md-inline What's new/);
	assert.match(fs.readFileSync(path.join(root, 'views/news.pug'), 'utf8'), /extends dashboard/);
	assert.match(fs.readFileSync(path.join(root, 'public/css/app.css'), 'utf8'), /--bs-offcanvas-width: var\(--fw-drawer-width, 37\.5rem\)/);
});

test('uses incremental server fragments without reloads or client-created cards', () => {
	const source = fs.readFileSync(path.join(root, 'public/js/product_updates.js'), 'utf8');
	assert.match(source, /ajax\/product-updates\/items/);
	assert.match(source, /data-product-update-items-fragment/);
	assert.match(source, /anotherModalIsOpen/);
	assert.match(source, /dismissInFlight/);
	assert.match(source, /Offcanvas\.getOrCreateInstance\(drawer\)\.show\(\)/);
	assert.match(source, /history\.pushState\(\{ productNews: true \}/);
	assert.match(source, /hidden\.bs\.offcanvas/);
	assert.match(source, /archiveStale/);
	assert.match(source, /version !== statusVersion/);
	assert.match(source, /ids\.has\(item\.dataset\.productUpdateId\)/);
	assert.doesNotMatch(source, /location\.reload|window\.location\.href/);
	assert.doesNotMatch(source, /navigateTo|page-content/);
	assert.doesNotMatch(source, /createElement\(['"]article['"]\)|createElement\(['"]img['"]\)/);
	const appSource = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
	assert.doesNotMatch(appSource, /['"]\/news['"]:\s*\{[^}]*partial/);
	assert.match(appSource, /state\.productNewsReturn/);
	assert.match(appSource, /path === '\/news'[\s\S]*mountCurrent\('\/dashboard'\)/);
});

test('serves authenticated internal status, modal, and seen routes while rejecting excluded hosts', async () => {
	let seenUpdateId = '';
	const update = { _id: 'update-1', title: 'Update', excerpt: 'Copy', link: 'https://streamient.com/blog/update/', feature_image: '', published_at: new Date() };
	const service = {
		getProductUpdateStatus: async () => ({ new_count: 2, has_modal: true }),
		getModalProductUpdates: async () => ({ updates: [update], through_update_id: 'update-1' }),
		markProductUpdatesSeen: async (_userId, updateId) => { seenUpdateId = updateId; return { seen_at: new Date() }; },
		listProductUpdates: async () => ({ updates: [update], latest_update_id: 'update-1', next_cursor: '' }),
	};
	const app = express();
	app.set('view engine', 'pug');
	app.set('views', path.join(root, 'views'));
	app.use(express.json());
	app.use((req, _res, next) => { req.isHosted = req.headers['x-test-excluded'] !== 'true'; req.whiteLabelHostId = req.headers['x-test-excluded'] === 'true' ? 'host-1' : ''; req.session = {}; req.userId = 'user-1'; next(); });
	app.use(createProductUpdatesRouter({ service, settings: { contentApiKey: 'content-key' } }));
	const server = app.listen(0);
	try {
		const base = `http://127.0.0.1:${server.address().port}`;
		const status = await fetch(`${base}/ajax/product-updates/status`);
		assert.deepEqual(await status.json(), { new_count: 2, has_modal: true });
		const modal = await fetch(`${base}/ajax/product-updates/modal`);
		assert.equal(modal.status, 200);
		assert.match(await modal.text(), /id="productUpdatesModal"/);
		const seen = await fetch(`${base}/ajax/product-updates/seen`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ update_id: 'update-1' }) });
		assert.equal(seen.status, 200);
		assert.equal(seenUpdateId, 'update-1');
		assert.equal((await fetch(`${base}/ajax/product-updates/status`, { headers: { 'x-test-excluded': 'true' } })).status, 404);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});
