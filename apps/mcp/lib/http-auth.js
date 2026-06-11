import {
	buildBearerChallenge,
	getDefaultScopesForRequestPath,
	getRequestMcpResourceUrls,
	getRequestProtectedResourceMetadataUrl,
	getProtectedResourceMetadataUrl,
	getRequiredScopesForTool,
	hasRequiredScopes,
	MCP_BASELINE_SCOPES,
	MCP_DEFAULT_SCOPES,
	signMcpBridgeToken,
	verifyMcpAccessToken,
} from '../../../modules/oauth.js';

export function extractRequestAuth(headers = {}) {
	const auth = headers.authorization;
	if (auth?.startsWith('Bearer ')) {
		return { scheme: 'Bearer', token: auth.slice(7) };
	}
	if (auth?.startsWith('Token ')) {
		return { scheme: 'Token', token: auth.slice(6) };
	}
	if (headers['access-token']) {
		return { scheme: 'Token', token: headers['access-token'] };
	}
	return null;
}

function buildLegacyAuthContext(token) {
	return {
		ok: true,
		mode: 'legacy',
		apiAuth: token,
	};
}

function isLikelyJwt(token) {
	return typeof token === 'string' && token.split('.').length === 3;
}

export function getToolNameFromRequestBody(body) {
	if (!body || typeof body !== 'object') return null;
	if (body.method !== 'tools/call') return null;
	return typeof body.params?.name === 'string' ? body.params.name : null;
}

export function getRequiredScopesForRequestBody(body) {
	const toolName = getToolNameFromRequestBody(body);
	if (!toolName) return MCP_BASELINE_SCOPES;
	return getRequiredScopesForTool(toolName);
}

export function buildUnauthorizedResponse(resourceMetadataUrl = getProtectedResourceMetadataUrl(), scopes = MCP_DEFAULT_SCOPES) {
	return {
		status: 401,
		headers: {
			'WWW-Authenticate': buildBearerChallenge({
				resourceMetadataUrl,
				scopes,
			}),
		},
		body: { error: 'Authentication required' },
	};
}

export function buildInvalidTokenResponse(resourceMetadataUrl = getProtectedResourceMetadataUrl(), scopes = MCP_DEFAULT_SCOPES) {
	return {
		status: 401,
		headers: {
			'WWW-Authenticate': buildBearerChallenge({
				resourceMetadataUrl,
				scopes,
				error: 'invalid_token',
				errorDescription: 'Access token is missing, invalid, or expired',
			}),
		},
		body: { error: 'Invalid access token' },
	};
}

export function buildInsufficientScopeResponse(requiredScopes, resourceMetadataUrl = getProtectedResourceMetadataUrl()) {
	return {
		status: 403,
		headers: {
			'WWW-Authenticate': buildBearerChallenge({
				resourceMetadataUrl,
				scopes: requiredScopes,
				error: 'insufficient_scope',
				errorDescription: 'Additional MCP scopes are required for this operation',
			}),
		},
		body: {
			error: 'insufficient_scope',
			required_scopes: requiredScopes,
		},
	};
}

export function authenticateHttpRequest(req) {
	const resourceMetadataUrl = getRequestProtectedResourceMetadataUrl(req);
	const defaultScopes = getDefaultScopesForRequestPath(req?.path);
	const auth = extractRequestAuth(req.headers);
	if (!auth?.token) {
		return { ok: false, response: buildUnauthorizedResponse(resourceMetadataUrl, defaultScopes) };
	}

	if (auth.scheme === 'Token') {
		return buildLegacyAuthContext(auth.token);
	}

	try {
		const tokenClaims = verifyMcpAccessToken(auth.token, { extraAudiences: getRequestMcpResourceUrls(req) });
		return {
			ok: true,
			mode: 'oauth',
			tokenClaims,
			apiAuth: {
				scheme: 'Bearer',
				token: signMcpBridgeToken({
					userId: tokenClaims.sub,
					tenantId: tokenClaims.tenantId,
					host_id: tokenClaims.host_id,
					clientId: tokenClaims.client_id,
					scopes: tokenClaims.scope,
				}),
			},
		};
	} catch {
		if (!isLikelyJwt(auth.token)) {
			return buildLegacyAuthContext(auth.token);
		}
		return { ok: false, response: buildInvalidTokenResponse(resourceMetadataUrl, defaultScopes) };
	}
}

export function checkRequestScopes(authContext, body) {
	if (!authContext || authContext.mode !== 'oauth') return null;
	const requiredScopes = getRequiredScopesForRequestBody(body);
	if (hasRequiredScopes(authContext.tokenClaims.scope, requiredScopes)) {
		return null;
	}
	return buildInsufficientScopeResponse(requiredScopes);
}
