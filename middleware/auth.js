import jwt from 'jsonwebtoken';
import config from '../config.js';
import { User } from '../model/user.js';
import { verifyMcpBridgeToken } from '../modules/oauth.js';
import { applyTenantContextToSession, ensureOwnerMembershipForUser, initializeSessionTenant, resolveActiveTenantContext } from '../modules/tenancy.js';
import * as OtelRuntime from '../modules/otel_runtime.js';

async function applyTenantContext(req, userId, preferredTenantId = null, preferredHostId = null, updateSession = false) {
	const context = updateSession
		? await initializeSessionTenant(req.session, userId, preferredTenantId, preferredHostId)
		: await resolveActiveTenantContext(userId, preferredTenantId, preferredHostId);

	if (!context?.activeTenant) return false;

	req.tenantId = context.activeTenant.tenantId;
	req.host_id = context.activeTenant.host_id;
	req.memberRole = context.activeTenant.role;
	req.accessibleTenants = context.accessibleTenants;
	OtelRuntime.setTraceAttributes({ 'enduser.id': userId, 'enduser.host_id': context.activeTenant.host_id, 'enduser.role': context.activeTenant.role });
	return true;
}

export async function requireAuth(req, res, next) {
	if (req.session?.userId) {
		req.userId = req.session.userId;
		req.authMethod = 'session';
		const preferredTenantId = req.whiteLabelHostId ? null : req.session.tenantId;
		const preferredHostId = req.whiteLabelHostId || req.session.host_id;
		const ok = await applyTenantContext(req, req.userId, preferredTenantId, preferredHostId, true);
		if (!ok) {
			if (!req.originalUrl.startsWith('/api/') && req.accepts('html')) {
				return res.status(403).render('auth/login', { error: 'Your account does not have access to any active teams yet.' });
			}
			return res.status(403).json({ error: 'No active account access found' });
		}
		if (req.whiteLabelHostId && req.host_id !== req.whiteLabelHostId) {
			delete req.session.userId;
			delete req.session.lastLoginRecordedAt;
			applyTenantContextToSession(req.session, null);
			if (!req.originalUrl.startsWith('/api/') && req.accepts('html')) {
				return res.status(403).render('auth/login', { error: 'Your account does not have access to this branded account.' });
			}
			return res.status(403).json({ error: 'No access to this branded account' });
		}
		if (!req.session.lastLoginRecordedAt) {
			const timestamp = new Date();
			req.session.lastLoginRecordedAt = timestamp.toISOString();
			await User.findByIdAndUpdate(req.userId, { $set: { last_login: timestamp } });
		}
		return next();
	}

	const authHeader = req.headers.authorization;
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.slice(7);
		try {
			let payload;
			try {
				payload = verifyMcpBridgeToken(token);
				req.authMethod = 'mcp-bridge';
				req.mcpClientId = payload.client_id;
				req.oauthScopes = payload.scope || '';
			} catch {
				payload = jwt.verify(token, config.jwtSecret);
				// 'kumbukum-api' accepted during the rebrand transition so pre-rename tokens keep working
				if (payload.aud && payload.aud !== 'streamient-api' && payload.aud !== 'kumbukum-api') {
					return res.status(401).json({ error: 'This bearer token is not valid for the Streamient API' });
				}
				req.authMethod = 'bearer';
			}

			req.userId = payload.userId || payload.sub;
			const preferredTenantId = req.whiteLabelHostId ? null : payload.tenantId;
			const preferredHostId = req.whiteLabelHostId || payload.host_id;
			const ok = await applyTenantContext(req, req.userId, preferredTenantId, preferredHostId, false);
			if (!ok) return res.status(401).json({ error: 'Token is not valid for any active account' });
			if (req.whiteLabelHostId && req.host_id !== req.whiteLabelHostId) return res.status(403).json({ error: 'Token is not valid for this branded account' });
			return next();
		} catch {
			return res.status(401).json({ error: 'Invalid token' });
		}
	}

	if (authHeader?.startsWith('Token ')) {
		const accessToken = authHeader.slice(6);
		const user = await User.findOne(
			{ 'access_tokens.token': accessToken, is_active: true },
			'host_id tenant access_tokens',
		);
		if (user) {
			await ensureOwnerMembershipForUser(user);
			req.userId = user._id.toString();
			req.authMethod = 'token';
			const matched = user.access_tokens.find((t) => t.token === accessToken);
			if (matched) req.tokenLabel = matched.name;
			const preferredTenantId = req.whiteLabelHostId ? null : user.tenant?.toString();
			const preferredHostId = req.whiteLabelHostId || user.host_id;
			const ok = await applyTenantContext(req, req.userId, preferredTenantId, preferredHostId, false);
			if (!ok) return res.status(401).json({ error: 'Token is not valid for any active account' });
			if (req.whiteLabelHostId && req.host_id !== req.whiteLabelHostId) return res.status(403).json({ error: 'Token is not valid for this branded account' });
			return next();
		}
	}

	if (req.accepts('html')) {
		return res.redirect('/login');
	}
	return res.status(401).json({ error: 'Authentication required' });
}

export function generateToken(userId, host_id, tenantId = null) {
	return jwt.sign({ userId, host_id, tenantId }, config.jwtSecret, { expiresIn: '7d' });
}

export function generateSocketToken(userId, host_id, tenantId = null) {
	return jwt.sign({ userId, host_id, tenantId }, config.jwtSecret, { expiresIn: '15m', audience: 'streamient-socket' });
}
