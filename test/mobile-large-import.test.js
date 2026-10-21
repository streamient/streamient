import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function runBoundedExtraction(filePath) {
	const moduleUrl = new URL('../services/import_service.js', import.meta.url).href;
	const script = `import { extractText } from ${JSON.stringify(moduleUrl)}; const result = await extractText(process.argv[1], 'text/plain', 'sparse.txt'); console.log('STREAMIENT_RESULT=' + JSON.stringify({ text: result.text.length, html: result.html.length, truncated: result.truncated }));`;
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', script, filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (data) => { stdout += data; });
		child.stderr.on('data', (data) => { stderr += data; });
		child.on('error', reject);
		child.on('close', (code) => {
			if (code !== 0) return reject(new Error(stderr || `Extractor exited ${code}`));
			const marker = stdout.split('\n').find((line) => line.startsWith('STREAMIENT_RESULT='));
			return marker ? resolve(JSON.parse(marker.slice('STREAMIENT_RESULT='.length))) : reject(new Error(`Extractor result missing: ${stdout}`));
		});
	});
}

describe('bounded multi-gigabyte import extraction', () => {
	it('processes a 3 GiB sparse text fixture under a 128 MiB heap', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'streamient-mobile-import-'));
		const fixture = path.join(directory, 'sparse.txt');
		try {
			await writeFile(fixture, 'Streamient mobile bounded extraction\n');
			await truncate(fixture, 3 * 1024 * 1024 * 1024);
			const result = await runBoundedExtraction(fixture);
			assert.equal(result.truncated, true);
			assert.ok(result.text <= 1_500_100);
			assert.ok(result.html <= 1_500_200);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('rejects unsupported binary extraction without reading file content', async () => {
		const { extractText } = await import('../services/import_service.js');
		await assert.rejects(extractText('/path/does/not/need/to/exist', 'image/png', 'image.png'), /binary and cannot be imported/);
	});

	it('classifies unknown binary headers as unsupported instead of plain text', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'streamient-mobile-detect-'));
		const fixture = path.join(directory, 'unknown.bin');
		try {
			await writeFile(fixture, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
			const { detectFileType } = await import('../modules/file_detect.js');
			assert.equal((await detectFileType(fixture)).mimeType, 'application/octet-stream');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

it('Word extraction cancellation settles only after its isolated worker exits', async () => {
	const { extractText } = await import('../services/import_service.js');
	const controller = new AbortController();
	const extraction = extractText('/no-such-word-file.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file.docx', { signal: controller.signal });
	controller.abort(new Error('Extraction cancelled'));
	await assert.rejects(extraction, /Extraction cancelled/);
});
