import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

it('exits quietly when the output consumer closes its pipe', async () => {
	const child = spawn(process.execPath, [new URL('../bin/streamient-cli.js', import.meta.url).pathname, '--help'], { stdio: ['ignore', 'pipe', 'pipe'] });
	let stderr = '';
	child.stderr.on('data', (data) => { stderr += data; });
	child.stdout.destroy();
	const [code] = await once(child, 'exit');
	assert.equal(code, 0);
	assert.equal(stderr, '');
});
