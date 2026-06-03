import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('ECC Email AI prompt buttons', () => {
	it('keeps global chat examples scoped away from ECC prompt chips', () => {
		const chatJs = fs.readFileSync(new URL('../public/js/chat.js', import.meta.url), 'utf8');
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');

		assert.ok(chatJs.includes("chatWelcome?.querySelectorAll('.chat-example-btn')"));
		assert.ok(!chatJs.includes("document.querySelectorAll('.chat-example-btn')"));
		assert.ok(eccJs.includes('event.stopPropagation()'));
	});

	it('renders mailbox summaries with structured sections instead of escaped markdown blobs', () => {
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');

		assert.ok(eccJs.includes('renderMailboxSummary(message.summary'));
		assert.ok(eccJs.includes('ecc-mailbox-summary-group'));
		assert.ok(eccJs.includes('summary.groups'));
		assert.ok(eccJs.includes('summary.next_steps'));
	});

	it('keeps ECC detail action buttons scoped to the selected message', () => {
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');

		assert.ok(eccJs.includes('if (options?.showActions)'));
		assert.ok(eccJs.includes('var isSelected = Boolean(options?.isSelected);'));
		assert.ok(eccJs.includes('var isSelectedMessage = (selectedId && messageId && selectedId === messageId) || message === selected;'));
		assert.ok(eccJs.includes('showActions: isSelectedMessage'));
		assert.ok(!eccJs.includes('showMove: isSelected'));
	});
});
