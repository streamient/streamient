import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireTenant } from '../modules/tenancy.js';
import { BILLING_SUBSCRIPTION_URL, applySubscriptionToUser, createCheckoutSession, createPortalSession, handleWebhook, resolveCheckoutPriceId, buildHostedTrialFields } from '../services/billing_service.js';
import { getBillingUserForHost } from '../services/subscription_access_service.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import config from '../config.js';
import express from 'express';
import { createLogger } from '../modules/logger.js';

const log = createLogger('billing');

const router = Router();

// ---- Webhook (raw body, no auth — Stripe verifies via signature) ----

router.post(
    '/billing/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            const sig = req.headers['stripe-signature'];
            if (!sig) return res.status(400).send('Missing Stripe-Signature header');
            await handleWebhook(req.body, sig);
            res.json({ received: true });
        } catch (err) {
            log.error({ err }, 'Stripe webhook error');
            res.status(400).send(`Webhook Error: ${err.message}`);
        }
    },
);

// ---- Checkout, success, cancel, portal (authenticated) ----

router.get('/billing/checkout', requireAuth, requireTenant, async (req, res) => {
    try {
        const billingUser = await getBillingUserForHost(req.host_id, req.userId);
        if (!billingUser) return res.redirect('/login');

        // Paid or Stripe-trialing users already have a subscription.
        if (billingUser.subscription_status === 'active' || (billingUser.subscription_status === 'trialing' && billingUser.trial_source !== 'no_card')) {
            return res.redirect('/dashboard');
        }

        if (!resolveCheckoutPriceId()) {
            return res.status(500).render('billing/checkout_cancel', {
                title: 'Billing Setup Missing',
                message: 'Stripe price ID is not configured for the Pro plan.',
            });
        }

        const checkoutUrl = await createCheckoutSession(billingUser);
        res.redirect(checkoutUrl);
    } catch (err) {
        log.error({ err, user_id: req.userId }, 'Checkout error');
        res.status(500).render('billing/checkout_cancel', {
            title: 'Checkout Error',
            message: 'Something went wrong starting checkout. Please try again.',
        });
    }
});

// Start the in-app 7-day no-card Pro trial (once per account).
router.post('/billing/trial', requireAuth, requireTenant, async (req, res) => {
    try {
        if (!config.isHosted) return res.redirect('/settings/subscription');

        const billingUser = await getBillingUserForHost(req.host_id, req.userId);
        if (!billingUser) return res.redirect('/login');

        const tenant = await Tenant.findOne({ host_id: req.host_id }).select('plan').lean();
        const status = billingUser.subscription_status || 'incomplete';

        // Already entitled (paid or trialing) → nothing to do.
        if (tenant?.plan === 'pro' || status === 'active' || status === 'trialing' || status === 'past_due') {
            return res.redirect('/dashboard');
        }

        // Trial is one-time: any prior trial/subscription history disqualifies.
        const usedTrialBefore = Boolean(billingUser.trial_ends_at) || status === 'trial_expired' || status === 'canceled' || status === 'unpaid';
        if (usedTrialBefore) {
            return res.redirect('/settings/subscription?trial=used');
        }

        await User.findByIdAndUpdate(billingUser._id, {
            $set: {
                ...buildHostedTrialFields(),
                trial_reminder_3d_sent_at: null,
                trial_reminder_24h_sent_at: null,
                trial_locked_at: null,
            },
        });

        res.redirect('/dashboard?trial=started');
    } catch (err) {
        log.error({ err, user_id: req.userId }, 'Start trial error');
        res.redirect('/settings/subscription');
    }
});

router.get('/billing/success', requireAuth, requireTenant, async (req, res) => {
    // Stripe redirects here after successful checkout.
    // First check if webhook already updated the status.
    const billingUser = await getBillingUserForHost(req.host_id, req.userId);
    if (billingUser && (billingUser.subscription_status === 'active' || (billingUser.subscription_status === 'trialing' && billingUser.trial_source !== 'no_card'))) {
        return res.redirect('/dashboard');
    }

    // Webhook may not have arrived yet (especially in dev) — retrieve session directly from Stripe.
    const sessionId = req.query.session_id;
    if (sessionId && billingUser) {
        try {
            const { getStripe } = await import('../modules/stripe.js');
            const stripe = getStripe();
            const session = await stripe.checkout.sessions.retrieve(sessionId);

            if (session.subscription) {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                await applySubscriptionToUser(billingUser._id, subscription, session.customer);
                return res.redirect('/dashboard');
            }
        } catch (err) {
            log.error({ err, user_id: req.userId, session_id: sessionId }, 'Billing success: failed to retrieve Stripe session');
        }
    }

    // Last resort fallback — redirect to dashboard, webhook may still arrive
    res.redirect('/dashboard');
});

router.get('/billing/cancel', requireAuth, requireTenant, async (req, res) => {
    res.redirect(BILLING_SUBSCRIPTION_URL);
});

router.get('/billing/portal', requireAuth, requireTenant, async (req, res) => {
    try {
        const billingUser = await getBillingUserForHost(req.host_id, req.userId);
        if (!billingUser) return res.redirect('/login');

        const portalUrl = await createPortalSession(billingUser);
        res.redirect(portalUrl);
    } catch (err) {
        log.error({ err, user_id: req.userId }, 'Portal error');
        res.redirect('/settings/subscription');
    }
});

export default router;
