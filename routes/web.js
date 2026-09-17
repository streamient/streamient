import { Router } from 'express';
import { requireAuth, generateSocketToken } from '../middleware/auth.js';
import { requireTenant, Tenant } from '../modules/tenancy.js';
import { User } from '../model/user.js';
import { listProjects, getProject, getProjectCounts, getProjectDeleteState } from '../services/project_service.js';
import { listGitRepos } from '../services/git_sync_service.js';
import { listConnections as listObsidianConnections } from '../services/obsidian_sync_service.js';
import { formatTrialEndsIn, getBillingUserForHost, hasProductAccess, hasProFeatureAccess } from '../services/subscription_access_service.js';
import { serializeWhiteLabelSettings } from '../services/white_label_service.js';
import { getCustomCode } from '../services/custom_code_service.js';
import { isTenantLimitReached, resolveStoredTenantLimits } from '../modules/tenant_limits.js';
import managani from '../modules/managani.js';
import config from '../config.js';
import { createLogger } from '../modules/logger.js';
import { createDateFormatters } from '../modules/date_format.js';
import { getTimezoneOptions } from '../modules/timezones.js';
import { renderMobileAppsModal } from './mobile_apps.js';
import productUpdatesRouter, { isProductUpdatesEligible } from './product_updates.js';
import {
	buildStreamientDemoFixtures,
	deactivateStreamientDemoSession,
	getStreamientDemoScene,
	getStreamientDemoSession,
	handleStreamientDemoToggle,
} from '../services/streamient_demo_service.js';

const log = createLogger('web');

const router = Router();

router.use(requireAuth, requireTenant);

router.use(handleStreamientDemoToggle);

router.use((req, res, next) => {
	const context = getStreamientDemoSession(req);
	if (!context && req.streamientDemoExpired) {
		deactivateStreamientDemoSession(req);
		if (req.path.startsWith('/ajax/')) return res.status(410).send('<div class="alert alert-warning mb-0">This demo session expired. Reload the app to continue with live data.</div>');
		return res.redirect('/dashboard');
	}
	req.streamientDemoContext = context;
	req.managaniSkip = Boolean(context);
	res.locals.streamient_demo_mode = Boolean(context);
	return next();
});

router.use((req, res, next) => {
	if (!req.streamientDemoContext) return next();
	const blockedAjax = req.path === '/ajax/batch-project-picker' || req.path.startsWith('/ajax/project-settings/') || req.path.startsWith('/ajax/section/settings');
	if (blockedAjax) return res.status(409).send('<div class="alert alert-info mb-0">Account and project settings are unavailable while demo data is active.</div>');
	if (req.path === '/settings' || req.path.startsWith('/settings/')) return res.redirect('/dashboard');
	return next();
});

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
	const rendersAppLayout = !req.path.startsWith('/ajax/');
	if (req.streamientDemoContext) {
		const fixtures = buildStreamientDemoFixtures(req.streamientDemoContext);
		const scene = getStreamientDemoScene(req.streamientDemoContext, fixtures);
		const dateFormatters = createDateFormatters(fixtures.user);
		req.streamientDemoFixtures = fixtures;
		res.locals.user = fixtures.user;
		res.locals.billing_user = null;
		res.locals.projects = fixtures.projects;
		res.locals.plan = 'pro';
		res.locals.member_role = 'viewer';
		res.locals.can_manage_team = false;
		res.locals.can_manage_restricted_settings = false;
		res.locals.accessible_tenants = [];
		res.locals.active_tenant = fixtures.tenant;
		res.locals.email_feature_enabled = true;
		res.locals.email_view_enabled = true;
		res.locals.git_sync_enabled = true;
		res.locals.white_label = {};
		res.locals.account_limits = { limit_projects: 0, limit_users: 0, limit_ai_workflows_per_day: 0 };
		res.locals.can_create_project = false;
		res.locals.byo_ai_enabled = false;
		res.locals.timezone_options = [];
		res.locals.host_id = fixtures.host_id;
		res.locals.ws_url = '';
		res.locals.user_id = fixtures.owner_id;
		res.locals.socket_token = '';
		res.locals.impersonating = false;
		res.locals.impersonatingName = '';
		res.locals.is_hosted = false;
		res.locals.is_trialing = false;
		res.locals.trial_ends_text = '';
		res.locals.trial_available = false;
		res.locals.can_upgrade = false;
		res.locals.hide_chat_sidebar = req.path === '/settings' || req.path.startsWith('/settings/');
		res.locals.custom_footer_code = { js_snippet: '', css_snippet: '' };
		res.locals.managani_browser = null;
		res.locals.product_updates_enabled = false;
		res.locals.streamient_demo_scene = scene;
		res.locals.streamient_demo_scene_json = JSON.stringify(scene).replace(/[<>&]/g, (char) => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' }[char]));
		Object.assign(res.locals, dateFormatters);
		return next();
	}
	const [user, projects, tenant, billingUser, customFooterCode] = await Promise.all([
		User.findById(req.userId),
		listProjects(req.host_id),
		Tenant.findOne({ host_id: req.host_id }).select('plan limit_projects limit_users limit_ai_workflows_per_day settings.byo_ai settings.white_label').lean(),
		getBillingUserForHost(req.host_id, req.userId),
		rendersAppLayout ? getCustomCode().catch((err) => {
			log.error({ err }, 'Custom footer code load error');
			return { js_snippet: '', css_snippet: '' };
		}) : Promise.resolve({ js_snippet: '', css_snippet: '' }),
	]);
	const activeTenant = (req.accessibleTenants || []).find((item) => item.tenantId === req.tenantId) || null;
	const plan = tenant?.plan || 'free';
	const is_hosted = req.isHosted;
	const proOnlyFeatureEnabled = hasProFeatureAccess(billingUser, plan, is_hosted);
	const dateFormatters = createDateFormatters(user || {});
	res.locals.user = user;
	res.locals.billing_user = billingUser;
	res.locals.projects = projects;
	res.locals.plan = plan;
	res.locals.member_role = req.memberRole;
	res.locals.can_manage_team = req.memberRole === 'owner' || req.memberRole === 'admin';
	res.locals.can_manage_restricted_settings = req.memberRole === 'owner' || req.memberRole === 'admin';
	res.locals.accessible_tenants = req.accessibleTenants || [];
	res.locals.active_tenant = activeTenant;
	// email_feature_enabled remains true for storage/import UI. Triage/reply moved to Mailtwine.
	res.locals.email_feature_enabled = true;
	res.locals.email_view_enabled = true;
	res.locals.git_sync_enabled = proOnlyFeatureEnabled;
	res.locals.white_label = serializeWhiteLabelSettings(tenant || {}, { canUsePro: proOnlyFeatureEnabled });
	res.locals.account_limits = is_hosted
		? resolveStoredTenantLimits(tenant || {})
		: { limit_projects: 0, limit_users: 0, limit_ai_workflows_per_day: 0 };
	res.locals.can_create_project = !is_hosted || !isTenantLimitReached(res.locals.account_limits.limit_projects, projects.length);
	res.locals.byo_ai_enabled = isByoAiSettingsAccessEnabled(req);
	res.locals.timezone_options = getTimezoneOptions();
	res.locals.host_id = req.host_id;
	res.locals.ws_url = config.wsUrl;
	res.locals.user_id = req.userId;
	res.locals.socket_token = generateSocketToken(req.userId, req.host_id, req.tenantId);
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
	res.locals.custom_footer_code = customFooterCode;
	res.locals.managani_browser = rendersAppLayout ? await managani.getBrowserContext(user, { req, res, billingUser }) : null;
	res.locals.product_updates_enabled = isProductUpdatesEligible(req);
	res.locals.streamient_demo_scene = null;
	res.locals.streamient_demo_scene_json = 'null';
	Object.assign(res.locals, dateFormatters);
	next();
});

router.use(productUpdatesRouter);

// Note: Free is a permanent, fully-usable plan with managed AI included, so
// there is no global subscription gate and no API-key onboarding gate. Pro-only
// features (Email AI, Git Sync) are gated individually.

router.get('/dashboard', (req, res) => res.render('dashboard', { title: 'Dashboard' }));
router.get('/notes', (req, res) => res.render('notes', { title: 'Notes' }));
router.get('/search', (req, res) => res.render('search', { title: 'Search results' }));
router.get('/memories', (req, res) => res.render('memories', { title: 'Memory' }));
router.get('/urls', (req, res) => res.render('urls', { title: 'URLs' }));
router.get('/emails', (req, res) => res.render('emails', { title: 'Emails' }));
router.get('/ajax/mobile-apps', renderMobileAppsModal);
router.get('/trash', (req, res) => res.render('trash', { title: 'Trash' }));
router.get('/graph', (req, res) => res.render('graph', { title: 'Knowledge Graph', page: 'graph' }));
router.get('/settings', (req, res) => res.redirect('/settings/profile'));
router.get('/settings/profile', (req, res) => res.render('settings/profile', { title: 'Profile' }));
router.get('/settings/security', (req, res) => res.render('settings/security', { title: 'Security' }));
router.get('/settings/team', (req, res) => res.render('settings/team', { title: 'My Team' }));
router.get('/settings/tokens', (req, res) => res.render('settings/tokens', { title: 'Access Tokens' }));
router.get('/settings/byo-ai', requireRestrictedSettingsAccess, requireByoAiWebAccess, (req, res) => res.render('settings/byo_ai', { title: 'AI' }));
router.get('/settings/white-label', requireRestrictedSettingsAccess, (req, res) => res.render('settings/white_label', { title: 'White-label' }));
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
router.get('/ajax/section/search', (req, res) => res.render('ajax/section/search'));
router.get('/ajax/section/memories', (req, res) => res.render('ajax/section/memories'));
router.get('/ajax/section/urls', (req, res) => res.render('ajax/section/urls'));
router.get('/ajax/section/emails', (req, res) => res.render('ajax/section/emails'));
router.get('/ajax/section/trash', (req, res) => res.render('ajax/section/trash'));
router.get('/ajax/section/settings/profile', (req, res) => res.render('ajax/section/settings/profile', { title: 'Profile' }));
router.get('/ajax/section/settings/security', (req, res) => res.render('ajax/section/settings/security', { title: 'Security' }));
router.get('/ajax/section/settings/team', (req, res) => res.render('ajax/section/settings/team', { title: 'My Team' }));
router.get('/ajax/section/settings/tokens', (req, res) => res.render('ajax/section/settings/tokens', { title: 'Access Tokens' }));
router.get('/ajax/section/settings/byo-ai', requireRestrictedSettingsAccess, requireByoAiWebAccess, (req, res) => res.render('ajax/section/settings/byo_ai', { title: 'AI' }));
router.get('/ajax/section/settings/white-label', requireRestrictedSettingsAccess, (req, res) => res.render('ajax/section/settings/white_label', { title: 'White-label' }));
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
	if (req.streamientDemoFixtures) {
		return res.render('ajax/project_list', {
			projects: req.streamientDemoFixtures.projects,
			counts: req.streamientDemoFixtures.counts,
			activeProjectId: req.query.active || '',
			emailFeatureEnabled: true,
			emailViewEnabled: true,
			is_hosted: false,
		});
	}
	const [projects, counts, tenant] = await Promise.all([
		listProjects(req.host_id),
		getProjectCounts(req.host_id).catch(() => ({})),
		Tenant.findOne({ host_id: req.host_id }).select('plan').lean(),
	]);
	const plan = tenant?.plan || 'free';
		const emailFeatureEnabled = true;
	res.render('ajax/project_list', { projects, counts, activeProjectId: req.query.active || '', emailFeatureEnabled, emailViewEnabled: true, is_hosted: req.isHosted });
});

router.get('/ajax/batch-project-picker', async (req, res) => {
	const projects = await listProjects(req.host_id);
	const currentProjectId = String(req.query.current || '');
	const action = req.query.action === 'copy' ? 'copy' : 'move';
	res.render('ajax/batch_project_picker', {
		projects: projects.filter((project) => project._id.toString() !== currentProjectId),
		action,
	});
});

router.get('/ajax/project-overview/:id', async (req, res) => {
	try {
		if (req.streamientDemoFixtures) {
			const project = req.streamientDemoFixtures.projects.find((item) => String(item._id) === String(req.params.id));
			if (!project) return res.status(404).send('');
			return res.render('ajax/project_overview', {
				project,
				counts: req.streamientDemoFixtures.counts,
				gitSyncEnabled: true,
				emailFeatureEnabled: true,
				emailViewEnabled: true,
				emailForwardDomain: '',
				canDelete: false,
				deleteBlockers: [],
				canManageProjectSettings: false,
				is_hosted: false,
			});
		}
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
		const pc = counts[project._id.toString()] || { notes: 0, memory: 0, urls: 0, emails: 0 };
		const deleteState = project.is_default ? { canDelete: false, blockers: [] } : await getProjectDeleteState(req.host_id, req.params.id).catch(() => ({ canDelete: false, blockers: [] }));
		const canDelete = !project.is_default && deleteState.canDelete;
		const canManageProjectSettings = req.memberRole === 'owner' || req.memberRole === 'admin';
		res.render('ajax/project_overview', { project, counts, gitSyncEnabled, emailFeatureEnabled, emailViewEnabled: true, emailForwardDomain, canDelete, deleteBlockers: deleteState.blockers, canManageProjectSettings, is_hosted: req.isHosted });
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
		const obsidianSyncAccessEnabled = proOnlyFeatureEnabled;
		const obsidianSyncConfigured = config.obsidian.enabled && Boolean(config.obsidian.encryptionKey);
		const [gitRepos, obsidianConnections] = await Promise.all([
			proOnlyFeatureEnabled ? listGitRepos(req.host_id, req.params.id).catch(() => []) : [],
			obsidianSyncAccessEnabled && obsidianSyncConfigured ? listObsidianConnections(req.host_id, req.params.id).catch(() => []) : [],
		]);
		res.render('ajax/project_settings', {
			project,
			gitRepos,
			gitSyncEnabled: proOnlyFeatureEnabled,
			obsidianConnections,
			obsidianSyncAccessEnabled,
			obsidianSyncConfigured,
			emailFeatureEnabled: true,
			emailForwardDomain,
			is_hosted: req.isHosted,
		});
	} catch (err) {
		log.error({ err, host_id: req.host_id, project_id: req.params.id }, 'Project settings modal error');
		res.status(500).send('<div class="alert alert-danger mb-0">Failed to load project settings.</div>');
	}
});

export default router;
