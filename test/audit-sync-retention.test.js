import test, { mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import matter from 'gray-matter';
import mongoose from '../model/mongoose.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { AuditLog } from '../model/audit_log.js';
import { Project } from '../model/project.js';
import { getMongoCoordinator } from '../modules/cache.js';
import { relocateConnectionFolder, __test as sync } from '../services/obsidian_sync_service.js';
import { listRecords, getChanges } from '../services/mobile_service.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { GraphLink } from '../model/graph_link.js';
import { writeExportArchive } from '../services/export_service.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

afterEach(() => mock.restoreAll());

test('repeated folder A-B-A-B moves have unique revision IDs and roll back if change insertion fails', async () => {
	const connection = { _id: 'connection', host_id: 'tenant', project: 'project', enabled: true, streamient_folder: 'A', sequence: 0, async save() {} };
	let file = { _id: 'file', host_id: 'tenant', connection: 'connection', path: 'A/one.md', revision: 1 };
	let fail = false;
	const changes = [];
	const session = {};
	const previousDb = mongoose.connection.db;
	mongoose.connection.db = { collection: () => ({}) };
	const coordinator = getMongoCoordinator();
	mongoose.connection.db = previousDb;
	mock.method(coordinator, 'acquireLock', async () => ({}));
	mock.method(coordinator, 'releaseLock', async () => {});
	mock.method(Project, 'findOneAndUpdate', () => ({ select() { return this; }, lean: async () => ({ _id: 'project' }) }));
	mock.method(ObsidianConnection, 'findOne', async () => connection);
	mock.method(ObsidianConnection, 'exists', async () => false);
	mock.method(ObsidianFile, 'exists', async () => false);
	mock.method(ObsidianFile, 'find', (query) => ({ sort() { return this; }, limit() { return this; }, select() { return this; }, lean: async () => query._id ? [] : [{ ...file }] }));
	mock.method(ObsidianFile, 'countDocuments', async () => 0);
	mock.method(ObsidianFile, 'findOneAndUpdate', async (query, update, options) => {
		assert.equal(options.session, session);
		assert.equal(query.revision, file.revision);
		assert.equal(query.host_id, 'tenant');
		Object.assign(file, update.$set);
		file.revision++;
		return { ...file };
	});
	mock.method(ObsidianConnection, 'findOneAndUpdate', async (_query, _update, options) => { assert.equal(options.session, session); return { sequence: connection.sequence + 1 }; });
	mock.method(ObsidianChange, 'create', async (rows, options) => { assert.equal(options.session, session); if (fail) throw new Error('change failed'); changes.push(rows[0]); return rows; });
	mock.method(AuditLog, 'create', async () => ({}));
	mock.method(mongoose.connection, 'transaction', async (callback) => {
		const before = { ...file };
		try { return await callback(session); } catch (err) { file = before; throw err; }
	});
	for (const folder of ['B', 'A', 'B']) assert.equal((await relocateConnectionFolder('tenant', 'connection', { streamient_folder: folder })).moved, 1);
	assert.deepEqual(changes.map((change) => change.operation_id), ['streamient:folder:file:2:B', 'streamient:folder:file:3:A', 'streamient:folder:file:4:B']);
	fail = true;
	await assert.rejects(relocateConnectionFolder('tenant', 'connection', { streamient_folder: 'A' }), /change failed/);
	assert.equal(file.path, 'B/one.md');
	assert.equal(file.revision, 4);
});

test('sync frontmatter parsing preserves content without growing the gray-matter cache', () => {
	const before = Object.keys(matter.cache);
	for (let i = 0; i < 10; i++) {
		const parsed = sync.parsedMarkdown(`---\ntitle: Unique ${i}\n---\nBody ${i}`, 'one.md');
		assert.equal(parsed.title, `Unique ${i}`);
		assert.ok(sync.itemMarkdown('note', { title: `Changed ${i}` }, `---\ntitle: Original ${i}\n---\nPreserved body`).includes('Preserved body'));
	}
	assert.deepEqual(Object.keys(matter.cache), before);
});

test('mobile lists and changes project only summary fields', async () => {
	for (const Model of [Note, Memory, Url, Email]) mock.method(Model, 'find', () => ({
		select(fields) { assert.ok(fields.includes('updatedAt')); assert.ok(!fields.includes('html_content')); assert.ok(!fields.includes('attachments')); return this; },
		sort() { return this; }, limit() { return this; }, lean: async () => [],
	}));
	assert.deepEqual((await listRecords('tenant')).records, []);
	const cursor = Buffer.from(JSON.stringify({ updated_at: new Date().toISOString(), id: '000000000000000000000000' })).toString('base64url');
	await getChanges('tenant', { cursor });
});

test('account export excludes trash for all four record models and scopes all archive queries', async (t) => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'streamient-export-audit-'));
	t.after(() => fs.rm(directory, { recursive: true }));
	const queries = [];
	for (const Model of [Note, Memory, Url, Email, GraphLink]) mock.method(Model, 'find', (filter) => {
		queries.push({ Model, filter });
		return { lean() { return this; }, cursor() { return { async *[Symbol.asyncIterator]() {}, async close() {} }; } };
	});
	await writeExportArchive(path.join(directory, 'archive.zip'), 'tenant');
	assert.equal(queries.length, 5);
	for (const { Model, filter } of queries) {
		assert.equal(filter.host_id, 'tenant');
		if (Model !== GraphLink) assert.equal(filter.in_trash, false);
	}
});
