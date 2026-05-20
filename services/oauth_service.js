import crypto from 'node:crypto';
import { isIP } from 'node:net';
import bcrypt from 'bcryptjs';
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from 'jose';

import { OAuthAuthorizationCode } from '../model/oauth_authorization_code.js';
import { OAuthClient } from '../model/oauth_client.js';
import { OAuthConsent } from '../model/oauth_consent.js';
import { OAuthRefreshToken } from '../model/oauth_refresh_token.js';
import {
	getAllowedMcpResourceUrls,
	getAuthorizationServerMetadataUrls,
	getOauthIssuer,
	getProtectedResourceMetadataUrl,
	isAllowedMcpResource,
	listScopeDetails,
	normalizeScopeInput,
	OAUTH_CODE_CHALLENGE_METHODS,
	OAUTH_GRANT_TYPES,
	OAUTH_RESPONSE_TYPES,
	OAUTH_TOKEN_ENDPOINT_AUTH_METHODS,
	MCP_ALL_SCOPES,
	scopeString,
	sha256Base64Url,
	signMcpAccessToken,
} from '../modules/oauth.js';
import * as audit from './audit_service.js';

const CLIENT_METADATA_CACHE = new Map();

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const PRIVATE_KEY_JWT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const PRIVATE_KEY_JWT_MAX_LIFETIME_SECONDS = 5 * 60;
const PRIVATE_KEY_JWT_SIGNING_ALGS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA'];
const ASYMMETRIC_JWK_TYPES = new Set(['RSA', 'EC', 'OKP']);
const PRIVATE_USE_REDIRECT_SCHEME_PATTERN = /^(?:com|org|net|io|dev|app|ai|co|me|fm|sh|is)\.[a-z0-9][a-z0-9.-]*:$/i;

export class OAuthError extends Error {
	constructor(error, description, status = 400) {
		super(description || error);
		this.name = 'OAuthError';
		this.oauthError = error;
		this.status = status;
	}
}

function sha256Hex(value) {
	return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomToken(bytes = 32) {
	return crypto.randomBytes(bytes).toString('base64url');
}

function toSafeUrl(value) {
	return String(value || '').trim();
}

function isLoopbackHost(hostname) {
	if (!hostname) return false;
	if (LOOPBACK_HOSTS.has(hostname)) return true;
	if (hostname.endsWith('.localhost')) return true;
	return false;
}

function isPrivateIpAddress(hostname) {
	const version = isIP(hostname);
	if (!version) return false;
	if (version === 4) {
		const parts = hostname.split('.').map((part) => parseInt(part, 10));
		if (parts[0] === 10) return true;
		if (parts[0] === 127) return true;
		if (parts[0] === 169 && parts[1] === 254) return true;
		if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		if (parts[0] === 192 && parts[1] === 168) return true;
		return false;
	}
	const normalized = hostname.toLowerCase();
	return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
}

function isPrivateUseRedirectScheme(protocol) {
	return PRIVATE_USE_REDIRECT_SCHEME_PATTERN.test(String(protocol || ''));
}

function validateClientMetadataDocumentUrl(clientId) {
	let parsed;
	try {
		parsed = new URL(clientId);
	} catch {
		throw new OAuthError('invalid_client', 'Client metadata URL is not valid', 400);
	}

	if (parsed.protocol !== 'https:') {
		throw new OAuthError('invalid_client', 'Client metadata URLs must use HTTPS', 400);
	}
	if (!parsed.pathname || parsed.pathname === '/') {
		throw new OAuthError('invalid_client', 'Client metadata URLs must include a path component', 400);
	}
	if (isLoopbackHost(parsed.hostname) || isPrivateIpAddress(parsed.hostname)) {
		throw new OAuthError('invalid_client', 'Client metadata host is not allowed', 400);
	}
	if (parsed.hash) {
		throw new OAuthError('invalid_client', 'Client metadata URLs must not include a fragment', 400);
	}

	return parsed.toString();
}

function validateOptionalHttpsUrl(value, fieldName) {
	if (!value) return null;
	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		throw new OAuthError('invalid_client_metadata', `${fieldName} must be a valid URL`, 400);
	}
	if (parsed.protocol !== 'https:') {
		throw new OAuthError('invalid_client_metadata', `${fieldName} must use HTTPS`, 400);
	}
	return parsed.toString();
}

function validatePublicHttpsUrl(value, fieldName) {
	const url = validateOptionalHttpsUrl(value, fieldName);
	if (!url) return null;
	const parsed = new URL(url);
	if (isLoopbackHost(parsed.hostname) || isPrivateIpAddress(parsed.hostname)) {
		throw new OAuthError('invalid_client_metadata', `${fieldName} host is not allowed`, 400);
	}
	if (parsed.hash) {
		throw new OAuthError('invalid_client_metadata', `${fieldName} must not include a fragment`, 400);
	}
	return parsed.toString();
}

function validateRedirectUri(uri) {
	let parsed;
	try {
		parsed = new URL(uri);
	} catch {
		throw new OAuthError('invalid_redirect_uri', 'redirect_uri must be a valid URL', 400);
	}

	if (!['http:', 'https:'].includes(parsed.protocol) && !isPrivateUseRedirectScheme(parsed.protocol)) {
		throw new OAuthError('invalid_redirect_uri', 'redirect_uri must use http, https, or a reverse-domain private-use scheme', 400);
	}

	const loopback = isLoopbackHost(parsed.hostname);
	if (!loopback && parsed.protocol !== 'https:' && !isPrivateUseRedirectScheme(parsed.protocol)) {
		throw new OAuthError('invalid_redirect_uri', 'redirect_uri must use HTTPS unless it targets localhost or uses a reverse-domain private-use scheme', 400);
	}
	if (parsed.hash) {
		throw new OAuthError('invalid_redirect_uri', 'redirect_uri must not contain a fragment', 400);
	}

	return parsed.toString();
}

function normalizeGrantTypes(value, { strict = true } = {}) {
	const grantTypes = Array.isArray(value) && value.length ? value : ['authorization_code', 'refresh_token'];
	const normalized = [...new Set(grantTypes.map((item) => String(item || '').trim()).filter(Boolean))];
	const supported = [];
	for (const grantType of normalized) {
		if (!OAUTH_GRANT_TYPES.includes(grantType)) {
			if (!strict) continue;
			throw new OAuthError('invalid_client_metadata', `Unsupported grant type: ${grantType}`, 400);
		}
		supported.push(grantType);
	}
	if (!supported.includes('authorization_code')) {
		throw new OAuthError('invalid_client_metadata', 'authorization_code grant type is required', 400);
	}
	return supported;
}

function normalizeResponseTypes(value) {
	const responseTypes = Array.isArray(value) && value.length ? value : ['code'];
	const normalized = [...new Set(responseTypes.map((item) => String(item || '').trim()).filter(Boolean))];
	for (const responseType of normalized) {
		if (!OAUTH_RESPONSE_TYPES.includes(responseType)) {
			throw new OAuthError('invalid_client_metadata', `Unsupported response type: ${responseType}`, 400);
		}
	}
	if (!normalized.includes('code')) {
		throw new OAuthError('invalid_client_metadata', 'code response type is required', 400);
	}
	return normalized;
}

function normalizeAuthMethod(value) {
	const authMethod = String(value || 'none').trim() || 'none';
	if (!OAUTH_TOKEN_ENDPOINT_AUTH_METHODS.includes(authMethod)) {
		throw new OAuthError('invalid_client_metadata', `Unsupported token_endpoint_auth_method: ${authMethod}`, 400);
	}
	return authMethod;
}

function normalizeJwks(value) {
	if (!value) return null;
	if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.keys)) {
		throw new OAuthError('invalid_client_metadata', 'jwks must be a JSON Web Key Set', 400);
	}
	if (!value.keys.length) {
		throw new OAuthError('invalid_client_metadata', 'jwks must contain at least one public key', 400);
	}
	for (const key of value.keys) {
		if (!key || typeof key !== 'object' || Array.isArray(key)) {
			throw new OAuthError('invalid_client_metadata', 'jwks keys must be objects', 400);
		}
		if (!ASYMMETRIC_JWK_TYPES.has(key.kty)) {
			throw new OAuthError('invalid_client_metadata', 'jwks keys must use asymmetric key types', 400);
		}
		if (key.d || key.k) {
			throw new OAuthError('invalid_client_metadata', 'jwks must not contain private or symmetric key material', 400);
		}
	}
	return { keys: value.keys };
}

function normalizeRegistrationPayload(payload, { strictGrantTypes = true } = {}) {
	const redirectUris = Array.isArray(payload.redirect_uris)
		? payload.redirect_uris
		: [];
	if (!redirectUris.length) {
		throw new OAuthError('invalid_client_metadata', 'redirect_uris is required', 400);
	}

	const normalizedRedirectUris = [...new Set(redirectUris.map((item) => validateRedirectUri(item)))];
	const clientName = String(payload.client_name || '').trim();
	if (!clientName) {
		throw new OAuthError('invalid_client_metadata', 'client_name is required', 400);
	}
	const tokenEndpointAuthMethod = normalizeAuthMethod(payload.token_endpoint_auth_method);
	const jwks = normalizeJwks(payload.jwks);
	const jwksUri = validatePublicHttpsUrl(payload.jwks_uri, 'jwks_uri');
	if (tokenEndpointAuthMethod === 'private_key_jwt' && !jwks && !jwksUri) {
		throw new OAuthError('invalid_client_metadata', 'private_key_jwt clients must provide jwks or jwks_uri', 400);
	}

	return {
		client_name: clientName,
		client_uri: validateOptionalHttpsUrl(payload.client_uri, 'client_uri'),
		logo_uri: validateOptionalHttpsUrl(payload.logo_uri, 'logo_uri'),
		redirect_uris: normalizedRedirectUris,
		jwks,
		jwks_uri: jwksUri,
		grant_types: normalizeGrantTypes(payload.grant_types, { strict: strictGrantTypes }),
		response_types: normalizeResponseTypes(payload.response_types),
		token_endpoint_auth_method: tokenEndpointAuthMethod,
	};
}

function parseCacheControlMaxAge(header) {
	const match = String(header || '').match(/max-age=(\d+)/i);
	if (!match) return null;
	const seconds = parseInt(match[1], 10);
	return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

function mapClientRecord(client, { includeSecret = false, secret = null } = {}) {
	const data = {
		_id: client._id?.toString?.() || client._id,
		client_id: client.client_id,
		client_name: client.client_name,
		client_uri: client.client_uri || null,
		logo_uri: client.logo_uri || null,
		redirect_uris: client.redirect_uris || [],
		jwks: client.jwks || null,
		jwks_uri: client.jwks_uri || null,
		grant_types: client.grant_types || ['authorization_code', 'refresh_token'],
		response_types: client.response_types || ['code'],
		token_endpoint_auth_method: client.token_endpoint_auth_method || 'none',
		registration_source: client.registration_source || 'manual',
		host_id: client.host_id || null,
		createdAt: client.createdAt,
		updatedAt: client.updatedAt,
		last_used_at: client.last_used_at || null,
	};

	if (includeSecret && secret) {
		data.client_secret = secret;
	}

	return data;
}

export function mapDynamicRegistrationClientResponse(client, { clientSecret = null } = {}) {
	const data = {
		client_id: client.client_id,
		client_name: client.client_name,
		redirect_uris: client.redirect_uris || [],
		grant_types: client.grant_types || ['authorization_code', 'refresh_token'],
		response_types: client.response_types || ['code'],
		token_endpoint_auth_method: client.token_endpoint_auth_method || 'none',
	};

	for (const field of ['client_uri', 'logo_uri', 'jwks', 'jwks_uri']) {
		if (client[field]) data[field] = client[field];
	}
	if (clientSecret) data.client_secret = clientSecret;
	return data;
}

async function fetchClientMetadataDocument(clientId) {
	const url = validateClientMetadataDocumentUrl(clientId);
	const cached = CLIENT_METADATA_CACHE.get(url);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}

	let response;
	try {
		response = await fetch(url, {
			headers: { Accept: 'application/json' },
			redirect: 'error',
			signal: AbortSignal.timeout(5000),
		});
	} catch (err) {
		throw new OAuthError('invalid_client', `Failed to fetch client metadata: ${err.message}`, 400);
	}

	if (!response.ok) {
		throw new OAuthError('invalid_client', `Client metadata request failed with status ${response.status}`, 400);
	}

	let json;
	try {
		json = await response.json();
	} catch {
		throw new OAuthError('invalid_client', 'Client metadata document is not valid JSON', 400);
	}

	if (json.client_id !== url) {
		throw new OAuthError('invalid_client', 'client_id metadata value must exactly match the document URL', 400);
	}

	const normalized = normalizeRegistrationPayload(json, { strictGrantTypes: false });
	const metadata = {
		client_id: url,
		registration_source: 'metadata',
		...normalized,
	};

	const maxAge = parseCacheControlMaxAge(response.headers.get('cache-control')) || (5 * 60 * 1000);
	CLIENT_METADATA_CACHE.set(url, { value: metadata, expiresAt: Date.now() + maxAge });
	return metadata;
}

function clientRecordFromStoredClient(client) {
	return {
		client_id: client.client_id,
		client_name: client.client_name,
		client_uri: client.client_uri || null,
		logo_uri: client.logo_uri || null,
		redirect_uris: client.redirect_uris || [],
		jwks: client.jwks || null,
		jwks_uri: client.jwks_uri || null,
		grant_types: client.grant_types || ['authorization_code', 'refresh_token'],
		response_types: client.response_types || ['code'],
		token_endpoint_auth_method: client.token_endpoint_auth_method || 'none',
		registration_source: client.registration_source || 'manual',
		host_id: client.host_id || null,
		doc: client,
	};
}

function getTokenEndpointUrl() {
	return `${getAuthorizationServerMetadataUrls().issuer}/token`;
}

function getClientJwksResolver(client) {
	if (client.jwks) {
		return createLocalJWKSet(client.jwks);
	}
	if (client.jwks_uri) {
		return createRemoteJWKSet(new URL(client.jwks_uri), {
			timeoutDuration: 5000,
		});
	}
	throw new OAuthError('invalid_client', 'private_key_jwt clients must provide jwks or jwks_uri', 401);
}

async function verifyPrivateKeyJwtClientAssertion({ client, clientAssertionType, clientAssertion }) {
	if (!clientAssertion) {
		throw new OAuthError('invalid_client', 'client_assertion is required for private_key_jwt clients', 401);
	}
	const normalizedAssertionType = String(clientAssertionType || PRIVATE_KEY_JWT_ASSERTION_TYPE).trim();
	if (normalizedAssertionType !== PRIVATE_KEY_JWT_ASSERTION_TYPE) {
		throw new OAuthError('invalid_client', 'client_assertion_type must be jwt-bearer for private_key_jwt clients', 401);
	}

	let result;
	try {
		result = await jwtVerify(clientAssertion, getClientJwksResolver(client), {
			issuer: client.client_id,
			subject: client.client_id,
			audience: [getTokenEndpointUrl(), getOauthIssuer()],
			algorithms: PRIVATE_KEY_JWT_SIGNING_ALGS,
		});
	} catch {
		throw new OAuthError('invalid_client', 'client assertion verification failed', 401);
	}

	const exp = result.payload.exp;
	if (!Number.isSafeInteger(exp)) {
		throw new OAuthError('invalid_client', 'client assertion exp is required', 401);
	}
	if (exp > Math.floor(Date.now() / 1000) + PRIVATE_KEY_JWT_MAX_LIFETIME_SECONDS) {
		throw new OAuthError('invalid_client', 'client assertion lifetime is too long', 401);
	}
	return result.payload;
}

async function findStoredClient(clientId, { host_id = null, includeSecret = false } = {}) {
	const query = host_id
		? { client_id: clientId, $or: [{ host_id }, { host_id: null }] }
		: { client_id: clientId };
	const projection = includeSecret ? '+client_secret_hash' : '';
	return OAuthClient.findOne(query).select(projection);
}

export async function resolveClient(clientId, { host_id = null, includeSecret = false } = {}) {
	if (!clientId) {
		throw new OAuthError('invalid_client', 'client_id is required', 400);
	}

	if (String(clientId).startsWith('https://')) {
		return fetchClientMetadataDocument(clientId);
	}

	const stored = await findStoredClient(clientId, { host_id, includeSecret });
	if (!stored) {
		throw new OAuthError('invalid_client', 'Unknown client_id', 400);
	}

	return stored;
}

export async function registerClient({ tenantId = null, host_id = null, createdByUserId = null, payload, source = 'manual' }) {
	const normalized = normalizeRegistrationPayload(payload || {});
	const clientId = `kk_${source}_${crypto.randomUUID().replace(/-/g, '')}`;
	let clientSecret = null;
	let clientSecretHash = null;

	if (normalized.token_endpoint_auth_method === 'client_secret_post') {
		clientSecret = randomToken(32);
		clientSecretHash = await bcrypt.hash(clientSecret, 12);
	}

	const client = await OAuthClient.create({
		tenant: tenantId || undefined,
		host_id: host_id || null,
		client_id: clientId,
		client_secret_hash: clientSecretHash || undefined,
		registration_source: source,
		created_by: createdByUserId || undefined,
		...normalized,
	});

	return {
		client: mapClientRecord(client, { includeSecret: !!clientSecret, secret: clientSecret }),
		client_secret: clientSecret,
	};
}

export async function authenticateClientForToken({ clientId, clientSecret, clientAssertionType, clientAssertion, host_id = null }) {
	const client = await resolveClient(clientId, { host_id, includeSecret: true });

	if (client instanceof OAuthClient) {
		if (client.token_endpoint_auth_method === 'client_secret_post') {
			if (!clientSecret) {
				throw new OAuthError('invalid_client', 'client_secret is required for this client', 401);
			}
			const ok = await bcrypt.compare(String(clientSecret), client.client_secret_hash || '');
			if (!ok) {
				throw new OAuthError('invalid_client', 'client authentication failed', 401);
			}
		}
		const clientRecord = clientRecordFromStoredClient(client);
		if (clientRecord.token_endpoint_auth_method === 'private_key_jwt') {
			await verifyPrivateKeyJwtClientAssertion({ client: clientRecord, clientAssertionType, clientAssertion });
		}
		return clientRecord;
	}

	if (client.token_endpoint_auth_method === 'private_key_jwt') {
		if (clientAssertion) {
			await verifyPrivateKeyJwtClientAssertion({ client, clientAssertionType, clientAssertion });
		} else if (clientAssertionType) {
			throw new OAuthError('invalid_client', 'client_assertion is required for private_key_jwt clients', 401);
		}
		return client;
	}
	if (client.token_endpoint_auth_method !== 'none') {
		throw new OAuthError('invalid_client', 'Unsupported client metadata token endpoint authentication method', 401);
	}
	return client;
}

export async function listClients(host_id) {
	const clients = await OAuthClient.find({ host_id }).sort({ createdAt: -1 }).lean();
	return clients.map((client) => mapClientRecord(client));
}

export async function deleteClient(host_id, clientId, ctx = {}) {
	const client = await OAuthClient.findOne({ _id: clientId, host_id });
	if (!client) throw new Error('OAuth client not found');

	await OAuthClient.deleteOne({ _id: client._id });
	await OAuthConsent.updateMany({ host_id, client_id: client.client_id, revoked_at: null }, { $set: { revoked_at: new Date() } });
	await OAuthRefreshToken.updateMany({ host_id, client_id: client.client_id, revoked_at: null }, { $set: { revoked_at: new Date() } });

	audit.log({
		action: 'delete',
		resource: 'oauth_client',
		resource_id: client.client_id,
		host_id,
		details: { client_name: client.client_name },
		...ctx,
	});

	return client;
}

export async function listConsents(userId, host_id) {
	const consents = await OAuthConsent.find({ user: userId, host_id, revoked_at: null })
		.sort({ last_used_at: -1, granted_at: -1 })
		.lean();

	return consents.map((consent) => ({
		_id: consent._id.toString(),
		client_id: consent.client_id,
		client_name: consent.client_name,
		client_uri: consent.client_uri || null,
		logo_uri: consent.logo_uri || null,
		redirect_uris: consent.redirect_uris || [],
		registration_source: consent.registration_source,
		scopes: consent.scopes || [],
		resource: consent.resource,
		granted_at: consent.granted_at,
		last_used_at: consent.last_used_at || null,
	}));
}

export async function revokeConsent(consentId, userId, host_id, ctx = {}) {
	const consent = await OAuthConsent.findOne({ _id: consentId, user: userId, host_id, revoked_at: null });
	if (!consent) throw new Error('Authorized app not found');

	consent.revoked_at = new Date();
	await consent.save();
	await OAuthRefreshToken.updateMany({ user: userId, host_id, client_id: consent.client_id, revoked_at: null }, { $set: { revoked_at: new Date() } });

	audit.log({
		action: 'delete',
		resource: 'oauth_consent',
		resource_id: consent._id.toString(),
		user_id: userId,
		host_id,
		details: { client_id: consent.client_id, client_name: consent.client_name },
		...ctx,
	});

	return consent;
}

export async function findConsent({ userId, host_id, clientId, resource }) {
	return OAuthConsent.findOne({
		user: userId,
		host_id,
		client_id: clientId,
		resource,
		revoked_at: null,
	});
}

export function consentCoversScopes(consent, requestedScopes) {
	if (!consent) return false;
	const granted = new Set(normalizeScopeInput(consent.scopes || []));
	return normalizeScopeInput(requestedScopes).every((scope) => granted.has(scope));
}

export async function approveConsent({ userId, tenantId, host_id, client, requestedScopes, resource, redirectUri, ctx = {} }) {
	const existing = await findConsent({ userId, host_id, clientId: client.client_id, resource });
	const scopes = normalizeScopeInput([...(existing?.scopes || []), ...normalizeScopeInput(requestedScopes)]);
	const redirectUris = [...new Set([...(client.redirect_uris || []), redirectUri].filter(Boolean))];
	const snapshot = {
		client_name: client.client_name,
		client_uri: client.client_uri || null,
		logo_uri: client.logo_uri || null,
		redirect_uris: redirectUris,
		registration_source: client.registration_source,
		scopes,
	};

	const consent = existing || new OAuthConsent({
		user: userId,
		tenant: tenantId,
		host_id,
		client_id: client.client_id,
		resource,
		granted_at: new Date(),
	});

	consent.client_name = snapshot.client_name;
	consent.client_uri = snapshot.client_uri;
	consent.logo_uri = snapshot.logo_uri;
	consent.redirect_uris = snapshot.redirect_uris;
	consent.registration_source = snapshot.registration_source;
	consent.scopes = scopes;
	consent.revoked_at = undefined;
	consent.last_used_at = new Date();
	await consent.save();

	audit.log({
		action: existing ? 'update' : 'create',
		resource: 'oauth_consent',
		resource_id: consent._id.toString(),
		user_id: userId,
		host_id,
		details: { client_id: client.client_id, client_name: client.client_name, scopes },
		...ctx,
	});

	return consent;
}

export async function issueAuthorizationCode({ userId, tenantId, host_id, client, redirectUri, scopes, resource, codeChallenge, codeChallengeMethod = 'S256' }) {
	if (!OAUTH_CODE_CHALLENGE_METHODS.includes(codeChallengeMethod)) {
		throw new OAuthError('invalid_request', 'code_challenge_method must be S256', 400);
	}

	const code = randomToken(32);
	await OAuthAuthorizationCode.create({
		code_hash: sha256Hex(code),
		user: userId,
		tenant: tenantId,
		host_id,
		client_id: client.client_id,
		client_name: client.client_name,
		redirect_uri: redirectUri,
		registration_source: client.registration_source,
		scope: scopeString(scopes),
		resource,
		code_challenge: codeChallenge,
		code_challenge_method: codeChallengeMethod,
		expires_at: new Date(Date.now() + 10 * 60 * 1000),
	});

	return code;
}

export async function exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier }) {
	if (!code) throw new OAuthError('invalid_grant', 'authorization code is required', 400);
	if (!clientId) throw new OAuthError('invalid_client', 'client_id is required', 401);
	if (!redirectUri) throw new OAuthError('invalid_grant', 'redirect_uri is required', 400);
	if (!codeVerifier) throw new OAuthError('invalid_grant', 'code_verifier is required', 400);

	const authCode = await OAuthAuthorizationCode.findOne({ code_hash: sha256Hex(code) });
	if (!authCode || authCode.used_at || authCode.expires_at <= new Date()) {
		throw new OAuthError('invalid_grant', 'authorization code is invalid or expired', 400);
	}
	if (authCode.client_id !== clientId) {
		throw new OAuthError('invalid_grant', 'authorization code was not issued to this client', 400);
	}
	if (authCode.redirect_uri !== validateRedirectUri(redirectUri)) {
		throw new OAuthError('invalid_grant', 'redirect_uri does not match the authorization request', 400);
	}
	if (authCode.code_challenge_method !== 'S256') {
		throw new OAuthError('invalid_grant', 'Unsupported code challenge method', 400);
	}
	if (sha256Base64Url(codeVerifier) !== authCode.code_challenge) {
		throw new OAuthError('invalid_grant', 'PKCE verification failed', 400);
	}

	authCode.used_at = new Date();
	await authCode.save();

	await OAuthConsent.updateOne(
		{ user: authCode.user, host_id: authCode.host_id, client_id: authCode.client_id, resource: authCode.resource, revoked_at: null },
		{ $set: { last_used_at: new Date() } },
	);
	await OAuthClient.updateOne({ client_id: authCode.client_id }, { $set: { last_used_at: new Date() } });

	return authCode;
}

async function storeRefreshToken({ userId, tenantId, host_id, client, scopes, resource, replacedByTokenHash = null }) {
	const refreshToken = randomToken(32);
	const tokenHash = sha256Hex(refreshToken);
	await OAuthRefreshToken.create({
		token_hash: tokenHash,
		user: userId,
		tenant: tenantId,
		host_id,
		client_id: client.client_id,
		client_name: client.client_name,
		registration_source: client.registration_source,
		scope: scopeString(scopes),
		resource,
		expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		replaced_by_token_hash: replacedByTokenHash || undefined,
	});
	return { refreshToken, tokenHash };
}

export async function issueTokenPair({ userId, tenantId, host_id, client, scopes, resource }) {
	const normalizedScopes = normalizeScopeInput(scopes);
	const accessToken = signMcpAccessToken({
		userId,
		tenantId,
		host_id,
		clientId: client.client_id,
		clientName: client.client_name,
		scopes: normalizedScopes,
		audience: resource,
	});
	const { refreshToken } = await storeRefreshToken({
		userId,
		tenantId,
		host_id,
		client,
		scopes: normalizedScopes,
		resource,
	});

	await OAuthConsent.updateOne(
		{ user: userId, host_id, client_id: client.client_id, resource, revoked_at: null },
		{ $set: { last_used_at: new Date() } },
	);
	await OAuthClient.updateOne({ client_id: client.client_id }, { $set: { last_used_at: new Date() } });

	return {
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 600,
		refresh_token: refreshToken,
		scope: scopeString(normalizedScopes),
	};
}

export async function exchangeRefreshToken({ refreshToken, client, host_id = null }) {
	if (!refreshToken) {
		throw new OAuthError('invalid_grant', 'refresh_token is required', 400);
	}

	const refresh = await OAuthRefreshToken.findOne({ token_hash: sha256Hex(refreshToken) });
	if (!refresh || refresh.revoked_at || refresh.rotated_at || refresh.expires_at <= new Date()) {
		throw new OAuthError('invalid_grant', 'refresh_token is invalid or expired', 400);
	}
	if (client.client_id !== refresh.client_id) {
		throw new OAuthError('invalid_grant', 'refresh_token was not issued to this client', 400);
	}
	if (host_id && refresh.host_id !== host_id) {
		throw new OAuthError('invalid_grant', 'refresh_token tenant mismatch', 400);
	}

	const scopes = normalizeScopeInput(refresh.scope);
	const nextPair = await issueTokenPair({
		userId: refresh.user,
		tenantId: refresh.tenant,
		host_id: refresh.host_id,
		client,
		scopes,
		resource: refresh.resource,
	});

	refresh.rotated_at = new Date();
	refresh.replaced_by_token_hash = sha256Hex(nextPair.refresh_token);
	await refresh.save();

	return nextPair;
}

export function buildAuthorizationServerMetadata() {
	const urls = getAuthorizationServerMetadataUrls();
	return {
		issuer: urls.issuer,
		authorization_endpoint: `${urls.issuer}/authorize`,
		token_endpoint: `${urls.issuer}/token`,
		registration_endpoint: `${urls.issuer}/register`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		token_endpoint_auth_methods_supported: OAUTH_TOKEN_ENDPOINT_AUTH_METHODS,
		token_endpoint_auth_signing_alg_values_supported: PRIVATE_KEY_JWT_SIGNING_ALGS,
		code_challenge_methods_supported: ['S256'],
		client_id_metadata_document_supported: true,
		scopes_supported: MCP_ALL_SCOPES,
	};
}

export function buildOauthUiConfig() {
	const metadata = buildAuthorizationServerMetadata();
	return {
		issuer: metadata.issuer,
		authorization_endpoint: metadata.authorization_endpoint,
		token_endpoint: metadata.token_endpoint,
		registration_endpoint: metadata.registration_endpoint,
		authorization_server_metadata_url: getAuthorizationServerMetadataUrls().oauth_authorization_server,
		openid_configuration_url: getAuthorizationServerMetadataUrls().openid_configuration_path_inserted,
		resource_metadata_url: getProtectedResourceMetadataUrl(),
		mcp_base_url: getAllowedMcpResourceUrls()[0],
		mcp_endpoint: getAllowedMcpResourceUrls()[1],
		allowed_resources: getAllowedMcpResourceUrls(),
		scope_details: listScopeDetails(['mcp:read', 'mcp:write', 'mcp:email', 'mcp:git']),
		client_registration: {
			client_id_metadata_document_supported: true,
			dynamic_registration_supported: true,
			pre_registration_supported: true,
		},
	};
}

export function buildAuthorizationErrorRedirect(redirectUri, error, description, state) {
	const url = new URL(redirectUri);
	url.searchParams.set('error', error);
	if (description) url.searchParams.set('error_description', description);
	if (state) url.searchParams.set('state', state);
	return url.toString();
}

export function parseAuthorizationRequest(input = {}) {
	const clientId = String(input.client_id || '').trim();
	const redirectUri = String(input.redirect_uri || '').trim();
	const responseType = String(input.response_type || '').trim();
	const scope = normalizeScopeInput(String(input.scope || 'mcp:read'));
	const state = typeof input.state === 'string' ? input.state : '';
	const codeChallenge = String(input.code_challenge || '').trim();
	const codeChallengeMethod = String(input.code_challenge_method || '').trim();
	const resource = String(input.resource || '').trim().replace(/\/$/, '');

	if (!clientId) throw new OAuthError('invalid_request', 'client_id is required', 400);
	if (!redirectUri) throw new OAuthError('invalid_request', 'redirect_uri is required', 400);
	if (responseType !== 'code') throw new OAuthError('unsupported_response_type', 'Only response_type=code is supported', 400);
	if (!codeChallenge) throw new OAuthError('invalid_request', 'code_challenge is required', 400);
	if (codeChallengeMethod !== 'S256') throw new OAuthError('invalid_request', 'code_challenge_method must be S256', 400);
	if (!resource) throw new OAuthError('invalid_target', 'resource is required', 400);
	if (!isAllowedMcpResource(resource)) {
		throw new OAuthError('invalid_target', 'resource must target this MCP server', 400);
	}
	if (!scope.length) {
		throw new OAuthError('invalid_scope', 'At least one supported scope is required', 400);
	}

	return {
		client_id: clientId,
		redirect_uri: validateRedirectUri(redirectUri),
		response_type: responseType,
		scopes: scope,
		state,
		code_challenge: codeChallenge,
		code_challenge_method: codeChallengeMethod,
		resource,
	};
}

export async function validateAuthorizationRequest(request, { host_id }) {
	const parsed = parseAuthorizationRequest(request);
	const client = await resolveClient(parsed.client_id, { host_id });
	const redirectUris = client.redirect_uris || [];
	if (!redirectUris.includes(parsed.redirect_uri)) {
		throw new OAuthError('invalid_request', 'redirect_uri is not registered for this client', 400);
	}
	return { ...parsed, client };
}
