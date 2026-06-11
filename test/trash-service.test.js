import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { batchRestore, emptyTrash, getTrashCount, listTrash } from '../services/trash_service.js';

function cloneDoc(doc) {
	return { ...doc };
}

function chainFindIds(ids) {
	return {
		select: () => ({
			lean: async () => ids.map((id) => ({ _id: { toString: () => id } })),
		}),
	};
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
			listDocuments: async (hostId, type, options) => {
				calls.push({ hostId, type, options });
				return responses[type];
			},
		});

		assert.deepEqual(result.items.map((item) => item._id), ['email-1', 'note-1']);
		assert.equal(result.items[0]._type, 'emails');
		assert.equal(result.items[0].subject, 'Email subject');
		assert.equal(result.total, 3);
		assert.deepEqual(calls.map((call) => call.type), ['notes', 'memory', 'urls', 'emails']);
		assert.ok(calls.every((call) => call.options.filter_by === 'in_trash:=true'));
		assert.ok(calls.every((call) => call.options.sort_by === 'trashed_at:desc'));
	});

	it('gets trash count from Typesense', async () => {
		const counts = { notes: 2, memory: 3, urls: 4, emails: 5 };
		const calls = [];

		const count = await getTrashCount('host-1', {
			listDocuments: async (hostId, type, options) => {
				calls.push({ hostId, type, options });
				return { found: counts[type], hits: [] };
			},
		});

		assert.equal(count, 14);
		assert.deepEqual(calls.map((call) => call.type), ['notes', 'memory', 'urls', 'emails']);
		assert.ok(calls.every((call) => call.options.filter_by === 'in_trash:=true'));
		assert.ok(calls.every((call) => call.options.perPage === 1));
	});

	it('restores selected items with one bulk index call per type', async () => {
		const originals = {
			noteFindOneAndUpdate: Note.findOneAndUpdate,
			noteUpdateMany: Note.updateMany,
			memoryFindOneAndUpdate: Memory.findOneAndUpdate,
			memoryUpdateMany: Memory.updateMany,
		};
		const notes = new Map([
			['note-1', { _id: 'note-1', host_id: 'host-1', title: 'Note 1', in_trash: true }],
			['note-2', { _id: 'note-2', host_id: 'host-1', title: 'Note 2', in_trash: true }],
		]);
		const memories = new Map([
			['memory-1', { _id: 'memory-1', host_id: 'host-1', title: 'Memory 1', in_trash: true }],
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
		} finally {
			Note.findOneAndUpdate = originals.noteFindOneAndUpdate;
			Note.updateMany = originals.noteUpdateMany;
			Memory.findOneAndUpdate = originals.memoryFindOneAndUpdate;
			Memory.updateMany = originals.memoryUpdateMany;
		}
	});

	it('empty trash removes Typesense docs once per non-empty type', async () => {
		const originals = {
			noteFind: Note.find,
			noteDeleteMany: Note.deleteMany,
			memoryFind: Memory.find,
			memoryDeleteMany: Memory.deleteMany,
			urlFind: Url.find,
			urlDeleteMany: Url.deleteMany,
			emailFind: Email.find,
			emailDeleteMany: Email.deleteMany,
		};
		const removeCalls = [];
		const deleteQueries = [];

		Note.find = () => chainFindIds(['note-1', 'note-2']);
		Memory.find = () => chainFindIds(['memory-1']);
		Url.find = () => chainFindIds([]);
		Email.find = () => chainFindIds(['email-1']);
		Note.deleteMany = async (query) => deleteQueries.push({ type: 'notes', query });
		Memory.deleteMany = async (query) => deleteQueries.push({ type: 'memory', query });
		Url.deleteMany = async (query) => deleteQueries.push({ type: 'urls', query });
		Email.deleteMany = async (query) => deleteQueries.push({ type: 'emails', query });

		try {
			const result = await emptyTrash('host-1', {
				bulkRemoveDocuments: async (hostId, type, ids) => {
					removeCalls.push({ hostId, type, ids });
					return ids.map((id) => ({ id, success: true }));
				},
			});

			assert.deepEqual(result, { deleted: 4 });
			assert.deepEqual(removeCalls, [
				{ hostId: 'host-1', type: 'notes', ids: ['note-1', 'note-2'] },
				{ hostId: 'host-1', type: 'memory', ids: ['memory-1'] },
				{ hostId: 'host-1', type: 'emails', ids: ['email-1'] },
			]);
			assert.equal(deleteQueries.length, 4);
		} finally {
			Note.find = originals.noteFind;
			Note.deleteMany = originals.noteDeleteMany;
			Memory.find = originals.memoryFind;
			Memory.deleteMany = originals.memoryDeleteMany;
			Url.find = originals.urlFind;
			Url.deleteMany = originals.urlDeleteMany;
			Email.find = originals.emailFind;
			Email.deleteMany = originals.emailDeleteMany;
		}
	});
});
