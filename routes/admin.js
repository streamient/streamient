import { Router } from 'express';
import config from '../config.js';
import { resolvePlanTenantLimits } from '../modules/tenant_limits.js';
import { ensureCollections } from '../modules/typesense.js';
import { isSysadminCredentials, requireAdmin } from '../middleware/sysadmin.js';
import emailTemplates from '../config/email_templates.js';
import { getByCategory, setSetting, deleteSetting } from '../services/system_settings_service.js';
import { sendTestEmail } from '../services/email_service.js';
import * as auditService from '../services/audit_service.js';
import { deleteTenantData } from '../services/account_cleanup_service.js';
import { ensureFreeSubscriptionForAccountHolder, ensureStripeCustomerForAccountHolder } from '../services/billing_service.js';
import { sendMagicLink } from '../services/magic_link_service.js';
import { AccountProvisioningError, provisionAccount } from '../services/account_provisioning_service.js';
import { AdminAccountError, getAdminAccount, listAdminAccounts, updateAdminAccount } from '../services/admin_account_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('admin');

const router = Router();

// ---- Admin login ----

router.get('/login', (req, res) => {
    if (req.session?.isAdmin) return res.redirect('/admin');
    res.render('admin/login');
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render('admin/login', { error: 'Email and password required' });
    }

    if (!isSysadminCredentials(email, password)) {
        return res.render('admin/login', { error: 'Invalid credentials' });
    }

    req.session.isAdmin = true;
    res.redirect('/admin');
});

router.post('/logout', (req, res) => {
    delete req.session.isAdmin;
    res.redirect('/admin/login');
});

// ---- Protected admin pages ----

router.use(requireAdmin);

router.get('/', async (req, res) => {
	try {
		const result = await listAdminAccounts({ status: req.query.status, page: req.query.page });
		res.render('admin/accounts', { title: 'Accounts', activeNav: 'accounts', ...result });
	} catch (err) {
		log.error({ err }, 'Admin accounts page error');
		res.status(500).render('admin/accounts', {
			title: 'Accounts',
			activeNav: 'accounts',
			accounts: [],
			total: 0,
			page: 1,
			pages: 0,
			status: 'active',
			error: 'Failed to load accounts',
		});
	}
});

router.get('/accounts/new', (req, res) => {
	res.render('admin/account_new', {
		title: 'New Account',
		activeNav: 'accounts',
		plan_limits: {
			free: resolvePlanTenantLimits('free'),
			pro: resolvePlanTenantLimits('pro'),
		},
	});
});

router.get('/accounts/:id/edit', async (req, res) => {
	try {
		const account = await getAdminAccount(req.params.id);
		if (!account) return res.redirect('/admin');
		res.render('admin/account_edit', {
			title: 'Edit Account',
			activeNav: 'accounts',
			account,
		});
	} catch (err) {
		log.error({ err, account_id: req.params.id }, 'Admin account edit page error');
		res.redirect('/admin');
	}
});

// ---- Admin API ----

router.get('/api/accounts', async (req, res) => {
	try {
		res.json(await listAdminAccounts({ status: req.query.status, page: req.query.page }));
	} catch (err) {
		log.error({ err }, 'Admin list accounts error');
		res.status(500).json({ error: 'Failed to list accounts' });
	}
});

export async function initializeAdminProvisionedAccount(user, tenant, options = {}) {
	const initializeBilling = options.initializeBilling || (async () => {
		await ensureStripeCustomerForAccountHolder(user, tenant);
		await ensureFreeSubscriptionForAccountHolder(user, tenant);
	});
	const initializeTypesense = options.initializeTypesense || (() => ensureCollections(tenant.host_id));
	const sendOwnerMagicLink = options.sendOwnerMagicLink || (() => sendMagicLink(user.email, config.appUrl));
	const logger = options.logger || log;
	const [billingResult, typesenseResult, magicLinkResult] = await Promise.allSettled([
		Promise.resolve().then(initializeBilling),
		Promise.resolve().then(initializeTypesense),
		Promise.resolve().then(sendOwnerMagicLink),
	]);
	const warnings = [];
	if (billingResult.status === 'rejected') {
		warnings.push('Stripe setup failed');
		logger.warn({ err: billingResult.reason, host_id: tenant.host_id }, 'Admin account Stripe setup failed');
	}
	if (typesenseResult.status === 'rejected') {
		warnings.push('Typesense setup failed');
		logger.warn({ err: typesenseResult.reason, host_id: tenant.host_id }, 'Admin account Typesense setup failed');
	}
	if (magicLinkResult.status === 'rejected') {
		warnings.push('Magic-link email failed; the owner can request another from login');
		logger.warn({ err: magicLinkResult.reason, host_id: tenant.host_id, email: user.email }, 'Admin account magic-link email failed');
	}
	return { magic_link_sent: magicLinkResult.status === 'fulfilled', warnings };
}

router.post('/api/accounts', async (req, res) => {
	try {
		const { user, tenant } = await provisionAccount(req.body);
		const setup = await initializeAdminProvisionedAccount(user, tenant);
		const account = await getAdminAccount(tenant._id.toString());
		res.status(201).json({ ok: true, account, ...setup });
	} catch (err) {
		if (err instanceof AccountProvisioningError) {
			return res.status(err.status).json({ error: err.message, code: err.code });
		}
		log.error({ err, owner_email: req.body?.owner_email }, 'Admin create account error');
		res.status(500).json({ error: 'Failed to create account' });
	}
});

router.get('/api/accounts/:id', async (req, res) => {
	try {
		const account = await getAdminAccount(req.params.id);
		if (!account) return res.status(404).json({ error: 'Not found' });
		res.json({ account });
	} catch (err) {
		log.error({ err, account_id: req.params.id }, 'Admin get account error');
		res.status(500).json({ error: 'Failed to get account' });
	}
});

router.put('/api/accounts/:id', async (req, res) => {
	try {
		const account = await updateAdminAccount(req.params.id, req.body);
		if (!account) return res.status(404).json({ error: 'Not found' });
		res.json({ ok: true, account });
	} catch (err) {
		if (err instanceof AdminAccountError) {
			return res.status(err.status).json({ error: err.message, code: err.code });
		}
		log.error({ err, account_id: req.params.id }, 'Admin update account error');
		res.status(500).json({ error: 'Failed to update account' });
	}
});

router.delete('/api/accounts/:id', async (req, res) => {
	try {
		const account = await getAdminAccount(req.params.id);
		if (!account) return res.status(404).json({ error: 'Not found' });
		await deleteTenantData(account.host_id, account._id);
		res.json({ ok: true });
	} catch (err) {
		log.error({ err, account_id: req.params.id }, 'Admin delete account error');
		res.status(500).json({ error: 'Failed to delete account' });
	}
});

// ---- Email Templates ----

router.get('/email-templates', (req, res) => {
    res.render('admin/email_templates', { title: 'Email Templates', activeNav: 'email-templates' });
});

router.get('/api/email-templates', async (req, res) => {
    try {
        const overrides = await getByCategory('email_templates');
        const overrideMap = {};
        for (const o of overrides) {
            overrideMap[o.key] = o.value;
        }

        const templates = Object.entries(emailTemplates).map(([key, defaults]) => {
            const subjectKey = `email_template.${key}.subject`;
            const htmlKey = `email_template.${key}.html`;
            return {
                key,
                subject: overrideMap[subjectKey] || defaults.subject,
                html: overrideMap[htmlKey] || defaults.html,
                variables: defaults.variables,
                isCustomized: !!(overrideMap[subjectKey] || overrideMap[htmlKey]),
            };
        });

        res.json({ templates });
    } catch (err) {
        log.error({ err }, 'Admin list email templates error');
        res.status(500).json({ error: 'Failed to list email templates' });
    }
});

router.put('/api/email-templates/:key', async (req, res) => {
    try {
        const { key } = req.params;
        if (!emailTemplates[key]) {
            return res.status(404).json({ error: 'Unknown template' });
        }

        const { subject, html } = req.body;
        if (subject !== undefined) {
            await setSetting(`email_template.${key}.subject`, subject, 'email_templates');
        }
        if (html !== undefined) {
            await setSetting(`email_template.${key}.html`, html, 'email_templates');
        }

        res.json({ ok: true });
    } catch (err) {
        log.error({ err, template_key: req.params.key }, 'Admin update email template error');
        res.status(500).json({ error: 'Failed to update email template' });
    }
});

router.post('/api/email-templates/:key/reset', async (req, res) => {
    try {
        const { key } = req.params;
        if (!emailTemplates[key]) {
            return res.status(404).json({ error: 'Unknown template' });
        }

        await deleteSetting(`email_template.${key}.subject`);
        await deleteSetting(`email_template.${key}.html`);

        const defaults = emailTemplates[key];
        res.json({ ok: true, subject: defaults.subject, html: defaults.html });
    } catch (err) {
        log.error({ err, template_key: req.params.key }, 'Admin reset email template error');
        res.status(500).json({ error: 'Failed to reset email template' });
    }
});

router.post('/api/email-templates/:key/test', async (req, res) => {
    try {
        const { key } = req.params;
        if (!emailTemplates[key]) {
            return res.status(404).json({ error: 'Unknown template' });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }

        const sampleVars = {};
        for (const v of emailTemplates[key].variables) {
            if (v.key === 'url' || v.key === 'loginUrl') {
                sampleVars[v.key] = '#';
            } else if (v.key === 'name') {
                sampleVars[v.key] = 'Test User';
            } else {
                sampleVars[v.key] = `[${v.key}]`;
            }
        }

        await sendTestEmail(email, key, sampleVars);
        res.json({ ok: true });
    } catch (err) {
        log.error({ err, template_key: req.params.key }, 'Admin send test email error');
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

// ---- Audit Logs ----

router.get('/audit-logs', (req, res) => {
    res.render('admin/audit_logs', { title: 'Audit Logs', activeNav: 'audit-logs' });
});

router.get('/api/audit-logs', async (req, res) => {
    try {
        const result = await auditService.query({
            host_id: req.query.host_id,
            user_id: req.query.user_id,
            resource: req.query.resource,
            action: req.query.action,
            channel: req.query.channel,
            mcp_client: req.query.mcp_client,
            q: req.query.q,
            from: req.query.from,
            to: req.query.to,
            page: parseInt(req.query.page, 10) || 1,
            per_page: parseInt(req.query.per_page, 10) || 50,
        });
        res.json(result);
    } catch (err) {
        log.error({ err }, 'Admin audit logs error');
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;
