import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import config from '../config.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';
import { completeUpload, readBlobBuffer, storeBuffer } from '../services/obsidian_blob_service.js';

class BlobFixture {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'streamient-blob-race-'));
	rows = new Map();
	uploads = new Map();
	beforeCreate = async () => {};
	afterCreate = async () => {};
	constructor(t) {
		const original = { dir: config.obsidian.vaultsDir, key: config.obsidian.encryptionKey };
		config.obsidian.vaultsDir = this.root;
		config.obsidian.encryptionKey = 'a'.repeat(64);
		t.mock.method(ObsidianBlob, 'findOne', (filter) => BlobFixture.query(this.rows.get(filter.host_id + ':' + filter.sha256) || null));
		t.mock.method(ObsidianBlob, 'create', async (data) => {
			await this.beforeCreate(data);
			const key = data.host_id + ':' + data.sha256;
			if (this.rows.has(key)) throw Object.assign(new Error('Duplicate blob'), { code: 11000 });
			const blob = { _id: crypto.randomUUID(), ...data };
			this.rows.set(key, blob);
			await this.afterCreate(blob);
			return blob;
		});
		t.mock.method(ObsidianUpload, 'findOne', (filter) => BlobFixture.query(this.uploads.get(filter._id) || null));
		t.after(() => {
			config.obsidian.vaultsDir = original.dir;
			config.obsidian.encryptionKey = original.key;
			fs.rmSync(this.root, { recursive: true, force: true });
		});
	}
	static query(value) {
		return { read(mode) { assert.equal(mode, 'primary'); return this; }, lean() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
	}
	orphan(plain) {
		const digest = crypto.createHash('sha256').update(plain).digest('hex');
		const directory = path.join(this.root, 'blobs', 'host', digest);
		fs.mkdirSync(directory, { recursive: true });
		fs.writeFileSync(path.join(directory, '0.part'), 'Retain existing ciphertext');
		return directory;
	}
	async stageUpload(plain, id) {
		const blob = await storeBuffer('host', plain, 'text/markdown');
		const staging = path.join(this.root, 'uploads', 'host', id);
		fs.mkdirSync(path.dirname(staging), { recursive: true });
		fs.renameSync(path.join(this.root, blob.storage_key), staging);
		this.rows.delete('host:' + blob.sha256);
		const upload = { _id: id, user: 'owner', host_id: 'host', connection: 'connection', path: id + '.md', mime_type: 'text/markdown', total_bytes: plain.length, received_bytes: plain.length, sha256: blob.sha256, chunks: blob.chunks, state: 'uploading', async save() { return this; } };
		this.uploads.set(id, upload);
	}
	async race(firstWrite, secondWrite) {
		let firstArrived;
		let releaseFirst;
		const arrived = new Promise((resolve) => { firstArrived = resolve; });
		const held = new Promise((resolve) => { releaseFirst = resolve; });
		let count = 0;
		this.beforeCreate = async () => {
			if (++count === 1) { firstArrived(); await held; }
			else releaseFirst();
		};
		const first = firstWrite();
		await arrived;
		const second = secondWrite();
		second.catch(() => releaseFirst());
		const results = await Promise.allSettled([first, second]);
		assert.ok(results.every((result) => result.status === 'fulfilled'), results.map((result) => result.reason?.message).join('; '));
		assert.equal(this.rows.size, 1);
		assert.equal(fs.readdirSync(path.join(this.root, 'blobs', 'host')).length, 1, 'Remove only the losing writer directory');
		return results.map((result) => result.value);
	}
}

describe('Obsidian blob publication', () => {
	it('stores new encrypted bytes despite an old non-empty hash directory', async (t) => {
		const fixture = new BlobFixture(t);
		const plain = Buffer.from('Identical URL Markdown');
		const orphan = fixture.orphan(plain);
		const blob = await storeBuffer('host', plain, 'text/markdown');
		assert.notEqual(path.join(fixture.root, blob.storage_key), orphan);
		assert.equal(fs.readFileSync(path.join(orphan, '0.part'), 'utf8'), 'Retain existing ciphertext');
		assert.deepEqual(await readBlobBuffer(blob, 'host'), plain);
		assert.equal((await storeBuffer('host', plain))._id, blob._id);
	});
	it('deduplicates concurrent server writes while keeping the winning encryption metadata and bytes together', async (t) => {
		const fixture = new BlobFixture(t);
		const plain = Buffer.from('Concurrent identical content');
		const [first, second] = await fixture.race(() => storeBuffer('host', plain), () => storeBuffer('host', plain));
		assert.equal(first._id, second._id);
		assert.deepEqual(await readBlobBuffer(first, 'host'), plain);
		assert.deepEqual(await readBlobBuffer(second, 'host'), plain);
		assert.deepEqual(fs.readdirSync(path.join(fixture.root, 'server', 'host')), []);
	});
	it('completes uploaded content despite an old hash directory', async (t) => {
		const fixture = new BlobFixture(t);
		const plain = Buffer.from('Uploaded content');
		await fixture.stageUpload(plain, 'upload-one');
		const orphan = fixture.orphan(plain);
		const result = await completeUpload('owner', 'host', 'upload-one');
		assert.equal(result.state, 'complete');
		assert.equal(fs.readFileSync(path.join(orphan, '0.part'), 'utf8'), 'Retain existing ciphertext');
		assert.deepEqual(await readBlobBuffer([...fixture.rows.values()][0], 'host'), plain);
	});
	it('deduplicates two uploads finishing concurrently and removes losing candidate bytes', async (t) => {
		const fixture = new BlobFixture(t);
		const plain = Buffer.from('Same content from two devices');
		await fixture.stageUpload(plain, 'upload-one');
		await fixture.stageUpload(plain, 'upload-two');
		const [first, second] = await fixture.race(() => completeUpload('owner', 'host', 'upload-one'), () => completeUpload('owner', 'host', 'upload-two'));
		assert.equal(first.blob_id, second.blob_id);
		assert.equal(first.state, 'complete');
		assert.equal(second.state, 'complete');
		assert.deepEqual(await readBlobBuffer([...fixture.rows.values()][0], 'host'), plain);
		assert.deepEqual(fs.readdirSync(path.join(fixture.root, 'uploads', 'host')), []);
	});
	it('retains its own published ciphertext if registration succeeds but its response fails', async (t) => {
		const fixture = new BlobFixture(t);
		const plain = Buffer.from('Published despite lost acknowledgement');
		fixture.afterCreate = async () => { throw new Error('Acknowledgement lost'); };
		const blob = await storeBuffer('host', plain);
		assert.deepEqual(await readBlobBuffer(blob, 'host'), plain);
		assert.equal(fs.readdirSync(path.join(fixture.root, 'blobs', 'host')).length, 1);
	});
	it('retries safely after a failed registration leaves an unpublished candidate', async (t) => {
		const fixture = new BlobFixture(t);
		const plain = Buffer.from('Retry publication');
		fixture.beforeCreate = async () => { throw new Error('Registration unavailable'); };
		await assert.rejects(storeBuffer('host', plain), /Registration unavailable/);
		fixture.beforeCreate = async () => {};
		const blob = await storeBuffer('host', plain);
		assert.deepEqual(await readBlobBuffer(blob, 'host'), plain);
		assert.equal(fixture.rows.size, 1);
	});
});
