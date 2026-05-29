import fs from 'node:fs';
import mammoth from 'mammoth';
import extractPdf from 'pdfjs-parse';
import lineByLine from 'n-readlines';
import striptags from 'striptags';
import { createLogger } from '../modules/logger.js';

const log = createLogger('import');

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
export async function extractText(filePath, mimeType, originalName) {
    // Reject known binary types early with a clear message
    if (BINARY_PREFIXES.some((p) => mimeType.startsWith(p)) || BINARY_TYPES.has(mimeType)) {
        throw new Error('File is binary and cannot be imported as a note');
    }

    if (PDF_TYPES.includes(mimeType)) {
        return extractPdfContent(filePath);
    }
    if (WORD_TYPES.includes(mimeType)) {
        return extractWordContent(filePath);
    }
    // Everything else: MD, TXT, RTF, HBS, code files, extensionless text, etc.
    return extractTextContent(filePath);
}

/**
 * Extract text from PDF using pdfjs-parse (proven in Razuna).
 */
async function extractPdfContent(filePath) {
    const buf = fs.readFileSync(filePath);
    const origLog = console.log;
    console.log = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('TT:')) return;
        origLog.apply(console, args);
    };
    let data;
    try {
        data = await extractPdf(buf);
    } finally {
        console.log = origLog;
    }
    let text = (data.text || '').trim();
    text = striptags(text, [], ' ');
    text = collapseWhitespace(text);
    return { text, html: `<p>${escapeHtml(text).replace(/\n/g, '</p><p>')}</p>` };
}

/**
 * Extract text from Word/DOCX using mammoth (proven in Razuna).
 */
async function extractWordContent(filePath) {
    const result = await mammoth.convertToHtml({ path: filePath });
    const html = (result.value || '').trim();
    let text = striptags(html, [], ' ');
    text = collapseWhitespace(text);
    return { text, html: html || `<p>${escapeHtml(text)}</p>` };
}

/**
 * Extract text from plain text files using n-readlines (proven in Razuna).
 * Handles MD, TXT, RTF, code, and any other text-based file.
 */
async function extractTextContent(filePath) {
    const liner = new lineByLine(filePath);
    const lines = [];
    let line;
    let errorCount = 0;

    while ((line = liner.next())) {
        try {
            lines.push(line.toString('utf8'));
        } catch (e) {
            errorCount++;
            if (errorCount >= 10) {
                log.warn({ file_path: filePath }, 'Too many read errors, stopping extraction');
                break;
            }
        }
    }

    let text = lines.join('\n');
    let stripped = striptags(text, [], ' ');
    stripped = collapseWhitespace(stripped);
    // For the HTML content, wrap lines in paragraphs while preserving blank-line breaks
    const html = text
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('');
    return { text: stripped, html };
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
