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

	it('finding 7: resetSessionState clears credentials, identity state, and pending work', async () => {
		const state = { tokens: 'A', bootstrap: 'A', records: ['A'], nextCursor: 'cursor', activeProjectId: 'p1', filter: 'urls', view: 'ai', error: 'x', detail: { id: 'n' }, detailLoading: true, chatMessages: ['A private answer'], chatQuery: 'private', conversationId: 'conv-A', conversations: ['A'], historyDrawer: true, searchQuery: 'private', searchResults: ['A private result'], searching: true, uploads: ['A private.pdf'], uploadTray: true, saving: true, feedLoading: true, loadingMore: true, noteDraft: { title: 'A' }, urlDraft: { url: 'https://a' }, fileDraft: { name: 'A.pdf' } };
		let cleared = false;
		const globals = { clearAuth: async () => { cleared = true; }, bootstrapRef: { current: 'A' }, uploadNamespaceRef: { current: 'ns:A' }, sessionEpoch: { current: 0 }, feedSeq: { current: 0 }, detailSeq: { current: 0 }, uploadControllers: { current: new Map([['u', { abort() {} }]]) }, useCallback: (fn) => fn };
		for (const name of Object.keys(state)) globals['set' + name[0].toUpperCase() + name.slice(1)] = (next) => { state[name] = next; };
		const { exports: f } = await compile(block('const resetSessionState = useCallback', 'const handleTokens = useCallback') + '\nexport { resetSessionState };', globals);
		await f.resetSessionState();
		assert.equal(cleared, true);
		assert.equal(state.tokens, null);
		assert.equal(state.bootstrap, null);
		assert.equal(globals.bootstrapRef.current, null);
		assert.equal(state.records.length, 0);
		assert.equal(state.nextCursor, null);
		assert.equal(state.activeProjectId, '');
		assert.equal(state.filter, 'all');
		assert.equal(state.view, 'projects');
		assert.equal(state.error, '');
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
		assert.equal(state.saving, false);
		assert.equal(state.feedLoading, false);
		assert.equal(state.loadingMore, false);
		assert.equal(globals.uploadNamespaceRef.current, '');
		assert.equal(globals.sessionEpoch.current, 1);
	});

	it('finding 7: upload storage is namespaced by identity', async () => {
		const store = new Map();
		const localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) };
		const uploads = await compile(read('apps/mobile/src/lib/uploads.ts'), { localStorage, indexedDB: { open: () => ({ set onupgradeneeded(fn) {}, set onsuccess(fn) {}, set onerror(fn) {} }) } });
		const namespaceA = 'https://a.example:userA:tenantA';
		const namespaceB = 'https://b.example:userB:tenantB';
		const sessionA = { id: 'remote', project_id: 'P_A', state: 'uploading', upload_length: 10, upload_offset: 0, chunk_size: 10 };
		await uploads.exports.rememberUpload(namespaceA, 'localA', sessionA, { uri: 'file://a', name: 'A.pdf', mimeType: 'application/pdf' }, 'A.pdf', 'application/pdf');
		assert.equal((await uploads.exports.restoreUploads(namespaceB)).length, 0);
		assert.equal((await uploads.exports.restoreUploads(namespaceA)).length, 1);
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

	it('MF1: a stale API token callback is fenced by the session epoch it was created under', async () => {
		const calls = [];
		let capturedOnTokens = null;
		const sessionEpoch = { current: 5 };
		await compile(block('const api = useMemo', 'const activeProject ='), {
			useMemo: (fn) => fn(),
			StreamientApi: class { constructor(server, tokens, onTokens) { capturedOnTokens = onTokens; } },
			server: serverA, tokens: { access_token: 'A' }, handleTokens: (next) => calls.push(next), sessionEpoch,
		});
		assert.ok(capturedOnTokens);
		capturedOnTokens({ access_token: 'A2' });
		assert.equal(calls.length, 1);
		sessionEpoch.current = 6;
		capturedOnTokens({ access_token: 'A2' });
		assert.equal(calls.length, 1);
	});

	it('MF2: definitive invalidation (handleTokens(null)) resets the session and clears persisted tokens', async () => {
		const saved = new Map([['tokens', { access_token: 'A1' }]]);
		const state = { tokens: 'A', bootstrap: 'A', records: ['A'] };
		const noopSetters = {};
		for (const name of ['nextCursor', 'activeProjectId', 'filter', 'view', 'error', 'detail', 'detailLoading', 'chatMessages', 'chatQuery', 'conversationId', 'conversations', 'historyDrawer', 'searchQuery', 'searchResults', 'searching', 'uploads', 'uploadTray', 'saving', 'feedLoading', 'loadingMore', 'noteDraft', 'urlDraft', 'fileDraft']) noopSetters['set' + name[0].toUpperCase() + name.slice(1)] = noop;
		const globals = {
			useCallback: (fn) => fn,
			setTokens: (next) => { state.tokens = next; }, setBootstrap: (next) => { state.bootstrap = next; }, setRecords: (next) => { state.records = next; },
			saveTokens: async (tokens) => { saved.set('tokens', tokens); }, clearAuth: async () => { saved.delete('tokens'); },
			sessionEpoch: { current: 0 }, feedSeq: { current: 0 }, detailSeq: { current: 0 }, uploadControllers: { current: new Map() }, bootstrapRef: { current: 'A' }, uploadNamespaceRef: { current: 'ns:A' },
			...noopSetters,
		};
		const src = block('const resetSessionState = useCallback', 'const handleTokens = useCallback') + '\n' + block('const handleTokens = useCallback', 'const api = useMemo') + '\nexport { handleTokens };';
		const { exports: f } = await compile(src, globals);
		f.handleTokens(null);
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(saved.has('tokens'), false);
		assert.equal(state.tokens, null);
		assert.equal(state.bootstrap, null);
		assert.equal(state.records.length, 0);
		assert.equal(globals.sessionEpoch.current, 1);
	});

	it('MF3: refreshCounts cannot merge a previous session project counts into the current bootstrap', async () => {
		const state = { bootstrap: null };
		const sessionEpoch = { current: 0 };
		const { exports: f } = await compile(block('const refreshCounts = useCallback', 'const applyChanges = useCallback') + '\nexport { refreshCounts };', {
			useCallback: (fn) => fn, sessionEpoch,
			setBootstrap: (fn) => { state.bootstrap = fn(state.bootstrap); },
			api: { projectCounts: () => new Promise((resolve) => setTimeout(() => resolve({ projects: [{ id: 'A_PROJECT', name: 'A private project' }] }), 20)) },
		});
		const pending = f.refreshCounts();
		sessionEpoch.current++;
		state.bootstrap = { user: { _id: 'B' }, projects: [{ id: 'B_PROJECT', name: 'B project' }] };
		await pending;
		assert.deepEqual(state.bootstrap.projects.map((p) => p.id), ['B_PROJECT']);
	});

	it('MF3 (queued): refreshCounts drops a stale queued bootstrap updater after the epoch changes', async () => {
		const state = { bootstrap: { projects: [{ id: 'B', name: 'B project' }] } };
		const sessionEpoch = { current: 0 };
		let queuedUpdater = null;
		const { exports: f } = await compile(block('const refreshCounts = useCallback', 'const applyChanges = useCallback') + '\nexport { refreshCounts };', {
			useCallback: (fn) => fn, sessionEpoch,
			setBootstrap: (updater) => { queuedUpdater = updater; },
			api: { projectCounts: () => Promise.resolve({ projects: [{ id: 'A', name: 'A' }] }) },
		});
		await f.refreshCounts();
		assert.ok(queuedUpdater);
		sessionEpoch.current++;
		const next = queuedUpdater(state.bootstrap);
		assert.deepEqual(next.projects.map((p) => p.id), ['B']);
	});

	it('MF3: a note saved under A cannot merge into B after an identity change', async () => {
		const state = { records: [], saving: false };
		const sideEffects = { clearDraft: 0, closeAdd: 0, detail: 0, refreshCounts: 0, swal: 0 };
		const sessionEpoch = { current: 0 };
		let resolveCreate;
		const { exports: f } = await compile(block('async function saveNote()', 'async function saveUrl()') + '\nexport { saveNote };', {
			api: { createNote: () => new Promise((resolve) => { resolveCreate = resolve; }) },
			noteDraft: { title: 'A note', content: '<p>x</p>', text: 'x', tags: '', projectId: 'P' },
			online: true, sessionEpoch, activeProjectId: 'P', filter: 'all',
			setSaving: (v) => { state.saving = v; }, setRecords: (fn) => { state.records = fn(state.records); },
			clearDraft: () => { sideEffects.clearDraft++; }, clearPendingShare: async () => {}, closeAdd: () => { sideEffects.closeAdd++; }, setDetail: () => { sideEffects.detail++; }, refreshCounts: async () => { sideEffects.refreshCounts++; },
			Swal: { fire: () => { sideEffects.swal++; } }, upsertRecord: noop, server: serverA, bootstrap: null, draftKey: () => 'k',
		});
		const pending = f.saveNote();
		await new Promise((resolve) => setImmediate(resolve));
		sessionEpoch.current++;
		resolveCreate({ record: { key: 'notes:A1', id: 'A1', project_id: 'P', type: 'notes', title: 'A note', excerpt: '', created_at: '', updated_at: '', metadata: {} } });
		await pending;
		assert.equal(sideEffects.clearDraft, 0);
		assert.equal(sideEffects.closeAdd, 0);
		assert.equal(sideEffects.detail, 0);
		assert.equal(sideEffects.refreshCounts, 0);
		assert.equal(sideEffects.swal, 0);
		assert.equal(state.records.length, 0);
	});

	it('MF3: a file upload started under A never persists into another namespace after identity change', async () => {
		const state = { uploads: [], uploadTray: false, saving: false };
		const sessionEpoch = { current: 0 };
		const uploadNamespaceRef = { current: 'ns:A' };
		const remembered = [];
		let resolveCreate;
		const { exports: f } = await compile(block('async function startFileUpload()', 'async function openRecord(') + '\nexport { startFileUpload };', {
			api: { createUpload: () => new Promise((resolve) => { resolveCreate = resolve; }) },
			fileDraft: { source: new Blob(['x']), name: 'A.pdf', mimeType: 'application/pdf', projectId: 'P' },
			online: true, sessionEpoch, uploadNamespaceRef,
			sourceSize: async () => 1, rememberUpload: async (ns) => { remembered.push(ns); }, crypto: { randomUUID: () => 'local-1' },
			setUploads: (fn) => { state.uploads = fn(state.uploads); }, setUploadTray: (v) => { state.uploadTray = v; }, setSaving: (v) => { state.saving = v; },
			closeAdd: () => {}, clearPendingShare: async () => {}, runUpload: () => {}, Swal: { fire: noop },
		});
		const pending = f.startFileUpload();
		await new Promise((resolve) => setImmediate(resolve));
		sessionEpoch.current++;
		uploadNamespaceRef.current = 'ns:B';
		resolveCreate({ upload: { id: 'sessA', project_id: 'P' } });
		await pending;
		assert.deepEqual(remembered, []);
		assert.equal(state.uploads.length, 0);
	});

	it('MF4: bootstrap re-checks identity after each await before setting uploads', async () => {
		const state = { uploads: [] };
		const sessionEpoch = { current: 0 };
		let resolveRestore;
		const start = app.indexOf('api.bootstrap().then(async (result) => {');
		const end = app.indexOf('}).catch(');
		const body = app.slice(start + 'api.bootstrap().then(async (result) => {'.length, end);
		const { exports: f } = await compile('async function chain(result) {' + body + '\n}\nexport { chain };', {
			canceled: false, epoch: 0, sessionEpoch, server: serverA,
			applyBootstrap: noop, setOffline: noop, setError: noop, setFeedLoading: noop,
			setUploads: (fn) => { state.uploads = fn(state.uploads); },
			uploadNamespace: (s, u, t) => 'ns:' + u, uploadNamespaceRef: { current: '' },
			loadPendingShare: async () => null, localStorage: { getItem: () => null }, activeProjectKey: () => 'k', openSharedContent: async () => {},
			restoreUploads: () => new Promise((resolve) => { resolveRestore = () => resolve([{ saved: { local_id: 'a1', session: { project_id: 'P' }, name: 'A private.pdf', mime_type: 'application/pdf' }, source: null }]); }),
			api: { uploadStatus: async () => ({}) },
		});
		const result = { value: { user: { _id: 'A' }, account: { host_id: 'H' }, projects: [{ id: 'P' }] }, offline: false };
		const pending = f.chain(result);
		await new Promise((resolve) => setImmediate(resolve));
		sessionEpoch.current++;
		resolveRestore();
		await pending;
		assert.deepEqual(state.uploads, []);
	});

	it('MF5: legacy uploads never migrate across users of the same host without server validation', async () => {
		const store = new Map();
		const localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) };
		const uploads = await compile(read('apps/mobile/src/lib/uploads.ts'), { localStorage, indexedDB: { open: () => ({ set onupgradeneeded(fn) {}, set onsuccess(fn) {}, set onerror(fn) {} }) } });
		store.set('streamient_upload_registry', JSON.stringify([{ local_id: 'legacyA', session: { id: 'sessA', project_id: 'P', state: 'uploading', upload_length: 10, upload_offset: 0, chunk_size: 10 }, source_kind: 'uri', uri: 'file://a', name: 'A private.pdf', mime_type: 'application/pdf' }]));
		const nsB = 'https://app.example:userB:samehost';
		assert.equal((await uploads.exports.restoreUploads(nsB)).length, 0);
		assert.equal(store.has('streamient_upload_registry'), true);
		assert.equal((await uploads.exports.restoreUploads(nsB, async () => false)).length, 0);
		assert.equal(store.has('streamient_upload_registry'), true);
		assert.equal((await uploads.exports.restoreUploads(nsB, async () => true)).length, 1);
		assert.equal(store.has('streamient_upload_registry'), false);
	});

	it('refresh 429 is transient and preserves the session', async () => {
		const store = storage();
		const auth429 = await compile(read('apps/mobile/src/lib/auth.ts'), { App: { addListener: async () => ({ remove() {} }) }, Browser: { open: async () => {}, close: async () => {} }, Capacitor: { isNativePlatform: () => true }, MOBILE_CLIENT_ID: 'm', MOBILE_SCOPES: '', oauthRedirectUri: () => 'x://cb', fetch: async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }), ...store });
		const { exports: { StreamientApi } } = await compile(read('apps/mobile/src/lib/api.ts'), { refreshTokens: auth429.exports.refreshTokens, getCachedJson: async () => null, setCachedJson: async () => {}, fetch: async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }) });
		const tokenA = { access_token: 'A_ACCESS', refresh_token: 'A_REFRESH', expires_in: 1, obtained_at: Date.now(), token_type: 'Bearer', scope: '' };
		let cleared = 0;
		await new StreamientApi(serverA, tokenA, (next) => { if (next === null) cleared++; }).bootstrap().catch(noop);
		assert.equal(cleared, 0);
	});

	it('email modal open is fenced by generation so a late email cannot overwrite a newer note', async () => {
		const script = read('public/js/chat.js');
		const elements = new Map();
		function element(id) {
			if (!elements.has(id)) elements.set(id, { value: '', textContent: '', className: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener(event, callback) { this[event] = callback; }, disabled: false, style: {}, remove() {}, removeAttribute() {} });
			return elements.get(id);
		}
		let resolveEmail; let resolveNote;
		const context = vm.createContext({
			document: { getElementById: element },
			rmCurrentType: null, rmCurrentId: null, rmModalSeq: 0,
			rmCleanup: () => { context.rmCurrentId = null; context.rmCurrentType = null; context.rmModalSeq += 1; },
			rmResetEmailView: () => {}, rmShowModal: noop, typeBadgeClass: () => '', escapeHtml: (s) => String(s),
			renderEmailDetails: (email, thread) => { context.renderedEmail = email.subject; },
			rmPopulate: () => {}, rmShowNoteEdit: () => {}, rmShowMemoryEdit: () => {}, rmIsDemoReadOnly: () => false,
			api: async (method, path) => { if (path === '/emails/A') return new Promise((resolve) => { resolveEmail = resolve; }); if (path === '/notes/B') return new Promise((resolve) => { resolveNote = resolve; }); return {}; },
			BsModal: { getOrCreateInstance: () => ({ show() {} }) },
		});
		vm.runInContext(script.slice(script.indexOf('async function openEmailModal('), script.indexOf('function rmSetUrlParsedText(')) + '\nglobalThis.openEmailModal = openEmailModal;', context);
		vm.runInContext(script.slice(script.indexOf('async function openItemModal('), script.indexOf('\n/**\n * Open modal from a chat')) + '\nglobalThis.openItemModal = openItemModal;', context);
		const emailOpening = context.openEmailModal({ _type: 'emails', id: 'A' });
		const noteOpening = context.openItemModal('notes', 'B');
		resolveNote({ note: { _id: 'B', title: 'B', content: 'B body' } });
		await noteOpening;
		assert.equal(element('result-modal-title').textContent, 'B');
		resolveEmail({ email: { _id: 'A', subject: 'A private email' }, thread: [] });
		await emailOpening;
		assert.equal(element('result-modal-title').textContent, 'B');
		assert.equal(context.rmCurrentId, 'B');
	});

	it('MF-A: a realtime record fetch under A cannot upsert into B feed', async () => {
		const sessionEpoch = { current: 0 };
		const base = {
			sessionEpoch, activeProjectId: 'P', filter: 'all',
			refreshCounts: noop, applyChanges: noop, setUploads: noop,
			upsertRecord: (items, rec) => [rec, ...items.filter((item) => item.key !== rec.key)],
		};
		const start = app.indexOf('realtimeEventHandler.current = (event, payload) => {');
		const end = app.indexOf('\n\tconst realtimeHostId =', start);
		const src = app.slice(start, end) + '\nexport { realtimeEventHandler };';

		let resolveRecord;
		let setRecordsCalls = 0;
		const state = { records: [record('B-note', 'P')] };
		const realtime1 = { current: null };
		await compile(src, { ...base, realtimeEventHandler: realtime1,
			api: { record: () => new Promise((resolve) => { resolveRecord = resolve; }) },
			setRecords: (fn) => { setRecordsCalls++; state.records = fn(state.records); },
		});
		realtime1.current('note:updated', { _id: 'A1' });
		await new Promise((resolve) => setImmediate(resolve));
		sessionEpoch.current++;
		resolveRecord({ record: record('A1') });
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(setRecordsCalls, 0);
		assert.deepEqual(state.records.map((item) => item.id), ['B-note']);

		sessionEpoch.current = 0;
		let queuedUpdater = null;
		const realtime2 = { current: null };
		await compile(src, { ...base, realtimeEventHandler: realtime2,
			api: { record: () => Promise.resolve({ record: record('A1') }) },
			setRecords: (updater) => { queuedUpdater = updater; },
		});
		realtime2.current('note:updated', { _id: 'A1' });
		await new Promise((resolve) => setImmediate(resolve));
		assert.ok(queuedUpdater);
		sessionEpoch.current++;
		assert.deepEqual(queuedUpdater([record('B-note', 'P')]).map((item) => item.id), ['B-note']);
	});

	it('MF-B: a settings refresh under A cannot apply its bootstrap to B', async () => {
		const sessionEpoch = { current: 0 };
		let resolveBootstrap;
		let applied = 0;
		let loaded = 0;
		const start = app.indexOf('onRefresh={async () => {');
		const end = app.indexOf('}} onSignOut', start);
		const body = app.slice(start + 'onRefresh={async () => {'.length, end);
		const { exports: f } = await compile('async function onRefresh() {\n' + body + '\n}\nexport { onRefresh };', {
			api: { bootstrap: () => new Promise((resolve) => { resolveBootstrap = resolve; }) },
			sessionEpoch,
			applyBootstrap: () => { applied++; },
			loadFeed: async () => { loaded++; },
		});
		const pending = f.onRefresh();
		await new Promise((resolve) => setImmediate(resolve));
		sessionEpoch.current++;
		resolveBootstrap({ value: { user: { _id: 'A' }, projects: [] }, offline: false });
		await pending;
		assert.equal(applied, 0);
		assert.equal(loaded, 0);
	});

	it('MF-C: a profile save under A cannot merge its user into B after identity change', async () => {
		const sessionEpoch = { current: 0 };
		let queuedUpdater = null;
		const start = app.indexOf('onSave={async (data) => {');
		const end = app.indexOf('}} onRefresh', start);
		const body = app.slice(start + 'onSave={async (data) => {'.length, end);
		const { exports: f } = await compile('async function onSave(data) {\n' + body + '\n}\nexport { onSave };', {
			api: { updateProfile: () => Promise.resolve({ user: { _id: 'A', name: 'A user' } }) },
			sessionEpoch,
			setBootstrap: (updater) => { queuedUpdater = updater; },
		});
		await f.onSave({ name: 'A user' });
		assert.ok(queuedUpdater);
		sessionEpoch.current++;
		const current = { user: { _id: 'B', name: 'B user' }, projects: [] };
		assert.deepEqual(queuedUpdater(current), current);
	});
});