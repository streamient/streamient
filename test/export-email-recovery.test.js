import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../services/export_service.js', import.meta.url), 'utf8');

function extract(name) {
	const match = new RegExp(`^(?:export )?(?:async )?function(?:\\*)? ${name}\\(`, 'm').exec(source);
	assert.ok(match, `missing function ${name}`);
	const next = /\n(?:export )?(?:async )?function(?:\*)? \w+\(/g;
	next.lastIndex = match.index + match[0].length;
	return source.slice(match.index, next.exec(source)?.index ?? source.length).replace(/^export /, '');
}

function load(names, globals) {
	const context = vm.createContext({ Date, Number, String, Math, Set, Map, Error, Buffer, crypto, path, fs, structuredClone, ...globals });
	vm.runInContext(names.map(extract).join('\n'), context);
	return context;
}

const query = (value) => ({ lean: async () => structuredClone(value) });

function setValue(obj, key, value) {
	const parts = key.split('.');
	let target = obj;
	for (const part of parts.slice(0, -1)) target = target[part] ||= {};
	target[parts.at(-1)] = value;
}

test('export email failure propagates to the worker and a retry delivers the notification', async () => {
	const row = { _id: 'export', host_id: 'host', token: 'token', owner: 'owner', user_email: 'synthetic@example.invalid', file_path: '/virtual/archive.zip', status: 'ready', email_sent_at: null };
	let emails = 0;
	let failFirst = true;
	const context = load(['processExport'], {
		ACTIVE_STATUSES: ['pending', 'processing'], EXPORT_DIR: '/virtual', EXPORT_QUEUE: 'account-export', EXPIRY_MS: 24 * 60 * 60 * 1000,
		Export: {
			findOneAndUpdate: () => query(row),
			updateOne: async (filter, update) => {
				const statusFilter = filter?.status;
				if (statusFilter?.$in && !statusFilter.$in.includes(row.status)) return { matchedCount: 0 };
				for (const [key, value] of Object.entries(update.$set || {})) setValue(row, key, value);
				return { matchedCount: 1 };
			},
		},
		User: { findById: () => ({ select: () => ({ lean: async () => null }) }) },
		sendExportReadyEmail: async () => { emails++; if (failFirst) { failFirst = false; throw new Error('synthetic SMTP failure'); } },
		log: { warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
		fs: { promises: { rm: async () => {}, stat: async () => { const err = new Error('ENOENT'); err.code = 'ENOENT'; throw err; }, mkdir: async () => {} } },
		writeExportArchive: async () => {},
	});

	await assert.rejects(context.processExport('export', 'host'), /synthetic SMTP failure/);
	assert.equal(row.email_sent_at, null);
	assert.equal(row.status, 'ready');
	assert.equal(emails, 1);

	await context.processExport('export', 'host');
	assert.equal(emails, 2);
	assert.ok(row.email_sent_at, 'a successful retry marks the notification sent');
});

test('recovery requeues a completed ready-but-unsent export job', async () => {
	const row = { _id: 'export', host_id: 'host', status: 'ready', email_sent_at: null };
	let addOptions;
	const context = load(['enqueueExport', 'recoverExports'], {
		ACTIVE_STATUSES: ['pending', 'processing'], EXPORT_QUEUE: 'account-export',
		Export: { find: () => ({ lean() { return this; }, async *cursor() { yield row; } }), updateOne: async () => ({ matchedCount: 0 }) },
		MongoQueue: { add: async (_queue, _data, options) => { addOptions = options; return null; }, getJob: async () => ({ status: 'completed' }) },
	});
	await context.recoverExports();
	assert.equal(addOptions.dedupKey, 'export');
	assert.equal(addOptions.requeueCompleted, true);
	assert.equal(addOptions.requeueFailed, true);
});

test('recovery does not force-requeue an active export job', async () => {
	const row = { _id: 'export', host_id: 'host', status: 'processing', email_sent_at: null };
	let addOptions;
	let failed = [];
	const context = load(['enqueueExport', 'recoverExports'], {
		ACTIVE_STATUSES: ['pending', 'processing'], EXPORT_QUEUE: 'account-export',
		Export: { find: () => ({ lean() { return this; }, async *cursor() { yield row; } }), updateOne: async (filter, update) => { failed.push(update.$set.status); return { matchedCount: 1 }; } },
		MongoQueue: { add: async (_queue, _data, options) => { addOptions = options; return null; }, getJob: async () => ({ status: 'failed' }) },
	});
	await context.recoverExports();
	assert.equal(addOptions.requeueCompleted, undefined);
	assert.equal(addOptions.requeueFailed, undefined);
	assert.deepEqual(failed, ['failed']);
});