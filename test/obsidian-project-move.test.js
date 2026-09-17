import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { __test as syncTest } from '../services/obsidian_sync_service.js';

afterEach(() => mock.restoreAll());

describe('Obsidian record projection ownership', () => {
	it('never imports a Streamient export back into the authoritative record', async () => {
		const connection = { _id: 'connection', host_id: 'tenant', owner: 'owner', project: 'source', sequence: 0, storage_bytes: 10 };
		const file = { _id: 'file', host_id: 'tenant', connection: 'connection', project: 'source', memory: 'record', path: 'Source/Memory.md', kind: 'markdown', revision: 1, size: 10, sha256: 'old', blob: 'blob', modified_at: new Date('2026-01-01'), async save() { return this; } };
		mock.method(ObsidianRevision, 'create', async (value) => value);
		mock.method(ObsidianConnection, 'findOneAndUpdate', async () => ({ sequence: ++connection.sequence }));
		mock.method(ObsidianConnection, 'updateOne', async () => ({}));
		mock.method(ObsidianChange, 'create', async (value) => value);
		mock.method(ObsidianBlob, 'findOne', () => { throw new Error('An export must not read the blob for reimport'); });
		const mutation = mock.method(Memory, 'findOneAndUpdate', () => { throw new Error('An export must not rewrite or trash its record'); });
		for (const operation of ['create', 'update', 'trash', 'restore']) await syncTest.commitFile(connection, file, operation, { modifiedAt: new Date(), source: 'streamient', updateRecord: false, operationId: operation });
		assert.equal(mutation.mock.callCount(), 0);
		assert.equal(file.is_indexed, true);
		assert.equal(file.in_trash, false);
		assert.equal(file.revision, 5);
	});
	it('rejects late content or type changes when the linked record moved or was relinked', async () => {
		for (const [type, Model] of [['note', Note], ['memory', Memory], ['url', Url]]) {
			const record = { _id: 'record', project: 'destination', updatedAt: new Date() };
			mock.method(Model, 'findOne', () => ({ lean: async () => record }));
			const write = mock.method(Model, 'findOneAndUpdate', async (filter) => {
				assert.equal(filter.project, 'source');
				assert.equal(filter.host_id, 'tenant');
				assert.equal(filter['obsidian_source.file_id'], 'old-file');
				assert.equal(filter.updatedAt, record.updatedAt);
				return null;
			});
			const file = { _id: 'old-file', host_id: 'tenant', project: 'source', connection: 'old-connection', path: 'Old.md', [type]: 'record', modified_at: new Date() };
			const raw = `---\nstreamient_type: ${type}\nurl: https://example.com\n---\nOld content`;
			await assert.rejects(syncTest.projectMarkdownFile(file, raw, 'owner'), { code: 'projection_changed', status: 409 });
			assert.equal(write.mock.callCount(), 1);
			file.projection_detached = true;
			assert.equal(await syncTest.projectMarkdownFile(file, raw, 'owner'), null);
			assert.equal(write.mock.callCount(), 1);
		}
		mock.method(Note, 'findOneAndDelete', async (filter) => { assert.equal(filter.project, 'source'); assert.equal(filter['obsidian_source.file_id'], 'old-file'); return null; });
		await assert.rejects(syncTest.projectMarkdownFile({ _id: 'old-file', host_id: 'tenant', project: 'source', path: 'Old.md', note: 'record' }, '---\nstreamient_type: memory\n---\nOld content', 'owner'), { code: 'projection_changed' });
	});
	it('publishes the updated record after genuine Markdown edits while retaining URL crawl fields', async () => {
		const original = { _id: 'record', project: 'project', updatedAt: new Date(), title: 'Old', text_content: 'Crawler text', crawl_enabled: true };
		mock.method(Url, 'findOne', () => ({ lean: async () => original }));
		mock.method(Url, 'findOneAndUpdate', async (filter, update, options) => {
			assert.equal(options.returnDocument, 'after');
			assert.equal(options.timestamps, false);
			assert.equal(update.$set.text_content, undefined);
			assert.equal(update.$set.crawl_enabled, undefined);
			return { ...original, ...update.$set };
		});
		const record = await syncTest.projectMarkdownFile({ _id: 'file', url: 'record', host_id: 'tenant', project: 'project', connection: 'connection', path: 'URL.md', modified_at: new Date() }, '---\nstreamient_type: url\ntitle: New\nurl: https://example.com/new\n---\nNew description', 'owner');
		assert.equal(record.title, 'New');
		assert.equal(record.description, 'New description');
		assert.equal(record.text_content, 'Crawler text');
		assert.equal(record.crawl_enabled, true);
	});
});
