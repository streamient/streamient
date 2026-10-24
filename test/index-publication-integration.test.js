import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { Note } from '../model/note.js';
import { Project } from '../model/project.js';
import { Tenant } from '../modules/tenancy.js';
import { buildCollectionName, bulkIndexDocuments, getTypesenseClient } from '../modules/typesense.js';

test('real Mongo and Typesense preserve a fresh publication after a delayed stale import', { skip: process.env.STREAMIENT_AUDIT_INTEGRATION !== '1', timeout: 60000 }, async (t) => {
	assert.ok(process.env.MONGO_URI);
	const dbName = `streamient_index_claim_test_${crypto.randomUUID().replaceAll('-', '')}`;
	const hostId = crypto.randomBytes(12).toString('hex');
	await mongoose.connect(process.env.MONGO_URI, { ...config.mongoOptions, dbName });
	assert.equal(mongoose.connection.db.databaseName, dbName);
	const client = getTypesenseClient();
	t.after(async () => {
		try {
			for (const type of ['notes', 'memory', 'urls', 'pages', 'emails', 'vault_files']) {
				try { await client.collections(buildCollectionName(type, hostId)).delete(); } catch (err) { if (err.httpStatus !== 404) throw err; }
			}
		} finally {
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		}
	});
	await Promise.all([Note.init(), Project.init(), Tenant.init()]);
	const owner = new mongoose.Types.ObjectId();
	await Tenant.create({ host_id: hostId, name: 'Isolated index test', owner });
	const project = await Project.create({ host_id: hostId, name: 'Index', owner });
	const old = await Note.create({ host_id: hostId, project: project._id, owner, title: 'Old A', text_content: 'Old content. '.repeat(600) });
	// Existing installations can publish before the scheduler patches their schema.
	await client.collections().create({ name: buildCollectionName('notes', hostId), fields: [{ name: 'title', type: 'string' }] });
	const documents = client.collections(buildCollectionName('notes', hostId)).documents();
	const search = async () => (await documents.search({ q: '*', query_by: 'title', filter_by: `source_id:=\`${old._id}\``, exclude_fields: 'embedding', per_page: 250 })).hits.map((hit) => hit.document);
	const originalImport = documents.import;
	let started, release;
	const waiting = new Promise((resolve) => { started = resolve; });
	const gate = new Promise((resolve) => { release = resolve; });
	let first = true;
	documents.import = async function (...args) { if (first) { first = false; started(); await gate; } return originalImport.apply(this, args); };
	let stale;
	try {
		stale = bulkIndexDocuments(hostId, 'notes', [old.toObject()]);
		await Promise.race([waiting, stale.then(() => { throw new Error('Publication ended before the import gate'); })]);
		const fresh = await Note.findOneAndUpdate({ _id: old._id, host_id: hostId }, { $set: { title: 'Fresh B', text_content: 'Fresh content. '.repeat(600), updatedAt: new Date(Date.now() + 1000), is_indexed: false } }, { returnDocument: 'after', timestamps: false }).lean();
		assert.equal((await bulkIndexDocuments(hostId, 'notes', [fresh]))[0].success, true);
		release();
		assert.equal((await stale)[0].success, false);
		const stored = await Note.findOneAndUpdate({ _id: old._id }, { $inc: { __v: 0 } }, { returnDocument: 'after', timestamps: false }).lean();
		const hits = await search();
		assert.equal(stored.is_indexed, true);
		assert.ok(hits.length > 1);
		assert.ok(hits.every((doc) => doc.claim === stored.index_claim && doc.title === 'Fresh B' && doc.id.startsWith(`${old._id}_${stored.index_claim}`)));

		// Recreate a legacy-only fixture to exercise exact-ID migration on the real server.
		await documents.delete({ filter_by: `source_id:=\`${old._id}\`` });
		const legacy = { ...hits[0], id: String(old._id), chunk_index: 0, chunk_count: 1 };
		delete legacy.claim;
		await originalImport.call(documents, [legacy], { action: 'upsert' });
		await Note.updateOne({ _id: old._id }, { $set: { index_claim: null, is_indexed: false } }, { timestamps: false });
		assert.equal((await bulkIndexDocuments(hostId, 'notes', [fresh]))[0].success, true);
		assert.ok((await search()).every((doc) => doc.claim && doc.id !== String(old._id)));
	} finally {
		release();
		if (stale) await stale.catch(() => {});
		documents.import = originalImport;
	}
});
