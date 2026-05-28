import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { indexEmailNow, removeEmailFromIndexNow } from '../services/email_index_service.js';

describe('Email index service', () => {
	it('marks email indexed only after immediate Typesense import succeeds', async () => {
		let indexed = null;
		let stateUpdate = null;

		const result = await indexEmailNow('host-1', {
			_id: '507f1f77bcf86cd799439011',
			host_id: 'host-1',
			project: '507f1f77bcf86cd799439012',
			subject: 'Indexed',
			in_trash: false,
		}, {
			indexFn: async (hostId, type, email) => {
				indexed = { hostId, type, email };
			},
			updateFn: async (query, update, options) => {
				stateUpdate = { query, update, options };
			},
		});

		assert.equal(result, true);
		assert.equal(indexed.type, 'emails');
		assert.equal(indexed.email.subject, 'Indexed');
		assert.deepEqual(stateUpdate.update, { $set: { is_indexed: true } });
		assert.deepEqual(stateUpdate.options, { timestamps: false });
	});

	it('leaves scheduler retry flag untouched when immediate import fails', async () => {
		let updateCalled = false;
		const originalConsoleError = console.error;
		console.error = () => {};
		try {
			const result = await indexEmailNow('host-1', {
				_id: '507f1f77bcf86cd799439011',
				host_id: 'host-1',
				project: '507f1f77bcf86cd799439012',
				subject: 'Broken',
				in_trash: false,
			}, {
				indexFn: async () => {
					throw new Error('Typesense down');
				},
				updateFn: async () => {
					updateCalled = true;
				},
			});

			assert.equal(result, false);
			assert.equal(updateCalled, false);
		} finally {
			console.error = originalConsoleError;
		}
	});

	it('removes trashed email documents immediately', async () => {
		let removed = null;
		let stateUpdate = null;

		const result = await removeEmailFromIndexNow('host-1', '507f1f77bcf86cd799439011', {
			removeFn: async (hostId, type, id) => {
				removed = { hostId, type, id };
			},
			updateFn: async (query, update) => {
				stateUpdate = { query, update };
			},
		});

		assert.equal(result, true);
		assert.deepEqual(removed, { hostId: 'host-1', type: 'emails', id: '507f1f77bcf86cd799439011' });
		assert.deepEqual(stateUpdate.update, { $set: { is_indexed: true } });
	});
});
