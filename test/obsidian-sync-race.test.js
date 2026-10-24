import assert from 'node:assert/strict';
import test, { mock, afterEach } from 'node:test';

import { ObsidianBlob } from '../model/obsidian_blob.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';
import mongoose from '../model/mongoose.js';
import { __test as syncTest } from '../services/obsidian_sync_service.js';

afterEach(() => mock.restoreAll());

function mockQuery(value) {
	return { lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}

test('a conditional file write publishes one revision and rejects the losing writer', async () => {
	const persisted = { _id: 'file', connection: 'conn', host_id: 'host', path: 'a.png', kind: 'image', size: 1, revision: 1, blob: 'old', sha256: 'old', modified_at: new Date(1000), last_source: 'obsidian', last_device_id: '', in_trash: false, trashed_at: null };
	mock.method(ObsidianRevision, 'create', async (data) => data);
	mock.method(ObsidianConnection, 'findOneAndUpdate', async () => ({ sequence: 1 }));
	mock.method(ObsidianConnection, 'updateOne', async () => ({ matchedCount: 1 }));
	mock.method(ObsidianChange, 'create', async (data) => data);
	mock.method(ObsidianBlob, 'findOne', () => ({ lean: async () => null }));
	mock.method(ObsidianFile, 'findOneAndUpdate', async (filter, update) => {
		if (filter.revision !== persisted.revision) return null;
		Object.assign(persisted, update.$set);
		return { ...persisted };
	});
	mock.method(mongoose.connection, 'transaction', async (callback) => callback(undefined));

	const connection = () => ({ _id: 'conn', host_id: 'host', project: 'project', storage_bytes: 1, owner: 'owner' });
	const fileA = { ...structuredClone(persisted) };
	const fileB = { ...structuredClone(persisted) };
	const winner = await syncTest.commitFile(connection(), fileA, 'update', { blob: { _id: 'A', sha256: 'A', total_bytes: 1 }, modifiedAt: new Date(2000), source: 'obsidian', operationId: 'A' });
	assert.equal(winner.file.revision, 2);
	assert.equal(persisted.blob, 'A');

	await assert.rejects(
		syncTest.commitFile(connection(), fileB, 'update', { blob: { _id: 'B', sha256: 'B', total_bytes: 1 }, modifiedAt: new Date(2000), source: 'obsidian', operationId: 'B' }),
		/revision changed concurrently/,
	);
	assert.equal(persisted.blob, 'A');
	assert.equal(persisted.revision, 2);
});

test('a mutation whose file was committed concurrently reloads and preserves the loser as a conflict', async () => {
	const persisted = { _id: 'file', connection: 'conn', host_id: 'host', path: 'a.png', kind: 'image', size: 1, revision: 2, blob: 'winner', sha256: 'winner', modified_at: new Date(Date.now() - 60_000), last_source: 'obsidian', last_device_id: '', in_trash: false, trashed_at: null };
	let sequence = 0;
	let finds = 0;
	let revisions = 0;
	const changes = [];
	mock.method(ObsidianChange, 'findOne', () => mockQuery(null));
	mock.method(ObsidianChange, 'create', async (data) => { changes.push(data); return data; });
	mock.method(ObsidianConnection, 'findOneAndUpdate', async (_filter, update) => ({ sequence: sequence += update.$inc.sequence }));
	mock.method(ObsidianConnection, 'updateOne', async () => ({ modifiedCount: 1 }));
	mock.method(ObsidianFile, 'findOne', () => { finds++; return mockQuery({ ...structuredClone(persisted), revision: finds === 1 ? 1 : persisted.revision }); });
	mock.method(ObsidianFile, 'findOneAndUpdate', async () => null);
	mock.method(ObsidianRevision, 'create', async (data) => ({ _id: `rev-${++revisions}`, ...data }));
	mock.method(ObsidianUpload, 'findOne', () => ({ lean: async () => ({ blob: 'blob-id', mime_type: 'text/markdown' }) }));
	mock.method(ObsidianBlob, 'findOne', () => ({ _id: 'blob-id', sha256: 'loser-sha', total_bytes: 5, lean: async () => ({ _id: 'blob-id', sha256: 'loser-sha', total_bytes: 5 }), toObject: () => ({ _id: 'blob-id', sha256: 'loser-sha', total_bytes: 5 }) }));
	mock.method(mongoose.connection, 'transaction', async (callback) => callback(undefined));

	const connection = { _id: 'conn', host_id: 'host', project: 'project', owner: 'owner', sequence: 0, storage_bytes: 1 };
	const result = await syncTest.applyMutation(connection, 'user', { operation_id: 'op', operation: 'update', file_id: 'file', path: 'a.png', base_revision: 1, upload_id: 'u', modified_at: new Date(Date.now() - 120_000), device_id: 'device' });

	assert.equal(finds, 2, 'the loser reloads the file after losing the conditional write');
	assert.equal(result.accepted, false);
	assert.equal(result.conflict, true);
	assert.equal(persisted.revision, 2);
	assert.equal(persisted.blob, 'winner');
	assert.ok(result.change.losing_revision_id, 'the losing bytes are preserved as a recoverable revision');
});

test('sequence allocation and change insert share one write transaction with no observable gap', async () => {
	let sequence = 0;
	const sessions = [];
	const changes = [];
	mock.method(mongoose.connection, 'transaction', async (callback) => callback('tx-session'));
	mock.method(ObsidianConnection, 'findOneAndUpdate', async (_filter, update, options) => { sessions.push(options?.session); return { sequence: sequence += update.$inc.sequence }; });
	mock.method(ObsidianChange, 'create', async (data, options) => { sessions.push(options?.session); changes.push(data); return data; });

	const connection = { _id: 'conn', host_id: 'host' };
	const file = { _id: 'file', path: 'a.png', revision: 1, sha256: 'sha', modified_at: new Date(), last_source: 'obsidian', last_device_id: '' };
	await syncTest.recordChange(connection, file, 'update', { operationId: 'A' });
	await syncTest.recordChange(connection, file, 'update', { operationId: 'B' });

	assert.deepEqual(changes.map((change) => change.sequence), [1, 2]);
	assert.equal(sessions.length, 4);
	assert.ok(sessions.every((session) => session === 'tx-session'), 'allocation and insert run in the same transaction');
});

test('recordChange reuses a provided session instead of nesting a transaction', async () => {
	let nested = 0;
	mock.method(mongoose.connection, 'transaction', async () => { nested++; });
	mock.method(ObsidianConnection, 'findOneAndUpdate', async (_filter, update, options) => ({ sequence: 7 }));
	mock.method(ObsidianChange, 'create', async (data, options) => data);

	const connection = { _id: 'conn', host_id: 'host' };
	const file = { _id: 'file', path: 'a.png', revision: 1, sha256: 'sha', modified_at: new Date(), last_source: 'obsidian', last_device_id: '' };
	const change = await syncTest.recordChange(connection, file, 'update', { operationId: 'A' }, 'existing-session');

	assert.equal(change.sequence, 7);
	assert.equal(nested, 0);
});