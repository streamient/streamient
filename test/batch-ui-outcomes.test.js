import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { attachItemHtml } from '../modules/item_html.js';

it('applies only authoritative successful outcomes, keeps failed selection including unloaded rows, and reports exact counts', () => {
	const checkboxes = [{ value: 'one', checked: true }, { value: 'two', checked: true }];
	const events = [];
	const successes = [];
	const errors = [];
	const context = vm.createContext({
		window: { dispatchEvent: event => events.push(event) },
		document: { querySelectorAll: selector => selector.includes(':checked') ? checkboxes.filter(cb => cb.checked) : checkboxes },
		CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
		showSuccess: message => successes.push(message), showError: message => errors.push(message),
	});
	const source = readFileSync(new URL('../public/js/batch.js', import.meta.url), 'utf8').replace('window.__sections.batch = { mount: mount, unmount: unmount };', 'window.testBatch = { applyBatchResult, getSelected };');
	vm.runInContext(source, context);
	const api = context.window.testBatch;
	const item = { _id: 'one', in_trash: true, updatedAt: '2026-10-17T00:00:00Z' };
	assert.equal(api.applyBatchResult({ deleted: 1, success_ids: ['one'], failed: [{ id: 'two', error: 'Conflict' }, { id: 'unloaded', error: 'Offline' }], outcomes: [{ event: 'note:deleted', item }] }, 'delete'), false);
	assert.equal(checkboxes[0].checked, false);
	assert.equal(checkboxes[1].checked, true);
	assert.deepEqual(Array.from(api.getSelected()).sort(), ['two', 'unloaded']);
	assert.equal(events[0].type, 'note:deleted');
	assert.equal(events[0].detail, item);
	assert.deepEqual(successes, ['1 moved to trash']);
	assert.match(errors[0], /2 item\(s\) failed/);
	assert.equal(api.applyBatchResult({ copied: 0, success_ids: [], outcomes: [], failed: [{ id: 'two', error: 'Conflict' }] }, 'copy'), false);
	assert.equal(successes.length, 1);
});

it('renders escaped server fragments for each record type without executable user HTML', () => {
	for (const type of ['note', 'memory', 'email']) {
		const item = attachItemHtml(type, { _id: 'one', title: '<script>unsafe()</script>', subject: '<img src=x onerror=alert(1)>', text_content: 'Plain text', content: 'Memory', from: ['<b>sender</b>'], tags: ['<script>tag</script>'] });
		assert.match(item.html, new RegExp(type + '-item'));
		assert.match(item.html, /data-id="one"/);
		assert.doesNotMatch(item.html, /<script>|<img src=x|<b>sender/);
	}
});

it('reports complete failure counts and truncated retry details honestly', () => {
	const errors = [];
	const context = vm.createContext({ window: { dispatchEvent() {} }, document: { querySelectorAll: () => [] }, CustomEvent: class {}, showSuccess() {}, showError: (message) => errors.push(message) });
	const source = readFileSync(new URL('../public/js/batch.js', import.meta.url), 'utf8').replace('window.__sections.batch = { mount: mount, unmount: unmount };', 'window.testBatch = { applyBatchResult };');
	vm.runInContext(source, context);
	assert.equal(context.window.testBatch.applyBatchResult({ moved: 50, success_ids: [], outcomes: [], failed: [], failed_count: 1400, failures_truncated: true, warning_count: 2 }, 'move'), false);
	assert.match(errors[0], /1400 item\(s\) failed.*narrow the selection/);
	assert.match(errors[1], /2 saved item\(s\) have Obsidian sync pending/);
});
