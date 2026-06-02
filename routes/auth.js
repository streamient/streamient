import { Router } from 'express';
import crypto from 'node:crypto';
import { generateSecret, verifySync, generateURI } from 'otplib';
import { User } from '../model/user.js';
import { createTenant, initializeSessionTenant } from '../modules/tenancy.js';
import { ensureCollections } from '../modules/typesense.js';
import { generateToken } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendTrialSignupNotificationEmail } from '../services/email_service.js';
import { sendMagicLink, isMagicLinkValid, verifyMagicLink } from '../services/magic_link_service.js';
import * as passkeyService from '../services/passkey_service.js';
import config from '../config.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('auth');

const is_hosted = config.isHosted;
import { createDefaultProject } from '../services/project_service.js';
import { PendingSignup } from '../model/pending_signup.js';
import { isSysadminCredentials, requireSysadmin } from '../middleware/sysadmin.js';

const router = Router();

export function buildHostedTrialFields(now = new Date(), trialDays = config.stripe.trialDays) {
	return {
		subscription_status: 'trialing',
		trial_source: 'no_card',
		trial_ends_at: new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000),
	};
}

async function hydrateSessionForUser(req, user, preferredTenantId = null, preferredHostId = null) {
	req.session.userId = user._id.toString();
	return initializeSessionTenant(
		req.session,
		user._id.toString(),
		preferredTenantId || user.tenant?.toString() || null,
		preferredHostId || user.host_id || null,
	);
}

async function recordSuccessfulLogin(req, userOrId) {
	const userId = typeof userOrId === 'object' ? userOrId._id : userOrId;
	const timestamp = new Date();
	if (req.session) {
		req.session.lastLoginRecordedAt = timestamp.toISOString();
	}
	await User.findByIdAndUpdate(userId, { $set: { last_login: timestamp } });
	return timestamp;
}

function peekPostAuthRedirect(req, fallback = '/dashboard') {
	return req.session?.oauthLoginReturnTo || fallback;
}

function consumePostAuthRedirect(req, fallback = '/dashboard') {
	const redirectTo = peekPostAuthRedirect(req, fallback);
	if (req.session?.oauthLoginReturnTo) {
		delete req.session.oauthLoginReturnTo;
	}
	return redirectTo;
}

// ---- Registration (email confirmation required before account creation) ----

router.post('/signup', async (req, res) => {
	try {
		const { email, name } = req.body;
		if (!email || !name) {
			return res.status(400).json({ error: 'email and name are required' });
		}

		const existing = await User.findOne({ email });
		if (existing) {
			return res.status(409).json({ error: 'Email already registered' });
		}

		// Generate a random password (user never sees it; they use magic link / passkey / reset)
		const password = crypto.randomBytes(24).toString('base64url');
		const verificationToken = crypto.randomBytes(32).toString('hex');

		// Remove any existing pending signup for this email
		await PendingSignup.deleteMany({ email });

		// Store pending signup (expires in 24 hours)
		await PendingSignup.create({
			email,
			name,
			password,
			token: verificationToken,
			expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
		});

		await sendVerificationEmail(email, verificationToken);

		res.status(200).json({
			message: 'We sent a confirmation link to your email. Please verify to activate your account.',
		});
	} catch (err) {
		log.error({ err, email: req.body?.email }, 'Registration error');
		res.status(500).json({ error: 'Registration failed' });
	}
});

// ---- Email Verification (two-step: GET shows confirm page, POST creates account) ----
// GET only renders a button so that email-client prefetch / link-preview cannot consume the token.

router.get('/verify', async (req, res) => {
	try {
		const { token } = req.query;
		if (!token) return res.render('auth/verify', { error: 'Token required' });

		const pending = await PendingSignup.findOne({ token, expires_at: { $gt: new Date() } });
		if (!pending) {
			// Token may already have been used — check if account exists
			return res.render('auth/verify', { error: 'This verification link has already been used or has expired.' });
		}

		// Check if email was taken in the meantime
		const existing = await User.findOne({ email: pending.email });
		if (existing) {
			await PendingSignup.deleteOne({ _id: pending._id });
			return res.redirect('/login?already_verified=true');
		}

		res.render('auth/verify', { token });
	} catch (err) {
		log.error({ err }, 'Verification page error');
		res.render('auth/verify', { error: 'Something went wrong. Please try again.' });
	}
});

router.post('/verify', async (req, res) => {
	try {
		const { token } = req.body;
		if (!token) return res.render('auth/verify', { error: 'Token required' });

		const pending = await PendingSignup.findOne({ token, expires_at: { $gt: new Date() } });
		if (!pending) return res.render('auth/verify', { error: 'This verification link has already been used or has expired.' });

		// Check again if email was taken in the meantime
		const existing = await User.findOne({ email: pending.email });
		if (existing) {
			await PendingSignup.deleteOne({ _id: pending._id });
			return res.redirect('/login?already_verified=true');
		}

		// Create the actual account
		const user = await User.create({
			email: pending.email,
			password: pending.password,
			name: pending.name,
			is_verified: true,
		});

		const tenant = await createTenant(user._id, pending.name);
		user.tenant = tenant._id;
		user.host_id = tenant.host_id;
		user.is_active = true;
		let createdHostedTrial = false;
		if (is_hosted) {
			Object.assign(user, buildHostedTrialFields());
			createdHostedTrial = true;
		}
		await user.save();
		if (createdHostedTrial) {
			sendTrialSignupNotificationEmail(user.email).catch((e) =>
				log.warn({ err: e, email: user.email }, 'Trial signup notification email failed'),
			);
		}

		ensureCollections(tenant.host_id).catch((e) =>
			log.warn({ err: e, host_id: tenant.host_id }, 'Typesense collection setup deferred'),
		);

		await createDefaultProject(user._id, tenant.host_id);

		// Clean up pending signup
		await PendingSignup.deleteOne({ _id: pending._id });

		// Send welcome email (fire-and-forget)
		sendWelcomeEmail(user.email, user.name).catch((e) =>
			log.warn({ err: e, email: user.email }, 'Welcome email failed'),
		);

		// Sign the user in directly
		await hydrateSessionForUser(req, user, tenant._id.toString(), tenant.host_id);
		await recordSuccessfulLogin(req, user);

		res.redirect('/dashboard');
	} catch (err) {
		log.error({ err }, 'Verification error');
		res.render('auth/verify', { error: 'Verification failed. Please try again.' });
	}
});

// ---- Login ----

router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({ error: 'email and password required' });
		}

		// ---- Sysadmin check (env-var based, no DB record) ----
		if (isSysadminCredentials(email, password)) {
			req.session.isSysadmin = true;
			if (req.is('application/x-www-form-urlencoded')) return res.redirect('/sysadmin');
			return res.json({ isSysadmin: true });
		}

		const user = await User.findOne({ email, is_active: true }).select('+password +totp_secret');
		if (!user || !(await user.comparePassword(password))) {
			if (req.is('application/x-www-form-urlencoded')) return res.render('auth/login', { error: 'Invalid credentials', oauth_continue: !!req.session?.oauthLoginReturnTo, redirect_to: peekPostAuthRedirect(req) });
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		// Check if 2FA is required
		if (user.totp_enabled) {
			const tempToken = crypto.randomBytes(32).toString('hex');
			req.session.pending2FA = { userId: user._id.toString(), token: tempToken };
			if (req.is('application/x-www-form-urlencoded')) return res.render('auth/2fa', { tempToken });
			return res.json({ requires2FA: true, tempToken });
		}

		// Set session
		const tenantContext = await hydrateSessionForUser(req, user);
		if (!tenantContext?.activeTenant) {
			if (req.is('application/x-www-form-urlencoded')) return res.render('auth/login', { error: 'Your account does not have access to any active teams yet.', oauth_continue: !!req.session?.oauthLoginReturnTo, redirect_to: peekPostAuthRedirect(req) });
			return res.status(403).json({ error: 'No active account access found' });
		}

		// Track last login
		await recordSuccessfulLogin(req, user);

		if (req.is('application/x-www-form-urlencoded')) return res.redirect(consumePostAuthRedirect(req));

		res.json({
			user: user.toSafe(),
			token: generateToken(user._id.toString(), tenantContext.activeTenant.host_id, tenantContext.activeTenant.tenantId),
			redirect_to: consumePostAuthRedirect(req),
		});
	} catch (err) {
		log.error({ err, email: req.body?.email }, 'Login error');
		res.status(500).json({ error: 'Login failed' });
	}
});

// ---- Password Reset (generate random password, show to user) ----

router.post('/reset-password', async (req, res) => {
	try {
		if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

		const user = await User.findById(req.session.userId).select('+password');
		if (!user) return res.status(404).json({ error: 'User not found' });

		const newPassword = crypto.randomBytes(16).toString('base64url');
		user.password = newPassword;
		await user.save();

		res.json({ password: newPassword });
	} catch (err) {
		log.error({ err, user_id: req.session?.userId }, 'Password reset error');
		res.status(500).json({ error: 'Password reset failed' });
	}
});

// ---- Forgot Password (public, unauthenticated) ----

router.post('/forgot-password', async (req, res) => {
	try {
		const { email } = req.body;
		if (!email) return res.status(400).json({ error: 'email is required' });

		const user = await User.findOne({ email, is_active: true });
		if (user) {
			const resetToken = crypto.randomBytes(32).toString('hex');
			user.password_reset_token = resetToken;
			user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
			await user.save();
			sendPasswordResetEmail(email, resetToken).catch((e) =>
				log.warn({ err: e, email }, 'Password reset email failed'),
			);
		}

		// Always return success to prevent email enumeration
		res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
	} catch (err) {
		log.error({ err, email: req.body?.email }, 'Forgot password error');
		res.status(500).json({ error: 'Failed to send reset email' });
	}
});

router.get('/reset-password', async (req, res) => {
	try {
		const { token } = req.query;
		if (!token) return res.redirect('/forgot-password');

		const user = await User.findOne({
			password_reset_token: token,
			password_reset_expires: { $gt: new Date() },
		}).select('+password_reset_token +password_reset_expires');

		if (!user) {
			return res.render('auth/reset_password', { error: 'Invalid or expired reset link.' });
		}

		// Generate and show the new random password (user must click Continue)
		const newPassword = crypto.randomBytes(16).toString('base64url');

		// Store temporarily — will be applied on confirm
		req.session.pendingReset = {
			userId: user._id.toString(),
			token,
			newPassword,
		};

		res.render('auth/reset_password', { password: newPassword, token });
	} catch (err) {
		log.error({ err }, 'Reset password page error');
		res.render('auth/reset_password', { error: 'Something went wrong. Please try again.' });
	}
});

router.post('/reset-password/confirm', async (req, res) => {
	try {
		const { token } = req.body;
		const pending = req.session.pendingReset;

		if (!pending || pending.token !== token) {
			return res.render('auth/reset_password', { error: 'Invalid reset session. Please request a new link.' });
		}

		const user = await User.findById(pending.userId).select('+password +password_reset_token +password_reset_expires');
		if (!user || user.password_reset_token !== token || user.password_reset_expires < new Date()) {
			return res.render('auth/reset_password', { error: 'Reset link has expired.' });
		}

		user.password = pending.newPassword;
		user.password_reset_token = undefined;
		user.password_reset_expires = undefined;
		await user.save();

		delete req.session.pendingReset;
		res.redirect('/login?reset=true');
	} catch (err) {
		log.error({ err }, 'Reset password confirm error');
		res.render('auth/reset_password', { error: 'Password reset failed. Please try again.' });
	}
});

// ---- 2FA Verify ----

router.post('/2fa/verify', async (req, res) => {
	try {
		const { code, tempToken } = req.body;
		const pending = req.session.pending2FA;

		if (!pending || pending.token !== tempToken) {
			return res.status(401).json({ error: 'Invalid 2FA session' });
		}

		const user = await User.findById(pending.userId).select('+totp_secret');
		if (!user) return res.status(401).json({ error: 'User not found' });

		const result = verifySync({ token: code, secret: user.totp_secret });
		if (!result.valid) return res.status(401).json({ error: 'Invalid 2FA code' });

		delete req.session.pending2FA;
		const tenantContext = await hydrateSessionForUser(req, user);
		if (!tenantContext?.activeTenant) {
			return res.status(403).json({ error: 'No active account access found' });
		}
		await recordSuccessfulLogin(req, user);

		res.json({
			user: user.toSafe(),
			token: generateToken(user._id.toString(), tenantContext.activeTenant.host_id, tenantContext.activeTenant.tenantId),
			redirect_to: consumePostAuthRedirect(req),
		});
	} catch (err) {
		log.error({ err }, '2FA error');
		res.status(500).json({ error: '2FA verification failed' });
	}
});

// ---- 2FA Setup ----

router.post('/2fa/setup', async (req, res) => {
	try {
		if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

		const user = await User.findById(req.session.userId).select('+totp_secret');
		if (!user) return res.status(404).json({ error: 'User not found' });

		const secret = generateSecret();
		const otpauth = generateURI({ issuer: 'Kumbukum', label: user.email, secret });

		user.totp_secret = secret;
		await user.save();

		res.json({ secret, otpauth });
	} catch (err) {
		log.error({ err, user_id: req.session?.userId }, '2FA setup error');
		res.status(500).json({ error: '2FA setup failed' });
	}
});

router.post('/2fa/confirm', async (req, res) => {
	try {
		if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

		const { code } = req.body;
		const user = await User.findById(req.session.userId).select('+totp_secret');
		if (!user) return res.status(404).json({ error: 'User not found' });

		const result = verifySync({ token: code, secret: user.totp_secret });
		if (!result.valid) return res.status(400).json({ error: 'Invalid code — try again' });

		user.totp_enabled = true;
		await user.save();

		res.json({ message: '2FA enabled successfully' });
	} catch (err) {
		log.error({ err, user_id: req.session?.userId }, '2FA confirm error');
		res.status(500).json({ error: '2FA confirmation failed' });
	}
});

// ---- Magic Link ----

router.post('/magic-link', async (req, res) => {
	try {
		const { email } = req.body;
		if (!email) return res.status(400).json({ error: 'email required' });

		await sendMagicLink(email);
		res.json({ message: 'If an account exists, a login link has been sent.' });
	} catch (err) {
		log.error({ err, email: req.body?.email }, 'Magic link error');
		res.status(500).json({ error: 'Failed to send magic link' });
	}
});

router.head('/magic', (req, res) => {
	res.set('Allow', 'GET, POST');
	return res.status(405).end();
});

router.get('/magic', async (req, res) => {
	try {
		const { token } = req.query;
		if (!token) return res.render('auth/magic', { error: 'Token required' });

		const isValid = await isMagicLinkValid(token);
		if (!isValid) {
			return res.render('auth/magic', { error: 'Invalid or expired magic link' });
		}

		return res.render('auth/magic', { token });
	} catch (err) {
		log.error({ err }, 'Magic link page error');
		return res.render('auth/magic', { error: 'Something went wrong. Please try again.' });
	}
});

router.post('/magic', async (req, res) => {
	try {
		const { token } = req.body;
		if (!token) return res.render('auth/magic', { error: 'Token required' });

		const user = await verifyMagicLink(token);
		if (!user) return res.render('auth/magic', { error: 'Invalid or expired magic link' });

		const tenantContext = await hydrateSessionForUser(req, user);
		if (!tenantContext?.activeTenant) {
			return res.render('auth/magic', { error: 'Your account does not have access to any active teams yet.' });
		}
		await recordSuccessfulLogin(req, user);

		return res.redirect(consumePostAuthRedirect(req));
	} catch (err) {
		log.error({ err }, 'Magic link verify error');
		return res.render('auth/magic', { error: 'Magic link verification failed' });
	}
});

router.all('/magic', (req, res) => {
	res.set('Allow', 'GET, POST');
	return res.status(405).json({ error: 'Method Not Allowed' });
});

// ---- Passkey ----

router.post('/passkey/register/options', async (req, res) => {
	try {
		if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
		const user = await User.findById(req.session.userId);
		if (!user) return res.status(404).json({ error: 'User not found' });

		const options = await passkeyService.getRegistrationOptions(user);
		req.session.passkeyChallenge = options.challenge;
		res.json(options);
	} catch (err) {
		log.error({ err, user_id: req.session?.userId }, 'Passkey register options error');
		res.status(500).json({ error: 'Failed to generate passkey options' });
	}
});

router.post('/passkey/register/verify', async (req, res) => {
	try {
		if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
		const user = await User.findById(req.session.userId);
		if (!user) return res.status(404).json({ error: 'User not found' });

		const challenge = req.session.passkeyChallenge;
		delete req.session.passkeyChallenge;

		const attestation = req.body.attestation;
		if (!attestation) return res.status(400).json({ error: 'Missing attestation data' });

		const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 100) : undefined;
		const browser_info = typeof req.body.browser_info === 'string' ? req.body.browser_info.trim().slice(0, 200) : undefined;

		await passkeyService.verifyAndSaveRegistration(user, attestation, challenge, { name, browser_info });
		res.json({ message: 'Passkey registered' });
	} catch (err) {
		log.error({ err, user_id: req.session?.userId }, 'Passkey register verify error');
		res.status(500).json({ error: 'Passkey registration failed' });
	}
});

router.post('/passkey/login/options', async (req, res) => {
	try {
		const options = await passkeyService.getAuthenticationOptions();
		req.session.passkeyChallenge = options.challenge;
		res.json(options);
	} catch (err) {
		log.error({ err }, 'Passkey login options error');
		res.status(500).json({ error: 'Failed to generate authentication options' });
	}
});

router.post('/passkey/login/verify', async (req, res) => {
	try {
		const challenge = req.session.passkeyChallenge;
		delete req.session.passkeyChallenge;

		const assertion = req.body.assertion;
		if (!assertion) return res.status(400).json({ error: 'Missing assertion data' });

		const { verification, passkey } = await passkeyService.verifyAuthentication(assertion, challenge);
		if (!verification.verified) {
			return res.status(401).json({ error: 'Passkey authentication failed' });
		}

		const user = await User.findById(passkey.user);
		if (!user) return res.status(404).json({ error: 'User not found' });

		const tenantContext = await hydrateSessionForUser(req, user);
		if (!tenantContext?.activeTenant) {
			return res.status(403).json({ error: 'No active account access found' });
		}
		await recordSuccessfulLogin(req, user);

		res.json({
			user: user.toSafe(),
			token: generateToken(user._id.toString(), tenantContext.activeTenant.host_id, tenantContext.activeTenant.tenantId),
			redirect_to: consumePostAuthRedirect(req),
		});
	} catch (err) {
		log.error({ err }, 'Passkey login verify error');
		res.status(500).json({ error: 'Passkey authentication failed' });
	}
});

// ---- Team Invite (disabled) ----

router.all('/team-invite', (req, res) => {
	res.status(410).format({
		html: () => res.send('Team invites are disabled. Team admins add users directly from Settings > My Team.'),
		json: () => res.json({ error: 'Team invites are disabled' }),
		default: () => res.type('text').send('Team invites are disabled'),
	});
});

// ---- Logout ----

router.post('/logout', (req, res) => {
	if (req.session?.oauthLoginReturnTo) {
		delete req.session.oauthLoginReturnTo;
	}
	req.session.destroy(() => {
		res.clearCookie('connect.sid');
		if (req.accepts('html')) return res.redirect('/login');
		res.json({ message: 'Logged out' });
	});
});

// ---- Render auth pages ----

router.get('/login', (req, res) => res.render('auth/login', { oauth_continue: !!req.session?.oauthLoginReturnTo, redirect_to: peekPostAuthRedirect(req) }));
router.get('/signup', (req, res) => res.render('auth/register'));
router.get('/forgot-password', (req, res) => res.render('auth/forgot_password'));

// ---- Sysadmin: account picker page ----

router.get('/sysadmin', requireSysadmin, (req, res) => {
	res.render('auth/sysadmin_login');
});

// ---- Sysadmin: user search for impersonation ----

router.get('/api/v1/admin/users/search', requireSysadmin, async (req, res) => {
	try {
		const q = (req.query.q || '').trim();
		if (!q || q.length < 2) return res.json([]);

		const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
		const users = await User.find({
			$or: [{ name: regex }, { email: regex }],
		})
			.select('name email is_active')
			.limit(20)
			.lean();

		res.json(users);
	} catch (err) {
		log.error({ err }, 'Sysadmin user search error');
		res.status(500).json({ error: 'Search failed' });
	}
});

// ---- Sysadmin: impersonate a user ----

router.post('/api/v1/admin/impersonate', requireSysadmin, async (req, res) => {
	try {
		const { userId } = req.body;
		if (!userId) return res.status(400).json({ error: 'userId required' });

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: 'User not found' });

		await hydrateSessionForUser(req, user, user.tenant?.toString(), user.host_id);
		req.session.impersonating = true;
		req.session.impersonatingName = user.name;

		res.json({ ok: true, redirect: '/dashboard' });
	} catch (err) {
		log.error({ err, user_id: req.body?.userId }, 'Impersonate error');
		res.status(500).json({ error: 'Impersonation failed' });
	}
});

// ---- Sysadmin: exit impersonation ----

router.post('/api/v1/admin/exit-impersonation', requireSysadmin, (req, res) => {
	delete req.session.userId;
	delete req.session.tenantId;
	delete req.session.host_id;
	delete req.session.memberRole;
	delete req.session.impersonating;
	delete req.session.impersonatingName;

	res.json({ ok: true, redirect: '/sysadmin' });
});

// ---- Ajax partials ----

router.get('/ajax/signup-success', (req, res) => res.render('ajax/signup_success'));
router.get('/ajax/forgot-password-success', (req, res) => res.render('ajax/forgot_password_success'));

export default router;
