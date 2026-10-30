import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { Project } from '../model/project.js';
import { batchRestore, emptyTrash, getTrashCount, listTrash, permanentDelete, restoreItem } from '../services/trash_service.js';
import { mockTenantWork } from './helpers/tenant-work.js';

function cloneDoc(doc) {
	return { ...doc };
}

function chainFindIds(ids) {
	const query = {
		select: () => query,
		read: () => query,
		lean: async () => ids.map((id) => ({ _id: { toString: () => id } })),
	};
	return query;
}

describe('Trash service Typesense bulk writes', () => {
	it('lists mixed trash items from Typesense sorted by trashed date', async () => {
		const calls = [];
		const responses = {
			notes: {
				found: 1,
				hits: [
					{ document: { id: 'note-1', source_id: 'note-1', title: 'Note title', project_id: 'project-1', trashed_at: 1780662300 } },
				],
			},
			memory: {
				found: 0,
				hits: [],
			},
			urls: {
				found: 1,
				hits: [
					{ document: { id: 'url-1', source_id: 'url-1', title: 'URL title', url: 'https://example.com', project_id: 'project-1', trashed_at: 1780662200 } },
				],
			},
			emails: {
				found: 1,
				hits: [
					{ document: { id: 'email-1', source_id: 'email-1', subject: 'Email subject', project_id: 'project-1', trashed_at: 1780662400 } },
				],
			},
		};

		const result = await listTrash('host-1', { page: 1, limit: 2 }, {
			listTrashDocuments: async (hostId, types, options) => {
				calls.push({ hostId, types, options });
				return {
					found: 3,
					hits: [responses.emails.hits[0], responses.notes.hits[0]],
				};
			},
		});

		assert.deepEqual(result.items.map((item) => item._id), ['email-1', 'note-1']);
		assert.equal(result.items[0]._type, 'emails');
		assert.equal(result.items[0].subject, 'Email subject');
		assert.equal(result.total, 3);
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0].types, ['notes', 'memory', 'urls', 'emails']);
		assert.equal(calls[0].options.sort_by, 'trashed_at:desc');
		assert.equal(calls[0].options.union, true);
		assert.equal(calls[0].options.page, 1);
		assert.equal(calls[0].options.perPage, 2);
	});

	it('gets trash count from Typesense', async () => {
		const counts = { notes: 2, memory: 3, urls: 4, emails: 5 };
		const calls = [];

		const count = await getTrashCount('host-1', {
			listTrashDocuments: async (hostId, types, options) => {
				calls.push({ hostId, types, options });
				return Object.fromEntries(types.map((type) => [type, { found: counts[type], hits: [] }]));
			},
		});

		assert.equal(count, 14);
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0].types, ['notes', 'memory', 'urls', 'emails']);
		assert.equal(calls[0].options.perPage, 1);
	});

	it('restores selected items with one bulk index call per type', async () => {
		const restoreTenant = mockTenantWork();
		const originals = {
			noteFindOneAndUpdate: Note.findOneAndUpdate,
			noteUpdateMany: Note.updateMany,
			memoryFindOneAndUpdate: Memory.findOneAndUpdate,
			memoryUpdateMany: Memory.updateMany,
			projectFindOneAndUpdate: Project.findOneAndUpdate,
			projectUpdateOne: Project.updateOne,
		};
		const notes = new Map([
			['note-1', { _id: 'note-1', host_id: 'host-1', project: 'project-1', title: 'Note 1', in_trash: true }],
			['note-2', { _id: 'note-2', host_id: 'host-1', project: 'project-1', title: 'Note 2', in_trash: true }],
		]);
		const memories = new Map([
			['memory-1', { _id: 'memory-1', host_id: 'host-1', project: 'project-1', title: 'Memory 1', in_trash: true }],
		]);
		const indexCalls = [];
		const stateUpdates = [];

		Note.findOneAndUpdate = async (query, update) => {
			const doc = notes.get(query._id);
			if (!doc || doc.host_id !== query.host_id || doc.in_trash !== true) return null;
			Object.assign(doc, update.$set || {});
			delete doc.trashed_at;
			return cloneDoc(doc);
		};
		Memory.findOneAndUpdate = async (query, update) => {
			const doc = memories.get(query._id);
			if (!doc || doc.host_id !== query.host_id || doc.in_trash !== true) return null;
			Object.assign(doc, update.$set || {});
			delete doc.trashed_at;
			return cloneDoc(doc);
		};
		Note.updateMany = async (query, update, options) => stateUpdates.push({ type: 'notes', query, update, options });
		Memory.updateMany = async (query, update, options) => stateUpdates.push({ type: 'memory', query, update, options });
		Project.findOneAndUpdate = () => ({ select() { return this; }, lean: async () => ({ _id: 'project-1', host_id: 'host-1' }) });
		Project.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });

		try {
			const restored = await batchRestore('host-1', [
				{ type: 'notes', id: 'note-1' },
				{ type: 'notes', id: 'note-2' },
				{ type: 'memories', id: 'memory-1' },
			], {
				bulkIndexDocuments: async (hostId, type, docs) => {
					indexCalls.push({ hostId, type, ids: docs.map((doc) => doc._id) });
					return docs.map((doc) => ({ id: doc._id, success: true }));
				},
			});

			assert.deepEqual(restored.map((doc) => doc._id), ['note-1', 'note-2', 'memory-1']);
			assert.deepEqual(indexCalls, [
				{ hostId: 'host-1', type: 'notes', ids: ['note-1', 'note-2'] },
				{ hostId: 'host-1', type: 'memory', ids: ['memory-1'] },
			]);
			assert.deepEqual(stateUpdates.map((call) => call.query), [
				{ _id: { $in: ['note-1', 'note-2'] }, host_id: 'host-1' },
				{ _id: { $in: ['memory-1'] }, host_id: 'host-1' },
			]);
			// bulkIndexDocuments now marks indexed via the claim protocol; only the
			// pending pre-step remains here, so there is no unconditional mark=true.
			assert.deepEqual(stateUpdates.map((call) => call.update.$set.is_indexed), [false, false]);
		} finally {
			Note.findOneAndUpdate = originals.noteFindOneAndUpdate;
			Note.updateMany = originals.noteUpdateMany;
			Memory.findOneAndUpdate = originals.memoryFindOneAndUpdate;
			Memory.updateMany = originals.memoryUpdateMany;
			Project.findOneAndUpdate = originals.projectFindOneAndUpdate;
			Project.updateOne = originals.projectUpdateOne;
			restoreTenant();
		}
	});

	it('empty trash uses returned deletes and preserves a restored item', async (t) => {
		const activeId = '507f1f77bcf86cd799439011';
		const removeCalls = [];
		const graphCalls = [];
		const indexCalls = [];
		const stateUpdates = [];
		for (const [Model, ids] of [[Note, ['note-1', 'note-2']], [Memory, ['memory-1']], [Url, []], [Email, ['email-1']]]) {
			t.mock.method(Model, 'findOneAndDelete', async () => ids.length ? { _id: ids.shift() } : null);
			t.mock.method(Model, 'find', (filter) => ({ lean: async () => Model === Note ? filter._id.$in.filter((id) => id === activeId).map((id) => ({ _id: id })) : [] }));
		}
		t.mock.method(Note, 'updateMany', async (query, update) => stateUpdates.push({ query, update }));
		const result = await emptyTrash('host-1', {
			exportTrashDocuments: async (hostId, type) => type === 'notes' ? [{ source_id: 'note-1' }, { source_id: 'note-orphan' }, { source_id: activeId }] : [],
			bulkRemoveDocuments: async (hostId, type, ids) => removeCalls.push([type, ids]),
			removeGraphLinks: async (hostId, ids) => graphCalls.push(ids),
			bulkIndexDocuments: async (hostId, type, docs) => { indexCalls.push(...docs.map((doc) => String(doc._id))); return docs.map((doc) => ({ id: String(doc._id), success: true })); },
		});
		assert.deepEqual(result, { deleted: 5 });
		assert.deepEqual(removeCalls, [['notes', ['note-1', 'note-orphan', 'note-2']], ['memory', ['memory-1']], ['emails', ['email-1']]]);
		assert.deepEqual(graphCalls[0], ['note-1', 'note-orphan', 'note-2']);
		assert.deepEqual(indexCalls, [activeId]);
		// bulkIndexDocuments marks indexed via the claim protocol; only the
		// pending pre-step remains here.
		assert.deepEqual(stateUpdates.map((call) => call.update.$set.is_indexed), [false]);
	});

	it('empty trash keeps the Typesense row of an item trashed while it runs and batches existence checks', async (t) => {
		const finds = [];
		const removed = [];
		let ids = ['note-1', '507f1f77bcf86cd799439012'];
		t.mock.method(Note, 'findOneAndDelete', async () => ids.length ? { _id: ids.shift() } : null);
		t.mock.method(Note, 'find', (filter) => { finds.push(filter._id.$in); return { lean: async () => [] }; });
		for (const Model of [Memory, Url, Email]) t.mock.method(Model, 'findOneAndDelete', async () => null);
		await emptyTrash('host-1', {
			// 'late-trashed' is in Typesense as trashed but Mongo trashed it after the delete loop ended.
			exportTrashDocuments: async (hostId, type) => type === 'notes' ? [{ source_id: 'note-1' }] : [],
			bulkRemoveDocuments: async (hostId, type, removeIds) => removed.push([type, removeIds]),
			removeGraphLinks: async () => {},
			bulkIndexDocuments: async () => [],
			removeDocumentsByFilter: async () => assert.fail('must not remove by broad in_trash filter'),
		});
		assert.equal(finds.length, 1);
		assert.deepEqual(removed, [['notes', ['note-1', '507f1f77bcf86cd799439012']]]);
		assert.equal(removed.flatMap(([, removeIds]) => removeIds).includes('late-trashed'), false);
	});

	it('stale permanent-delete repair preserves a concurrent live publication', async (t) => {
		const id = '507f1f77bcf86cd799439011';
		const old = { _id: id, host_id: 'host-1', in_trash: false, updatedAt: new Date(1) };
		let indexed = true;
		let chunks = [];
		t.mock.method(Note, 'findOneAndDelete', async () => null);
		t.mock.method(Note, 'findOneAndUpdate', () => ({ lean: async () => {
			chunks = [{ id: 'fresh-live', in_trash: false }];
			return old;
		} }));
		t.mock.method(Note, 'updateMany', async (_filter, update) => { indexed = update.$set.is_indexed; });
		const outcome = await permanentDelete('host-1', 'notes', id, {
			removeGraphLinks: async (_host, ids) => assert.deepEqual(ids, []),
			bulkRemoveDocuments: async () => assert.fail('live rows must not receive broad source removal'),
			bulkIndexDocuments: async () => {
				indexed = true; // The fresh publisher marks after repair queues its older snapshot.
				return [{ id, success: false, error: 'stale' }];
			},
		});
		assert.equal(outcome.repaired, true);
		assert.equal(indexed, true);
		assert.deepEqual(chunks.map((chunk) => chunk.id), ['fresh-live']);
	});

	it('permanent delete is idempotent and always cleans the source ID', async () => {
		const originals = { findOneAndDelete: Note.findOneAndDelete, findOne: Note.findOne, atomic: Note.findOneAndUpdate };
		const removeCalls = [];
		const graphCalls = [];
		let present = true;
		Note.findOneAndDelete = async () => {
			if (present) return { _id: 'note-1' };
			throw Object.assign(new Error('invalid ObjectId'), { name: 'CastError' });
		};
		Note.findOneAndUpdate = () => ({ lean: async () => { throw Object.assign(new Error('invalid ObjectId'), { name: 'CastError' }); } });

		try {
			const deps = {
				bulkRemoveDocuments: async (hostId, type, ids) => removeCalls.push({ hostId, type, ids }),
				removeGraphLinks: async (hostId, ids) => graphCalls.push({ hostId, ids }),
			};
			const first = await permanentDelete('host-1', 'notes', 'note-1', deps);
			present = false;
			const second = await permanentDelete('host-1', 'notes', 'note-1', deps);

			assert.deepEqual(first, { id: 'note-1', deleted: true, missing: false, repaired: false });
			assert.deepEqual(second, { id: 'note-1', deleted: false, missing: true, repaired: false });
			assert.deepEqual(removeCalls, [
				{ hostId: 'host-1', type: 'notes', ids: ['note-1'] },
				{ hostId: 'host-1', type: 'notes', ids: ['note-1'] },
			]);
			assert.deepEqual(graphCalls, [
				{ hostId: 'host-1', ids: ['note-1'] },
				{ hostId: 'host-1', ids: ['note-1'] },
			]);
		} finally {
			Note.findOneAndDelete = originals.findOneAndDelete;
			Note.findOne = originals.findOne;
			if (originals.atomic) Note.findOneAndUpdate = originals.atomic;
		}
	});

	it('strict restore removes an orphan index entry and reports stale not-found', async () => {
		const originals = { findOneAndUpdate: Note.findOneAndUpdate, findOne: Note.findOne };
		const removeCalls = [];
		const graphCalls = [];
		const castError = Object.assign(new Error('invalid ObjectId'), { name: 'CastError' });
		Note.findOneAndUpdate = () => ({ lean: async () => { throw castError; }, then(resolve, reject) { return Promise.reject(castError).then(resolve, reject); } });

		try {
			await assert.rejects(
				() => restoreItem('host-1', 'notes', 'note-orphan', {
					bulkRemoveDocuments: async (hostId, type, ids) => removeCalls.push({ hostId, type, ids }),
					removeGraphLinks: async (hostId, ids) => graphCalls.push({ hostId, ids }),
				}),
				(err) => err.code === 'TRASH_ITEM_NOT_FOUND' && err.stale === true && err.message === 'Item no longer exists',
			);
			assert.deepEqual(removeCalls, [{ hostId: 'host-1', type: 'notes', ids: ['note-orphan'] }]);
			assert.deepEqual(graphCalls, [{ hostId: 'host-1', ids: ['note-orphan'] }]);
		} finally {
			Note.findOneAndUpdate = originals.findOneAndUpdate;
			Note.findOne = originals.findOne;
			if (originals.atomic) Note.findOneAndUpdate = originals.atomic;
		}
	});
});

it('manual permanent delete removes search content when graph cleanup fails', async (t) => {
	t.mock.method(Url, 'findOneAndDelete', async () => ({ _id: 'url' }));
	const removed = [];
	const result = await permanentDelete('tenant', 'urls', 'url', {
		removeGraphLinks: async () => { throw new Error('graph offline'); },
		bulkRemoveDocuments: async (...args) => removed.push(args),
	});
	assert.equal(result.deleted, true);
	assert.deepEqual(removed, [['tenant', 'urls', ['url']]]);
});

it('empty trash continues all types after graph failures', async (t) => {
	for (const Model of [Note, Memory, Url, Email]) {
		let deleted = false;
		t.mock.method(Model, 'findOneAndDelete', async () => { if (deleted) return null; deleted = true; return { _id: Model.modelName }; });
		t.mock.method(Model, 'find', () => ({ lean: async () => [] }));
	}
	const removed = [];
	assert.deepEqual(await emptyTrash('tenant', {
		exportTrashDocuments: async () => [],
		removeGraphLinks: async () => { throw new Error('graph offline'); },
		bulkRemoveDocuments: async (_host, type) => removed.push(type),
	}), { deleted: 4 });
	assert.deepEqual(removed.sort(), ['emails', 'memory', 'notes', 'urls']);
});
