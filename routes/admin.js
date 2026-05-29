import { Router } from 'express';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Project } from '../model/project.js';
import { isSysadminCredentials, requireAdmin } from '../middleware/sysadmin.js';
import emailTemplates from '../config/email_templates.js';
import { getByCategory, setSetting, deleteSetting } from '../services/system_settings_service.js';
import { sendTestEmail } from '../services/email_service.js';
import * as auditService from '../services/audit_service.js';
import { deleteAccountDataForUser } from '../services/account_cleanup_service.js';
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

router.get('/', (req, res) => {
    res.render('admin/accounts', { title: 'Accounts', activeNav: 'accounts' });
});

router.get('/accounts/:id/edit', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('tenant');
        if (!user) return res.redirect('/admin');
        res.render('admin/account_edit', {
            title: 'Edit Account',
            activeNav: 'accounts',
            account: user,
        });
    } catch (err) {
        log.error({ err, account_id: req.params.id }, 'Admin account edit page error');
        res.redirect('/admin');
    }
});

// ---- Admin API ----

router.get('/api/accounts', async (req, res) => {
    try {
        const status = req.query.status || 'active';
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = 50;

        const filter = status === 'inactive' ? { is_active: false } : { is_active: true };

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('name email is_active host_id createdAt last_login')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        // Gather counts for each user in parallel
        const enriched = await Promise.all(
            users.map(async (u) => {
                if (!u.host_id) {
                    return { ...u, projectCount: 0, itemCount: 0 };
                }
                const [projectCount, noteCount, memoryCount, urlCount] = await Promise.all([
                    Project.countDocuments({ host_id: u.host_id }),
                    Note.countDocuments({ host_id: u.host_id, in_trash: { $ne: true } }),
                    Memory.countDocuments({ host_id: u.host_id, in_trash: { $ne: true } }),
                    Url.countDocuments({ host_id: u.host_id, in_trash: { $ne: true } }),
                ]);
                return {
                    ...u,
                    projectCount,
                    itemCount: noteCount + memoryCount + urlCount,
                };
            }),
        );

        res.json({ accounts: enriched, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        log.error({ err }, 'Admin list accounts error');
        res.status(500).json({ error: 'Failed to list accounts' });
    }
});

router.get('/api/accounts/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).lean();
        if (!user) return res.status(404).json({ error: 'Not found' });
        res.json(user);
    } catch (err) {
        log.error({ err, account_id: req.params.id }, 'Admin get account error');
        res.status(500).json({ error: 'Failed to get account' });
    }
});

router.put('/api/accounts/:id', async (req, res) => {
    try {
        const { name, email, is_active } = req.body;
        const update = {};
        if (name !== undefined) update.name = name.trim();
        if (email !== undefined) update.email = email.trim().toLowerCase();
        if (is_active !== undefined) update.is_active = Boolean(is_active);

        const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
        if (!user) return res.status(404).json({ error: 'Not found' });

        // Sync is_active to tenant
        if (is_active !== undefined && user.tenant) {
            await Tenant.findByIdAndUpdate(user.tenant, { is_active: Boolean(is_active) });
        }

        res.json({ ok: true, account: user.toSafe() });
    } catch (err) {
        log.error({ err, account_id: req.params.id }, 'Admin update account error');
        res.status(500).json({ error: 'Failed to update account' });
    }
});

router.delete('/api/accounts/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Not found' });

        await deleteAccountDataForUser(user);

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
