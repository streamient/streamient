import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Url } from '../model/url.js';
import { saveUrl } from '../services/url_service.js';

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
