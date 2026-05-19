import { Router } from 'express';
import { Tenant } from '../modules/tenancy.js';
import { listScopeDetails } from '../modules/oauth.js';
import * as oauthService from '../services/oauth_service.js';

const router = Router();

function denyFraming(res) {
	res.set('X-Frame-Options', 'DENY');
	res.set('Content-Security-Policy', "frame-ancestors 'none'");
}

function redirectWithCode(redirectUri, code, state) {
	const url = new URL(redirectUri);
	url.searchParams.set('code', code);
	if (state) url.searchParams.set('state', state);
	return url.toString();
}

function renderError(res, status, message) {
	denyFraming(res);
	return res.status(status).render('auth/oauth_authorize', {
		error: message,
		client: null,
		oauth_request: null,
		scope_details: [],
		active_tenant: null,
	});
}

function sendTokenError(res, err) {
	const status = err?.status || 400;
	return res.status(status).json({
		error: err?.oauthError || 'invalid_request',
		error_description: err?.message || 'OAuth request failed',
	});
}

function metadataResponse() {
	return oauthService.buildAuthorizationServerMetadata();
}

router.get('/.well-known/oauth-authorization-server/oauth', (_req, res) => {
	res.json(metadataResponse());
});

router.get('/.well-known/openid-configuration/oauth', (_req, res) => {
	res.json(metadataResponse());
});

router.get('/oauth/.well-known/openid-configuration', (_req, res) => {
	res.json(metadataResponse());
});

router.get('/oauth/authorize', async (req, res) => {
	if (!req.session?.userId) {
		req.session.oauthLoginReturnTo = req.originalUrl;
		return res.redirect('/login');
	}
	if (!req.tenantId || !req.host_id) {
		return renderError(res, 403, 'Select an active account before authorizing apps.');
	}

	try {
		const oauthRequest = await oauthService.validateAuthorizationRequest(req.query, { host_id: req.host_id });
		const activeTenant = await Tenant.findById(req.tenantId).select('name host_id').lean();
		const existingConsent = await oauthService.findConsent({
			userId: req.session.userId,
			host_id: req.host_id,
			clientId: oauthRequest.client.client_id,
			resource: oauthRequest.resource,
		});

		if (oauthService.consentCoversScopes(existingConsent, oauthRequest.scopes) && req.query.prompt !== 'consent') {
			const code = await oauthService.issueAuthorizationCode({
				userId: req.session.userId,
				tenantId: req.tenantId,
				host_id: req.host_id,
				client: oauthRequest.client,
				redirectUri: oauthRequest.redirect_uri,
				scopes: oauthRequest.scopes,
				resource: oauthRequest.resource,
				codeChallenge: oauthRequest.code_challenge,
				codeChallengeMethod: oauthRequest.code_challenge_method,
			});
			return res.redirect(redirectWithCode(oauthRequest.redirect_uri, code, oauthRequest.state));
		}

		denyFraming(res);
		return res.render('auth/oauth_authorize', {
			error: null,
			client: oauthRequest.client,
			oauth_request: oauthRequest,
			scope_details: listScopeDetails(oauthRequest.scopes),
			active_tenant: activeTenant,
		});
	} catch (err) {
		console.error('OAuth authorize page error:', err);
		return renderError(res, err?.status || 400, err?.message || 'Authorization request failed');
	}
});

router.post('/oauth/authorize', async (req, res) => {
	if (!req.session?.userId) {
		req.session.oauthLoginReturnTo = req.originalUrl;
		return res.redirect('/login');
	}
	if (!req.tenantId || !req.host_id) {
		return renderError(res, 403, 'Select an active account before authorizing apps.');
	}

	try {
		const oauthRequest = await oauthService.validateAuthorizationRequest(req.body, { host_id: req.host_id });
		if (req.body.decision !== 'approve') {
			return res.redirect(oauthService.buildAuthorizationErrorRedirect(
				oauthRequest.redirect_uri,
				'access_denied',
				'The resource owner denied the request',
				oauthRequest.state,
			));
		}

		await oauthService.approveConsent({
			userId: req.session.userId,
			tenantId: req.tenantId,
			host_id: req.host_id,
			client: oauthRequest.client,
			requestedScopes: oauthRequest.scopes,
			resource: oauthRequest.resource,
			redirectUri: oauthRequest.redirect_uri,
			ctx: {
				channel: 'web',
				user_id: req.session.userId,
				host_id: req.host_id,
				ip: req.ip,
				user_agent: req.headers['user-agent'],
			},
		});

		const code = await oauthService.issueAuthorizationCode({
			userId: req.session.userId,
			tenantId: req.tenantId,
			host_id: req.host_id,
			client: oauthRequest.client,
			redirectUri: oauthRequest.redirect_uri,
			scopes: oauthRequest.scopes,
			resource: oauthRequest.resource,
			codeChallenge: oauthRequest.code_challenge,
			codeChallengeMethod: oauthRequest.code_challenge_method,
		});

		return res.redirect(redirectWithCode(oauthRequest.redirect_uri, code, oauthRequest.state));
	} catch (err) {
		console.error('OAuth authorize submit error:', err);
		return renderError(res, err?.status || 400, err?.message || 'Authorization failed');
	}
});

router.post('/oauth/token', async (req, res) => {
	try {
		const grantType = String(req.body.grant_type || '').trim();
		const client = await oauthService.authenticateClientForToken({
			clientId: String(req.body.client_id || '').trim(),
			clientSecret: req.body.client_secret,
			clientAssertionType: req.body.client_assertion_type,
			clientAssertion: req.body.client_assertion,
		});

		if (grantType === 'authorization_code') {
			const authCode = await oauthService.exchangeAuthorizationCode({
				code: req.body.code,
				clientId: client.client_id,
				redirectUri: req.body.redirect_uri,
				codeVerifier: req.body.code_verifier,
			});

			const tokens = await oauthService.issueTokenPair({
				userId: authCode.user,
				tenantId: authCode.tenant,
				host_id: authCode.host_id,
				client,
				scopes: authCode.scope,
				resource: authCode.resource,
			});
			return res.json(tokens);
		}

		if (grantType === 'refresh_token') {
			const tokens = await oauthService.exchangeRefreshToken({
				refreshToken: req.body.refresh_token,
				client,
			});
			return res.json(tokens);
		}

		throw new oauthService.OAuthError('unsupported_grant_type', 'Only authorization_code and refresh_token grants are supported', 400);
	} catch (err) {
		console.error('OAuth token error:', err);
		return sendTokenError(res, err);
	}
});

router.post('/oauth/register', async (req, res) => {
	try {
		const { client, client_secret } = await oauthService.registerClient({
			payload: req.body,
			source: 'dynamic',
		});
		return res.status(201).json({
			...client,
			client_secret,
			client_id_issued_at: Math.floor(Date.now() / 1000),
			client_secret_expires_at: client_secret ? 0 : undefined,
		});
	} catch (err) {
		console.error('OAuth register error:', err);
		return sendTokenError(res, err);
	}
});

export default router;
