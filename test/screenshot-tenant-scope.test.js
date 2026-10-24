import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

async function loadScreenshotModule() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'streamient-screenshot-test-'));
	const sourcePath = fileURLToPath(new URL('../modules/screenshot.js', import.meta.url));
	const sharpPath = fileURLToPath(new URL('../node_modules/sharp/dist/index.mjs', import.meta.url));
	const configPath = fileURLToPath(new URL('../config.js', import.meta.url));
	let source = await readFile(sourcePath, 'utf8');
	source = source.replace("from 'sharp'", `from ${JSON.stringify(sharpPath)}`);
	source = source.replace("from '../config.js'", `from ${JSON.stringify(configPath)}`);
	source = source.replace('const __dirname = path.dirname(fileURLToPath(import.meta.url));', 'const __dirname = "/unused";');
	source = source.replace("const SCREENSHOTS_DIR = path.join(__dirname, '..', 'assets', 'screenshots');", `const SCREENSHOTS_DIR = ${JSON.stringify(root)};`);
	const fixtureModule = path.join(root, 'screenshot-module.mjs');
	await writeFile(fixtureModule, source);
	const module = await import('file://' + fixtureModule);
	return { module, root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('client screenshots are scoped to their tenant and never reuse the public capture', async () => {
	const { module, root, cleanup } = await loadScreenshotModule();
	try {
		const sharp = (await import('sharp')).default;
		const privateImage = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer();
		const url = 'https://example.invalid/account/dashboard?fixture=tenant-scope';
		const hostA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
		const hostB = 'bbbbbbbbbbbbbbbbbbbbbbbb';

		const fromA = await module.saveScreenshotDataUrl(url, 'data:image/png;base64,' + privateImage.toString('base64'), hostA);
		const fromB = await module.saveScreenshotDataUrl(url, 'data:image/png;base64,' + privateImage.toString('base64'), hostB);

		assert.equal(fromA, `${hostA}-${module.urlToFilename(url)}`);
		assert.equal(fromB, `${hostB}-${module.urlToFilename(url)}`);
		assert.notEqual(fromA, fromB);

		// The public URL-only capture must never adopt or overwrite the private file.
		const fromPublic = await module.saveScreenshot(url);
		assert.notEqual(fromPublic, fromA);
		assert.notEqual(fromPublic, fromB);

		await access(path.join(root, fromA));
		await access(path.join(root, fromB));
	} finally {
		await cleanup();
	}
});

test('legacy ambiguous bare-hash screenshots fail closed for serving and signing', async () => {
	const { module, cleanup } = await loadScreenshotModule();
	try {
		const bare = `${'a'.repeat(64)}.png`;
		const publicName = `pub-${'a'.repeat(64)}.png`;
		const privateName = `${'a'.repeat(24)}-${'b'.repeat(64)}.png`;

		assert.equal(module.signScreenshotUrl(bare), null);
		assert.equal(module.resolveScreenshotPath(bare), null);
		assert.equal(module.verifyScreenshotSignature(bare, Math.floor(Date.now() / 1000) + 3600, 'deadbeef'), false);

		assert.ok(module.signScreenshotUrl(publicName));
		assert.ok(module.signScreenshotUrl(privateName));
		assert.equal(module.resolveScreenshotPath(bare), null);
		assert.ok(module.resolveScreenshotPath(publicName));
		assert.ok(module.resolveScreenshotPath(privateName));
	} finally {
		await cleanup();
	}
});