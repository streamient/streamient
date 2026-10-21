import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../apps/mobile/vite.config.ts';

test('mobile development serves workspace font assets without exposing server source', () => {
	const allowed = config.server.fs.allow;
	const serves = (file) => allowed.some((directory) => { const relative = path.relative(directory, file); return !relative.startsWith('..') && !path.isAbsolute(relative); });
	for (const family of ['inter', 'material-symbols-outlined']) {
		const font = fs.realpathSync(new URL(`../apps/mobile/node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`, import.meta.url));
		assert.ok(serves(font), `${family} font must be allowed`);
	}
	assert.ok(serves(fileURLToPath(new URL('../apps/mobile/src/main.tsx', import.meta.url))));
	assert.equal(serves(fileURLToPath(new URL('../config.js', import.meta.url))), false);
	assert.equal(config.server.fs.strict, undefined);
});
