import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const search = fs.readFileSync(new URL('../public/js/search_results.js', import.meta.url), 'utf8');

class CountsHarness {
	constructor() {
		this.cells = Array.from({ length: 4 }, () => ({ textContent: '9' }));
		this.errors = [];
		this.requests = [];
		this.context = vm.createContext({
			clearTimeout: () => {}, setTimeout: (callback) => { this.timer = callback; },
			api: () => new Promise((resolve, reject) => this.requests.push({ resolve, reject })),
			document: { querySelectorAll: () => [{ dataset: { id: 'source' }, querySelectorAll: () => this.cells }], getElementById: () => null },
			showError: (message) => this.errors.push(message), console: { error: () => {} },
		});
		vm.runInContext(app.slice(app.indexOf('let countDebounce ='), app.indexOf('let trashDebounce =')), this.context);
	}
	refresh() { vm.runInContext('refreshCounts()', this.context); }
	start() { this.refresh(); return this.timer(); }
}

describe('incremental sidebar counts', () => {
	it('ignores an older response even while a newer refresh is still debouncing', async () => {
		const ui = new CountsHarness();
		const first = ui.start();
		ui.refresh();
		ui.requests[0].resolve({ source: { notes: 1, memory: 2, urls: 3, emails: 4 } });
		await first;
		assert.deepEqual(ui.cells.map((cell) => cell.textContent), ['9', '9', '9', '9']);
		const second = ui.timer();
		ui.requests[1].resolve({ source: { notes: 5, memory: 6, urls: 7, emails: 8 } });
		await second;
		assert.deepEqual(ui.cells.map((cell) => cell.textContent), [5, 6, 7, 8]);
	});
	it('retains valid counts on errors, suppresses repeated errors, and recovers', async () => {
		const ui = new CountsHarness();
		for (let index = 0; index < 2; index++) {
			const pending = ui.start();
			ui.requests[index].reject(new Error('Unavailable'));
			await pending;
		}
		assert.equal(ui.errors.length, 1);
		assert.deepEqual(ui.cells.map((cell) => cell.textContent), ['9', '9', '9', '9']);
		const recovered = ui.start();
		ui.requests[2].resolve({});
		await recovered;
		assert.deepEqual(ui.cells.map((cell) => cell.textContent), [0, 0, 0, 0]);
		const failedAgain = ui.start();
		ui.requests[3].reject(new Error('Unavailable again'));
		await failedAgain;
		assert.equal(ui.errors.length, 2);
	});
	it('does not apply an out-of-order success or report an obsolete failure', async () => {
		const ui = new CountsHarness();
		const older = ui.start();
		const newer = ui.start();
		ui.requests[1].resolve({ source: { notes: 2, memory: 3, urls: 4, emails: 5 } });
		await newer;
		ui.requests[0].resolve({});
		await older;
		assert.deepEqual(ui.cells.map((cell) => cell.textContent), [2, 3, 4, 5]);
		const stale = ui.start();
		ui.refresh();
		ui.requests[2].reject(new Error('Old request failed'));
		await stale;
		assert.equal(ui.errors.length, 0);
	});
	it('refreshes each successful search batch, including partial success, without a socket or reload', async () => {
		const events = [];
		const outcomes = [];
		let requests = 0;
		const context = vm.createContext({
			busy: false, generation: 1, filters: { types: ['notes'] }, root: { querySelector: () => ({ textContent: '' }) }, queuedEvents: new Map(),
			setButtonLoading: () => {}, updateSelection: () => {}, refreshItem: () => {}, showSuccess: () => {}, showError: () => {},
			api: async () => ({ outcomes: ++requests === 1 ? [{ success: true, id: 'one', type: 'notes' }, { success: false, id: 'two', type: 'notes', error: 'stale' }] : [{ success: true, id: 'three', type: 'notes' }] }),
			applyItem: (outcome) => outcomes.push(outcome),
			CustomEvent: class { constructor(type) { this.type = type; } },
			window: { dispatchEvent: (event) => events.push(event.type) },
			location: { reload() { throw new Error('Unexpected reload'); } },
			navigateTo() { throw new Error('Unexpected navigation'); },
			load() { throw new Error('Unexpected results reload'); },
			chosen: Array.from({ length: 26 }, () => ({})),
		});
		vm.runInContext(search.slice(search.indexOf('const runAction ='), search.indexOf('const actionDialog =')), context);
		await vm.runInContext("runAction('move', { project_id: 'destination' }, {}, chosen)", context);
		assert.deepEqual(events, ['counts:refresh', 'counts:refresh']);
		assert.equal(outcomes.length, 3);
		events.length = 0;
		context.api = async () => ({ outcomes: [{ success: false, id: 'four', type: 'notes', error: 'stale' }] });
		await vm.runInContext("runAction('move', { project_id: 'destination' }, {}, chosen)", context);
		assert.deepEqual(events, []);
		assert.match(app, /\['item-modal-saved', 'item-modal-deleted', 'counts:refresh'\]/);
	});
});
