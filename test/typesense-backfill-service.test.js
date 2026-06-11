import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { SystemSetting } from '../model/system_setting.js';
import { backfillTypesenseTrashFields } from '../services/typesense_backfill_service.js';

describe('Typesense trash fields backfill', () => {
	it('marks all content models unindexed once and stores a guard setting', async () => {
		const originals = {
			systemFindOne: SystemSetting.findOne,
			systemFindOneAndUpdate: SystemSetting.findOneAndUpdate,
			noteUpdateMany: Note.updateMany,
			memoryUpdateMany: Memory.updateMany,
			urlUpdateMany: Url.updateMany,
			emailUpdateMany: Email.updateMany,
		};
		const modelCalls = [];
		let settingUpdate = null;

		SystemSetting.findOne = async (query) => {
			assert.deepEqual(query, { key: 'typesense.trash_fields_backfill_v1' });
			return null;
		};
		SystemSetting.findOneAndUpdate = async (query, update, options) => {
			settingUpdate = { query, update, options };
			return { value: update.$set.value };
		};
		Note.updateMany = async (query, update, options) => {
			modelCalls.push({ type: 'notes', query, update, options });
			return { modifiedCount: 2 };
		};
		Memory.updateMany = async (query, update, options) => {
			modelCalls.push({ type: 'memory', query, update, options });
			return { modifiedCount: 3 };
		};
		Url.updateMany = async (query, update, options) => {
			modelCalls.push({ type: 'urls', query, update, options });
			return { modifiedCount: 4 };
		};
		Email.updateMany = async (query, update, options) => {
			modelCalls.push({ type: 'emails', query, update, options });
			return { modifiedCount: 5 };
		};

		try {
			const result = await backfillTypesenseTrashFields();

			assert.deepEqual(modelCalls.map((call) => call.type).sort(), ['emails', 'memory', 'notes', 'urls']);
			assert.ok(modelCalls.every((call) => JSON.stringify(call.query) === '{}'));
			assert.ok(modelCalls.every((call) => JSON.stringify(call.update) === JSON.stringify({ $set: { is_indexed: false } })));
			assert.ok(modelCalls.every((call) => JSON.stringify(call.options) === JSON.stringify({ timestamps: false })));
			assert.equal(result.skipped, false);
			assert.equal(result.queued, 14);
			assert.deepEqual(settingUpdate.query, { key: 'typesense.trash_fields_backfill_v1' });
			assert.equal(settingUpdate.update.$set.category, 'backfill');
			assert.equal(settingUpdate.update.$set.value.complete, true);
			assert.equal(settingUpdate.update.$set.value.queued, 14);
			assert.equal(settingUpdate.options.upsert, true);
		} finally {
			SystemSetting.findOne = originals.systemFindOne;
			SystemSetting.findOneAndUpdate = originals.systemFindOneAndUpdate;
			Note.updateMany = originals.noteUpdateMany;
			Memory.updateMany = originals.memoryUpdateMany;
			Url.updateMany = originals.urlUpdateMany;
			Email.updateMany = originals.emailUpdateMany;
		}
	});

	it('skips when the guard setting is complete', async () => {
		const originals = {
			systemFindOne: SystemSetting.findOne,
			systemFindOneAndUpdate: SystemSetting.findOneAndUpdate,
			noteUpdateMany: Note.updateMany,
			memoryUpdateMany: Memory.updateMany,
			urlUpdateMany: Url.updateMany,
			emailUpdateMany: Email.updateMany,
		};

		SystemSetting.findOne = async () => ({ value: { complete: true } });
		SystemSetting.findOneAndUpdate = async () => {
			throw new Error('unexpected guard rewrite');
		};
		Note.updateMany = async () => {
			throw new Error('unexpected note queue');
		};
		Memory.updateMany = async () => {
			throw new Error('unexpected memory queue');
		};
		Url.updateMany = async () => {
			throw new Error('unexpected url queue');
		};
		Email.updateMany = async () => {
			throw new Error('unexpected email queue');
		};

		try {
			const result = await backfillTypesenseTrashFields();

			assert.deepEqual(result, { skipped: true });
		} finally {
			SystemSetting.findOne = originals.systemFindOne;
			SystemSetting.findOneAndUpdate = originals.systemFindOneAndUpdate;
			Note.updateMany = originals.noteUpdateMany;
			Memory.updateMany = originals.memoryUpdateMany;
			Url.updateMany = originals.urlUpdateMany;
			Email.updateMany = originals.emailUpdateMany;
		}
	});
});
