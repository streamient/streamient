import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function functionBlock(source, name) {
	const start = source.indexOf('async function ' + name);
	assert.notEqual(start, -1);
	const next = source.indexOf('\n\tasync function ', start + 1);
	return source.slice(start, next === -1 ? source.length : next);
}

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

	it('shows selected email mailbox status only while viewing a label list', () => {
		const eccPug = fs.readFileSync(new URL('../views/ajax/section/ecc.pug', import.meta.url), 'utf8');
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');

		assert.ok(eccPug.includes('span.badge.text-bg-secondary.me-3.d-none#ecc-detail-mailbox-status'));
		assert.ok(eccJs.includes('var status = activeLabel ? mailboxStatusName(email) : \'\';'));
		assert.ok(eccJs.includes('detailMailboxStatus.classList.toggle(\'d-none\', !status);'));
	});

	it('uses realtime thread identifiers to reconcile visible thread rows', () => {
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');

		assert.ok(eccJs.includes('(email?.thread_identifiers || []).forEach(add);'));
		assert.ok(eccJs.includes('threadIdsOverlap(incomingThreadIds, listItemThreadIds(item))'));
		assert.ok(eccJs.includes('selectedIds.delete(item.dataset.id || \'\');'));
	});

	it('does not full-reload ECC email lists after bulk move, trash, or reset', () => {
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');
		const moveSelected = functionBlock(eccJs, 'moveSelected');
		const trashSelected = functionBlock(eccJs, 'trashSelected');
		const resetSelectedTriage = functionBlock(eccJs, 'resetSelectedTriage');

		assert.ok(moveSelected.includes('applyEmailSocketUpdate(result?.email || result);'));
		assert.ok(moveSelected.includes('await loadLabels();'));
		assert.ok(!moveSelected.includes('loadAll()'));

		assert.ok(trashSelected.includes('ids.forEach(removeEmailFromList);'));
		assert.ok(trashSelected.includes('await loadLabels();'));
		assert.ok(!trashSelected.includes('loadAll()'));

		assert.ok(resetSelectedTriage.includes('applyEmailSocketUpdate(result?.email || result);'));
		assert.ok(resetSelectedTriage.includes('await loadLabels();'));
		assert.ok(!resetSelectedTriage.includes('loadAll()'));
		assert.ok(!resetSelectedTriage.includes('activeMailbox = \'inbox\';'));
		assert.ok(!resetSelectedTriage.includes('activeLabel = \'\';'));
	});
});
