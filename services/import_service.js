import { Worker } from 'node:worker_threads';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import striptags from 'striptags';
import { createLogger } from '../modules/logger.js';

const log = createLogger('import');
const MAX_EXTRACTED_CHARACTERS = 1_500_000;

const PDF_TYPES = ['application/pdf'];
const WORD_TYPES = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// MIME prefixes that are known binary and cannot be imported as notes
const BINARY_PREFIXES = ['image/', 'audio/', 'video/', 'font/'];
const BINARY_TYPES = new Set([
    'application/zip', 'application/gzip', 'application/x-tar',
    'application/x-7z-compressed', 'application/x-rar-compressed',
    'application/octet-stream', 'application/wasm',
    'application/x-executable', 'application/x-mach-binary',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/**
 * Dispatch to the right extractor based on detected mime type.
 * Returns { text, html } — html may be same as text for plain files.
 */
export async function extractText(filePath, mimeType, originalName, { signal } = {}) {
    signal?.throwIfAborted();
    // Reject known binary types early with a clear message
    if (BINARY_PREFIXES.some((p) => mimeType.startsWith(p)) || BINARY_TYPES.has(mimeType)) {
        throw new Error('File is binary and cannot be imported as a note');
    }

    if (PDF_TYPES.includes(mimeType)) {
        return extractPdfContent(filePath, signal);
    }
    if (WORD_TYPES.includes(mimeType)) {
        return extractWordContent(filePath, signal);
    }
    // Everything else: MD, TXT, RTF, HBS, code files, extensionless text, etc.
    return extractTextContent(filePath, signal);
}

/**
 * Extract PDF text through Poppler's page-wise parser. Stdout is consumed in
 * bounded chunks, so source-file size does not determine JavaScript memory use.
 */
async function extractPdfContent(filePath, signal) {
	return new Promise((resolve, reject) => {
		const process = spawn('pdftotext', ['-layout', filePath, '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
		const abort = () => process.kill('SIGKILL');
		signal?.addEventListener('abort', abort, { once: true });
		if (signal?.aborted) abort();
		let text = '';
		let stderr = '';
		let truncated = false;
		process.stdout.setEncoding('utf8');
		process.stdout.on('data', (chunk) => {
			if (text.length >= MAX_EXTRACTED_CHARACTERS) return;
			const remaining = MAX_EXTRACTED_CHARACTERS - text.length;
			text += chunk.slice(0, remaining);
			if (chunk.length > remaining) truncated = true;
		});
		process.stderr.setEncoding('utf8');
		process.stderr.on('data', (chunk) => { if (stderr.length < 4000) stderr += chunk.slice(0, 4000 - stderr.length); });
		process.on('error', reject);
		process.on('close', (code) => {
			signal?.removeEventListener('abort', abort);
			if (signal?.aborted) return reject(signal.reason);
			if (code && !text) return reject(new Error(stderr.trim() || `PDF extraction failed with exit code ${code}`));
			resolve(extractedResult(text, truncated));
		});
	});
}

/**
 * Extract text from Word/DOCX using mammoth (proven in Razuna).
 */
async function extractWordContent(filePath, signal) {
	// Mammoth cannot cancel; isolate it so cancellation waits for actual termination.
	const worker = new Worker(new URL('./word_extractor.js', import.meta.url), { workerData: { filePath, limit: MAX_EXTRACTED_CHARACTERS } });
	let result;
	let error;
	const abort = () => { worker.terminate().catch(() => {}); };
	signal?.addEventListener('abort', abort, { once: true });
	if (signal?.aborted) abort();
	await new Promise((resolve, reject) => {
		worker.on('message', (message) => { result = message; });
		worker.on('error', (err) => { error = err; });
		worker.on('exit', (code) => { signal?.removeEventListener('abort', abort); if (signal?.aborted) reject(signal.reason); else if (error || code || !result) reject(error || new Error('Word extraction failed')); else resolve(); });
	});
	const html = result.html.trim();
	const text = collapseWhitespace(striptags(html, [], ' '));
	return { text, html: html || `<p>${escapeHtml(text)}</p>` };
}

/**
 * Extract text from plain text files using n-readlines (proven in Razuna).
 * Handles MD, TXT, RTF, code, and any other text-based file.
 */
async function extractTextContent(filePath, signal) {
	const decoder = new TextDecoder('utf-8', { fatal: false });
	let text = '';
	let truncated = false;
	for await (const chunk of createReadStream(filePath, { highWaterMark: 64 * 1024, signal })) {
		const decoded = decoder.decode(chunk, { stream: true });
		const remaining = MAX_EXTRACTED_CHARACTERS - text.length;
		if (decoded.length > remaining) {
			text += decoded.slice(0, remaining);
			truncated = true;
			break;
		}
		text += decoded;
	}
	if (!truncated) text += decoder.decode();
	if (truncated) log.info({ file_path: filePath, extracted_characters: MAX_EXTRACTED_CHARACTERS }, 'Imported text preview truncated after bounded extraction');
	return extractedResult(text, truncated);
}

function extractedResult(value, truncated = false) {
	const suffix = truncated ? '\n\n[Imported content truncated after bounded extraction.]' : '';
	const raw = `${String(value || '').trim()}${suffix}`;
	let text = striptags(raw, [], ' ');
	text = collapseWhitespace(text);
	const html = raw.split(/\n{2,}/).map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`).join('');
	return { text, html, truncated };
}

function collapseWhitespace(str) {
    return str.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
