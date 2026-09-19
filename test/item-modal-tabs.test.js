import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

function read(relativePath) {
	return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

function classList(initial = []) {
	const values = new Set(initial);
	return {
		toggle(value, force) { if (force) values.add(value); else values.delete(value); },
		contains(value) { return values.has(value); },
	};
}

const layout = read('views/layout.pug');
const chat = read('public/js/chat.js');

describe('Note and Memory modal sections', () => {
	it('renders the requested Info field order and Related & Tags content', () => {
		const note = layout.slice(layout.indexOf('#result-modal-note'), layout.indexOf('//- Memory form'));
		const memory = layout.slice(layout.indexOf('#result-modal-memory'), layout.indexOf('//- URL form'));

		assert.ok(note.indexOf('#rm-note-title') < note.indexOf('#rm-note-tab-preview'));
		assert.ok(note.indexOf('#rm-note-tab-preview') < note.indexOf('#rm-note-tags'));
		assert.doesNotMatch(note, /#rm-memory-source|\.form-text Source/);
		assert.ok(memory.indexOf('#rm-memory-title') < memory.indexOf('#rm-memory-tab-preview'));
		assert.ok(memory.indexOf('#rm-memory-tab-preview') < memory.indexOf('#rm-memory-tags'));
		assert.ok(memory.indexOf('#rm-memory-tags') < memory.indexOf('#rm-memory-source'));
		assert.match(memory, /Optional attribution, such as a meeting, document, conversation, or AI session\./);
		for (const panel of [note, memory]) {
			assert.match(panel, /Related & Tags/);
			assert.match(panel, /\.form-text Related to…/);
			assert.match(panel, /\.rm-link-search/);
			assert.match(panel, /\.rm-link-tags/);
		}
		assert.match(chat, /Connected via shared tags/);
	});

	it('switches sections without recreating content or navigating', () => {
		const start = chat.indexOf('function rmShowRecordSection');
		const end = chat.indexOf('\nfunction rmCanonicalMarkdownBody', start);
		const source = chat.slice(start, end);
		const elements = {};
		for (const prefix of ['note', 'memory']) {
			for (const section of ['info', 'related']) {
				elements[`rm-${prefix}-section-tab-${section}`] = { classList: classList(), attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
				elements[`rm-${prefix}-section-${section}`] = { classList: classList(section === 'related' ? ['d-none'] : []) };
			}
		}
		const context = vm.createContext({ document: { getElementById(id) { return elements[id] || null; } } });
		vm.runInContext(source, context);
		vm.runInContext("rmShowRecordSection('notes', 'related')", context);
		assert.equal(elements['rm-note-section-tab-info'].classList.contains('active'), false);
		assert.equal(elements['rm-note-section-tab-related'].classList.contains('active'), true);
		assert.equal(elements['rm-note-section-info'].classList.contains('d-none'), true);
		assert.equal(elements['rm-note-section-related'].classList.contains('d-none'), false);
		assert.equal(elements['rm-note-section-tab-related'].attributes['aria-selected'], 'true');
		assert.doesNotMatch(source, /rmInitEditor|innerHTML|replaceChildren|navigateTo|location|reload/);
	});

	it('defaults Notes and Memories to Info while preserving create/edit behavior', () => {
		assert.match(chat, /if \(type === 'notes'\)[\s\S]*?rmShowRecordSection\(type, 'info'\)/);
		assert.match(chat, /else if \(type === 'memory'\)[\s\S]*?rmShowRecordSection\(type, 'info'\)/);
		assert.match(chat, /if \(type === 'notes'\) rmShowNoteEdit\(\)/);
		assert.match(chat, /else if \(type === 'memory'\) rmShowMemoryEdit\(\)/);
		assert.match(chat, /rmShowNotePreview\(\)/);
		assert.match(chat, /rmShowMemoryPreview\(\)/);
		for (const id of ['rm-note-section-tab-info', 'rm-note-section-tab-related', 'rm-memory-section-tab-info', 'rm-memory-section-tab-related']) {
			assert.match(chat, new RegExp(`getElementById\\('${id}'\\).*addEventListener`));
		}
	});
});
