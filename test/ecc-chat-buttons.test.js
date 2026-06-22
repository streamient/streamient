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

	it('keeps selected ECC detail message state scoped to the selected message', () => {
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

	it('renders ECC list move actions as inline buttons', () => {
		const eccPug = fs.readFileSync(new URL('../views/ajax/section/ecc.pug', import.meta.url), 'utf8');
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');

		assert.ok(eccPug.includes('#ecc-move-actions'));
		assert.ok(!eccPug.includes('#ecc-move-btn'));
		assert.ok(!eccPug.includes('#ecc-move-menu'));
		assert.ok(!eccPug.includes("icon('checkSquare'"));
		assert.ok(!eccPug.includes("icon('restore'"));
		assert.ok(eccJs.includes('function renderMoveActions()'));
		assert.ok(eccJs.includes('btn btn-outline-secondary btn-sm ecc-move-target'));
		assert.ok(!eccJs.includes("{ slug: 'sent', name: 'Sent'"));
		assert.ok(!eccJs.includes('kkIcon(mailbox.icon'));
		assert.ok(!eccJs.includes('class="dropdown-item ecc-move-target"'));
	});

	it('renders ECC triage labels in Actions and Status groups', () => {
		const eccPug = fs.readFileSync(new URL('../views/ajax/section/ecc.pug', import.meta.url), 'utf8');
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');
		const appCss = fs.readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');

		assert.ok(eccPug.includes('#ecc-labels'));
		assert.ok(eccPug.includes('data-label-section="actions"'));
		assert.ok(eccPug.includes('data-label-section="status"'));
		assert.ok(eccPug.includes('data-label="reply-required"'));
		assert.ok(!eccPug.includes('h6.mb-2 Labels'));
		assert.ok(eccJs.includes("var ECC_ACTION_LABELS = ['reply-required', 'human-do', 'waiting', 'marketing'];"));
		assert.ok(eccJs.includes("var ECC_STATUS_LABELS = ['spam', 'no-action'];"));
		assert.ok(eccJs.includes('function renderLabelCounts(labels)'));
		assert.ok(!eccJs.includes('/email-labels'));
		assert.ok(appCss.includes('#ecc-labels .ecc-label-section:first-child'));
		assert.ok(appCss.includes('#ecc-labels .ecc-label-section + .ecc-label-section'));
		assert.ok(appCss.includes('margin-top: 1.5rem;'));
	});

	it('uses top-nav triage status and socket counts instead of the old triage modal and label fetch', () => {
		const layoutPug = fs.readFileSync(new URL('../views/layout.pug', import.meta.url), 'utf8');
		const eccPug = fs.readFileSync(new URL('../views/ajax/section/ecc.pug', import.meta.url), 'utf8');
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');
		const appJs = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');

		assert.ok(layoutPug.includes('#ecc-triage-nav-status'));
		assert.ok(!eccPug.includes('#ecc-triage-modal'));
		assert.ok(eccJs.includes('function renderTriageNavStatus()'));
		assert.ok(eccJs.includes('Triage: '));
		assert.ok(eccJs.includes("triageNavStatus.classList.add('d-none')"));
		assert.ok(eccJs.includes('!triageProgress?.running'));
		assert.ok(!eccJs.includes('Triage failed'));
		assert.ok(eccJs.includes('email-counts:request'));
		assert.ok(eccJs.includes('email-counts:updated'));
		assert.ok(appJs.includes("socket.on('email-counts:updated'"));
		assert.ok(appJs.includes("socket.emit('email-counts:request'"));
		assert.ok(!eccJs.includes('getOrCreateInstance(triageModalEl'));
	});

	it('does not render selected-message legacy move controls in ECC detail', () => {
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');

		assert.ok(!eccJs.includes('buildBodyMoveDropdown'));
		assert.ok(!eccJs.includes('buildBodyTrashButton'));
		assert.ok(!eccJs.includes('ecc-body-move-target'));
		assert.ok(!eccJs.includes('dropdown-menu dropdown-menu-end'));
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
		assert.ok(!moveSelected.includes('await loadLabels();'));
		assert.ok(!moveSelected.includes('loadAll()'));

		assert.ok(trashSelected.includes('ids.forEach(removeEmailFromList);'));
		assert.ok(!trashSelected.includes('await loadLabels();'));
		assert.ok(!trashSelected.includes('loadAll()'));

		assert.ok(resetSelectedTriage.includes('applyEmailSocketUpdate(result?.email || result);'));
		assert.ok(!resetSelectedTriage.includes('await loadLabels();'));
		assert.ok(!resetSelectedTriage.includes('loadAll()'));
		assert.ok(!resetSelectedTriage.includes('activeMailbox = \'inbox\';'));
		assert.ok(!resetSelectedTriage.includes('activeLabel = \'\';'));
	});

	it('does not confirm reversible move-to-trash actions', () => {
		const chatJs = fs.readFileSync(new URL('../public/js/chat.js', import.meta.url), 'utf8');
		const batchJs = fs.readFileSync(new URL('../public/js/batch.js', import.meta.url), 'utf8');
		const eccJs = fs.readFileSync(new URL('../public/js/ecc.js', import.meta.url), 'utf8');
		const trashSelected = functionBlock(eccJs, 'trashSelected');

		assert.ok(!chatJs.includes('confirmAction(\'Move to Trash\''));
		assert.ok(!batchJs.includes('confirmAction(\'Move to Trash\''));
		assert.ok(!trashSelected.includes('confirmAction(\'Move to Trash\''));
		assert.ok(chatJs.includes('showSuccess(\'Moved to trash\');'));
		assert.ok(batchJs.includes('showSuccess(count + \' moved to trash\');'));
		assert.ok(trashSelected.includes('showSuccess(ids.length + \' moved to trash\');'));
	});
});
