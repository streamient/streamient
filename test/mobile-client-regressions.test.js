import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

function read(relativePath) {
	return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

async function compile(src, globals = {}) {
	const code = (await transform(src.replace(/^import .*\n/gm, ''), { loader: 'ts', format: 'cjs', target: 'es2022' })).code;
	const context = vm.createContext({ module: { exports: {} }, console, URL, URLSearchParams, Headers, Response, Blob, TextDecoder, TextEncoder, DOMException, Error, TypeError, atob, btoa, crypto, navigator: { onLine: true }, ...globals });
	vm.runInContext(code, context);
	return { exports: context.module.exports, context };
}

const app = read('apps/mobile/src/App.tsx');
const noop = () => {};
const record = (id, project = 'P', time = '2026-10-23T00:00:00Z') => ({ key: 'notes:' + id, id, project_id: project, type: 'notes', title: id, updated_at: time });

function block(start, end) { return app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start))); }

const serverA = { baseUrl: 'https://a.example', resourceUrl: 'https://a.example/api/v1' };
const serverB = { baseUrl: 'https://b.example', resourceUrl: 'https://b.example/api/v1' };

function storage() {
	const saved = new Map();
	return { saved, getStoredJson: async (key) => saved.get(key) ?? null, setStoredJson: async (key, value) => { saved.set(key, value); }, removeStoredValue: async (key) => { saved.delete(key); } };
}

describe('Streamient Mobile client regressions', () => {
	it('finding 6: transient refresh 503 preserves live auth; definitive invalid_grant clears it', async () => {
		const store = storage();
		const auth503 = await compile(read('apps/mobile/src/lib/auth.ts'), { App: { addListener: async () => ({ remove() {} }) }, Browser: { open: async () => {}, close: async () => {} }, Capacitor: { isNativePlatform: () => true }, MOBILE_CLIENT_ID: 'streamient-mobile', MOBILE_SCOPES: '', oauthRedirectUri: () => 'com.streamient.mobile://oauth/callback', fetch: async () => new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 }), ...store });
		const { exports: { StreamientApi } } = await compile(read('apps/mobile/src/lib/api.ts'), { refreshTokens: auth503.exports.refreshTokens, getCachedJson: async () => null, setCachedJson: async () => {}, fetch: async () => new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 }) });
		const tokenA = { access_token: 'A_ACCESS', refresh_token: 'A_REFRESH', expires_in: 1, obtained_at: Date.now(), token_type: 'Bearer', scope: '' };
		let cleared = 0;
		await new StreamientApi(serverA, tokenA, (next) => { if (next === null) cleared++; }).bootstrap().catch(noop);
		assert.equal(cleared, 0);

		const auth401 = await compile(read('apps/mobile/src/lib/auth.ts'), { App: { addListener: async () => ({ remove() {} }) }, Browser: { open: async () => {}, close: async () => {} }, Capacitor: { isNativePlatform: () => true }, MOBILE_CLIENT_ID: 'streamient-mobile', MOBILE_SCOPES: '', oauthRedirectUri: () => 'com.streamient.mobile://oauth/callback', fetch: async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'revoked' }), { status: 401 }), ...store });
		const { exports: { StreamientApi: Api401 } } = await compile(read('apps/mobile/src/lib/api.ts'), { refreshTokens: auth401.exports.refreshTokens, getCachedJson: async () => null, setCachedJson: async () => {}, fetch: async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 401 }) });
		await new Api401(serverA, tokenA, (next) => { if (next === null) cleared++; }).bootstrap().catch(noop);
		assert.equal(cleared, 1);
	});

	it('finding 6: beginning a server-B login keeps A selected and never posts A refresh token to B', async () => {
		const requests = [];
		const store = storage();
		const auth = await compile(read('apps/mobile/src/lib/auth.ts'), { App: { addListener: async () => ({ remove() {} }) }, Browser: { open: async () => {}, close: async () => {} }, Capacitor: { isNativePlatform: () => true }, MOBILE_CLIENT_ID: 'streamient-mobile', MOBILE_SCOPES: '', oauthRedirectUri: () => 'com.streamient.mobile://oauth/callback', fetch: async (url, init) => { requests.push({ url, init }); return new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 }); }, ...store });
		const tokenA = { access_token: 'A_ACCESS', refresh_token: 'A_REFRESH', expires_in: 1, obtained_at: Date.now(), token_type: 'Bearer', scope: '' };
		await auth.exports.saveTokens(tokenA);
		await auth.exports.saveSelectedServer(serverA);
		await auth.exports.beginOAuth(serverB);
		assert.equal((await auth.exports.loadSelectedServer()).baseUrl, serverA.baseUrl);
		assert.equal((await auth.exports.loadPendingServer()).baseUrl, serverB.baseUrl);
		const restoredServer = await auth.exports.loadSelectedServer();
		const restoredTokens = await auth.exports.loadTokens();
		const { exports: { StreamientApi } } = await compile(read('apps/mobile/src/lib/api.ts'), { refreshTokens: auth.exports.refreshTokens, getCachedJson: async () => null, setCachedJson: async () => {}, fetch: async (url, init) => { requests.push({ url, init }); return new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 }); } });
		await new StreamientApi(restoredServer, restoredTokens, noop).bootstrap().catch(noop);
		assert.equal(requests.some((req) => req.url === serverB.baseUrl + '/oauth/token'), false);
	});

	it('finding 6: successful exchange binds the persisted credential store to the new server', async () => {
		const store = storage();
		const auth = await compile(read('apps/mobile/src/lib/auth.ts'), { App: { addListener: async () => ({ remove() {} }) }, Browser: { open: async () => {}, close: async () => {} }, Capacitor: { isNativePlatform: () => true }, MOBILE_CLIENT_ID: 'streamient-mobile', MOBILE_SCOPES: '', oauthRedirectUri: () => 'com.streamient.mobile://oauth/callback', fetch: async () => new Response(JSON.stringify({ access_token: 'B_ACCESS', refresh_token: 'B_REFRESH', expires_in: 3600, scope: '', token_type: 'Bearer' }), { status: 200 }), ...store });
		await auth.exports.beginOAuth(serverB);
		const state = store.saved.get('oauth_state');
		const tokens = await auth.exports.exchangeCode(serverB, 'code', state);
		assert.equal(tokens.access_token, 'B_ACCESS');
		assert.equal((await auth.exports.loadSelectedServer()).baseUrl, serverB.baseUrl);
		assert.equal(await auth.exports.loadPendingServer(), null);
	});

	it('finding 7: sign-out resets chat, search, detail, conversation, and upload state', async () => {
		const state = { tokens: 'A', bootstrap: 'A', records: ['A'], nextCursor: 'cursor', activeProjectId: 'p1', filter: 'urls', view: 'ai', error: 'x', detail: { id: 'n' }, detailLoading: true, chatMessages: ['A private answer'], chatQuery: 'private', conversationId: 'conv-A', conversations: ['A'], historyDrawer: true, searchQuery: 'private', searchResults: ['A private result'], searching: true, uploads: ['A private.pdf'], uploadTray: true, noteDraft: { title: 'A' }, urlDraft: { url: 'https://a' }, fileDraft: { name: 'A.pdf' } };
		const globals = { Swal: { fire: async () => ({ isConfirmed: true }) }, clearAuth: async () => {}, bootstrapRef: { current: 'A' }, uploadNamespaceRef: { current: 'ns:A' }, sessionEpoch: { current: 0 }, feedSeq: { current: 0 }, detailSeq: { current: 0 }, uploadControllers: { current: new Map([['u', { abort() {} }]]) } };
		for (const name of Object.keys(state)) globals['set' + name[0].toUpperCase() + name.slice(1)] = (next) => { state[name] = next; };
		const { exports: f } = await compile(block('async function signOut()', '\n\tfunction chooseProject') + '\nexport { signOut };', globals);
		await f.signOut();
		assert.equal(state.tokens, null);
		assert.equal(state.records.length, 0);
		assert.equal(state.nextCursor, null);
		assert.equal(state.activeProjectId, '');
		assert.equal(state.filter, 'all');
		assert.equal(state.view, 'projects');
		assert.equal(state.detail, null);
		assert.equal(state.detailLoading, false);
		assert.equal(state.chatMessages.length, 0);
		assert.equal(state.chatQuery, '');
		assert.equal(state.conversationId, '');
		assert.equal(state.conversations.length, 0);
		assert.equal(state.historyDrawer, false);
		assert.equal(state.searchQuery, '');
		assert.equal(state.searchResults.length, 0);
		assert.equal(state.searching, false);
		assert.equal(state.uploads.length, 0);
		assert.equal(state.uploadTray, false);
		assert.equal(globals.uploadNamespaceRef.current, '');
		assert.equal(globals.sessionEpoch.current, 1);
	});

	it('finding 7: upload storage is namespaced by identity and legacy entries are never reused across accounts', async () => {
		const store = new Map();
		const localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) };
		const uploads = await compile(read('apps/mobile/src/lib/uploads.ts'), { localStorage, indexedDB: { open: () => ({ set onupgradeneeded(fn) {}, set onsuccess(fn) {}, set onerror(fn) {} }) } });
		const namespaceA = 'https://a.example:userA:tenantA';
		const namespaceB = 'https://b.example:userB:tenantB';
		const sessionA = { id: 'remote', project_id: 'P_A', state: 'uploading', upload_length: 10, upload_offset: 0, chunk_size: 10 };
		await uploads.exports.rememberUpload(namespaceA, 'localA', sessionA, { uri: 'file://a', name: 'A.pdf', mimeType: 'application/pdf' }, 'A.pdf', 'application/pdf');
		assert.equal((await uploads.exports.restoreUploads(namespaceB, [])).length, 0);
		assert.equal((await uploads.exports.restoreUploads(namespaceA, [])).length, 1);

		// Legacy (un-namespaced) uploads migrate only into the identity that owns their project.
		const namespaceC = 'https://c.example:userC:tenantC';
		const namespaceD = 'https://d.example:userD:tenantD';
		const legacy = [{ local_id: 'legacyA', session: { ...sessionA, project_id: 'P_A' }, source_kind: 'uri', uri: 'file://a', name: 'A.pdf', mime_type: 'application/pdf' }];
		store.set('streamient_upload_registry', JSON.stringify(legacy));
		assert.equal((await uploads.exports.restoreUploads(namespaceD, ['P_B'])).length, 0);
		assert.equal(store.has('streamient_upload_registry'), true);
		const migrated = await uploads.exports.restoreUploads(namespaceC, ['P_A']);
		assert.equal(migrated.length, 1);
		assert.equal(store.has('streamient_upload_registry'), false);
	});

	it('finding 13: transient network TypeError pauses instead of failing, and retry resumes via authoritative status', async () => {
		const state = { uploads: [{ localId: 'local', session: { id: 'remote', state: 'uploading', upload_length: 40_000_000, upload_offset: 20_000_000, chunk_size: 20_000_000 }, source: new Blob(['fake']), name: 'private.pdf', mimeType: 'application/pdf', paused: false, manualPause: false }] };
		let statusCalls = 0; let resumeCalls = 0; let completeCalls = 0;
		const runBlock = block('async function runUpload(', '\n\tuseEffect(() => {\n\t\tif (!api || !online)') + '\nexport { runUpload };';
		const base = {
			online: true, sessionEpoch: { current: 0 }, uploadControllers: { current: new Map() }, uploadNamespaceRef: { current: 'ns' },
			AbortController, TypeError, waitForProcessing: noop, updateUpload: noop, forgetUpload: noop, refreshCounts: noop,
			setUploads: (fn) => { state.uploads = fn(state.uploads); },
			api: { uploadStatus: async (id) => { statusCalls++; return { id, state: 'uploading', upload_length: 40_000_000, upload_offset: 20_000_000 }; }, completeUpload: async () => { completeCalls++; throw new Error('Upload incomplete'); } },
			uploadWithResume: async () => { resumeCalls++; throw new TypeError('fetch failed'); },
		};
		const { exports: f } = await compile(runBlock, base);
		await f.runUpload(state.uploads[0]);
		assert.equal(state.uploads[0].session.state, 'uploading');
		assert.equal(state.uploads[0].paused, true);
		assert.equal(state.uploads[0].manualPause, true);

		const { exports: f2 } = await compile(runBlock, { ...base, uploadWithResume: async () => { resumeCalls++; return { id: 'remote', state: 'complete', upload_length: 40_000_000, upload_offset: 40_000_000 }; } });
		await f2.runUpload(state.uploads[0]);
		assert.equal(completeCalls, 0);
		assert.ok(resumeCalls >= 2);
	});

	it('finding 13: a failed session asks for authoritative status and resumes rather than retrying complete forever', async () => {
		const state = { uploads: [{ localId: 'local', session: { id: 'remote', state: 'failed', error: 'Upload incomplete at offset 20000000', upload_length: 40_000_000, upload_offset: 20_000_000, chunk_size: 20_000_000 }, source: new Blob(['fake']), name: 'private.pdf', mimeType: 'application/pdf', paused: false, manualPause: false }] };
		let statusCalls = 0; let completeCalls = 0;
		const { exports: f } = await compile(block('async function runUpload(', '\n\tuseEffect(() => {\n\t\tif (!api || !online)') + '\nexport { runUpload };', {
			online: true, sessionEpoch: { current: 0 }, uploadControllers: { current: new Map() }, uploadNamespaceRef: { current: 'ns' },
			AbortController, TypeError, waitForProcessing: noop, updateUpload: noop, forgetUpload: noop, refreshCounts: noop,
			setUploads: (fn) => { state.uploads = fn(state.uploads); },
			api: { uploadStatus: async (id) => { statusCalls++; return { id, state: 'uploading', upload_length: 40_000_000, upload_offset: 20_000_000 }; }, completeUpload: async () => { completeCalls++; throw new Error('Upload incomplete at offset 20000000'); } },
			uploadWithResume: async () => ({ id: 'remote', state: 'processing', upload_length: 40_000_000, upload_offset: 40_000_000 }),
		});
		await f.runUpload(state.uploads[0]);
		assert.equal(statusCalls, 1);
		assert.equal(completeCalls, 0);
	});

	it('finding 14: reconnect applies every changes page and advances the cursor to the final page', async () => {
		const state = { records: [] };
		const changeCursor = { current: 'start' };
		const calls = [];
		const pages = [
			{ changes: Array.from({ length: 100 }, (_, id) => ({ action: 'upsert', record: record(String(id)) })), next_cursor: 'page-1', has_more: true },
			{ changes: [{ action: 'upsert', record: record('last') }], next_cursor: 'page-2', has_more: false },
		];
		const { exports: f } = await compile(block('function upsertRecord(', '\nfunction relativeTime') + block('const applyChanges = useCallback', '\n\trealtimeEventHandler.current =') + '\nexport { applyChanges };', {
			api: { changes: async (cursor) => { calls.push(cursor); return pages.shift(); } }, changeCursor, sessionEpoch: { current: 0 }, activeProjectId: 'P', filter: 'all', useCallback: (fn) => fn,
			setRecords: (fn) => { state.records = fn(state.records); },
		});
		await f.applyChanges();
		assert.equal(calls.length, 2);
		assert.equal(state.records.length, 101);
		assert.equal(state.records.some((r) => r.id === 'last'), true);
		assert.equal(changeCursor.current, 'page-2');
	});

	it('finding 15: an obsolete feed response cannot overwrite the current project', async () => {
		const state = { records: [] };
		const feedSeq = { current: 0 };
		const setRecords = (fn) => { state.records = fn(state.records); };
		let resolveA;
		const make = async (project) => (await compile(block('const loadFeed = useCallback', '\n\tuseEffect(() => { if (view === "projects")') + '\nexport { loadFeed };', {
			api: { records: () => project === 'A' ? new Promise((resolve) => { resolveA = resolve; }) : Promise.resolve({ value: { records: [record('B-note', 'B')], next_cursor: null }, offline: false }) },
			activeProjectId: project, filter: 'all', useCallback: (fn) => fn, setRecords,
			setLoadingMore: noop, setFeedLoading: noop, setNextCursor: noop, setOffline: noop, Swal: { fire: noop }, feedSeq,
		})).exports.loadFeed;
		const loadA = await make('A');
		const loadB = await make('B');
		const pendingA = loadA();
		await loadB();
		assert.equal(state.records[0].project_id, 'B');
		resolveA({ value: { records: [record('A-note', 'A')], next_cursor: null }, offline: false });
		await pendingA;
		assert.equal(state.records[0].project_id, 'B');
	});

	it('finding 24: closing detail clears loading and ignores the late record response', async () => {
		const state = { detail: null, detailLoading: false };
		let resolveRecord;
		const { exports: f } = await compile(block('async function openRecord(', '\n\tfunction editDetail()') + '\nexport { openRecord, closeDetail };', {
			api: { record: () => new Promise((resolve) => { resolveRecord = resolve; }) }, detailSeq: { current: 0 },
			setDetail: (next) => { state.detail = next; }, setDetailLoading: (next) => { state.detailLoading = next; },
			Swal: { fire: noop },
		});
		const pending = f.openRecord(record('n'));
		assert.equal(state.detailLoading, true);
		f.closeDetail();
		assert.equal(state.detail, null);
		assert.equal(state.detailLoading, false);
		resolveRecord({ record: record('n', 'P', '2026-10-23T00:00:01Z') });
		await pending;
		assert.equal(state.detail, null);
		assert.equal(state.detailLoading, false);
	});

	it('finding 8: a stale modal read cannot overwrite the current modal or its save target', async () => {
		const script = read('public/js/chat.js');
		const elements = new Map();
		const writes = [];
		function element(id) {
			if (!elements.has(id)) elements.set(id, { value: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener(event, callback) { this[event] = callback; } });
			return elements.get(id);
		}
		let resolveA; let resolveB;
		const context = vm.createContext({ document: { getElementById: element }, rmCurrentType: null, rmCurrentId: null, rmIsObsidianSynced: false, rmModalSeq: 0,
			rmIsDemoReadOnly: () => false, rmShowModal: noop, typeBadgeClass: () => '', showSuccess: noop, showError: (message) => { throw new Error(message); },
			rmCleanup: () => { context.rmCurrentId = null; context.rmCurrentType = null; context.rmModalSeq += 1; },
			rmPopulate: (type, rec) => { element('rm-note-title').value = rec.title; element('rm-note-tags').value = ''; context.currentContent = rec.content; },
			rmGetEditorContent: () => ({ content: context.currentContent, text_content: context.currentContent }), rmSyncLinks: async () => {},
			api: async (method, path, body) => { if (method === 'GET') return new Promise((resolve) => { if (path.endsWith('/A')) resolveA = resolve; else resolveB = resolve; }); writes.push({ method, path, body }); return {}; },
			window: { currentProjectId: 'P', dispatchEvent: noop }, CustomEvent: class {}, BsModal: { getInstance: () => ({ hide() {} }) }, modalEl: element('chat-result-modal'),
		});
		vm.runInContext(script.slice(script.indexOf('async function openItemModal('), script.indexOf('\n/**\n * Open modal from a chat')) + '\nglobalThis.openItemModal = openItemModal;', context);
		const saveStart = script.indexOf("document.getElementById('rm-save-btn')?.addEventListener('click', async () => {");
		vm.runInContext(script.slice(saveStart, script.indexOf('\n\t// Delete', saveStart)), context);
		const openingA = context.openItemModal('notes', 'A');
		context.rmCleanup();
		const openingB = context.openItemModal('notes', 'B');
		resolveB({ note: { _id: 'B', title: 'B', content: 'B original body' } });
		await openingB;
		resolveA({ note: { _id: 'A', title: 'A', content: 'A private body' } });
		await openingA;
		await element('rm-save-btn').click();
		assert.equal(writes.length, 1);
		assert.equal(writes[0].path, '/notes/B');
		assert.equal(writes[0].body.content, 'B original body');
		assert.equal(writes[0].body.title, 'B');
	});
});