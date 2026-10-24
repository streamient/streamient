import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { MOBILE_CLIENT_ID, MOBILE_SCOPES, NATIVE_REDIRECT_URI, WEB_REDIRECT_URI, oauthRedirectUri } from "./config";
import { getStoredJson, removeStoredValue, setStoredJson } from "./secureStorage";
import type { ServerOption, TokenSet } from "../types";

const TOKEN_KEY = "tokens";
const VERIFIER_KEY = "pkce_verifier";
const STATE_KEY = "oauth_state";
const SERVER_KEY = "server";
const PENDING_SERVER_KEY = "oauth_pending_server";

function base64Url(bytes: ArrayBuffer) {
	return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length: number) {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return base64Url(bytes.buffer).slice(0, length);
}

async function sha256(value: string) {
	return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function loadSelectedServer() {
	return getStoredJson<ServerOption>(SERVER_KEY);
}

export async function saveSelectedServer(server: ServerOption) {
	await setStoredJson(SERVER_KEY, server);
}

export async function loadPendingServer() {
	return getStoredJson<ServerOption>(PENDING_SERVER_KEY);
}

export async function savePendingServer(server: ServerOption) {
	await setStoredJson(PENDING_SERVER_KEY, server);
}

export async function clearPendingServer() {
	await removeStoredValue(PENDING_SERVER_KEY);
}

export async function loadTokens() {
	return getStoredJson<TokenSet>(TOKEN_KEY);
}

// Serialize credential-store writes so a refresh that resolves before sign-out
// cannot re-persist the old tokens after clearAuth has already run.
let authWriteChain: Promise<unknown> = Promise.resolve();

function serializeAuthWrite<T>(operation: () => Promise<T>): Promise<T> {
	const result = authWriteChain.then(operation, operation);
	authWriteChain = result.then(() => undefined, () => undefined);
	return result;
}

export async function saveTokens(tokens: TokenSet) {
	await serializeAuthWrite(() => setStoredJson(TOKEN_KEY, { ...tokens, obtained_at: Date.now() }));
}

export async function clearAuth() {
	await serializeAuthWrite(() => Promise.all([removeStoredValue(TOKEN_KEY), removeStoredValue(VERIFIER_KEY), removeStoredValue(STATE_KEY), removeStoredValue(SERVER_KEY), removeStoredValue(PENDING_SERVER_KEY)]));
}

export async function beginOAuth(server: ServerOption) {
	const verifier = randomString(86);
	const state = randomString(40);
	const params = new URLSearchParams({ client_id: MOBILE_CLIENT_ID, code_challenge: await sha256(verifier), code_challenge_method: "S256", redirect_uri: oauthRedirectUri(), resource: server.resourceUrl, response_type: "code", scope: MOBILE_SCOPES, state });
	await Promise.all([setStoredJson(VERIFIER_KEY, verifier), setStoredJson(STATE_KEY, state), savePendingServer(server)]);
	const url = `${server.baseUrl}/oauth/authorize?${params}`;
	if (Capacitor.isNativePlatform()) await Browser.open({ url, presentationStyle: "fullscreen" });
	else window.location.assign(url);
}

export function parseOAuthCallback(url: string) {
	const parsed = new URL(url);
	const error = parsed.searchParams.get("error");
	if (error) throw new Error(parsed.searchParams.get("error_description") || error);
	const code = parsed.searchParams.get("code");
	const state = parsed.searchParams.get("state");
	if (!code || !state) throw new Error("OAuth callback missing code or state");
	return { code, state };
}

async function tokenRequest(server: ServerOption, body: URLSearchParams): Promise<TokenSet> {
	const response = await fetch(`${server.baseUrl}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
	const result = await response.json().catch(() => ({})) as TokenSet & { error?: string; error_description?: string };
	if (!response.ok) throw Object.assign(new Error(result.error_description || result.error || "OAuth token exchange failed"), { status: response.status, code: result.error });
	return { ...result, obtained_at: Date.now() };
}

export async function exchangeCode(server: ServerOption, code: string, state: string) {
	const [expectedState, verifier] = await Promise.all([getStoredJson<string>(STATE_KEY), getStoredJson<string>(VERIFIER_KEY)]);
	if (!expectedState || expectedState !== state) throw new Error("OAuth state mismatch");
	if (!verifier) throw new Error("Missing PKCE verifier");
	const tokens = await tokenRequest(server, new URLSearchParams({ client_id: MOBILE_CLIENT_ID, code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: oauthRedirectUri(), resource: server.resourceUrl }));
	await Promise.all([removeStoredValue(VERIFIER_KEY), removeStoredValue(STATE_KEY), saveTokens(tokens), saveSelectedServer(server), clearPendingServer()]);
	if (Capacitor.isNativePlatform()) await Browser.close().catch(() => undefined);
	return tokens;
}

export async function refreshTokens(server: ServerOption, refreshToken: string) {
	return tokenRequest(server, new URLSearchParams({ client_id: MOBILE_CLIENT_ID, grant_type: "refresh_token", refresh_token: refreshToken, resource: server.resourceUrl }));
}

export function listenForOAuthCallbacks(callback: (url: string) => void) {
	const handle = (url: string) => { if (url.startsWith(NATIVE_REDIRECT_URI) || url.startsWith(WEB_REDIRECT_URI)) callback(url); };
	const subscription = App.addListener("appUrlOpen", ({ url }) => handle(url));
	return () => void subscription.then((listener) => listener.remove());
}
