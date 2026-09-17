import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Url } from '../model/url.js';
import { attachScreenshotUrl, getUrl, listUrls, saveUrl } from '../services/url_service.js';

describe('URL service listing', () => {
	it('returns the saved record markup without needing a list query and escapes user text', () => {
		const doc = { _id: 'url-one', title: '<script>bad()</script>', description: '<img onerror="bad()">', url: 'https://example.com', crawl_enabled: true };
		const result = attachScreenshotUrl(doc);
		assert.match(result.html, /data-id="url-one"/);
		assert.match(result.html, /&lt;script&gt;/);
		assert.doesNotMatch(result.html, /<script>|<img onerror/);
		assert.equal(doc.html, undefined);
	});
	it('reconciles one URL against acknowledged state with tenant scope and lean results', async () => {
		const originalFindOne = Url.findOne;
		const calls = [];
		try {
			Url.findOne = (filter) => {
				calls.push(filter);
				return { read(value) { calls.push(value); return this; }, lean() { calls.push('lean'); return { _id: 'url-one' }; } };
			};
			const result = await getUrl('tenant-one', 'url-one');
			assert.deepEqual(calls, [{ _id: 'url-one', host_id: 'tenant-one' }, 'primary', 'lean']);
			assert.match(result.html, /data-id="url-one"/);
		} finally {
			Url.findOne = originalFindOne;
		}
	});
	it('sorts newest saved URLs first with deterministic pagination and lean results', async () => {
		const originalFind = Url.find;
		const calls = [];
		const docs = [{ _id: 'url-2', title: 'Newest' }, { _id: 'url-1', title: 'Older' }];
		const chain = {
			select(value) { calls.push(['select', value]); return this; },
			sort(value) { calls.push(['sort', value]); return this; },
			skip(value) { calls.push(['skip', value]); return this; },
			limit(value) { calls.push(['limit', value]); return this; },
			lean() { calls.push(['lean']); return docs; },
		};

		try {
			Url.find = (query) => {
				calls.push(['find', query]);
				return chain;
			};

			const result = await listUrls('host-1', 'project-1', { page: 2, limit: 25 });

			assert.deepEqual(calls, [
				['find', { host_id: 'host-1', in_trash: { $ne: true }, project: 'project-1' }],
				['select', '-text_content'],
				['sort', { createdAt: -1, _id: -1 }],
				['skip', 25],
				['limit', 25],
				['lean'],
			]);
			assert.deepEqual(result.map(({ html, ...doc }) => doc), docs);
			assert.match(result[0].html, /data-id="url-2"/);
		} finally {
			Url.find = originalFind;
		}
	});
});

describe('URL service duplicate handling', () => {
	it('returns an existing active URL in the same project instead of creating a duplicate', async () => {
		const originalFindOne = Url.findOne;
		const originalCreate = Url.create;

		let capturedQuery = null;
		let createCalled = false;
		const existingUrl = {
			_id: 'url-1',
			url: 'https://example.com/path',
			normalized_url: 'https://example.com/path',
			title: 'Example',
			$locals: {},
		};

		try {
			Url.findOne = async (query) => {
				capturedQuery = query;
				return existingUrl;
			};
			Url.create = async () => {
				createCalled = true;
				return null;
			};

			const result = await saveUrl('user-1', 'host-1', {
				url: 'https://EXAMPLE.com/path#fragment',
				project: 'project-1',
			});

			assert.equal(result, existingUrl);
			assert.equal(result.$locals.wasDuplicate, true);
			assert.equal(createCalled, false);
			assert.equal(capturedQuery.host_id, 'host-1');
			assert.equal(capturedQuery.project, 'project-1');
			assert.deepEqual(capturedQuery.in_trash, { $ne: true });
			assert.ok(capturedQuery.$or.some((condition) => condition.normalized_url === 'https://example.com/path'));
		} finally {
			Url.findOne = originalFindOne;
			Url.create = originalCreate;
		}
	});
});
