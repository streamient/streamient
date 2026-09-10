import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('Android release verification accepts verbose success and rejects unsigned or failed verification', (t) => {
	const script = readFileSync(new URL('../apps/mobile/scripts/android-release-bundle.sh', import.meta.url), 'utf8');
	const buildCommand = './gradlew :app:bundleRelease';
	const buildEnd = script.lastIndexOf(buildCommand);
	assert.notEqual(buildEnd, -1);
	const verification = script.slice(buildEnd + buildCommand.length);
	const directory = mkdtempSync(join(tmpdir(), 'streamient-signature-'));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	mkdirSync(join(directory, 'bin'));
	const jarsigner = join(directory, 'bin', 'jarsigner');
	writeFileSync(jarsigner, '#!/usr/bin/env bash\ncat "$MOCK_OUTPUT"\nexit "$MOCK_STATUS"\n');
	chmodSync(jarsigner, 0o755);
	const output = join(directory, 'verification.log');
	const cases = [
		{ name: 'large successful output', output: `jar verified.\n${'JarInputStream warning\n'.repeat(20000)}`, status: 0, expected: 0 },
		{ name: 'unsigned bundle', output: 'jar is unsigned\n', status: 0, expected: 1 },
		{ name: 'failed verifier despite success text', output: 'jar verified.\n', status: 1, expected: 1 },
		{ name: 'missing verification confirmation', output: 'unexpected output\n', status: 0, expected: 1 },
	];
	for (const scenario of cases) {
		writeFileSync(output, scenario.output);
		const result = spawnSync('bash', ['-c', `set -euo pipefail\n${verification}`], { encoding: 'utf8', env: { ...process.env, JAVA_HOME: directory, PATH: `${join(directory, 'bin')}:${process.env.PATH}`, AAB_PATH: join(directory, 'app-release.aab'), MOCK_OUTPUT: output, MOCK_STATUS: String(scenario.status) } });
		assert.equal(result.status, scenario.expected, scenario.name);
		if (scenario.expected === 0) assert.match(result.stdout, /Signed Android App Bundle:/);
	}
});
