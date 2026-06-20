import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireTenant, Tenant } from '../modules/tenancy.js';
import { User } from '../model/user.js';
import { EmailIdentity } from '../model/email_identity.js';
import { listProjects, getProject, getProjectCounts } from '../services/project_service.js';
import { listGitRepos } from '../services/git_sync_service.js';
import { listEmailIdentities } from '../services/email_identity_service.js';
import { formatTrialEndsIn, getBillingUserForHost, hasProductAccess, hasProFeatureAccess } from '../services/subscription_access_service.js';
import config from '../config.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('web');

const router = Router();

router.use(requireAuth, requireTenant);

function requireRestrictedSettingsAccess(req, res, next) {
	if (req.memberRole === 'owner' || req.memberRole === 'admin') return next();
	if (req.path.startsWith('/ajax/')) {
		return res.status(403).send('<div class="alert alert-warning mb-0">This setting is available to account admins only.</div>');
	}
	return res.redirect('/settings/profile');
}

function isByoAiSettingsAccessEnabled(req) {
	// All hosted plans can configure their own keys (Free is BYOK; Pro may
	// override managed keys). Self-hosted uses env vars in production.
	return req.isHosted || config.env !== 'production';
}

function requireByoAiWebAccess(req, res, next) {
	if (isByoAiSettingsAccessEnabled(req)) return next();
	if (req.path.startsWith('/ajax/')) {
		return res.status(403).send('<div class="alert alert-warning mb-0">BYO AI keys are configured through environment variables in self-hosted installs.</div>');
	}
	return res.redirect(req.isHosted ? '/settings/subscription' : '/settings/profile');
}

// Email settings (auto-triage, spam guard) are part of the Pro Email Command Center.
function requireEmailSettingsWebAccess(req, res, next) {
	if (res.locals.email_feature_enabled) return next();
	if (req.path.startsWith('/ajax/')) {
		return res.status(403).send('<div class="alert alert-warning mb-0">Email settings are available on the Pro plan.</div>');
	}
	return res.redirect('/settings/subscription');
}

function getUsageTotals(projects, counts) {
	const totals = { notes: 0, memory: 0, urls: 0, emails: 0, projects: projects.length };
	for (const pc of Object.values(counts || {})) {
		totals.notes += pc.notes || 0;
		totals.memory += pc.memory || 0;
		totals.urls += pc.urls || 0;
		totals.emails += pc.emails || 0;
	}
	return totals;
}

async function renderUsageSettings(req, res, view) {
	let counts = {};
	let usageLoadError = false;
	try {
		counts = await getProjectCounts(req.host_id);
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Usage settings counts error');
		usageLoadError = true;
	}
	res.render(view, {
		title: 'Usage',
		usageTotals: getUsageTotals(res.locals.projects || [], counts),
		usageLoadError,
	});
}

// Inject user + sidebar data into all views
router.use(async (req, res, next) => {
	const [user, projects, tenant, billingUser] = await Promise.all([
		User.findById(req.userId),
		listProjects(req.host_id),
		Tenant.findOne({ host_id: req.host_id }).select('plan settings.byo_ai').lean(),
		getBillingUserForHost(req.host_id, req.userId),
	]);
	const activeTenant = (req.accessibleTenants || []).find((item) => item.tenantId === req.tenantId) || null;
	const plan = tenant?.plan || 'free';
	const is_hosted = req.isHosted;
	const proOnlyFeatureEnabled = hasProFeatureAccess(billingUser, plan, is_hosted);
	// Free (BYOK) tenants with no managed AI must supply at least one key.
	const hasByoKey = Boolean(
		tenant?.settings?.byo_ai?.global?.openai_api_key ||
		tenant?.settings?.byo_ai?.global?.gemini_api_key,
	);
	res.locals.user = user;
	res.locals.billing_user = billingUser;
	res.locals.projects = projects;
	res.locals.plan = plan;
	res.locals.member_role = req.memberRole;
	res.locals.can_manage_team = req.memberRole === 'owner' || req.memberRole === 'admin';
	res.locals.can_manage_restricted_settings = req.memberRole === 'owner' || req.memberRole === 'admin';
	res.locals.accessible_tenants = req.accessibleTenants || [];
	res.locals.active_tenant = activeTenant;
	// email_feature_enabled = the Pro Email Command Center (AI triage, managed inbox).
	// email_view_enabled = the project Emails section (ingest/view as knowledge) — Free.
	res.locals.email_feature_enabled = proOnlyFeatureEnabled;
	res.locals.email_view_enabled = true;
	res.locals.git_sync_enabled = proOnlyFeatureEnabled;
	// Pro/trial/self-hosted get unlimited projects; Free is capped (hide the +).
	res.locals.projects_unlimited = proOnlyFeatureEnabled;
	res.locals.byo_ai_enabled = isByoAiSettingsAccessEnabled(req);
	res.locals.needs_api_key = is_hosted && !proOnlyFeatureEnabled && !hasByoKey;
	res.locals.host_id = req.host_id;
	res.locals.ws_url = config.wsUrl;
	res.locals.impersonating = req.session.impersonating || false;
	res.locals.impersonatingName = req.session.impersonatingName || '';
	res.locals.is_hosted = is_hosted;
	res.locals.is_trialing = is_hosted && billingUser?.subscription_status === 'trialing' && billingUser?.trial_source === 'no_card' && hasProductAccess(billingUser);
	res.locals.trial_ends_text = res.locals.is_trialing ? formatTrialEndsIn(billingUser) : '';
	// Free, never-trialed accounts can start the one-time in-app Pro trial.
	const billingStatus = billingUser?.subscription_status || 'incomplete';
	res.locals.trial_available = is_hosted && plan !== 'pro' && billingStatus === 'incomplete' && !billingUser?.trial_ends_at;
	res.locals.can_upgrade = is_hosted && plan !== 'pro' && !res.locals.is_trialing;
	res.locals.hide_chat_sidebar = req.path === '/settings' || req.path.startsWith('/settings/');
	next();
});

// Note: Free is a permanent, fully-usable plan, so there is no global
// subscription gate. Pro-only features (Email, Git Sync, managed AI) are gated
// individually.

// Onboarding gate: hosted Free users with no AI key see only the key-entry page
// until they add a key (or sign out). needs_api_key is per-request (false when the
// request host isn't hosted), so these can register unconditionally.
router.get('/onboarding/api-key', (req, res) => {
	if (!res.locals.needs_api_key) return res.redirect('/dashboard');
	res.render('onboarding/api_key', { title: 'Add your AI key' });
});

router.use((req, res, next) => {
	if (!res.locals.needs_api_key) return next();
	if (req.path === '/onboarding/api-key') return next();
	if (req.path.startsWith('/ajax/')) {
		return res.status(409).json({ error: 'API key required', redirect: '/onboarding/api-key' });
	}
	return res.redirect('/onboarding/api-key');
});

router.get('/dashboard', (req, res) => res.render('dashboard', { title: 'Dashboard' }));
router.get('/notes', (req, res) => res.render('notes', { title: 'Notes' }));
router.get('/memories', (req, res) => res.render('memories', { title: 'Memory' }));
router.get('/urls', (req, res) => res.render('urls', { title: 'URLs' }));
router.get('/emails', (req, res) => res.render('emails', { title: 'Emails' }));
router.get('/ecc', (req, res) => res.render('ecc', { title: 'Email Command Center', page: 'ecc' }));
router.get('/trash', (req, res) => res.render('trash', { title: 'Trash' }));
router.get('/graph', (req, res) => res.render('graph', { title: 'Knowledge Graph', page: 'graph' }));
router.get('/settings', (req, res) => res.redirect('/settings/profile'));
router.get('/settings/profile', (req, res) => res.render('settings/profile', { title: 'Profile' }));
router.get('/settings/security', (req, res) => res.render('settings/security', { title: 'Security' }));
router.get('/settings/team', (req, res) => res.render('settings/team', { title: 'My Team' }));
router.get('/settings/tokens', (req, res) => res.render('settings/tokens', { title: 'Access Tokens' }));
router.get('/settings/byo-ai', requireRestrictedSettingsAccess, requireByoAiWebAccess, (req, res) => res.render('settings/byo_ai', { title: 'AI' }));
router.get('/settings/email', requireRestrictedSettingsAccess, requireByoAiWebAccess, requireEmailSettingsWebAccess, (req, res) => res.render('settings/email', { title: 'Email settings' }));
router.get('/settings/typesense', requireRestrictedSettingsAccess, (req, res) => res.render('settings/typesense', { title: 'Typesense' }));
router.get('/settings/usage', (req, res) => renderUsageSettings(req, res, 'settings/usage'));
router.get('/settings/export', requireRestrictedSettingsAccess, (req, res) => res.render('settings/export', { title: 'Export' }));
router.get('/settings/activity-logs', requireRestrictedSettingsAccess, (req, res) => res.render('settings/activity_logs', { title: 'Activity Logs' }));
router.get('/settings/subscription', (req, res) => {
	if (!req.isHosted) return res.redirect('/settings/profile');
	res.render('settings/subscription', { title: 'Subscription' });
});

// ---- Ajax section partials (SPA navigation) ----

router.get('/ajax/section/dashboard', (req, res) => res.render('ajax/section/dashboard'));
router.get('/ajax/section/notes', (req, res) => res.render('ajax/section/notes'));
router.get('/ajax/section/memories', (req, res) => res.render('ajax/section/memories'));
router.get('/ajax/section/urls', (req, res) => res.render('ajax/section/urls'));
router.get('/ajax/section/emails', (req, res) => res.render('ajax/section/emails'));
router.get('/ajax/section/ecc', (req, res) => res.render('ajax/section/ecc'));
router.get('/ajax/section/trash', (req, res) => res.render('ajax/section/trash'));
router.get('/ajax/section/settings/profile', (req, res) => res.render('ajax/section/settings/profile', { title: 'Profile' }));
router.get('/ajax/section/settings/security', (req, res) => res.render('ajax/section/settings/security', { title: 'Security' }));
router.get('/ajax/section/settings/team', (req, res) => res.render('ajax/section/settings/team', { title: 'My Team' }));
router.get('/ajax/section/settings/tokens', (req, res) => res.render('ajax/section/settings/tokens', { title: 'Access Tokens' }));
router.get('/ajax/section/settings/byo-ai', requireRestrictedSettingsAccess, requireByoAiWebAccess, (req, res) => res.render('ajax/section/settings/byo_ai', { title: 'AI' }));
router.get('/ajax/section/settings/email', requireRestrictedSettingsAccess, requireByoAiWebAccess, requireEmailSettingsWebAccess, (req, res) => res.render('ajax/section/settings/email', { title: 'Email settings' }));
router.get('/ajax/section/settings/typesense', requireRestrictedSettingsAccess, (req, res) => res.render('ajax/section/settings/typesense', { title: 'Typesense' }));
router.get('/ajax/section/settings/usage', (req, res) => renderUsageSettings(req, res, 'ajax/section/settings/usage'));
router.get('/ajax/section/settings/export', requireRestrictedSettingsAccess, (req, res) => res.render('ajax/section/settings/export', { title: 'Export' }));
router.get('/ajax/section/settings/activity-logs', requireRestrictedSettingsAccess, (req, res) => res.render('ajax/section/settings/activity_logs', { title: 'Activity Logs' }));
router.get('/ajax/section/settings/subscription', (req, res) => {
	if (!req.isHosted) return res.status(403).send('<div class="alert alert-warning mb-0">Subscriptions are managed on the hosted edition.</div>');
	res.render('ajax/section/settings/subscription', { title: 'Subscription' });
});

// ---- Ajax partials ----

router.get('/ajax/project-list', async (req, res) => {
	const [projects, counts, tenant] = await Promise.all([
		listProjects(req.host_id),
		getProjectCounts(req.host_id).catch(() => ({})),
		Tenant.findOne({ host_id: req.host_id }).select('plan').lean(),
	]);
	const plan = tenant?.plan || 'free';
	const emailFeatureEnabled = hasProFeatureAccess(res.locals.billing_user, plan, req.isHosted);
	res.render('ajax/project_list', { projects, counts, activeProjectId: req.query.active || '', emailFeatureEnabled, emailViewEnabled: true, is_hosted: req.isHosted });
});

router.get('/ajax/project-overview/:id', async (req, res) => {
	try {
		const [project, counts, tenant] = await Promise.all([
			getProject(req.host_id, req.params.id),
			getProjectCounts(req.host_id).catch(() => ({})),
			Tenant.findOne({ host_id: req.host_id }).select('plan').lean(),
		]);
		if (!project) return res.status(404).send('');
		const plan = tenant?.plan || 'free';
		const proOnlyFeatureEnabled = hasProFeatureAccess(res.locals.billing_user, plan, req.isHosted);
		const gitSyncEnabled = proOnlyFeatureEnabled;
		const emailFeatureEnabled = proOnlyFeatureEnabled;
		const emailForwardDomain = String(config.emailForwardDomain || '').trim().replace(/^@+/, '');
		const gitRepos = await listGitRepos(req.host_id, req.params.id).catch(() => []);
		const emailIdentityCount = await EmailIdentity.countDocuments({ host_id: req.host_id, project: req.params.id }).catch(() => 0);
		const pc = counts[project._id.toString()] || { notes: 0, memory: 0, urls: 0, emails: 0 };
		const canDelete = !project.is_default && pc.notes === 0 && pc.memory === 0 && pc.urls === 0 && pc.emails === 0 && gitRepos.length === 0 && emailIdentityCount === 0;
		const canManageProjectSettings = req.memberRole === 'owner' || req.memberRole === 'admin';
		res.render('ajax/project_overview', { project, counts, gitSyncEnabled, emailFeatureEnabled, emailViewEnabled: true, emailForwardDomain, gitRepos, canDelete, canManageProjectSettings, is_hosted: req.isHosted });
	} catch (err) {
		res.status(500).send('<div class="text-danger">Failed to load project</div>');
	}
});

router.get('/ajax/project-settings/:id', requireRestrictedSettingsAccess, async (req, res) => {
	try {
		const [project, tenant] = await Promise.all([
			getProject(req.host_id, req.params.id),
			Tenant.findOne({ host_id: req.host_id }).select('plan').lean(),
		]);
		if (!project) return res.status(404).send('<div class="alert alert-danger mb-0">Project not found.</div>');

		const plan = tenant?.plan || 'free';
		const proOnlyFeatureEnabled = hasProFeatureAccess(res.locals.billing_user, plan, req.isHosted);
		const emailForwardDomain = String(config.emailForwardDomain || '').trim().replace(/^@+/, '');
		const [gitRepos, emailIdentities] = await Promise.all([
			proOnlyFeatureEnabled ? listGitRepos(req.host_id, req.params.id).catch(() => []) : [],
			proOnlyFeatureEnabled ? listEmailIdentities(req.host_id, req.params.id).catch(() => []) : [],
		]);
		res.render('ajax/project_settings', {
			project,
			gitRepos,
			emailIdentities,
			gitSyncEnabled: proOnlyFeatureEnabled,
			emailFeatureEnabled: proOnlyFeatureEnabled,
			emailForwardDomain,
			is_hosted: req.isHosted,
		});
	} catch (err) {
		log.error({ err, host_id: req.host_id, project_id: req.params.id }, 'Project settings modal error');
		res.status(500).send('<div class="alert alert-danger mb-0">Failed to load project settings.</div>');
	}
});

export default router;
