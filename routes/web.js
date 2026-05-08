import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireTenant, Tenant } from '../modules/tenancy.js';
import { User } from '../model/user.js';
import { listProjects, getProject, getProjectCounts } from '../services/project_service.js';
import { listGitRepos } from '../services/git_sync_service.js';
import { formatTrialEndsIn, hasProductAccess, hasProFeatureAccess } from '../services/subscription_access_service.js';
import config from '../config.js';

const is_hosted = config.isHosted;

const router = Router();

router.use(requireAuth, requireTenant);

function requireRestrictedSettingsAccess(req, res, next) {
	if (req.memberRole === 'owner' || req.memberRole === 'admin') return next();
	if (req.path.startsWith('/ajax/')) {
		return res.status(403).send('<div class="alert alert-warning mb-0">This setting is available to account admins only.</div>');
	}
	return res.redirect('/settings/profile');
}

// Inject user + sidebar data into all views
router.use(async (req, res, next) => {
	const [user, projects, tenant] = await Promise.all([
		User.findById(req.userId),
		listProjects(req.host_id),
		Tenant.findOne({ host_id: req.host_id }).select('plan').lean(),
	]);
	const activeTenant = (req.accessibleTenants || []).find((item) => item.tenantId === req.tenantId) || null;
	const plan = tenant?.plan || 'free';
	const proOnlyFeatureEnabled = hasProFeatureAccess(user, plan, is_hosted);
	res.locals.user = user;
	res.locals.projects = projects;
	res.locals.plan = plan;
	res.locals.member_role = req.memberRole;
	res.locals.can_manage_team = req.memberRole === 'owner' || req.memberRole === 'admin';
	res.locals.can_manage_restricted_settings = req.memberRole === 'owner' || req.memberRole === 'admin';
	res.locals.accessible_tenants = req.accessibleTenants || [];
	res.locals.active_tenant = activeTenant;
	res.locals.email_feature_enabled = proOnlyFeatureEnabled;
	res.locals.git_sync_enabled = proOnlyFeatureEnabled;
	res.locals.host_id = req.host_id;
	res.locals.ws_url = config.wsUrl;
	res.locals.impersonating = req.session.impersonating || false;
	res.locals.impersonatingName = req.session.impersonatingName || '';
	res.locals.is_hosted = is_hosted;
	res.locals.is_trialing = is_hosted && user?.subscription_status === 'trialing' && user?.trial_source === 'no_card' && hasProductAccess(user);
	res.locals.trial_ends_text = res.locals.is_trialing ? formatTrialEndsIn(user) : '';
	res.locals.hide_chat_sidebar = req.path === '/settings' || req.path.startsWith('/settings/');
	next();
});

// ---- Subscription gate (hosted edition only) ----
// Users without an active/trialing subscription get redirected to checkout.
if (is_hosted) {
	router.use((req, res, next) => {
		const user = res.locals.user;
		if (!user) return next();

		// Settings/subscription page is always accessible so users can manage billing
		if (req.path.startsWith('/settings/subscription')) return next();

		if (hasProductAccess(user)) return next();

		// Everything else — redirect to checkout
		return res.redirect('/billing/checkout');
	});
}

router.get('/dashboard', (req, res) => res.render('dashboard', { title: 'Dashboard' }));
router.get('/notes', (req, res) => res.render('notes', { title: 'Notes' }));
router.get('/memories', (req, res) => res.render('memories', { title: 'Memory' }));
router.get('/urls', (req, res) => res.render('urls', { title: 'URLs' }));
router.get('/emails', (req, res) => res.render('emails', { title: 'Emails' }));
router.get('/trash', (req, res) => res.render('trash', { title: 'Trash' }));
router.get('/graph', (req, res) => res.render('graph', { title: 'Knowledge Graph', page: 'graph' }));
router.get('/settings', (req, res) => res.redirect('/settings/profile'));
router.get('/settings/profile', (req, res) => res.render('settings/profile', { title: 'Profile' }));
router.get('/settings/security', (req, res) => res.render('settings/security', { title: 'Security' }));
router.get('/settings/team', (req, res) => res.render('settings/team', { title: 'My Team' }));
router.get('/settings/tokens', (req, res) => res.render('settings/tokens', { title: 'Access Tokens' }));
router.get('/settings/typesense', requireRestrictedSettingsAccess, (req, res) => res.render('settings/typesense', { title: 'Typesense' }));
router.get('/settings/usage', (req, res) => res.render('settings/usage', { title: 'Usage' }));
router.get('/settings/export', requireRestrictedSettingsAccess, (req, res) => res.render('settings/export', { title: 'Export' }));
if (is_hosted) {
	router.get('/settings/subscription', (req, res) => res.render('settings/subscription', { title: 'Subscription' }));
}

// ---- Ajax section partials (SPA navigation) ----

router.get('/ajax/section/dashboard', (req, res) => res.render('ajax/section/dashboard'));
router.get('/ajax/section/notes', (req, res) => res.render('ajax/section/notes'));
router.get('/ajax/section/memories', (req, res) => res.render('ajax/section/memories'));
router.get('/ajax/section/urls', (req, res) => res.render('ajax/section/urls'));
router.get('/ajax/section/emails', (req, res) => res.render('ajax/section/emails'));
router.get('/ajax/section/trash', (req, res) => res.render('ajax/section/trash'));
router.get('/ajax/section/settings/profile', (req, res) => res.render('ajax/section/settings/profile', { title: 'Profile' }));
router.get('/ajax/section/settings/security', (req, res) => res.render('ajax/section/settings/security', { title: 'Security' }));
router.get('/ajax/section/settings/team', (req, res) => res.render('ajax/section/settings/team', { title: 'My Team' }));
router.get('/ajax/section/settings/tokens', (req, res) => res.render('ajax/section/settings/tokens', { title: 'Access Tokens' }));
router.get('/ajax/section/settings/typesense', requireRestrictedSettingsAccess, (req, res) => res.render('ajax/section/settings/typesense', { title: 'Typesense' }));
router.get('/ajax/section/settings/usage', (req, res) => res.render('ajax/section/settings/usage', { title: 'Usage' }));
router.get('/ajax/section/settings/export', requireRestrictedSettingsAccess, (req, res) => res.render('ajax/section/settings/export', { title: 'Export' }));
if (is_hosted) {
	router.get('/ajax/section/settings/subscription', (req, res) => res.render('ajax/section/settings/subscription', { title: 'Subscription' }));
}

// ---- Ajax partials ----

router.get('/ajax/project-list', async (req, res) => {
	const [projects, counts, tenant] = await Promise.all([
		listProjects(req.host_id),
		getProjectCounts(req.host_id).catch(() => ({})),
		Tenant.findOne({ host_id: req.host_id }).select('plan').lean(),
	]);
	const plan = tenant?.plan || 'free';
	const emailFeatureEnabled = hasProFeatureAccess(res.locals.user, plan, is_hosted);
	res.render('ajax/project_list', { projects, counts, activeProjectId: req.query.active || '', emailFeatureEnabled, is_hosted });
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
		const proOnlyFeatureEnabled = hasProFeatureAccess(res.locals.user, plan, is_hosted);
		const gitSyncEnabled = proOnlyFeatureEnabled;
		const emailFeatureEnabled = proOnlyFeatureEnabled;
		const gitRepos = await listGitRepos(req.host_id, req.params.id).catch(() => []);
		const pc = counts[project._id.toString()] || { notes: 0, memory: 0, urls: 0, emails: 0 };
		const canDelete = !project.is_default && pc.notes === 0 && pc.memory === 0 && pc.urls === 0 && pc.emails === 0 && gitRepos.length === 0;
		res.render('ajax/project_overview', { project, counts, gitSyncEnabled, emailFeatureEnabled, gitRepos, canDelete, is_hosted });
	} catch (err) {
		res.status(500).send('<div class="text-danger">Failed to load project</div>');
	}
});

export default router;
