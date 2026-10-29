import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import config from '../config.js';
import { Note } from '../model/note.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excludedDirectories = new Set(['node_modules', 'test', 'tests', '__tests__', 'coverage', 'dist', 'build', 'public']);
const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const primaryRead = /read\(['"]primary|primaryQuery|readPreference['"]?\s*:\s*['"]primary|ReadPreference\.PRIMARY/;
// Lower this when removing primary reads; never raise it.
const PRIMARY_READ_BASELINE = 0;

function sourceFiles(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name.startsWith('.') || excludedDirectories.has(entry.name) ? [] : sourceFiles(fullPath);
		return entry.isFile() && sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
	});
}

describe('read preference guard', () => {
	it('does not add primary reads outside transaction sessions', () => {
		const hits = sourceFiles(rootDir).flatMap((file) => fs.readFileSync(file, 'utf8').split('\n').map((line, i) => ({ line, at: `${path.relative(rootDir, file)}:${i + 1}` })).filter(({ line }) => primaryRead.test(line) && !line.includes('session')));
		assert.ok(hits.length <= PRIMARY_READ_BASELINE, `primary reads above baseline ${PRIMARY_READ_BASELINE}:\n${hits.map((hit) => hit.at).join('\n')}`);
	});

	it('sets read preference per model, not on the connection', () => {
		assert.equal(Note.schema.options.read, 'secondaryPreferred');
		assert.equal('readPreference' in config.mongoOptions, false);
		assert.equal('maxStalenessSeconds' in config.mongoOptions, false);
	});
});
