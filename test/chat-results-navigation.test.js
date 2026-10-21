import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

function read(relativePath) {
	return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

function classList(initial) {
	const values = new Set(initial);
	return {
		add(value) { values.add(value); },
		remove(value) { values.delete(value); },
		contains(value) { return values.has(value); },
	};
}

describe('chat result navigation', () => {
	it('dismisses results and restores the current page through one shared path', () => {
		const panel = { classList: classList([]) };
		const page = { classList: classList(['d-none']) };
		const context = vm.createContext({
			console,
			document: { getElementById(id) { return id === 'chat-results-panel' ? panel : id === 'page-content' ? page : null; } },
			window: {},
		});
		vm.runInContext(read('public/js/chat.js'), context);
		vm.runInContext("currentChatResults = [{ id: 'result-1' }]; dismissChatResults();", context);
		assert.equal(vm.runInContext('currentChatResults.length', context), 0);
		assert.equal(panel.classList.contains('d-none'), true);
		assert.equal(page.classList.contains('d-none'), false);
		assert.equal(typeof context.window.dismissChatResults, 'function');
	});

	it('dismisses chat results before loading a selected sidebar section', async () => {
		const source = read('public/js/app.js');
		const navigateSource = source.slice(source.indexOf('async function navigateTo('), source.indexOf('\nwindow.navigateTo = navigateTo;'));
		const events = [];
		const page = { style: {}, innerHTML: '', querySelectorAll() { return []; } };
		const context = vm.createContext({
			ROUTES: { '/memories': { title: 'Memories', partial: '/ajax/section/memories' } },
			JSURL: { stringify() { return ''; } },
			__isNavigating: false,
			currentProjectId: null,
			document: { getElementById() { return page; }, title: '' },
			executeScripts() { events.push('scripts'); },
			fetch: async () => { events.push('fetch'); return { ok: true, redirected: false, text: async () => '<section>Memories</section>' }; },
			history: { pushState() { events.push('history'); } },
			isLoginRedirect() { return false; },
			isStreamientDemoMode() { return false; },
			isSettingsPath() { return false; },
			demoFetchOptions() {},
			handleDemoExpiredResponse() { return false; },
			makeAvatar: { refresh() {} },
			mountCurrent() { events.push('mount'); },
			openSettingsModal() {},
			redirectToLogin() {},
			syncLayoutForPath() {},
			unmountCurrent() { events.push('unmount'); },
			window: { dismissChatResults() { events.push('dismiss'); }, location: {} },
		});
		vm.runInContext(navigateSource, context);
		await vm.runInContext("navigateTo('/memories')", context);
		assert.deepEqual(events, ['dismiss', 'unmount', 'fetch', 'scripts', 'mount', 'history']);
		assert.equal(page.innerHTML, '<section>Memories</section>');
		assert.equal(context.window.location.href, undefined);
	});
});
