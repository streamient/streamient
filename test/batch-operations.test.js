import test from 'node:test';
import assert from 'node:assert/strict';
import { Note } from '../model/note.js';
import { processBatch, resolveBatchIds } from '../routes/api.js';

test('explicit batch IDs use bounded pages and at most five concurrent operations with accurate failures', async () => {
	let active = 0;
	let peak = 0;
	const ids = Array.from({ length: 241 }, (_, n) => String(n));
	const pages = [];
	for await (const page of resolveBatchIds('host', 'notes', { ids: [...ids, '1'] })) pages.push(page);
	assert.deepEqual(pages.map((page) => page.length), [100, 100, 41]);
	const result = await processBatch('host', 'notes', { ids }, async (id) => {
		peak = Math.max(peak, ++active);
		await new Promise((resolve) => setImmediate(resolve));
		active--;
		if (id === '13') throw new Error('retry me');
		if (id === '14') return null;
		return { _id: id };
	});
	assert.equal(peak, 5);
	assert.equal(result.success_ids.length, 239);
	assert.deepEqual(result.failed.map(({ id }) => id).sort(), ['13', '14']);
});

test('select-all keyset pages retain the original ceiling and do not select newly copied records', async (t) => {
	const originalFind = Note.find;
	const originalFindOne = Note.findOne;
	t.after(() => { Note.find = originalFind; Note.findOne = originalFindOne; });
	let rows = Array.from({ length: 205 }, (_, n) => ({ _id: String(n + 1).padStart(4, '0') }));
	const chain = (result) => ({ select() { return this; }, sort() { return this; }, read() { return this; }, limit(n) { assert.equal(n, 100); return this; }, lean: async () => result });
	Note.findOne = () => chain(rows.at(-1));
	Note.find = (filter) => { assert.equal(filter.host_id, 'host'); assert.equal(filter.in_trash.$ne, true); return chain(rows.filter(({ _id }) => _id <= filter._id.$lte && (!filter._id.$gt || _id > filter._id.$gt)).slice(0, 100)); };
	const processed = [];
	for await (const page of resolveBatchIds('host', 'notes', { all: true })) {
		processed.push(...page);
		rows = rows.filter(({ _id }) => !page.includes(_id));
		rows.push({ _id: '9999' });
	}
	assert.equal(processed.length, 205);
	assert.equal(new Set(processed).size, 205);
	assert.equal(processed.includes('9999'), false);
});

test('copies keep content with fresh identities and pending indexing', async (t) => {
	const { copyBatchItem } = await import('../routes/api.js');
	const { Project } = await import('../model/project.js');
	const { Memory } = await import('../model/memory.js');
	const { Url } = await import('../model/url.js');
	const { Email } = await import('../model/email.js');
	const { mockTenantWork } = await import('./helpers/tenant-work.js');
	const restoreWork = mockTenantWork(); t.after(restoreWork);
	const projectFind = Project.findOneAndUpdate;
	t.after(() => { Project.findOneAndUpdate = projectFind; });
	Project.findOneAndUpdate = (filter) => ({ select() { return this; }, read() { return this; }, lean: async () => ({ _id: filter._id }) });
	const common = { _id: 'source-id', project: 'source-project', host_id: 'host', owner: 'old-owner', title: 'Copy me', content: '<p>content</p>', text_content: 'content', tags: ['tag'], is_indexed: true, git_source: { repo_id: 'foreign-repo', file_path: 'owned.md' }, git_commit: { sha: 'old' }, obsidian_source: { file_id: 'foreign-file' }, url: 'https://example.com', screenshot: '', subject: 'Mail subject', attachment_text_content: 'attachment text', message_id: 'old-message', references: ['other-message'], raw_hash: 'old-hash' };
	for (const [type, Model] of [['notes', Note], ['memories', Memory], ['urls', Url], ['emails', Email]]) {
		const findOne = Model.findOne;
		const create = Model.create;
		let payload;
		Model.findOne = () => ({ read() { return this; }, lean: async () => common });
		if (type === 'emails') Model.findOne = async () => null;
		Model.create = async (data) => { payload = Array.isArray(data) ? data[0] : data; const doc = { _id: `copy-${type}`, ...payload, updatedAt: new Date() }; return Array.isArray(data) ? [doc] : doc; };
		try {
			if (type === 'emails') {
				let reads = 0;
				Model.findOne = () => { if (reads++ === 0) return { read() { return this; }, lean: async () => common }; return Promise.resolve(null); };
			}
			const item = await copyBatchItem(type, 'new-owner', 'host', 'source-id', 'destination', { skipSideEffects: true });
			assert.equal(item._id, `copy-${type}`);
			assert.equal(payload.project, 'destination');
			assert.equal(payload.owner, 'new-owner');
			assert.equal(payload.is_indexed, false);
			for (const identity of ['_id', 'git_source', 'git_commit', 'obsidian_source', 'createdAt', 'updatedAt']) assert.equal(Object.hasOwn(payload, identity), false, `${type}:${identity}`);
			if (type === 'emails') { assert.equal(payload.message_id, ''); assert.equal(payload.raw_hash, ''); assert.deepEqual(payload.references, []); assert.equal(payload.attachment_text_content, 'attachment text'); }
		} finally { Model.findOne = findOne; Model.create = create; }
	}
});

test('large batches retain exact counts and bounded visible outcomes and failure details', async () => {
	const ids = Array.from({ length: 2300 }, (_, n) => String(n));
	let operations = 0;
	await assert.rejects(processBatch('host', 'notes', { ids }, async () => { operations++; }), /Batch limit is 1000/);
	assert.equal(operations, 0);
	const result = await processBatch('host', 'notes', { ids, visible_ids: ['0', '2299', '0'] }, async (id) => {
		if (Number(id) >= 1100) throw new Error('retry');
		return { _id: id, title: id };
	});
	assert.equal(result.success_count, 1100);
	assert.equal(result.failed_count, 1200);
	assert.equal(result.failures_truncated, true);
	assert.ok(result.failed.length <= 1000);
	assert.ok(result.failed.some(({ id }) => id === '2299'));
	assert.deepEqual(result.success_ids, ['0']);
	assert.equal(result.outcomes.length, 1);
});
