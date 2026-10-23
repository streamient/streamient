import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Export } from '../model/export.js';
import { cleanupExpiredExports, EXPORT_DIR } from '../services/export_service.js';
import { migrateExportIndexes } from '../services/export_ttl_migration_service.js';

function cleanupMocks(t, rows) {
	const find = Export.find;
	const deleteOne = Export.deleteOne;
	const listIndexes = Export.collection.listIndexes;
	const exists = Export.findOneAndUpdate;
	const deleted = [];
	Export.find = () => ({ read() { return this; }, lean: async () => rows });
	Export.findOneAndUpdate = async () => true;
	Export.collection.listIndexes = () => ({ toArray: async () => [] });
	Export.deleteOne = async (query) => { deleted.push(query._id); return { deletedCount: 1 }; };
	t.after(() => { Export.find = find; Export.deleteOne = deleteOne; Export.collection.listIndexes = listIndexes; Export.findOneAndUpdate = exists; });
	return deleted;
}

test('expired export cleanup removes file before metadata and retains failures for retry', async (t) => {
	await fs.mkdir(EXPORT_DIR, { recursive: true });
	const filePath = path.join(EXPORT_DIR, `cleanup-test-${process.pid}.zip`);
	await fs.writeFile(filePath, 'fixture');
	t.after(() => fs.rm(filePath, { force: true }));
	const deleted = cleanupMocks(t, [{ _id: 'good', file_path: filePath }, { _id: 'missing', file_path: `${filePath}-missing` }, { _id: 'outside', file_path: '/outside/export.zip' }, { _id: 'failure', file_path: EXPORT_DIR }]);
	assert.equal(await cleanupExpiredExports(), 2);
	assert.deepEqual(deleted, ['good', 'missing']);
	await assert.rejects(fs.stat(filePath), { code: 'ENOENT' });
});

test('cleanup refuses the old TTL index until migration has completed', async (t) => {
	cleanupMocks(t, []);
	Export.collection.listIndexes = () => ({ toArray: async () => [{ name: 'expires_at_1', key: { expires_at: 1 }, expireAfterSeconds: 0 }] });
	await assert.rejects(cleanupExpiredExports(), /migrate-export-indexes/);
});

test('export migration is explicit, repairs duplicate admissions, and can repeat', async () => {
	const calls = [];
	let indexes = [{ name: 'expires_at_1', key: { expires_at: 1 }, expireAfterSeconds: 0 }];
	let rows = [{ _id: 'new', host_id: 'tenant' }, { _id: 'old', host_id: 'tenant' }];
	const db = { collection: () => ({
		listIndexes: () => ({ toArray: async () => indexes }),
		find: () => ({ sort: () => rows }),
		dropIndex: async (name) => { calls.push(['drop', name]); indexes = []; },
		updateMany: async (filter) => { calls.push(['fail', filter._id.$in]); rows = rows.slice(0, 1); },
		createIndex: async () => { calls.push(['admission']); },
	}) };
	assert.deepEqual((await migrateExportIndexes({ db })).duplicate_exports, ['old']);
	assert.deepEqual(calls, []);
	await migrateExportIndexes({ db, apply: true });
	assert.deepEqual(calls, [['drop', 'expires_at_1'], ['fail', ['old']], ['admission']]);
	assert.deepEqual((await migrateExportIndexes({ db, apply: true })).ttl_indexes, []);
});
