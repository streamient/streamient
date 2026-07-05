import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectionName } from '../modules/typesense.js';
import config from '../config.js';

describe('Typesense collection prefix', () => {
	it('prefixes host-scoped collection names with the product prefix', () => {
		assert.equal(config.typesense.collectionPrefix, 'st');
		assert.equal(buildCollectionName('emails', 'host-1'), 'st_emails_host-1');
		assert.equal(buildCollectionName('notes', 'host-1'), 'st_notes_host-1');
	});

	it('keeps legacy names when the prefix is disabled', () => {
		const original = config.typesense.collectionPrefix;
		try {
			config.typesense.collectionPrefix = '';
			assert.equal(buildCollectionName('emails', 'host-1'), 'emails_host-1');
		} finally {
			config.typesense.collectionPrefix = original;
		}
	});
});
