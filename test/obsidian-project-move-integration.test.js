import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test, { mock } from 'node:test';
import config from '../config.js';
import mongoose, { connectDB } from '../db.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { User } from '../model/user.js';
import { Project } from '../model/project.js';
import { TenantMember } from '../model/tenant_member.js';
import { AuditLog } from '../model/audit_log.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { Tenant } from '../modules/tenancy.js';
import { SearchResults } from '../modules/search_results.js';
import { buildCollectionName, getTypesenseClient } from '../modules/typesense.js';
import { updateNote } from '../services/note_service.js';
import { updateMemory } from '../services/memory_service.js';
import { updateUrl } from '../services/url_service.js';
import { applyMutations, deleteObsidianHostDirectory, getMarkdownContent, materializeProjectExports, syncStreamientItem, __test as syncTest } from '../services/obsidian_sync_service.js';
import { readBlobBuffer, storeBuffer } from '../services/obsidian_blob_service.js';

class MoveFixture {
	hostId = `obsidian-move-${Date.now()}-${process.pid}`;
	specs = [['note', 'notes', Note, updateNote], ['memory', 'memory', Memory, updateMemory], ['url', 'urls', Url, updateUrl]];
	async setup() {
		this.user = await User.create({ email: `${this.hostId}@example.com`, password: 'integration-password', name: 'Move regression', is_active: true });
		this.tenant = await Tenant.create({ host_id: this.hostId, name: 'Move regression', owner: this.user._id, plan: 'pro' });
		await User.updateOne({ _id: this.user._id }, { $set: { host_id: this.hostId, tenant: this.tenant._id } });
		await TenantMember.create({ host_id: this.hostId, tenant: this.tenant._id, user: this.user._id, role: 'owner' });
		this.projects = [];
		for (const name of ['Source', 'Destination', 'Unsynced']) this.projects.push(await Project.create({ host_id: this.hostId, name, owner: this.user._id }));
		this.source = await this.connection(this.projects[0]);
		this.destination = await this.connection(this.projects[1]);
		this.records = [];
		for (const [type, , Model] of this.specs) {
			const record = await Model.create({ host_id: this.hostId, project: this.projects[0]._id, owner: this.user._id, title: `Move ${type}`, content: type === 'note' ? '<p>Canonical <strong>content</strong></p>' : 'Canonical memory', text_content: type === 'url' ? 'Crawler-owned text' : 'Canonical content', description: 'Saved description', url: 'https://example.com/move', normalized_url: 'https://example.com/move', crawl_enabled: true, tags: ['move-regression', 'KeepCase'], source: 'Original source' });
			const version = record.updatedAt.toISOString();
			const file = await syncStreamientItem(type, record._id, this.hostId, { item: record });
			assert.ok(file);
			const stored = await Model.findById(record._id).read('primary').lean();
			assert.equal(stored.updatedAt.toISOString(), version, 'Export must not change the record version');
			this.records.push({ type, Model, id: record._id, oldFile: file.toObject(), before: stored });
		}
	}
	async connection(project) {
		return ObsidianConnection.create({ host_id: this.hostId, project: project._id, owner: this.user._id, streamient_folder: `Streamient/${project.name}`, enabled: true });
	}
	async upload(connection, file, raw) {
		const blob = await storeBuffer(this.hostId, Buffer.from(raw), 'text/markdown');
		return ObsidianUpload.create({ host_id: this.hostId, user: this.user._id, connection: connection._id, path: file.path, mime_type: 'text/markdown', total_bytes: blob.total_bytes, received_bytes: blob.total_bytes, sha256: blob.sha256, state: 'complete', blob: blob._id, expires_at: new Date(Date.now() + 60_000) });
	}
	async move(source, destination) {
		const search = new SearchResults(this.hostId);
		const filters = { project_id: String(source._id), types: ['notes', 'memory', 'urls'] };
		const items = await search.selection(filters);
		assert.equal(items.length, 3);
		const outcomes = await search.apply({ filters, items, action: 'move', project_id: String(destination._id) }, { user_id: this.user._id, channel: 'web' });
		assert.ok(outcomes.every((outcome) => outcome.success), JSON.stringify(outcomes.filter((outcome) => !outcome.success)));
		return outcomes;
	}
	async cleanup() {
		for (const Model of [Note, Memory, Url, Project, TenantMember, AuditLog, ObsidianFile, ObsidianUpload, ObsidianRevision, ObsidianChange, ObsidianBlob, ObsidianConnection]) await Model.deleteMany({ host_id: this.hostId });
		if (this.tenant) await Tenant.deleteOne({ _id: this.tenant._id });
		if (this.user) await User.deleteOne({ _id: this.user._id });
		for (const type of ['notes', 'memory', 'urls', 'emails', 'pages', 'vault_files']) {
			try { await getTypesenseClient().collections(buildCollectionName(type, this.hostId)).delete(); } catch (error) { if (error.httpStatus !== 404) throw error; }
		}
		await deleteObsidianHostDirectory(this.hostId);
	}
}

test('Obsidian-linked search moves persist without export rollback or stale-vault resurrection', { skip: process.env.RUN_OBSIDIAN_INTEGRATION !== '1' }, async (t) => {
	await connectDB();
	const fixture = new MoveFixture();
	t.after(async () => { try { await fixture.cleanup(); } finally { await mongoose.disconnect(); } });
	await fixture.setup();

	await t.test('publishes concurrent identical content past an abandoned hash directory', async () => {
		const plain = Buffer.from('Shared Markdown for concurrent URL moves');
		const sha256 = crypto.createHash('sha256').update(plain).digest('hex');
		const directory = path.resolve(config.obsidian.vaultsDir, 'blobs', fixture.hostId, sha256);
		await mkdir(directory, { recursive: true });
		await writeFile(path.join(directory, '0.part'), 'Existing encrypted bytes must remain untouched');
		const blobs = await Promise.all(Array.from({ length: 12 }, () => storeBuffer(fixture.hostId, plain, 'text/markdown')));
		assert.equal(new Set(blobs.map((blob) => String(blob._id))).size, 1);
		assert.equal(await ObsidianBlob.countDocuments({ host_id: fixture.hostId, sha256 }), 1);
		assert.deepEqual(await readBlobBuffer(blobs[0], fixture.hostId), plain);
		assert.equal(await readFile(path.join(directory, '0.part'), 'utf8'), 'Existing encrypted bytes must remain untouched');
		assert.equal((await readdir(path.dirname(directory))).filter((name) => name.startsWith(sha256)).length, 2, 'Keep the original directory and the winning blob only');
	});

	const originalNote = fixture.records[0];
	const markdown = '---\ntitle: Move note\nstreamient_type: note\ncustom: preserve-me\ntags: [move-regression, KeepCase]\n---\n# Canonical Markdown\n\n**Preserve this body**\n';
	const upload = await fixture.upload(fixture.source, originalNote.oldFile, markdown);
	const imported = await applyMutations(fixture.user._id, fixture.hostId, fixture.source._id, { mutations: [{ operation_id: 'initial-markdown', operation: 'update', file_id: originalNote.oldFile._id, path: originalNote.oldFile.path, upload_id: upload._id, base_revision: originalNote.oldFile.revision, modified_at: new Date() }] });
	assert.equal(imported.results[0].accepted, true);
	originalNote.before = await Note.findById(originalNote.id).read('primary').lean();

	await t.test('moves notes, memories and URLs through search while preserving IDs, content and versions', async () => {
		const outcomes = await fixture.move(fixture.projects[0], fixture.projects[1]);
		for (const record of fixture.records) {
			const stored = await record.Model.findById(record.id).read('primary').lean();
			const outcome = outcomes.find((item) => item.id === String(record.id));
			assert.equal(String(stored.project), String(fixture.projects[1]._id));
			assert.equal(stored.updatedAt.toISOString(), outcome.item.version);
			assert.deepEqual(stored.tags, record.before.tags);
			assert.equal(stored.content, record.before.content);
			assert.equal(stored.text_content, record.before.text_content);
			assert.equal(stored.source, record.before.source);
			assert.equal(stored.crawl_enabled, record.before.crawl_enabled);
			assert.equal(String(stored.obsidian_source.connection_id), String(fixture.destination._id));
			assert.notEqual(String(stored.obsidian_source.file_id), String(record.oldFile._id));
			const previous = await ObsidianFile.findById(record.oldFile._id).read('primary').lean();
			assert.equal(previous.in_trash, true);
			assert.equal(previous.projection_detached, true);
			assert.equal(await record.Model.countDocuments({ host_id: fixture.hostId }), 1);
			record.moved = stored;
		}
		const raw = await getMarkdownContent(fixture.hostId, fixture.records[0].moved.obsidian_source.file_id);
		assert.equal(syncTest.parsedMarkdown(raw, 'Note.md').frontmatter.custom, 'preserve-me');
		assert.equal(syncTest.parsedMarkdown(raw, 'Note.md').body, syncTest.parsedMarkdown(markdown, 'Note.md').body);
	});

	await t.test('old-vault restore, upload, and repeated operations cannot undo the move', async () => {
		for (const record of fixture.records) {
			const mutation = { operation_id: `late-restore-${record.type}`, operation: 'restore', file_id: record.oldFile._id, path: record.oldFile.path, base_revision: record.oldFile.revision, modified_at: new Date(Date.now() + 60_000) };
			const result = await applyMutations(fixture.user._id, fixture.hostId, fixture.source._id, { mutations: [mutation, mutation] });
			assert.equal(result.results[0].accepted, false);
			assert.equal(result.results[0].file.in_trash, true);
			assert.match(result.results[0].change.conflict_reason, /moved to another project/);
			assert.equal(result.results[1].duplicate, true);
			assert.deepEqual(await record.Model.findById(record.id).read('primary').lean(), record.moved);
		}
		const lateUpload = await fixture.upload(fixture.source, originalNote.oldFile, '# Late offline content');
		const late = await applyMutations(fixture.user._id, fixture.hostId, fixture.source._id, { mutations: [{ operation_id: 'late-upload', operation: 'update', file_id: originalNote.oldFile._id, path: originalNote.oldFile.path, upload_id: lateUpload._id, base_revision: 1, modified_at: new Date(Date.now() + 60_000) }] });
		assert.equal(late.results[0].accepted, false);
		assert.ok(late.results[0].change.losing_revision_id, 'Retain offline content as a recoverable revision');
	});

	await t.test('metadata exports and genuine Markdown edits still synchronize after moving', async () => {
		for (const [index, [, , , update]] of fixture.specs.entries()) {
			const record = fixture.records[index];
			const changed = await update(fixture.hostId, record.id, { title: `Changed ${record.type}`, tags: ['new-tag'] });
			const stored = await record.Model.findById(record.id).read('primary').lean();
			assert.equal(stored.title, changed.title);
			assert.deepEqual(stored.tags, ['new-tag']);
			assert.equal(stored.updatedAt.toISOString(), changed.updatedAt.toISOString());
			const raw = await getMarkdownContent(fixture.hostId, stored.obsidian_source.file_id);
			assert.equal(syncTest.parsedMarkdown(raw, 'Record.md').title, changed.title);
			await syncStreamientItem(record.type, record.id, fixture.hostId, { item: record.before });
			assert.equal((await record.Model.findById(record.id).read('primary').lean()).title, changed.title);
		}
		await updateNote(fixture.hostId, originalNote.id, { markdown_content: '---\ntitle: Markdown edited\n---\nNew Markdown body' });
		assert.equal((await Note.findById(originalNote.id).read('primary').lean()).title, 'Markdown edited');
		assert.match((await Note.findById(originalNote.id).read('primary').lean()).text_content, /New Markdown body/);
	});

	await t.test('moves to an unsynced project, retries, and later exports without duplicating records', async () => {
		await fixture.move(fixture.projects[1], fixture.projects[2]);
		for (const record of fixture.records) {
			const stored = await record.Model.findById(record.id).read('primary').lean();
			assert.equal(String(stored.project), String(fixture.projects[2]._id));
			assert.equal(stored.obsidian_source?.file_id, undefined);
			assert.equal(await syncStreamientItem(record.type, record.id, fixture.hostId, { item: stored }), null);
		}
		const connection = await fixture.connection(fixture.projects[2]);
		for (const record of fixture.records) {
			await syncStreamientItem(record.type, record.id, fixture.hostId);
			await syncStreamientItem(record.type, record.id, fixture.hostId);
			const stored = await record.Model.findById(record.id).read('primary').lean();
			assert.equal(String(stored.obsidian_source.connection_id), String(connection._id));
			assert.equal(await ObsidianFile.countDocuments({ host_id: fixture.hostId, [record.type]: record.id, in_trash: false }), 1);
			assert.equal(await record.Model.countDocuments({ host_id: fixture.hostId }), 1);
		}
		await fixture.move(fixture.projects[2], fixture.projects[0]);
		for (const record of fixture.records) assert.equal(String((await record.Model.findById(record.id).read('primary').lean()).project), String(fixture.projects[0]._id));
	});

	await t.test('recovers an interrupted source detachment on the next destination export batch', async () => {
		const record = fixture.records[0];
		const moved = await Note.findOneAndUpdate({ _id: record.id, host_id: fixture.hostId }, { $set: { project: fixture.projects[1]._id, is_indexed: false } }, { returnDocument: 'after' });
		const failure = mock.method(ObsidianChange, 'create', async () => { throw new Error('Temporary change-log failure'); });
		try { await assert.rejects(syncStreamientItem('note', record.id, fixture.hostId, { item: moved }), /Temporary change-log failure/); } finally { failure.mock.restore(); }
		assert.equal(String((await Note.findById(record.id).read('primary').lean()).project), String(fixture.projects[1]._id));
		await materializeProjectExports(fixture.hostId, fixture.destination._id);
		const restored = await Note.findById(record.id).read('primary').lean();
		assert.equal(String(restored.obsidian_source.connection_id), String(fixture.destination._id));
		assert.equal(await ObsidianFile.countDocuments({ host_id: fixture.hostId, note: record.id, in_trash: false }), 1);
		assert.equal(await Note.countDocuments({ host_id: fixture.hostId }), 1);
	});
});
