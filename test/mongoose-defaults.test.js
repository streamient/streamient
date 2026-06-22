import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

import mongoose from '../model/mongoose.js';
import { User } from '../model/user.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const modelDir = path.join(rootDir, 'model');
const modelFiles = fs.readdirSync(modelDir)
	.filter((file) => file.endsWith('.js') && file !== 'mongoose.js')
	.sort();
const rawMongooseAllowed = new Set(['model/mongoose.js', 'test/mongoose-defaults.test.js']);

await Promise.all(modelFiles.map((file) => import(pathToFileURL(path.join(modelDir, file)).href)));
await import(pathToFileURL(path.join(rootDir, 'modules/tenancy.js')).href);

function readMode(schema) {
	const read = schema.options.read;
	return read?.mode || read;
}

async function runPreHook(model, op, query) {
	assert.equal(query.model, model);
	await query._queryMiddleware.execPre(op, query, []);
}

function jsFiles(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		if (entry.name === 'node_modules' || entry.name === '.git') return [];
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return jsFiles(fullPath);
		return entry.name.endsWith('.js') ? [fullPath] : [];
	});
}

describe('Mongoose defaults', () => {
	it('keeps app-side files on the configured Mongoose singleton', () => {
		const roots = ['model', 'modules', 'routes', 'services', 'middleware', 'test']
			.map((dir) => path.join(rootDir, dir))
			.filter((dir) => fs.existsSync(dir));
		const files = [
			path.join(rootDir, 'db.js'),
			path.join(rootDir, 'app.js'),
			...roots.flatMap(jsFiles),
		];

		for (const file of files) {
			const rel = path.relative(rootDir, file);
			if (rawMongooseAllowed.has(rel)) continue;
			const source = fs.readFileSync(file, 'utf8');
			assert.equal(source.includes("from 'mongoose'"), false, `${rel} imports raw mongoose`);
			assert.equal(source.includes('from "mongoose"'), false, `${rel} imports raw mongoose`);
		}
	});

	it('applies read, toJSON, and usePushEach schema defaults to every model', () => {
		const modelNames = mongoose.modelNames().sort();
		assert.ok(modelNames.length >= modelFiles.length);

		for (const modelName of modelNames) {
			const schema = mongoose.model(modelName).schema;
			assert.equal(readMode(schema), 'secondaryPreferred', `${modelName} read mode`);
			assert.equal(schema.options.toJSON?.virtuals, true, `${modelName} toJSON virtuals`);
			assert.equal(schema.options.usePushEach, true, `${modelName} usePushEach`);
		}
	});

	it('defaults find query results to lean with virtuals', async () => {
		const query = User.find({ email: 'a@example.com' });
		await runPreHook(User, 'find', query);
		assert.deepEqual(query._mongooseOptions.lean, { virtuals: true });
	});

	it('preserves explicit hydrated query opt-outs', async () => {
		const query = User.findOne({ email: 'a@example.com' }).lean(false);
		await runPreHook(User, 'findOne', query);
		assert.equal(query._mongooseOptions.lean, false);
	});

	it('merges explicit lean options with virtuals', async () => {
		const query = User.findOne({ email: 'a@example.com' }).lean({ getters: true });
		await runPreHook(User, 'findOne', query);
		assert.deepEqual(query._mongooseOptions.lean, { getters: true, virtuals: true });
	});

	it('defaults findOneAndUpdate returned documents to lean with virtuals', async () => {
		const query = User.findOneAndUpdate({ email: 'a@example.com' }, { $set: { name: 'A' } }, { returnDocument: 'after' });
		await runPreHook(User, 'findOneAndUpdate', query);
		assert.deepEqual(query._mongooseOptions.lean, { virtuals: true });
	});

	it('applies schema read preference to aggregations', () => {
		const aggregate = User.aggregate([{ $match: { email: 'a@example.com' } }]);
		assert.equal(aggregate.options.readPreference?.mode, 'secondaryPreferred');
	});
});
