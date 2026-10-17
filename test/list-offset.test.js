import test from 'node:test';
import assert from 'node:assert/strict';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { listNotes } from '../services/note_service.js';
import { listMemories } from '../services/memory_service.js';
import { listUrls } from '../services/url_service.js';
import { listEmails } from '../services/email_ingest_service.js';

test('record lists accept validated offsets after removals and insertions while retaining page compatibility', async (t) => {
	for (const [Model, list] of [[Note, listNotes], [Memory, listMemories], [Url, listUrls], [Email, listEmails]]) {
		let rows = Array.from({ length: 100 }, (_, n) => ({ _id: `row-${n + 1}`, title: 'Item', subject: 'Mail', url: 'https://example.com', createdAt: new Date(200000 - n * 1000), updatedAt: new Date(200000 - n * 1000) }));
		if (Model === Memory) t.mock.method(Model, 'aggregate', async (pipeline) => rows.slice(pipeline.find((step) => step.$skip !== undefined).$skip, pipeline.find((step) => step.$skip !== undefined).$skip + pipeline.find((step) => step.$limit !== undefined).$limit));
		else t.mock.method(Model, 'find', () => {
			let start = 0;
			let size = rows.length;
			const query = { select() { return this; }, sort() { return this; }, skip(value) { start = value; return this; }, limit(value) { size = value; return this; }, lean() { return this; }, then(resolve) { return Promise.resolve(rows.slice(start, start + size)).then(resolve); } };
			return query;
		});
		assert.equal((await list('host', 'project', { offset: 0, limit: 50 }))[0]._id, 'row-1');
		assert.equal((await list('host', 'project', { page: 2, limit: 50 }))[0]._id, 'row-51');
		const originals = [...rows];
		rows.splice(0, 50);
		assert.equal((await list('host', 'project', { offset: 0, limit: 50 }))[0]._id, 'row-51');
		rows = [...originals];
		rows.unshift(...Array.from({ length: 5 }, (_, n) => ({ ...originals[0], _id: `copy-${n}`, createdAt: new Date(300000 + n), updatedAt: new Date(300000 + n) })));
		assert.equal((await list('host', 'project', { offset: 55, limit: 50 }))[0]._id, 'row-51');
		for (const offset of [-1, 1.5, 'invalid', Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(list('host', 'project', { offset }), /offset must be/);
	}
});
