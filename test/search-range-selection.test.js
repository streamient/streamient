import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../public/js/search_results.js', import.meta.url), 'utf8');
const marker = "on(root.querySelector('#search-list'), 'click', (event) => {";
const start = script.indexOf(marker);
const registration = script.slice(start, script.indexOf(marker, start + marker.length));

class SelectionHarness {
	constructor() {
		this.keys = ['notes:1', 'memory:1', 'urls:1', 'notes:2', 'memory:2'];
		this.state = { selected: new Map(), rows: new Map(this.keys.map((key) => [key, { key }])), selectionAnchor: null, selectionRequest: 0, selectingAll: false, busy: false, root: { querySelector: () => ({}), querySelectorAll: () => this.keys.map((key) => ({ dataset: { searchKey: key } })) }, on: (target, event, handler) => { this.handler = handler; }, updateSelection: () => {} };
		vm.createContext(this.state);
		vm.runInContext(registration, this.state);
	}
	click(index, checked, shiftKey = false) {
		this.handler({ shiftKey, target: { matches: () => true, checked, closest: () => ({ dataset: { searchKey: this.keys[index] } }) } });
	}
	get selected() { return [...this.state.selected.keys()]; }
}

describe('search Shift-click range selection', () => {
	it('selects an inclusive forward range across mixed record types', () => {
		const ui = new SelectionHarness();
		ui.click(0, true);
		ui.click(3, true, true);
		assert.deepEqual(ui.selected, ui.keys.slice(0, 4));
	});
	it('selects backwards and deselects ranges using the clicked checkbox state', () => {
		const ui = new SelectionHarness();
		ui.click(4, true);
		ui.click(1, true, true);
		assert.deepEqual([...ui.selected].sort(), ui.keys.slice(1).sort());
		ui.click(3, false, true);
		assert.deepEqual(ui.selected, [ui.keys[4]]);
	});
	it('treats Shift-click as a single selection when the anchor is absent', () => {
		const ui = new SelectionHarness();
		ui.click(0, true);
		ui.state.selectionAnchor = 'missing:record';
		ui.click(4, true, true);
		assert.deepEqual(ui.selected, [ui.keys[0], ui.keys[4]]);
	});
	it('invalidates pending all-selection requests and blocks changes during mutation', () => {
		const ui = new SelectionHarness();
		ui.state.selectingAll = true;
		ui.click(0, true);
		assert.equal(ui.state.selectingAll, false);
		assert.equal(ui.state.selectionRequest, 1);
		ui.state.busy = true;
		ui.click(4, true, true);
		assert.deepEqual(ui.selected, [ui.keys[0]]);
	});
});
