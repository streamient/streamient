import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { runStreamientIndexer } from '../modules/typesense.js';

test('every indexed model has the host/is_indexed/updatedAt index the indexer queries', () => {
	for (const Model of [Note, Memory, Url, Email, ObsidianFile]) {
		const found = Model.schema.indexes().some(([keys]) => JSON.stringify(keys) === JSON.stringify({ host_id: 1, is_indexed: 1, updatedAt: -1 }));
		assert.equal(found, true, Model.modelName);
	}
});

test('indexer host discovery aggregate does not sort every unindexed document', async () => {
	const pipelines = [];
	const model = { aggregate: async (pipeline) => { pipelines.push(pipeline); return []; } };
	await runStreamientIndexer({ Note: model });
	assert.equal(pipelines.length, 1);
	assert.equal(pipelines[0].some((step) => '$sort' in step), false);
	assert.equal(pipelines[0].some((step) => '$group' in step), true);
});
