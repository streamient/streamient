import assert from 'node:assert/strict';
import test from 'node:test';
import config from '../config.js';
import mongoose from '../db.js';
import { User } from '../model/user.js';
import { Project } from '../model/project.js';
import { Tenant } from '../modules/tenancy.js';
import { TenantMember } from '../model/tenant_member.js';
import { Note } from '../model/note.js';
import { AuditLog } from '../model/audit_log.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { applyMutations, syncStreamientItem, deleteObsidianHostDirectory, __test as syncTest } from '../services/obsidian_sync_service.js';
import { storeBuffer } from '../services/obsidian_blob_service.js';

// Isolated Mongo regression for concurrent public mutations, Streamient-side edits, and
// atomic sequence allocation. It connects to a unique database, cleans up only that database,
// and is skipped by default so the ordinary suite never requires a live Mongo server.
test('concurrent Obsidian mutations and Streamient edits stay atomic', { skip: process.env.RUN_OBSIDIAN_INTEGRATION !== '1', timeout: 60000 }, async (t) => {
	const hostId = `obsidian-atomic-${Date.now()}-${process.pid}`;
	const dbName = `streamient_obsidian_atomic_${process.pid}_${Date.now()}`;
	await mongoose.connect(config.mongoUri, { ...config.mongoOptions, dbName });
	t.after(async () => {
		try { await deleteObsidianHostDirectory(hostId); } finally {
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		}
	});
	await Promise.all([User, TenantMember, Project, ObsidianBlob, ObsidianFile, ObsidianUpload, ObsidianRevision, ObsidianChange, ObsidianConnection, Note].map((Model) => Model.createIndexes()));

	const user = await User.create({ email: `${hostId}@example.com`, password: 'integration-password', name: 'Atomic regression', is_active: true });
	const tenant = await Tenant.create({ host_id: hostId, name: 'Atomic regression', owner: user._id, plan: 'pro' });
	await User.updateOne({ _id: user._id }, { $set: { host_id: hostId, tenant: tenant._id } });
	await TenantMember.create({ host_id: hostId, tenant: tenant._id, user: user._id, role: 'owner' });
	const project = await Project.create({ host_id: hostId, name: 'Atomic', owner: user._id });
	const connection = await ObsidianConnection.create({ host_id: hostId, project: project._id, owner: user._id, streamient_folder: 'Streamient', enabled: true });
	async function upload(raw, path = 'Notes/atomic.md') {
		const blob = await storeBuffer(hostId, Buffer.from(raw), 'text/markdown');
		return ObsidianUpload.create({ host_id: hostId, user: user._id, connection: connection._id, path, mime_type: 'text/markdown', total_bytes: blob.total_bytes, received_bytes: blob.total_bytes, sha256: blob.sha256, state: 'complete', blob: blob._id, expires_at: new Date(Date.now() + 60_000) });
	}

	await t.test('two concurrent public mutations advance the file atomically without duplicate projections', async () => {
		const file = await ObsidianFile.create({ connection: connection._id, project: project._id, host_id: hostId, path: 'Notes/concurrent.md', kind: 'markdown', mime_type: 'text/markdown', size: 0, revision: 0, modified_at: new Date(Date.now() - 60_000), last_source: 'obsidian', in_trash: false });
		const [uploadA, uploadB] = await Promise.all([upload('# Content A', file.path), upload('# Content B', file.path)]);
		const base = { file_id: file._id, path: file.path, base_revision: 0, modified_at: new Date(Date.now() - 60_000) };
		const [left, right] = await Promise.all([
			applyMutations(user._id, hostId, connection._id, { mutations: [{ operation_id: 'concurrent-A', operation: 'update', upload_id: uploadA._id, ...base }] }),
			applyMutations(user._id, hostId, connection._id, { mutations: [{ operation_id: 'concurrent-B', operation: 'update', upload_id: uploadB._id, ...base }] }),
		]);
		const outcomes = [left.results[0], right.results[0]];
		const accepted = outcomes.filter((outcome) => outcome.accepted).length;
		assert.ok(accepted >= 1, 'at least one writer commits');

		const stored = await ObsidianFile.findOneAndUpdate({ _id: file._id, host_id: hostId }, { $inc: { revision: 0 } }, { returnDocument: 'after', timestamps: false }).lean();
		assert.equal(stored.revision, accepted, 'each accepted mutation advanced the revision exactly once');
		assert.equal(await Note.countDocuments({ host_id: hostId }), 1, 'no duplicate projection was minted');
	});

	await t.test('a Streamient-side Markdown edit commits atomically and updates the record', async () => {
		const blob = await storeBuffer(hostId, Buffer.from('# Before'), 'text/markdown');
		const note = await Note.create({ host_id: hostId, project: project._id, owner: user._id, title: 'Editable', content: '<p>Before</p>', text_content: 'Before', obsidian_source: { connection_id: connection._id } });
		const file = await ObsidianFile.create({ connection: connection._id, project: project._id, host_id: hostId, path: 'Notes/editable.md', kind: 'markdown', mime_type: 'text/markdown', size: blob.total_bytes, revision: 0, blob: blob._id, sha256: blob.sha256, note: note._id, modified_at: new Date(Date.now() - 60_000), last_source: 'obsidian', in_trash: false });
		await Note.updateOne({ _id: note._id, host_id: hostId }, { $set: { 'obsidian_source.file_id': file._id } }, { timestamps: false });

		await syncStreamientItem('note', note._id, hostId, { markdown: '# After edit' });

		const storedFile = await ObsidianFile.findOneAndUpdate({ _id: file._id, host_id: hostId }, { $inc: { revision: 0 } }, { returnDocument: 'after', timestamps: false }).lean();
		const storedNote = await Note.findOneAndUpdate({ _id: note._id, host_id: hostId }, { $inc: { __v: 0 } }, { returnDocument: 'after', timestamps: false }).lean();
		assert.equal(storedFile.revision, 1, 'the file revision advanced once');
		assert.equal(String(storedFile.note), String(note._id));
		assert.match(storedNote.content, /After edit/);
	});

	await t.test('concurrent change allocations produce unique contiguous sequences', async () => {
		const file = { _id: new mongoose.Types.ObjectId(), path: 'Notes/seq.md', revision: 0, sha256: '', modified_at: new Date(), last_source: 'obsidian', last_device_id: '' };
		const changes = await Promise.all(Array.from({ length: 8 }, (_, index) => syncTest.recordChange(connection, file, 'update', { operationId: `seq-${index}` })));
		const sequences = changes.map((change) => change.sequence);
		assert.equal(new Set(sequences).size, 8, 'every allocation is unique');
		assert.deepEqual([...sequences].sort((a, b) => a - b), Array.from({ length: sequences.length }, (_, index) => Math.min(...sequences) + index), 'allocations are contiguous with no gaps');
	});

	await Promise.all([Note, ObsidianChange, ObsidianRevision, ObsidianUpload, ObsidianFile, ObsidianConnection].map((Model) => Model.deleteMany({ host_id: hostId })));
	await TenantMember.deleteMany({ host_id: hostId });
	await Project.deleteMany({ host_id: hostId });
	await User.deleteMany({ host_id: hostId });
	await AuditLog.deleteMany({ host_id: hostId });
	if (tenant) await Tenant.deleteOne({ _id: tenant._id });
});
