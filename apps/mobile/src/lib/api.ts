import { getCachedJson, setCachedJson } from "./cache";
import { refreshTokens } from "./auth";
import type { BootstrapResponse, ChangesResponse, ChatConversation, ChatMessage, Project, RecordDetail, RecordsResponse, SearchResult, ServerOption, TokenSet, UploadSession } from "../types";

type RequestOptions = { body?: unknown; method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; signal?: AbortSignal };

function cacheNamespace(server: ServerOption, token: string) {
	try {
		const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
		const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))) as { sub?: string; userId?: string; host_id?: string };
		return `${server.baseUrl}:${payload.sub || payload.userId || "unknown"}:${payload.host_id || "unknown"}`;
	} catch {
		return `${server.baseUrl}:unknown`;
	}
}

export class ApiError extends Error {
	constructor(message: string, public status: number, public code = "") {
		super(message);
	}
}

// Refresh tokens are single-use, so every StreamientApi instance shares one in-flight refresh per server+token.
// Each login is a token lineage that refreshes extend; a stale instance adopts only its own lineage's newest tokens,
// so different users, servers, or logins never share credentials (opaque tokens included).
const refreshKey = (server: ServerOption, refreshToken: string) => `${server.baseUrl}\n${refreshToken}`;
const inflightRefreshes = new Map<string, Promise<TokenSet>>();
const lineageByToken = new Map<string, symbol>();
const latestByLineage = new Map<symbol, TokenSet>();
const remember = <K, V>(map: Map<K, V>, key: K, value: V, max: number) => { map.delete(key); map.set(key, value); if (map.size > max) map.delete(map.keys().next().value as K); };

export class StreamientApi {
	private cacheNamespace: string;
	private lineage: symbol;

	constructor(private server: ServerOption, private tokens: TokenSet, private onTokens: (tokens: TokenSet | null) => void) {
		this.cacheNamespace = cacheNamespace(server, tokens.access_token);
		const key = tokens.refresh_token ? refreshKey(server, tokens.refresh_token) : "";
		this.lineage = (key && lineageByToken.get(key)) || Symbol("session");
		if (key) remember(lineageByToken, key, this.lineage, 64);
	}

	private accessTokenNeedsRefresh() {
		if (!this.tokens.refresh_token || !this.tokens.obtained_at || !this.tokens.expires_in) return false;
		return Date.now() >= this.tokens.obtained_at + this.tokens.expires_in * 1000 - 30_000;
	}

	private latestTokens() {
		const latest = latestByLineage.get(this.lineage);
		return latest && latest.refresh_token !== this.tokens.refresh_token ? latest : this.tokens;
	}

	private async replaceTokens() {
		const refreshToken = this.tokens.refresh_token;
		if (!refreshToken) throw new Error("Your session has expired");
		const latest = this.latestTokens();
		if (latest !== this.tokens) { this.tokens = latest; return; } // A sibling instance already rotated this token; the app received the result from it.
		const key = refreshKey(this.server, refreshToken);
		const lineage = this.lineage;
		let pending = inflightRefreshes.get(key);
		if (!pending) {
			pending = refreshTokens(this.server, refreshToken).then((next) => {
				remember(latestByLineage, lineage, next, 16);
				if (next.refresh_token) remember(lineageByToken, refreshKey(this.server, next.refresh_token), lineage, 64);
				return next;
			}).finally(() => { inflightRefreshes.delete(key); });
			inflightRefreshes.set(key, pending);
		}
		this.tokens = await pending;
		this.onTokens(this.tokens);
	}

	private handleRefreshFailure(error: unknown) {
		if (error instanceof TypeError || !navigator.onLine) return;
		if (this.latestTokens() !== this.tokens) return; // Token was already rotated elsewhere; the next request adopts the latest tokens.
		const status = (error as { status?: number }).status;
		if (status && (status >= 500 || status === 429)) return; // Transient server/rate-limit failure preserves the session.
		latestByLineage.delete(this.lineage);
		this.onTokens(null);
	}

	private async authorizedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
		if (retry && this.accessTokenNeedsRefresh()) {
			try { await this.replaceTokens(); }
			catch (error) { this.handleRefreshFailure(error); throw error; }
		}
		const headers = new Headers(init.headers);
		headers.set("Accept", "application/json");
		if (this.tokens.access_token) headers.set("Authorization", `Bearer ${this.tokens.access_token}`);
		const response = await fetch(`${this.server.baseUrl}${path}`, { ...init, headers });
		if (response.status === 401 && retry && this.tokens.refresh_token) {
			try {
				await this.replaceTokens();
				return this.authorizedFetch(path, init, false);
			} catch (error) {
				this.handleRefreshFailure(error);
				throw error;
			}
		}
		return response;
	}

	private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const headers: Record<string, string> = {};
		if (options.body !== undefined) headers["Content-Type"] = "application/json";
		const response = await this.authorizedFetch(path, { method: options.method || (options.body === undefined ? "GET" : "POST"), headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: options.signal });
		const result = response.status === 204 ? null : await response.json().catch(() => ({}));
		if (!response.ok) {
			const error = result as { error?: string; error_description?: string; message?: string; code?: string };
			throw new ApiError(error.error_description || error.error || error.message || `Request failed (${response.status})`, response.status, error.code);
		}
		return result as T;
	}

	private async cached<T>(key: string, load: () => Promise<T>) {
		try {
			const value = await load();
			await setCachedJson(this.cacheNamespace, key, value);
			return { offline: false, value };
		} catch (error) {
			const cached = await getCachedJson<T>(this.cacheNamespace, key);
			if (cached && (!navigator.onLine || error instanceof TypeError)) return { offline: true, value: cached };
			throw error;
		}
	}

	bootstrap() {
		return this.cached<BootstrapResponse>("bootstrap", () => this.request("/api/v1/mobile/bootstrap"));
	}

	projects() {
		return this.request<{ projects: Project[] }>("/api/v1/mobile/projects");
	}

	projectCounts() {
		return this.request<{ projects: Project[] }>("/api/v1/mobile/projects/counts");
	}

	records(options: { projectId: string; type: string; cursor?: string; limit?: number }) {
		const params = new URLSearchParams({ project_id: options.projectId, type: options.type, limit: String(options.limit || 30) });
		if (options.cursor) params.set("cursor", options.cursor);
		const key = `records:${options.projectId}:${options.type}:${options.cursor || "first"}`;
		return this.cached<RecordsResponse>(key, () => this.request(`/api/v1/mobile/records?${params}`));
	}

	changes(cursor: string, projectId: string) {
		const params = new URLSearchParams({ cursor, project_id: projectId });
		return this.request<ChangesResponse>(`/api/v1/mobile/records/changes?${params}`);
	}

	record(type: string, id: string) {
		return this.request<{ record: RecordDetail }>(`/api/v1/mobile/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
	}

	search(query: string, options: { projectId?: string; allProjects?: boolean; type?: string } = {}) {
		const params = new URLSearchParams({ q: query, type: options.type || "all" });
		if (options.projectId) params.set("project_id", options.projectId);
		if (options.allProjects) params.set("all_projects", "true");
		return this.request<{ results: SearchResult[]; found: number }>(`/api/v1/mobile/search?${params}`);
	}

	createNote(data: { title: string; content: string; text_content: string; tags: string[]; project_id: string }) {
		return this.request<{ record: RecordDetail }>("/api/v1/mobile/notes", { method: "POST", body: data });
	}

	updateNote(id: string, data: { title: string; content: string; text_content: string; tags: string[]; project_id: string }) {
		return this.request<{ record: RecordDetail }>(`/api/v1/mobile/notes/${encodeURIComponent(id)}`, { method: "PUT", body: data });
	}

	createUrl(data: { url: string; title: string; project_id: string }) {
		return this.request<{ record: RecordDetail; duplicate: boolean }>("/api/v1/mobile/urls", { method: "POST", body: data });
	}

	createUpload(data: { project_id: string; file_name: string; mime_type: string; upload_length: number; title?: string; tags?: string[] }) {
		return this.request<{ upload: UploadSession }>("/api/v1/mobile/note-imports", { method: "POST", body: data });
	}

	uploadStatus(id: string): Promise<UploadSession>;
	uploadStatus(id: string, head: true): Promise<{ upload_offset: number; upload_length: number; state: string; chunk_size: number }>;
	async uploadStatus(id: string, head = false): Promise<UploadSession | { upload_offset: number; upload_length: number; state: string; chunk_size: number }> {
		if (!head) return (await this.request<{ upload: UploadSession }>(`/api/v1/mobile/note-imports/${encodeURIComponent(id)}`)).upload;
		const response = await this.authorizedFetch(`/api/v1/mobile/note-imports/${encodeURIComponent(id)}`, { method: "HEAD" });
		if (!response.ok) throw new ApiError(`Import lookup failed (${response.status})`, response.status);
		return { upload_offset: Number(response.headers.get("Upload-Offset") || 0), upload_length: Number(response.headers.get("Upload-Length") || 0), state: response.headers.get("Upload-State") || "uploading", chunk_size: Number(response.headers.get("Upload-Chunk-Size") || 20_000_000) };
	}

	async uploadChunk(id: string, offset: number, length: number, checksum: string, body: Blob, signal?: AbortSignal) {
		const response = await this.authorizedFetch(`/api/v1/mobile/note-imports/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/offset+octet-stream", "Upload-Offset": String(offset), "Upload-Length": String(length), "Upload-Checksum": `sha256 ${checksum}` }, body, signal });
		if (!response.ok) {
			const error = await response.json().catch(() => ({})) as { error?: string; code?: string };
			throw new ApiError(error.error || `Chunk upload failed (${response.status})`, response.status, error.code);
		}
		return Number(response.headers.get("Upload-Offset") || offset + body.size);
	}

	completeUpload(id: string) {
		return this.request<{ upload: UploadSession }>(`/api/v1/mobile/note-imports/${encodeURIComponent(id)}/complete`, { method: "POST", body: {} });
	}

	cancelUpload(id: string) {
		return this.request<{ upload: UploadSession }>(`/api/v1/mobile/note-imports/${encodeURIComponent(id)}`, { method: "DELETE" });
	}

	async chat(query: string, options: { projectId?: string; allProjects?: boolean; conversationId?: string }, onToken: (token: string) => void, signal?: AbortSignal) {
		const response = await this.authorizedFetch("/api/v1/mobile/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, project_id: options.projectId, all_projects: options.allProjects, conversation_id: options.conversationId }), signal });
		if (!response.ok || !response.body) throw new ApiError(`AI request failed (${response.status})`, response.status);
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let doneData: { conversation_id?: string; results?: SearchResult[] } = {};
		while (true) {
			const current = await reader.read();
			if (current.done) break;
			buffer += decoder.decode(current.value, { stream: true });
			const blocks = buffer.split("\n\n");
			buffer = blocks.pop() || "";
			for (const block of blocks) {
				const event = block.match(/^event:\s*(.+)$/m)?.[1] || "message";
				const raw = block.match(/^data:\s*(.+)$/m)?.[1];
				if (!raw) continue;
				const data = JSON.parse(raw) as { text?: string; error?: string; conversation_id?: string; results?: SearchResult[] };
				if (event === "token" && data.text) onToken(data.text);
				if (event === "error") throw new Error(data.error || "AI request failed");
				if (event === "done") doneData = data;
			}
		}
		return doneData;
	}

	conversations() {
		return this.request<{ conversations: ChatConversation[] }>("/api/v1/mobile/chat/conversations");
	}

	conversationMessages(id: string) {
		return this.request<{ messages: ChatMessage[] }>(`/api/v1/mobile/chat/conversations/${encodeURIComponent(id)}/messages`);
	}

	profile() {
		return this.request<{ user: BootstrapResponse["user"] }>("/api/v1/mobile/profile");
	}

	updateProfile(data: { name?: string; timezone?: string; time_format?: string }) {
		return this.request<{ user: BootstrapResponse["user"] }>("/api/v1/mobile/profile", { method: "PUT", body: data });
	}

	socketToken() {
		return this.request<{ token: string; expires_in: number; refresh_after: number }>("/api/v1/mobile/socket-token", { method: "POST", body: {} });
	}
}
