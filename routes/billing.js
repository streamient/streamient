import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireTenant } from '../modules/tenancy.js';
import { User } from '../model/user.js';
import { BILLING_SUBSCRIPTION_URL, applySubscriptionToUser, createCheckoutSession, createPortalSession, handleWebhook, resolveCheckoutPlan, resolveCheckoutPriceId } from '../services/billing_service.js';
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
        const user = await User.findById(req.userId).select('+stripe_customer_id');
        if (!user) return res.redirect('/login');

        // Paid or Stripe-trialing users already have a subscription.
        if (user.subscription_status === 'active' || (user.subscription_status === 'trialing' && user.trial_source !== 'no_card')) {
            return res.redirect('/dashboard');
        }

        const plan = resolveCheckoutPlan(req.query.plan);
        if (!resolveCheckoutPriceId(plan)) {
            return res.status(500).render('billing/checkout_cancel', {
                title: 'Billing Setup Missing',
                message: `Stripe price ID is not configured for the ${plan} plan.`,
            });
        }

        const checkoutUrl = await createCheckoutSession(user, plan);
        res.redirect(checkoutUrl);
    } catch (err) {
        log.error({ err, user_id: req.userId }, 'Checkout error');
        res.status(500).render('billing/checkout_cancel', {
            title: 'Checkout Error',
            message: 'Something went wrong starting checkout. Please try again.',
        });
    }
});

router.get('/billing/success', requireAuth, requireTenant, async (req, res) => {
    // Stripe redirects here after successful checkout.
    // First check if webhook already updated the status.
    const user = await User.findById(req.userId).select('+stripe_customer_id');
    if (user && (user.subscription_status === 'active' || (user.subscription_status === 'trialing' && user.trial_source !== 'no_card'))) {
        return res.redirect('/dashboard');
    }

    // Webhook may not have arrived yet (especially in dev) — retrieve session directly from Stripe.
    const sessionId = req.query.session_id;
    if (sessionId && user) {
        try {
            const { getStripe } = await import('../modules/stripe.js');
            const stripe = getStripe();
            const session = await stripe.checkout.sessions.retrieve(sessionId);

            if (session.subscription) {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                await applySubscriptionToUser(user._id, subscription, session.customer);
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
        const user = await User.findById(req.userId).select('+stripe_customer_id');
        if (!user) return res.redirect('/login');

        const portalUrl = await createPortalSession(user);
        res.redirect(portalUrl);
    } catch (err) {
        log.error({ err, user_id: req.userId }, 'Portal error');
        res.redirect('/settings/subscription');
    }
});

export default router;
