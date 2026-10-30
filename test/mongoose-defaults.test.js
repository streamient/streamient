import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

import config from '../config.js';
import { MongoClient } from 'mongodb';
import mongoose, { queryForSave } from '../model/mongoose.js';
import { User } from '../model/user.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const modelDir = path.join(rootDir, 'model');
const modelFiles = fs.readdirSync(modelDir)
	.filter((file) => file.endsWith('.js') && file !== 'mongoose.js')
	.sort();
const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.ts']);
const excludedSourceDirectories = new Set(['node_modules', 'coverage', 'dist', 'build', 'public']);

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

function sourceFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return excludedSourceDirectories.has(entry.name) ? [] : sourceFiles(fullPath);
		return entry.isFile() && sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
	});
}

const productionFiles = [
	...['apps', 'middleware', 'model', 'modules', 'routes', 'scripts', 'services'].flatMap((dir) => sourceFiles(path.join(rootDir, dir))),
	...['app.js', 'build.js', 'config.js', 'db.js', 'swagger.js', 'tracing.js'].map((file) => path.join(rootDir, file)).filter((file) => fs.existsSync(file)),
].sort();
const mongooseWrapperPath = path.join(modelDir, 'mongoose.js');

describe('Mongoose defaults', () => {
	it('keeps read preference off native clients and on per-model schema options', () => {
		const client = new MongoClient(config.mongoUri, config.mongoOptions);
		assert.equal(client.options.readPreference.mode, 'primary');
		assert.equal(client.options.readConcern.level, 'majority');
		assert.equal(client.options.writeConcern.w, 'majority');
		for (const name of ['db.js', 'app.js', 'modules/socket.js']) assert.match(fs.readFileSync(path.join(rootDir, name), 'utf8'), /config\.mongoOptions/, name);
	});

	it('keeps legacy clock format unset until the user saves it', () => {
		const user = new User({ email: 'timezone-default@example.com', password: 'password', name: 'Timezone Default' });

		assert.equal(user.timezone, 'UTC');
		assert.equal(user.timezone_configured, false);
		assert.equal(user.time_format, undefined);
	});

	it('keeps app-side files on the configured Mongoose singleton', () => {
		for (const file of productionFiles) {
			if (file === mongooseWrapperPath) continue;
			const source = fs.readFileSync(file, 'utf8');
			assert.equal(/(?:from\s*|import\s*\(|require\s*\()\s*['"]mongoose['"]/.test(source), false, `${path.relative(rootDir, file)} imports raw mongoose`);
		}
	});

	it('reserves direct hydration bypasses for queryForSave', () => {
		for (const file of productionFiles) {
			if (file === mongooseWrapperPath) continue;
			const source = fs.readFileSync(file, 'utf8');
			assert.doesNotMatch(source, /\.lean\s*\(\s*false\s*\)/, `${path.relative(rootDir, file)} bypasses queryForSave`);
			assert.equal(source.includes('hydratedQuery'), false, `${path.relative(rootDir, file)} uses the retired hydration helper`);
		}
	});

	it('applies read, toJSON, and usePushEach schema defaults to every model', () => {
		// Matches Helpmonks: these models deliberately use the driver default.
		const driverDefault = new Set(['Email', 'UserPasskey']);
		const modelNames = mongoose.modelNames().sort();
		assert.ok(modelNames.length >= modelFiles.length);

		for (const modelName of modelNames) {
			const schema = mongoose.model(modelName).schema;
			assert.equal(readMode(schema), driverDefault.has(modelName) ? null : 'secondaryPreferred', `${modelName} read mode`);
			assert.equal(schema.options.toJSON?.virtuals, true, `${modelName} toJSON virtuals`);
			assert.equal(schema.options.usePushEach, true, `${modelName} usePushEach`);
		}
	});

	it('defaults find query results to lean with virtuals', async () => {
		const query = User.find({ email: 'a@example.com' });
		await runPreHook(User, 'find', query);
		assert.deepEqual(query._mongooseOptions.lean, { virtuals: true });
	});

	it('preserves queryForSave hydration opt-outs', async () => {
		const query = queryForSave(User.findOne({ email: 'a@example.com' }));
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
		assert.equal(aggregate.options.readPreference, 'secondaryPreferred');
	});
});
