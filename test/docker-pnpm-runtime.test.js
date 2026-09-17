import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('constrains and preinstalls pnpm 12 without Corepack', () => {
	assert.equal(packageJson.packageManager, undefined);
	assert.equal(packageJson.engines.pnpm, '12');
	for (const file of ['dev.Dockerfile', 'prod.Dockerfile']) {
		const source = fs.readFileSync(new URL(`../docker/dockerfiles/${file}`, import.meta.url), 'utf8');
		assert.match(source, /ARG PNPM_VERSION=12/);
		assert.match(source, /npm install --global pnpm@\$\{PNPM_VERSION\}/);
		assert.doesNotMatch(source, /corepack/);
	}
});


test('production dependency stages include the session-store patch before installation', () => {
	const source = fs.readFileSync(new URL('../docker/dockerfiles/prod.Dockerfile', import.meta.url), 'utf8');
	for (const stage of ['deps', 'production']) {
		const body = source.split(`FROM builder AS ${stage}`)[1].split('FROM ')[0];
		assert.ok(body.indexOf('COPY --link patches ./patches') >= 0);
		assert.ok(body.indexOf('COPY --link patches ./patches') < body.indexOf('RUN pnpm install'));
	}
});
