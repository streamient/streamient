import { Browser } from "@capacitor/browser";
import { Network } from "@capacitor/network";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Swal from "sweetalert2";
import { BottomNav } from "./components/BottomNav";
import { Icon } from "./components/Icon";
import { LoginScreen } from "./components/LoginScreen";
import { RichTextEditor } from "./components/RichTextEditor";
import { Sheet } from "./components/Sheet";
import { StreamientApi } from "./lib/api";
import { beginOAuth, clearAuth, exchangeCode, listenForOAuthCallbacks, loadPendingServer, loadSelectedServer, loadTokens, parseOAuthCallback, saveTokens } from "./lib/auth";
import { clearDraft, loadDraft, saveDraft } from "./lib/cache";
import { APP_VERSION, HOSTED_SERVER } from "./lib/config";
import { startRealtime } from "./lib/realtime";
import { clearPendingShare, listenForShares, loadPendingShare, sharedTextKind } from "./lib/shareTarget";
import { forgetUpload, rememberUpload, restoreUploads, sourceSize, updateRememberedUpload, uploadNamespace, uploadWithResume, waitForProcessing, type UploadSource } from "./lib/uploads";
import type { AppView, BootstrapResponse, ChatConversation, ChatMessage, FeedFilter, Project, RecordDetail, RecordSummary, RecordType, SearchResult, ServerOption, SharePayload, TokenSet, UploadSession } from "./types";

type AddMode = "chooser" | "note" | "url" | "file";
type UploadUi = { localId: string; session: UploadSession; source: UploadSource | null; name: string; mimeType: string; paused: boolean; manualPause: boolean };
type NoteDraft = { id?: string; title: string; content: string; text: string; tags: string; projectId: string };

const FILTERS: { value: FeedFilter; label: string; icon: string }[] = [
	{ value: "all", label: "All", icon: "view_stream" },
	{ value: "notes", label: "Notes", icon: "edit_note" },
	{ value: "memories", label: "Memories", icon: "neurology" },
	{ value: "urls", label: "URLs", icon: "link" },
	{ value: "emails", label: "Emails", icon: "mail" },
];

const TYPE_ICONS: Record<RecordType, string> = { notes: "edit_note", memories: "neurology", urls: "link", emails: "mail" };
const TYPE_LABELS: Record<RecordType, string> = { notes: "Note", memories: "Memory", urls: "URL", emails: "Email" };
const FAMILY_APPS = [
	{ name: "Razuna", description: "Digital Asset Management", href: "https://razuna.com/" },
	{ name: "Managani", description: "product growth platform", href: "https://managani.com/" },
	{ name: "Helpmonks", description: "email management platform", href: "https://helpmonks.com/" },
	{ name: "Mailtwine", description: "AI email triage & AI email assistant", href: "https://mailtwine.com/" },
];

function activeProjectKey(server: ServerOption) {
	return `streamient_active_project:${server.baseUrl}`;
}

function draftKey(server: ServerOption, userId: string, noteId = "new") {
	return `${server.baseUrl}:${userId}:note:${noteId}`;
}

function upsertRecord(items: RecordSummary[], record: RecordSummary, activeProjectId: string, filter: FeedFilter) {
	const without = items.filter((item) => item.key !== record.key);
	if (record.project_id !== activeProjectId || (filter !== "all" && record.type !== filter)) return without;
	return [record, ...without].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id));
}

function relativeTime(value: string) {
	const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
	if (seconds < 60) return "now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
	if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
	return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string) {
	return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "S";
}

function countTotal(project: Project) {
	return Object.values(project.counts).reduce((total, value) => total + Number(value || 0), 0);
}

function markdown(value: string) {
	return { __html: DOMPurify.sanitize(marked.parse(value, { async: false }) as string) };
}

function BrandHomeButton({ onClick }: { onClick: () => void }) {
	return <button aria-label="Show all records" className="brand-home" onClick={onClick} title="Show all records" type="button"><img alt="" src="/favicon.svg" /></button>;
}

function openExternal(event: MouseEvent<HTMLAnchorElement>) {
	event.preventDefault();
	void Browser.open({ url: event.currentTarget.href });
}

export function App() {
	const [server, setServer] = useState<ServerOption>(HOSTED_SERVER);
	const [tokens, setTokens] = useState<TokenSet | null>(null);
	const [authReady, setAuthReady] = useState(false);
	const [loginLoading, setLoginLoading] = useState(false);
	const [error, setError] = useState("");
	const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
	const [activeProjectId, setActiveProjectId] = useState("");
	const [view, setView] = useState<AppView>("projects");
	const [filter, setFilter] = useState<FeedFilter>("all");
	const [records, setRecords] = useState<RecordSummary[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [feedLoading, setFeedLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [offline, setOffline] = useState(false);
	const [projectDrawer, setProjectDrawer] = useState(false);
	const [addDrawer, setAddDrawer] = useState(false);
	const [addMode, setAddMode] = useState<AddMode>("chooser");
	const [noteDraft, setNoteDraft] = useState<NoteDraft>({ title: "", content: "", text: "", tags: "", projectId: "" });
	const [urlDraft, setUrlDraft] = useState({ url: "", title: "", projectId: "" });
	const [fileDraft, setFileDraft] = useState<{ source: UploadSource | null; name: string; mimeType: string; projectId: string }>({ source: null, name: "", mimeType: "", projectId: "" });
	const [saving, setSaving] = useState(false);
	const [detail, setDetail] = useState<RecordDetail | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [uploads, setUploads] = useState<UploadUi[]>([]);
	const [uploadTray, setUploadTray] = useState(false);
	const [online, setOnline] = useState(navigator.onLine);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<RecordSummary[]>([]);
	const [searchAllProjects, setSearchAllProjects] = useState(false);
	const [searchType, setSearchType] = useState<FeedFilter>("all");
	const [searching, setSearching] = useState(false);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatQuery, setChatQuery] = useState("");
	const [chatAllProjects, setChatAllProjects] = useState(false);
	const [chatting, setChatting] = useState(false);
	const [conversationId, setConversationId] = useState("");
	const [conversations, setConversations] = useState<ChatConversation[]>([]);
	const [historyDrawer, setHistoryDrawer] = useState(false);
	const [appearance, setAppearance] = useState(localStorage.getItem("streamient_appearance") || "system");
	const uploadControllers = useRef(new Map<string, AbortController>());
	const bootstrapRef = useRef<BootstrapResponse | null>(null);
	const activeProjectIdRef = useRef("");
	const changeCursor = useRef("");
	const feedLoad = useRef<Promise<void>>(Promise.resolve());
	const authHandled = useRef(false);
	const sessionEpoch = useRef(0);
	const feedSeq = useRef(0);
	const detailSeq = useRef(0);
	const uploadNamespaceRef = useRef("");
	const realtimeEventHandler = useRef<(event: string, payload: Record<string, unknown>) => void>(() => undefined);

	const resetSessionState = useCallback(async () => {
		sessionEpoch.current++;
		feedSeq.current++;
		detailSeq.current++;
		for (const controller of uploadControllers.current.values()) controller.abort();
		uploadControllers.current.clear();
		await clearAuth();
		setTokens(null);
		setBootstrap(null);
		bootstrapRef.current = null;
		uploadNamespaceRef.current = "";
		setRecords([]);
		setNextCursor(null);
		setActiveProjectId("");
		setFilter("all");
		setView("projects");
		setError("");
		setDetail(null);
		setDetailLoading(false);
		setChatMessages([]);
		setChatQuery("");
		setConversationId("");
		setConversations([]);
		setHistoryDrawer(false);
		setSearchQuery("");
		setSearchResults([]);
		setSearching(false);
		setUploads([]);
		setUploadTray(false);
		setSaving(false);
		setFeedLoading(false);
		setLoadingMore(false);
		setNoteDraft({ title: "", content: "", text: "", tags: "", projectId: "" });
		setUrlDraft({ url: "", title: "", projectId: "" });
		setFileDraft({ source: null, name: "", mimeType: "", projectId: "" });
	}, []);

	const handleTokens = useCallback((next: TokenSet | null) => {
		if (next) {
			setTokens(next);
			void saveTokens(next);
		} else {
			void resetSessionState();
		}
	}, [resetSessionState]);

	const api = useMemo(() => {
		if (!tokens) return null;
		const epoch = sessionEpoch.current;
		return new StreamientApi(server, tokens, (next) => {
			if (epoch !== sessionEpoch.current) return;
			handleTokens(next);
		});
	}, [server, tokens, handleTokens]);
	const activeProject = bootstrap?.projects.find((project) => project.id === activeProjectId) || bootstrap?.projects[0] || null;
	const visibleFilters = FILTERS.filter((item) => item.value !== "emails" || bootstrap?.features.emails);

	const applyBootstrap = useCallback((data: BootstrapResponse) => {
		const storedProject = localStorage.getItem(activeProjectKey(server));
		const selected = data.projects.find((project) => project.id === storedProject)?.id || data.projects[0]?.id || "";
		setBootstrap(data);
		bootstrapRef.current = data;
		setActiveProjectId((current) => data.projects.some((project) => project.id === current) ? current : selected);
		changeCursor.current = data.change_cursor;
	}, [server]);

	useEffect(() => {
		const resumeLogin = (event: PageTransitionEvent) => { if (event.persisted) setLoginLoading(false); };
		window.addEventListener("pageshow", resumeLogin);
		return () => window.removeEventListener("pageshow", resumeLogin);
	}, []);

	useEffect(() => {
		let removeCallback = () => undefined;
		const finishCallback = async (url: string, selectedServer: ServerOption) => {
			try {
				const parsed = parseOAuthCallback(url);
				const nextTokens = await exchangeCode(selectedServer, parsed.code, parsed.state);
				sessionEpoch.current++;
				setTokens(nextTokens);
				setServer(selectedServer);
				setError("");
				if (!url.startsWith("com.streamient.mobile:")) history.replaceState({}, "", "/");
			} catch (callbackError) {
				setError(callbackError instanceof Error ? callbackError.message : "Sign-in failed");
			} finally {
				setLoginLoading(false);
			}
		};
		void (async () => {
			try {
				const [storedServer, storedTokens, pendingServer] = await Promise.all([loadSelectedServer(), loadTokens(), loadPendingServer()]);
				const selectedServer = storedServer || HOSTED_SERVER;
				setServer(selectedServer);
				if (window.location.pathname === "/oauth/callback" && !authHandled.current) {
					authHandled.current = true;
					setLoginLoading(true);
					await finishCallback(window.location.href, pendingServer || selectedServer);
				} else setTokens(storedTokens);
				removeCallback = listenForOAuthCallbacks((url) => void loadPendingServer().then((callbackServer) => finishCallback(url, callbackServer || selectedServer)));
			} catch (restoreError) {
				console.error("Streamient Mobile authentication restore failed:", restoreError);
				setServer(HOSTED_SERVER);
				setTokens(null);
				setError("Saved sign-in could not be restored. Please sign in again.");
			} finally {
				setAuthReady(true);
			}
		})();
		return () => removeCallback();
	}, []);

	useEffect(() => {
		let removeShare = () => undefined;
		void listenForShares((share) => { if (bootstrapRef.current) void openSharedContent(share, activeProjectIdRef.current || bootstrapRef.current.projects[0]?.id || ""); }).then((remove) => { removeShare = remove; });
		return () => removeShare();
	}, []);

	useEffect(() => {
		activeProjectIdRef.current = activeProjectId;
	}, [activeProjectId]);

	useEffect(() => {
		let networkListener: { remove: () => Promise<void> } | null = null;
		void Network.getStatus().then(({ connected }) => setOnline(connected));
		void Network.addListener("networkStatusChange", ({ connected }) => setOnline(connected)).then((listener) => { networkListener = listener; });
		return () => { void networkListener?.remove(); };
	}, []);

	useEffect(() => {
		if (!online) for (const controller of uploadControllers.current.values()) controller.abort();
	}, [online]);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const apply = () => document.documentElement.dataset.theme = appearance === "system" ? (media.matches ? "dark" : "light") : appearance;
		apply();
		media.addEventListener("change", apply);
		localStorage.setItem("streamient_appearance", appearance);
		return () => media.removeEventListener("change", apply);
	}, [appearance]);

	useEffect(() => {
		if (!api) { setBootstrap(null); bootstrapRef.current = null; return; }
		let canceled = false;
		const epoch = sessionEpoch.current;
		setFeedLoading(true);
		api.bootstrap().then(async (result) => {
			if (canceled || epoch !== sessionEpoch.current) return;
			applyBootstrap(result.value);
			setOffline(result.offline);
			const namespace = uploadNamespace(server, result.value.user._id, result.value.account.host_id);
			uploadNamespaceRef.current = namespace;
			const pending = await loadPendingShare();
			if (canceled || epoch !== sessionEpoch.current) return;
			const storedProject = localStorage.getItem(activeProjectKey(server));
			const pendingProjectId = result.value.projects.find((project) => project.id === storedProject)?.id || result.value.projects[0]?.id || "";
			if (pending) await openSharedContent(pending, pendingProjectId);
			if (canceled || epoch !== sessionEpoch.current) return;
			const restored = await restoreUploads(namespace, (session) => api.uploadStatus(session.id).then(() => true).catch(() => false));
			if (canceled || epoch !== sessionEpoch.current) return;
			setUploads(restored.map(({ saved, source }) => ({ localId: saved.local_id, session: saved.session, source, name: saved.name, mimeType: saved.mime_type, paused: true, manualPause: false })));
		}).catch((loadError) => {
			if (canceled || epoch !== sessionEpoch.current) return;
			setError(loadError instanceof Error ? loadError.message : "Could not load Streamient");
		}).finally(() => { if (!canceled && epoch === sessionEpoch.current) setFeedLoading(false); });
		return () => { canceled = true; };
	}, [api, applyBootstrap]);

	const loadFeed = useCallback(async (cursor = "") => {
		if (!api || !activeProjectId) return;
		const requestId = ++feedSeq.current;
		let feedLoaded = () => {};
		if (!cursor) feedLoad.current = new Promise<void>((resolve) => { feedLoaded = resolve; });
		cursor ? setLoadingMore(true) : setFeedLoading(true);
		try {
			const result = await api.records({ projectId: activeProjectId, type: filter, cursor: cursor || undefined });
			if (requestId !== feedSeq.current) return;
			setRecords((current) => cursor ? [...current, ...result.value.records.filter((record) => !current.some((item) => item.key === record.key))] : result.value.records);
			setNextCursor(result.value.next_cursor);
			setOffline(result.offline);
		} catch (loadError) {
			if (requestId !== feedSeq.current) return;
			void Swal.fire({ icon: "error", title: "Could not load records", text: loadError instanceof Error ? loadError.message : "Try again." });
		} finally {
			if (requestId === feedSeq.current) {
				setFeedLoading(false);
				setLoadingMore(false);
			}
			feedLoaded();
		}
	}, [api, activeProjectId, filter]);

	useEffect(() => { if (view === "projects") void loadFeed(); }, [loadFeed, view]);

	const refreshCounts = useCallback(async () => {
		if (!api) return;
		const epoch = sessionEpoch.current;
		const result = await api.projectCounts();
		if (epoch !== sessionEpoch.current) return;
		setBootstrap((current) => (epoch === sessionEpoch.current && current) ? { ...current, projects: result.projects } : current);
	}, [api]);

	const applyChanges = useCallback(async () => {
		if (!api || !activeProjectId || !changeCursor.current) return;
		const epoch = sessionEpoch.current;
		// Apply changes only after the first-page snapshot lands, or that older snapshot would overwrite them.
		for (let pending: Promise<void> | null = null; pending !== feedLoad.current;) { pending = feedLoad.current; await pending; }
		if (epoch !== sessionEpoch.current) return;
		let result = await api.changes(changeCursor.current, activeProjectId);
		while (true) {
			if (epoch !== sessionEpoch.current) return;
			const changes = result.changes;
			setRecords((current) => changes.reduce((items, change) => change.action === "delete" ? items.filter((item) => item.key !== change.key) : upsertRecord(items, change.record, activeProjectId, filter), current));
			changeCursor.current = result.next_cursor;
			if (!result.has_more) break;
			result = await api.changes(changeCursor.current, activeProjectId);
		}
	}, [api, activeProjectId, filter]);

	realtimeEventHandler.current = (event, payload) => {
		if (!api) return;
		if (event === "counts:refresh") { void refreshCounts(); return; }
		if (event === "connection:reconnected") { void applyChanges(); return; }
		if (event.startsWith("note-import:")) {
			const id = String(payload.id || "");
			setUploads((current) => current.map((item) => item.session.id === id ? { ...item, session: payload as unknown as UploadSession } : item));
			return;
		}
		const match = event.match(/^(note|memory|url|email):(created|updated|deleted)$/);
		if (!match) return;
		const type = ({ note: "notes", memory: "memories", url: "urls", email: "emails" } as const)[match[1] as "note" | "memory" | "url" | "email"];
		const id = String(payload._id || payload.id || "");
		if (match[2] === "deleted") setRecords((current) => current.filter((item) => item.key !== `${type}:${id}`));
		else if (id) {
			const epoch = sessionEpoch.current;
			void api.record(type, id).then(({ record }) => {
				if (epoch !== sessionEpoch.current) return;
				setRecords((current) => (epoch === sessionEpoch.current ? upsertRecord(current, record, activeProjectId, filter) : current));
			}).catch(() => undefined);
		}
		void refreshCounts();
	};

	const realtimeHostId = bootstrap?.account.host_id || "";
	const realtimeUserId = bootstrap?.user._id || "";
	useEffect(() => {
		if (!api || !realtimeHostId || !realtimeUserId) return;
		return startRealtime(api, server, { hostId: realtimeHostId, userId: realtimeUserId }, (event, payload) => realtimeEventHandler.current(event, payload));
	}, [api, server, realtimeHostId, realtimeUserId]);

	async function openSharedContent(share: SharePayload, selectedProjectId = "") {
		const projectId = selectedProjectId || activeProjectId || bootstrap?.projects[0]?.id || "";
		const kind = sharedTextKind(share);
		setAddDrawer(true);
		setAddMode(kind);
		if (kind === "file") {
			const file = share.files[0];
			setFileDraft({ source: { uri: file.uri, name: file.name, mimeType: file.mimeType }, name: file.name, mimeType: file.mimeType, projectId });
		} else if (kind === "url") setUrlDraft({ url: share.texts.join("\n").trim(), title: share.title, projectId });
		else setNoteDraft({ title: share.title, content: `<p>${share.texts.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`, text: share.texts.join("\n"), tags: "", projectId });
	}

	function openAdd(mode: AddMode = "chooser") {
		if (!online) { void Swal.fire({ icon: "info", title: "Connect to add records", text: "Offline records remain available to read." }); return; }
		setAddMode(mode);
		setAddDrawer(true);
		if (mode === "note") setNoteDraft(loadDraft<NoteDraft>(draftKey(server, bootstrap?.user._id || "")) || { title: "", content: "", text: "", tags: "", projectId: activeProjectId });
		if (mode === "url") setUrlDraft({ url: "", title: "", projectId: activeProjectId });
		if (mode === "file") setFileDraft({ source: null, name: "", mimeType: "", projectId: activeProjectId });
	}

	function closeAdd() {
		void clearPendingShare();
		setAddDrawer(false);
		setAddMode("chooser");
	}

	async function saveNote() {
		if (!api || !noteDraft.projectId || !online) return;
		const epoch = sessionEpoch.current;
		const apiRef = api;
		setSaving(true);
		try {
			const payload = { title: noteDraft.title || "Untitled", content: noteDraft.content, text_content: noteDraft.text, tags: noteDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean), project_id: noteDraft.projectId };
			const result = noteDraft.id ? await apiRef.updateNote(noteDraft.id, payload) : await apiRef.createNote(payload);
			if (epoch !== sessionEpoch.current) return;
			setRecords((current) => upsertRecord(current, result.record, activeProjectId, filter));
			clearDraft(draftKey(server, bootstrap?.user._id || "", noteDraft.id));
			await clearPendingShare();
			closeAdd();
			setDetail(null);
			await refreshCounts();
		} catch (saveError) {
			if (epoch !== sessionEpoch.current) return;
			void Swal.fire({ icon: "error", title: "Note not saved", text: saveError instanceof Error ? saveError.message : "Try again." });
		} finally { if (epoch === sessionEpoch.current) setSaving(false); }
	}

	async function saveUrl() {
		if (!api || !urlDraft.projectId || !online) return;
		const epoch = sessionEpoch.current;
		const apiRef = api;
		setSaving(true);
		try {
			const result = await apiRef.createUrl({ url: urlDraft.url, title: urlDraft.title, project_id: urlDraft.projectId });
			if (epoch !== sessionEpoch.current) return;
			setRecords((current) => upsertRecord(current, result.record, activeProjectId, filter));
			await clearPendingShare();
			closeAdd();
			await refreshCounts();
			if (result.duplicate) void Swal.fire({ icon: "info", title: "Already saved", text: "That URL is already in this project." });
		} catch (saveError) {
			if (epoch !== sessionEpoch.current) return;
			void Swal.fire({ icon: "error", title: "URL not saved", text: saveError instanceof Error ? saveError.message : "Try again." });
		} finally { if (epoch === sessionEpoch.current) setSaving(false); }
	}

	const updateUpload = useCallback((localId: string, session: UploadSession) => {
		setUploads((current) => current.map((item) => item.localId === localId ? { ...item, session, paused: false } : item));
		void updateRememberedUpload(uploadNamespaceRef.current, localId, session);
	}, []);

	async function runUpload(item: UploadUi) {
		if (!api || !item.source || !online) return;
		const source = item.source;
		const epoch = sessionEpoch.current;
		const controller = new AbortController();
		uploadControllers.current.set(item.localId, controller);
		setUploads((current) => current.map((currentItem) => currentItem.localId === item.localId ? { ...currentItem, paused: false, manualPause: false } : currentItem));
		try {
			let session = item.session;
			if (session.state === "failed") session = await api.uploadStatus(session.id);
			if (session.state === "uploading") session = await uploadWithResume(api, session, source, (next) => updateUpload(item.localId, next), controller.signal);
			if (session.state === "processing") session = await waitForProcessing(api, session, (next) => updateUpload(item.localId, next), controller.signal);
			if (epoch !== sessionEpoch.current) return;
			updateUpload(item.localId, session);
			if (session.state === "complete") { await forgetUpload(uploadNamespaceRef.current, item.localId); await refreshCounts(); }
		} catch (uploadError) {
			if ((uploadError as Error).name === "AbortError") setUploads((current) => current.map((currentItem) => currentItem.localId === item.localId ? { ...currentItem, paused: true } : currentItem));
			else if (uploadError instanceof TypeError) setUploads((current) => current.map((currentItem) => currentItem.localId === item.localId ? { ...currentItem, paused: true, manualPause: true } : currentItem));
			else setUploads((current) => current.map((currentItem) => currentItem.localId === item.localId ? { ...currentItem, session: { ...currentItem.session, state: "failed", error: uploadError instanceof Error ? uploadError.message : "Upload failed" }, paused: false } : currentItem));
		} finally { uploadControllers.current.delete(item.localId); }
	}

	useEffect(() => {
		if (!api || !online) return;
		for (const item of uploads) {
			if (item.source && item.paused && !item.manualPause && ["uploading", "processing"].includes(item.session.state) && !uploadControllers.current.has(item.localId)) void runUpload(item);
		}
	}, [api, online, uploads]);

	async function startFileUpload() {
		if (!api || !fileDraft.source || !fileDraft.projectId || !online) return;
		const source = fileDraft.source;
		const epoch = sessionEpoch.current;
		const namespace = uploadNamespaceRef.current;
		const projectId = fileDraft.projectId;
		const name = fileDraft.name;
		const mimeType = fileDraft.mimeType;
		setSaving(true);
		try {
			const length = await sourceSize(source);
			const session = (await api.createUpload({ project_id: projectId, file_name: name, mime_type: mimeType, upload_length: length })).upload;
			if (epoch !== sessionEpoch.current) return;
			const item: UploadUi = { localId: crypto.randomUUID(), session, source, name, mimeType, paused: false, manualPause: false };
			await rememberUpload(namespace, item.localId, session, source, item.name, item.mimeType);
			if (epoch !== sessionEpoch.current) return;
			setUploads((current) => [...current, item]);
			setUploadTray(true);
			closeAdd();
			await clearPendingShare();
			void runUpload(item);
		} catch (uploadError) {
			if (epoch !== sessionEpoch.current) return;
			void Swal.fire({ icon: "error", title: "Import not started", text: uploadError instanceof Error ? uploadError.message : "Try again." });
		} finally { if (epoch === sessionEpoch.current) setSaving(false); }
	}

	async function openRecord(record: RecordSummary) {
		if (!api) return;
		const requestId = ++detailSeq.current;
		setDetailLoading(true);
		try {
			const loaded = (await api.record(record.type, record.id)).record;
			if (requestId !== detailSeq.current) return;
			setDetail(loaded);
		} catch (detailError) {
			if (requestId !== detailSeq.current) return;
			void Swal.fire({ icon: "error", title: "Record unavailable", text: detailError instanceof Error ? detailError.message : "Try again." });
		} finally {
			if (requestId === detailSeq.current) setDetailLoading(false);
		}
	}

	function closeDetail() {
		detailSeq.current++;
		setDetail(null);
		setDetailLoading(false);
	}

	function editDetail() {
		if (!detail || detail.type !== "notes") return;
		const next = loadDraft<NoteDraft>(draftKey(server, bootstrap?.user._id || "", detail.id)) || { id: detail.id, title: detail.title, content: detail.content, text: detail.text_content, tags: Array.isArray(detail.metadata.tags) ? detail.metadata.tags.join(", ") : "", projectId: detail.project_id };
		setNoteDraft(next);
		setDetail(null);
		setAddMode("note");
		setAddDrawer(true);
	}

	async function runSearch() {
		if (!api || !searchQuery.trim()) return;
		const epoch = sessionEpoch.current;
		setSearching(true);
		try {
			const result = await api.search(searchQuery.trim(), { projectId: activeProjectId, allProjects: searchAllProjects, type: searchType });
			if (epoch !== sessionEpoch.current) return;
			setSearchResults(result.results as RecordSummary[]);
		} catch (searchError) {
			if (epoch !== sessionEpoch.current) return;
			void Swal.fire({ icon: "error", title: "Search failed", text: searchError instanceof Error ? searchError.message : "Try again." });
		} finally {
			if (epoch === sessionEpoch.current) setSearching(false);
		}
	}

	async function sendChat() {
		if (!api || !chatQuery.trim() || chatting) return;
		if (!online) { void Swal.fire({ icon: "info", title: "AI needs a connection", text: "Reconnect to continue chatting." }); return; }
		const epoch = sessionEpoch.current;
		const query = chatQuery.trim();
		setChatQuery("");
		setChatMessages((current) => [...current, { role: "user", message: query }, { role: "assistant", message: "" }]);
		setChatting(true);
		try {
			let answer = "";
			const result = await api.chat(query, { projectId: activeProjectId, allProjects: chatAllProjects, conversationId: conversationId || undefined }, (token) => {
				if (epoch !== sessionEpoch.current) return;
				answer += token;
				setChatMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, message: answer } : message));
			});
			if (epoch !== sessionEpoch.current) return;
			setConversationId(result.conversation_id || conversationId);
			setChatMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, sources: result.results } : message));
		} catch (chatError) {
			if (epoch !== sessionEpoch.current) return;
			setChatMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, message: chatError instanceof Error ? chatError.message : "AI request failed" } : message));
		} finally {
			if (epoch === sessionEpoch.current) setChatting(false);
		}
	}

	async function openHistory() {
		if (!api) return;
		const epoch = sessionEpoch.current;
		setHistoryDrawer(true);
		try {
			const result = await api.conversations();
			if (epoch === sessionEpoch.current) setConversations(result.conversations);
		} catch {
			if (epoch === sessionEpoch.current) setConversations([]);
		}
	}

	async function selectConversation(conversation: ChatConversation) {
		if (!api) return;
		const epoch = sessionEpoch.current;
		const result = await api.conversationMessages(conversation.conversation_id);
		if (epoch !== sessionEpoch.current) return;
		setConversationId(conversation.conversation_id);
		setChatMessages(result.messages);
		setHistoryDrawer(false);
	}

	async function signOut() {
		const confirmed = await Swal.fire({ icon: "question", title: "Sign out?", showCancelButton: true, confirmButtonText: "Sign out" });
		if (!confirmed.isConfirmed) return;
		await resetSessionState();
	}

	function chooseProject(id: string) {
		const refreshCurrent = id === activeProjectId && view === "projects" && filter === "all";
		setActiveProjectId(id);
		activeProjectIdRef.current = id;
		localStorage.setItem(activeProjectKey(server), id);
		setProjectDrawer(false);
		setFilter("all");
		setView("projects");
		if (refreshCurrent) void loadFeed();
	}

	function showAllRecords() {
		const refreshCurrent = view === "projects" && filter === "all";
		setProjectDrawer(false);
		setHistoryDrawer(false);
		setFilter("all");
		setView("projects");
		if (refreshCurrent) void loadFeed();
	}

	function changeView(next: AppView) {
		if (next === "ai") setChatAllProjects(true);
		if (next === "ai" && !online) { void Swal.fire({ icon: "info", title: "AI needs a connection", text: "Offline records remain available in Projects." }); return; }
		setView(next);
	}

	if (!authReady) return <div className="app-loading"><span className="brand-mark">S</span><span className="spinner dark" /></div>;
	if (!tokens) return <LoginScreen initialServer={server} loading={loginLoading} error={error} onLogin={async (selected) => { setLoginLoading(true); setError(""); try { setServer(selected); await beginOAuth(selected); } catch (loginError) { setError(loginError instanceof Error ? loginError.message : "Could not connect"); setLoginLoading(false); } }} />;
	if (!bootstrap) return <div className="app-loading"><span className="brand-mark">S</span><span className="spinner dark" />{error && <p>{error}</p>}</div>;

	return <div className="mobile-shell">
		{(!online || offline) && <div className="offline-banner"><Icon name="cloud_off" /> Offline — showing cached records</div>}
		{view === "projects" && <>
			<header className="top-bar">
				<BrandHomeButton onClick={showAllRecords} />
				<div className="top-actions"><button className="icon-button" onClick={() => setView("search")} aria-label="Search"><Icon name="search" /></button><button className="avatar-button" onClick={() => setView("settings")} aria-label="Settings">{initials(bootstrap.user.name)}</button></div>
			</header>
			<main className="content feed-content">
				<div className="feed-heading"><div><h1>Records</h1><p><span className="feed-project-dot" style={{ background: activeProject?.color }} />{activeProject?.name || "Project"} · {activeProject ? countTotal(activeProject) : 0} records</p></div>{uploads.some((item) => !["complete", "canceled"].includes(item.session.state)) && <button className="upload-pill" onClick={() => setUploadTray(true)}><Icon name="upload" />{uploads.filter((item) => !["complete", "canceled"].includes(item.session.state)).length}</button>}</div>
				<div className="filter-row" role="tablist">{visibleFilters.map((item) => <button aria-selected={filter === item.value} key={item.value} className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)} role="tab" type="button"><Icon name={item.icon} />{item.label}</button>)}</div>
				{feedLoading ? <RecordSkeleton /> : records.length ? <div className="record-list">{records.map((record) => <RecordRow key={record.key} record={record} onOpen={() => void openRecord(record)} />)}{nextCursor && <button className="button subtle full" disabled={loadingMore} onClick={() => void loadFeed(nextCursor)}>{loadingMore ? "Loading…" : "Load more"}</button>}</div> : <EmptyFeed filter={filter} onAdd={() => openAdd(filter === "urls" ? "url" : "note")} />}
			</main>
		</>}

		{view === "search" && <SearchScreen query={searchQuery} setQuery={setSearchQuery} allProjects={searchAllProjects} setAllProjects={setSearchAllProjects} type={searchType} setType={setSearchType} filters={visibleFilters} results={searchResults} searching={searching} onBack={() => setView("projects")} onSearch={() => void runSearch()} onOpen={(record) => void openRecord(record)} />}
		{view === "ai" && <AiScreen project={activeProject} allProjects={chatAllProjects} setAllProjects={setChatAllProjects} messages={chatMessages} query={chatQuery} setQuery={setChatQuery} chatting={chatting} onHome={showAllRecords} onSend={() => void sendChat()} onHistory={() => void openHistory()} onNew={() => { setChatMessages([]); setConversationId(""); }} onOpen={(record) => void openRecord(record)} />}
		{view === "settings" && <SettingsScreen bootstrap={bootstrap} server={server} appearance={appearance} setAppearance={setAppearance} onBack={() => setView("projects")} onSave={async (data) => {
			if (!api) return;
			const epoch = sessionEpoch.current;
			const apiRef = api;
			try {
				const result = await apiRef.updateProfile(data);
				if (epoch !== sessionEpoch.current) return;
				setBootstrap((current) => (epoch === sessionEpoch.current && current) ? { ...current, user: { ...current.user, ...result.user } } : current);
			} catch (saveError) {
				if (epoch !== sessionEpoch.current) return;
				throw saveError;
			}
		}} onRefresh={async () => {
			if (!api) return;
			const epoch = sessionEpoch.current;
			const apiRef = api;
			const result = await apiRef.bootstrap();
			if (epoch !== sessionEpoch.current) return;
			applyBootstrap(result.value);
			await loadFeed();
		}} onSignOut={() => void signOut()} />}

		<BottomNav active={view} onProjects={() => setProjectDrawer(true)} onAdd={() => openAdd()} onAi={() => changeView("ai")} />

		<Sheet open={projectDrawer} title="Switch project" onClose={() => setProjectDrawer(false)}>{bootstrap.projects.map((project) => <button key={project.id} className="project-row" onClick={() => chooseProject(project.id)}><span className="project-icon" style={{ background: `${project.color}20`, color: project.color }}><Icon name="folder" /></span><span className="project-info"><strong>{project.name}</strong><small>{countTotal(project)} records · {project.counts.notes} notes · {project.counts.memories} memories · {project.counts.urls} URLs{project.counts.emails === undefined ? "" : ` · ${project.counts.emails} emails`}</small></span>{project.id === activeProjectId && <Icon name="check_circle" className="check" />}</button>)}</Sheet>

		<Sheet open={addDrawer} title={addMode === "chooser" ? "Add to Streamient" : addMode === "note" ? noteDraft.id ? "Edit note" : "New note" : addMode === "url" ? "Save URL" : "Import document"} onClose={closeAdd} wide={addMode === "note"}>
			{addMode === "chooser" && <div className="add-options"><button onClick={() => openAdd("note")}><span className="option-icon note"><Icon name="edit_note" /></span><span><strong>Note</strong><small>Write with the rich-text editor</small></span><Icon name="chevron_right" /></button><button onClick={() => openAdd("url")}><span className="option-icon url"><Icon name="link" /></span><span><strong>URL</strong><small>Save a web page to a project</small></span><Icon name="chevron_right" /></button><button onClick={() => openAdd("file")}><span className="option-icon file"><Icon name="upload_file" /></span><span><strong>Import document</strong><small>PDF, Word, text, Markdown, and more</small></span><Icon name="chevron_right" /></button></div>}
			{addMode === "note" && <NoteForm draft={noteDraft} projects={bootstrap.projects} saving={saving} onChange={(next) => { setNoteDraft(next); saveDraft(draftKey(server, bootstrap.user._id, next.id), next); }} onCancel={closeAdd} onSave={() => void saveNote()} />}
			{addMode === "url" && <UrlForm draft={urlDraft} projects={bootstrap.projects} saving={saving} onChange={setUrlDraft} onCancel={closeAdd} onSave={() => void saveUrl()} />}
			{addMode === "file" && <FileForm draft={fileDraft} projects={bootstrap.projects} saving={saving} onChange={setFileDraft} onCancel={closeAdd} onSave={() => void startFileUpload()} />}
		</Sheet>

		<Sheet open={!!detail || detailLoading} title={detail?.title || "Record"} onClose={closeDetail} wide>{detailLoading && !detail ? <RecordSkeleton /> : detail && <RecordView record={detail} onEdit={editDetail} />}</Sheet>
		<UploadTray open={uploadTray} uploads={uploads} onClose={() => setUploadTray(false)} onPause={(item) => { setUploads((current) => current.map((value) => value.localId === item.localId ? { ...value, paused: true, manualPause: true } : value)); uploadControllers.current.get(item.localId)?.abort(); }} onResume={(item) => void runUpload(item)} onCancel={async (item) => { if (!api) return; uploadControllers.current.get(item.localId)?.abort(); await api.cancelUpload(item.session.id).catch(() => undefined); await forgetUpload(uploadNamespaceRef.current, item.localId); setUploads((current) => current.filter((value) => value.localId !== item.localId)); }} />
		<Sheet open={historyDrawer} title="AI history" onClose={() => setHistoryDrawer(false)}>{conversations.length ? conversations.map((conversation) => <button className="history-row" key={conversation.conversation_id} onClick={() => void selectConversation(conversation)}><Icon name="chat_bubble" /><span><strong>{conversation.title}</strong><small>{new Date(conversation.timestamp).toLocaleDateString()}</small></span><Icon name="chevron_right" /></button>) : <div className="empty-mini">No previous conversations</div>}</Sheet>
	</div>;
}

function RecordRow({ record, onOpen }: { record: RecordSummary; onOpen: () => void }) {
	return <button className="record-row" onClick={onOpen}><span className={`record-type ${record.type}`}><Icon name={TYPE_ICONS[record.type]} /></span><span className="record-copy"><span className="record-meta"><span>{TYPE_LABELS[record.type]}</span><span>·</span><time>{relativeTime(record.updated_at)}</time></span><strong>{record.title}</strong><small>{record.excerpt || "No preview available"}</small>{record.type === "urls" && !!record.metadata.domain && <span className="domain"><Icon name="language" />{String(record.metadata.domain)}</span>}</span><Icon name="chevron_right" className="row-chevron" /></button>;
}

function RecordSkeleton() {
	return <div className="record-list skeleton-list">{[1, 2, 3, 4].map((item) => <div className="record-row" key={item}><span className="skeleton icon-skeleton" /><span className="record-copy"><span className="skeleton short" /><span className="skeleton title-skeleton" /><span className="skeleton" /></span></div>)}</div>;
}

function EmptyFeed({ filter, onAdd }: { filter: FeedFilter; onAdd: () => void }) {
	return <div className="empty-state"><span><Icon name={filter === "all" ? "inventory_2" : TYPE_ICONS[filter]} /></span><h2>No {filter === "all" ? "records" : filter} yet</h2><p>Add knowledge to this project and it will appear here.</p><button className="button primary" onClick={onAdd}><Icon name="add" /> Add your first</button></div>;
}

function ProjectSelect({ value, projects, onChange }: { value: string; projects: Project[]; onChange: (value: string) => void }) {
	return <div className="form-group"><label htmlFor="project-select">Project</label><select id="project-select" className="form-control" value={value} onChange={(event) => onChange(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></div>;
}

function FormActions({ saving, onCancel, onSave, saveLabel }: { saving: boolean; onCancel: () => void; onSave: () => void; saveLabel: string }) {
	return <div className="form-actions"><button className="button subtle" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="button" onClick={onSave} disabled={saving}>{saving ? <span className="spinner" /> : null}{saving ? "Saving…" : saveLabel}</button></div>;
}

function NoteForm({ draft, projects, saving, onChange, onCancel, onSave }: { draft: NoteDraft; projects: Project[]; saving: boolean; onChange: (draft: NoteDraft) => void; onCancel: () => void; onSave: () => void }) {
	return <form onSubmit={(event) => { event.preventDefault(); onSave(); }}><div className="form-group"><label htmlFor="note-title">Title</label><input id="note-title" className="form-control" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></div><ProjectSelect value={draft.projectId} projects={projects} onChange={(projectId) => onChange({ ...draft, projectId })} /><div className="form-group"><label>Content</label><RichTextEditor value={draft.content} onChange={(content, text) => onChange({ ...draft, content, text })} /></div><div className="form-group"><label htmlFor="note-tags">Tags <small>comma separated</small></label><input id="note-tags" className="form-control" value={draft.tags} onChange={(event) => onChange({ ...draft, tags: event.target.value })} /></div><FormActions saving={saving} onCancel={onCancel} onSave={onSave} saveLabel={draft.id ? "Save changes" : "Save note"} /></form>;
}

function UrlForm({ draft, projects, saving, onChange, onCancel, onSave }: { draft: { url: string; title: string; projectId: string }; projects: Project[]; saving: boolean; onChange: (draft: { url: string; title: string; projectId: string }) => void; onCancel: () => void; onSave: () => void }) {
	return <form onSubmit={(event) => { event.preventDefault(); onSave(); }}><div className="form-group"><label htmlFor="url-value">URL</label><input id="url-value" className="form-control" type="url" required value={draft.url} onChange={(event) => onChange({ ...draft, url: event.target.value })} /></div><div className="form-group"><label htmlFor="url-title">Title <small>optional</small></label><input id="url-title" className="form-control" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></div><ProjectSelect value={draft.projectId} projects={projects} onChange={(projectId) => onChange({ ...draft, projectId })} /><FormActions saving={saving} onCancel={onCancel} onSave={onSave} saveLabel="Save URL" /></form>;
}

function FileForm({ draft, projects, saving, onChange, onCancel, onSave }: { draft: { source: UploadSource | null; name: string; mimeType: string; projectId: string }; projects: Project[]; saving: boolean; onChange: (draft: { source: UploadSource | null; name: string; mimeType: string; projectId: string }) => void; onCancel: () => void; onSave: () => void }) {
	return <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>{draft.source ? <div className="selected-file"><span><Icon name="description" /></span><div><strong>{draft.name}</strong><small>{draft.source instanceof Blob ? `${(draft.source.size / 1_000_000).toFixed(1)} MB` : draft.mimeType}</small></div><button type="button" className="icon-button" onClick={() => onChange({ ...draft, source: null, name: "", mimeType: "" })}><Icon name="close" /></button></div> : <label className="file-picker"><Icon name="upload_file" /><strong>Choose a document</strong><small>Any supported size. Uploads resume automatically.</small><input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onChange({ ...draft, source: file, name: file.name, mimeType: file.type || "application/octet-stream" }); }} /></label>}<ProjectSelect value={draft.projectId} projects={projects} onChange={(projectId) => onChange({ ...draft, projectId })} /><div className="privacy-note"><Icon name="verified_user" /><span>Transferred in 20 MB integrity-checked chunks. The complete file is never loaded into app memory.</span></div><FormActions saving={saving} onCancel={onCancel} onSave={onSave} saveLabel="Start import" /></form>;
}

function RecordView({ record, onEdit }: { record: RecordDetail; onEdit: () => void }) {
	return <article className="record-view"><div className="record-view-meta"><span className={`record-type ${record.type}`}><Icon name={TYPE_ICONS[record.type]} /></span><span>{TYPE_LABELS[record.type]} · Updated {new Date(record.updated_at).toLocaleString()}</span>{record.type === "notes" && <button className="button small" onClick={onEdit}><Icon name="edit" /> Edit</button>}</div>{record.type === "urls" && !!record.metadata.url && <a className="external-url" href={String(record.metadata.url)} target="_blank" rel="noreferrer"><Icon name="open_in_new" />{String(record.metadata.url)}</a>}<div className="rich-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(record.content || `<p>${record.text_content}</p>`) }} /></article>;
}

function SearchScreen(props: { query: string; setQuery: (value: string) => void; allProjects: boolean; setAllProjects: (value: boolean) => void; type: FeedFilter; setType: (value: FeedFilter) => void; filters: typeof FILTERS; results: RecordSummary[]; searching: boolean; onBack: () => void; onSearch: () => void; onOpen: (record: RecordSummary) => void }) {
	return <><header className="top-bar search-bar"><button aria-label="Back to records" className="icon-button" onClick={props.onBack} type="button"><Icon name="arrow_back" /></button><form onSubmit={(event) => { event.preventDefault(); props.onSearch(); }}><Icon name="search" /><label className="sr-only" htmlFor="global-search">Search</label><input id="global-search" autoFocus value={props.query} onChange={(event) => props.setQuery(event.target.value)} /><button aria-label="Clear search" type="button" className="clear-search" onClick={() => props.setQuery("")}><Icon name="cancel" /></button></form></header><main className="content search-content"><div className="search-options"><label><input type="checkbox" checked={props.allProjects} onChange={(event) => props.setAllProjects(event.target.checked)} /><span>All projects</span></label><select className="form-control" value={props.type} onChange={(event) => props.setType(event.target.value as FeedFilter)}>{props.filters.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></div>{props.searching ? <RecordSkeleton /> : props.results.length ? <div className="record-list">{props.results.map((record) => <RecordRow key={record.key} record={record} onOpen={() => props.onOpen(record)} />)}</div> : <div className="search-prompt"><Icon name="manage_search" /><h1>Search your knowledge</h1><p>Find notes, memories, URLs, and email across Streamient.</p></div>}</main></>;
}

function AiScreen(props: { project: Project | null; allProjects: boolean; setAllProjects: (value: boolean) => void; messages: ChatMessage[]; query: string; setQuery: (value: string) => void; chatting: boolean; onHome: () => void; onSend: () => void; onHistory: () => void; onNew: () => void; onOpen: (record: SearchResult) => void }) {
	return <><header className="top-bar"><div className="ai-title"><BrandHomeButton onClick={props.onHome} /><div><small>Streamient</small><strong>AI Assistant</strong></div></div><div className="top-actions"><button aria-label="Chat history" className="icon-button" onClick={props.onHistory} type="button"><Icon name="history" /></button><button aria-label="New chat" className="icon-button" onClick={props.onNew} type="button"><Icon name="add_comment" /></button></div></header><main className="content ai-content"><label className="scope-toggle"><Icon name="folder" /><span>{props.allProjects ? "All projects" : props.project?.name}</span><input type="checkbox" checked={props.allProjects} onChange={(event) => props.setAllProjects(event.target.checked)} /><small>All</small></label>{props.messages.length ? <div className="chat-list">{props.messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>{message.role === "assistant" && <span className="ai-avatar"><Icon name="auto_awesome" /></span>}<div><div className="chat-bubble" dangerouslySetInnerHTML={message.role === "assistant" ? markdown(message.message || (props.chatting ? "Thinking…" : "")) : { __html: DOMPurify.sanitize(message.message) }} />{!!message.sources?.length && <div className="chat-sources"><strong>Sources</strong>{message.sources.slice(0, 4).map((source) => <button type="button" key={source.key} onClick={() => props.onOpen(source)}><Icon name={TYPE_ICONS[source.type]} />{source.title}</button>)}</div>}</div></div>)}</div> : <div className="ai-welcome"><span><Icon name="auto_awesome" /></span><h1>Ask your knowledge</h1><p>Get answers grounded in everything saved to Streamient.</p><div className="suggestions">{["Summarize what changed recently", "Find decisions about our roadmap", "What should I follow up on?"].map((value) => <button key={value} onClick={() => props.setQuery(value)}>{value}<Icon name="north_east" /></button>)}</div></div>}</main><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); props.onSend(); }}><label className="sr-only" htmlFor="chat-query">Ask Streamient</label><textarea id="chat-query" rows={1} value={props.query} onChange={(event) => props.setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); props.onSend(); } }} /><button aria-label="Send message" disabled={!props.query.trim() || props.chatting}><Icon name="arrow_upward" /></button></form></>;
}

function SettingsScreen({ bootstrap, server, appearance, setAppearance, onBack, onSave, onRefresh, onSignOut }: { bootstrap: BootstrapResponse; server: ServerOption; appearance: string; setAppearance: (value: string) => void; onBack: () => void; onSave: (data: { name: string; timezone: string; time_format: string }) => Promise<void>; onRefresh: () => Promise<void>; onSignOut: () => void }) {
	const [name, setName] = useState(bootstrap.user.name);
	const [timezone, setTimezone] = useState(bootstrap.user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
	const [timeFormat, setTimeFormat] = useState(bootstrap.user.time_format || "12-hour");
	const [busy, setBusy] = useState(false);
	return <><header className="top-bar"><button aria-label="Back to records" className="icon-button" onClick={onBack} type="button"><Icon name="arrow_back" /></button><h1>Settings</h1><span className="top-spacer" /></header><main className="content settings-content"><section className="profile-card"><span className="large-avatar">{initials(bootstrap.user.name)}</span><div><strong>{bootstrap.user.name}</strong><small>{bootstrap.user.email}</small></div></section><section className="settings-section"><h2>Profile</h2><div className="form-group"><label htmlFor="settings-name">Name</label><input id="settings-name" className="form-control" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="form-group"><label htmlFor="settings-timezone">Timezone</label><input id="settings-timezone" className="form-control" value={timezone} onChange={(event) => setTimezone(event.target.value)} /></div><div className="form-group"><label htmlFor="settings-time-format">Time format</label><select id="settings-time-format" className="form-control" value={timeFormat} onChange={(event) => setTimeFormat(event.target.value as "12-hour" | "24-hour")}><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></select></div><button className="button primary settings-save" disabled={busy} onClick={async () => { setBusy(true); try { await onSave({ name, timezone, time_format: timeFormat }); } finally { setBusy(false); } }}>Save profile</button></section><section className="settings-section"><h2>Appearance</h2><div className="segmented">{["system", "light", "dark"].map((value) => <button className={appearance === value ? "active" : ""} key={value} onClick={() => setAppearance(value)}><Icon name={value === "system" ? "devices" : value === "light" ? "light_mode" : "dark_mode"} />{value[0].toUpperCase() + value.slice(1)}</button>)}</div></section><section className="settings-section"><h2>Connection</h2><div className="settings-row"><Icon name="dns" /><span><strong>Server</strong><small>{server.baseUrl}</small></span><Icon name="verified" className="connected" /></div><button className="settings-row button-row" onClick={() => void onRefresh()}><Icon name="sync" /><span><strong>Refresh data</strong><small>Sync projects and records now</small></span><Icon name="chevron_right" /></button></section><section className="settings-section"><h2>About</h2><a className="settings-row" href="https://streamient.com/support" target="_blank" rel="noreferrer"><Icon name="help" /><span><strong>Support</strong></span><Icon name="open_in_new" /></a><a className="settings-row" href="https://streamient.com/privacy" target="_blank" rel="noreferrer"><Icon name="privacy_tip" /><span><strong>Privacy</strong></span><Icon name="open_in_new" /></a><div className="settings-row"><Icon name="info" /><span><strong>Version</strong></span><small>{APP_VERSION}</small></div></section><button className="button danger full" onClick={onSignOut}><Icon name="logout" /> Sign out</button><footer aria-label="Other apps" className="settings-family"><small>Built by the team behind:</small><ul>{FAMILY_APPS.map((app) => <li key={app.name}><a href={app.href} onClick={openExternal} rel="noreferrer" target="_blank">{app.name}</a><span> - {app.description}</span></li>)}</ul></footer></main></>;
}

function UploadTray({ open, uploads, onClose, onPause, onResume, onCancel }: { open: boolean; uploads: UploadUi[]; onClose: () => void; onPause: (item: UploadUi) => void; onResume: (item: UploadUi) => void; onCancel: (item: UploadUi) => void }) {
	return <Sheet open={open} title="Imports" onClose={onClose}>{uploads.length ? uploads.map((item) => { const progress = item.session.upload_length ? Math.round(item.session.upload_offset / item.session.upload_length * 100) : 0; return <div className="upload-row" key={item.localId}><span className="upload-file-icon"><Icon name="description" /></span><div className="upload-info"><strong>{item.name}</strong><small>{item.session.state === "processing" ? "Processing content…" : item.session.state === "complete" ? "Import complete" : item.session.state === "failed" ? item.session.error || "Import failed" : item.paused ? `Paused at ${progress}%` : `Uploading · ${progress}%`}</small><div className="progress"><span style={{ width: `${item.session.state === "processing" || item.session.state === "complete" ? 100 : progress}%` }} /></div></div><div className="upload-actions">{item.session.state === "uploading" && !item.paused && <button className="icon-button" onClick={() => onPause(item)}><Icon name="pause" /></button>}{((item.session.state === "uploading" && item.paused) || item.session.state === "failed") && <button className="icon-button" onClick={() => onResume(item)}><Icon name="play_arrow" /></button>}{["uploading", "failed"].includes(item.session.state) && <button className="icon-button" onClick={() => onCancel(item)}><Icon name="close" /></button>}</div></div>; }) : <div className="empty-mini">No document imports</div>}</Sheet>;
}
