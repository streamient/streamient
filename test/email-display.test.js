import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildEmailExcerpt, cleanEmailExcerptText, visibleTextFromEmailHtml } from '../modules/email_display.js';

describe('Email display helpers', () => {
	it('removes parser control lines from text excerpts', () => {
		const excerpt = cleanEmailExcerptText([
			'--- Please reply above this line ---',
			'Digital asset management simplified - https://razuna.com',
			'-HMSTOPPARSER-',
		].join('\n'));

		assert.equal(excerpt, 'Digital asset management simplified - https://razuna.com');
	});

	it('extracts visible text from HTML without hidden content', () => {
		const text = visibleTextFromEmailHtml([
			'<div style="display:none">Hidden tracking message</div>',
			'<p>Visible <strong>HTML</strong> body</p>',
			'<span aria-hidden="true">Hidden label</span>',
		].join(''));

		assert.equal(text, 'Visible HTML body');
	});

	it('prefers visible HTML text for email excerpts', () => {
		const excerpt = buildEmailExcerpt({
			text_content: '--- Please reply above this line ---\nPlain fallback',
			html_content: '<p>Rendered HTML body</p><div hidden>Hidden content</div>',
		});

		assert.equal(excerpt, 'Rendered HTML body');
	});
});
