import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../config.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Project } from '../model/project.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { updateNote, deleteNote } from '../services/note_service.js';
import { updateMemory, deleteMemory } from '../services/memory_service.js';
import { updateUrl, deleteUrl } from '../services/url_service.js';
import { processBatch } from '../routes/api.js';
import { getTypesenseClient } from '../modules/typesense.js';
import { mockTenantWork } from './helpers/tenant-work.js';

test('committed moves and deletions remain successful when Obsidian synchronization is deferred', async (t) => {
	const restore = mockTenantWork(); t.after(restore);
	const enabled = config.obsidian.enabled;
	config.obsidian.enabled = true;
	t.after(() => { config.obsidian.enabled = enabled; });
	t.mock.method(Project, 'findOneAndUpdate', (filter) => ({ select() { return this; }, read() { return this; }, lean: async () => ({ _id: filter._id }) }));
	t.mock.method(ObsidianConnection, 'findOne', () => ({ read() { return this; }, lean: async () => { throw new Error('vault unavailable'); } }));
	t.mock.method(getTypesenseClient(), 'collections', () => ({ documents: () => ({ delete: async () => ({ num_deleted: 1 }), import: async () => [{ success: true }] }) }));
	for (const [type, Model, update, remove] of [['notes', Note, updateNote, deleteNote], ['memories', Memory, updateMemory, deleteMemory], ['urls', Url, updateUrl, deleteUrl]]) {
		let saved;
		t.mock.method(Model, 'findOne', () => ({ select() { return this; }, lean: async () => ({ _id: 'record', project: 'source' }) }));
		t.mock.method(Model, 'exists', () => ({ read: async () => true }));
		t.mock.method(Model, 'findOneAndUpdate', async (_filter, change) => { saved = { _id: 'record', host_id: 'host', project: 'source', title: 'Saved', url: 'https://example.com', updatedAt: new Date(), ...saved, ...change.$set }; return saved; });
		const moved = await processBatch('host', type, { ids: ['record'] }, (id) => update('host', id, { project: 'destination' }));
		assert.equal(saved.project, 'destination');
		assert.equal(moved.success_count, 1);
		assert.equal(moved.failed_count, 0);
		assert.equal(moved.warning_count, 1);
		assert.match(moved.outcomes[0].item.sync_warning, /saved.*pending/);
		const deleted = await processBatch('host', type, { ids: ['record'] }, (id) => remove('host', id));
		assert.equal(saved.in_trash, true);
		assert.equal(deleted.success_count, 1);
		assert.equal(deleted.failed_count, 0);
		assert.equal(deleted.warning_count, 1);
		assert.match(deleted.outcomes[0].item.sync_warning, /trash.*pending/);
	}
});
