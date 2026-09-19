import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = readFileSync(fileURLToPath(new URL('../public/js/chat.js', import.meta.url)), 'utf8');
const renderSource = source.slice(source.indexOf('function rmRenderPreview'), source.indexOf('\nfunction rmCanonicalMarkdownBody'));

function renderPreview(textContent, htmlContent, preferHtml) {
	const sanitized = [];
	const context = vm.createContext({
		escapeHtml: (value) => value,
		rmSanitizePreviewHtml(html) {
			sanitized.push(html);
			return html.replace(/<script[\s\S]*?<\/script>/gi, '');
		},
		window: { marked: { parse: (value) => `<markdown>${value}</markdown>` } },
	});
	vm.runInContext(renderSource, context);
	const result = vm.runInContext(`rmRenderPreview(${JSON.stringify(textContent)}, ${JSON.stringify(htmlContent)}, ${JSON.stringify(preferHtml)})`, context);
	return { result, sanitized };
}

describe('note preview rendering', () => {
	it('prefers sanitized canonical HTML over a short text summary', () => {
		const { result, sanitized } = renderPreview('Short summary', '<h2>Full note</h2><script>bad()</script>', true);
		assert.equal(result, '<h2>Full note</h2>');
		assert.deepEqual(sanitized, ['<h2>Full note</h2><script>bad()</script>']);
	});

	it('falls back to Markdown-rendered text when canonical HTML is empty', () => {
		const { result } = renderPreview('## Full note', '', true);
		assert.equal(result, '<markdown>## Full note</markdown>');
	});

	it('keeps Memory and Obsidian preview paths unchanged', () => {
		const { result } = renderPreview('**Memory**', '<p>Memory</p>');
		assert.equal(result, '<markdown>**Memory**</markdown>');
		assert.match(source, /else preview\.innerHTML = rmRenderPreview\(rmTextContent, rmContent, true\);/);
		assert.match(source, /else preview\.innerHTML = rmRenderPreview\(rmTextContent, rmContent\);/);
		assert.match(source, /if \(rmIsObsidianSynced\) void rmRenderObsidianPreview\(preview\);/);
	});
});
