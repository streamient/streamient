import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('release publication requires a successful non-dry-run image build on a release tag', () => {
	const workflow = readFileSync(new URL('../.github/workflows/docker-publish.yml', import.meta.url), 'utf8');
	const release = workflow.slice(workflow.indexOf('    create-release:'));
	assert.match(release, /needs: build-and-push/);
	assert.match(workflow, /push: \$\{\{ inputs\.dry_run != true \}\}/);
	const expression = release.match(/if: \$\{\{ (.+) \}\}/)?.[1];
	assert.ok(expression);
	const allowed = new Function('inputs', 'github', 'startsWith', 'return (' + expression + ');');
	for (const [dryRun, ref, expected] of [[true, 'refs/tags/2026.10.30', false], [false, 'refs/tags/2026.10.30', true], [false, 'refs/heads/develop', false], [false, 'refs/heads/2026-test', false]]) {
		assert.equal(allowed({ dry_run: dryRun }, { ref }, (value, prefix) => value.startsWith(prefix)), expected);
	}
	assert.equal(existsSync(new URL('../.github/workflows/release.yml', import.meta.url)), false);
});
