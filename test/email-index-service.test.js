import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { indexEmailNow, indexEmailsNow, removeEmailFromIndexNow, removeEmailsFromIndexNow } from '../services/email_index_service.js';

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

	it('indexes soft-deleted email documents with trash fields', async () => {
		let indexed = null;

		const result = await indexEmailNow('host-1', {
			_id: '507f1f77bcf86cd799439011',
			host_id: 'host-1',
			project: '507f1f77bcf86cd799439012',
			subject: 'Trashed',
			in_trash: true,
			trashed_at: new Date('2026-06-05T12:27:00.000Z'),
		}, {
			indexFn: async (hostId, type, email) => {
				indexed = { hostId, type, email };
			},
			updateFn: async () => {},
		});

		assert.equal(result, true);
		assert.equal(indexed.type, 'emails');
		assert.equal(indexed.email.in_trash, true);
		assert.deepEqual(indexed.email.trashed_at, new Date('2026-06-05T12:27:00.000Z'));
	});

	it('removes permanently deleted email documents immediately', async () => {
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

	it('bulk indexes multiple emails with one Typesense call and one state update', async () => {
		let indexCall = null;
		let stateUpdate = null;
		const emails = [
			{ _id: '507f1f77bcf86cd799439011', host_id: 'host-1', project: '507f1f77bcf86cd799439012', subject: 'A' },
			{ _id: '507f1f77bcf86cd799439013', host_id: 'host-1', project: '507f1f77bcf86cd799439012', subject: 'B' },
		];

		const results = await indexEmailsNow('host-1', emails, {
			indexManyFn: async (hostId, type, docs) => {
				indexCall = { hostId, type, ids: docs.map((doc) => doc._id) };
				return docs.map((doc) => ({ id: doc._id, success: true }));
			},
			updateManyFn: async (query, update, options) => {
				stateUpdate = { query, update, options };
			},
		});

		assert.deepEqual(results.map((result) => result.success), [true, true]);
		assert.deepEqual(indexCall, { hostId: 'host-1', type: 'emails', ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'] });
		assert.deepEqual(stateUpdate.query, { _id: { $in: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'] }, host_id: 'host-1' });
		assert.deepEqual(stateUpdate.update, { $set: { is_indexed: true } });
		assert.deepEqual(stateUpdate.options, { timestamps: false });
	});

	it('does not mark failed bulk email imports as indexed', async () => {
		let stateUpdate = null;
		const emails = [
			{ _id: '507f1f77bcf86cd799439011', host_id: 'host-1', project: '507f1f77bcf86cd799439012', subject: 'A' },
			{ _id: '507f1f77bcf86cd799439013', host_id: 'host-1', project: '507f1f77bcf86cd799439012', subject: 'B' },
		];

		const results = await indexEmailsNow('host-1', emails, {
			indexManyFn: async () => [
				{ id: '507f1f77bcf86cd799439011', success: true },
				{ id: '507f1f77bcf86cd799439013', success: false, error: 'Typesense rejected doc' },
			],
			updateManyFn: async (query, update, options) => {
				stateUpdate = { query, update, options };
			},
		});

		assert.deepEqual(results.map((result) => result.success), [true, false]);
		assert.deepEqual(stateUpdate.query, { _id: { $in: ['507f1f77bcf86cd799439011'] }, host_id: 'host-1' });
	});

	it('bulk removes multiple email documents with one Typesense call', async () => {
		let removeCall = null;
		let stateUpdate = null;

		const results = await removeEmailsFromIndexNow('host-1', ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'], {
			removeManyFn: async (hostId, type, ids) => {
				removeCall = { hostId, type, ids };
				return ids.map((id) => ({ id, success: true }));
			},
			updateManyFn: async (query, update, options) => {
				stateUpdate = { query, update, options };
			},
		});

		assert.deepEqual(results.map((result) => result.success), [true, true]);
		assert.deepEqual(removeCall, { hostId: 'host-1', type: 'emails', ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'] });
		assert.deepEqual(stateUpdate.query, { _id: { $in: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'] }, host_id: 'host-1' });
	});
});
