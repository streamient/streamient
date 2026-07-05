import { getStripe } from '../modules/stripe.js';
import { hydratedQuery } from '../model/mongoose.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import config from '../config.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('billing');

export const BILLING_SUBSCRIPTION_URL = 'https://app.streamient.com/settings/subscription';

/**
 * Build the no-card 7-day Pro trial fields. Applied via the in-app
 * "Start Pro trial" action (POST /billing/trial), not at signup.
 */
export function buildHostedTrialFields(now = new Date(), trialDays = config.stripe.trialDays) {
    return {
        subscription_status: 'trialing',
        trial_source: 'no_card',
        trial_ends_at: new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000),
    };
}

/**
 * Resolve tenant plan from a Stripe subscription. Pro is the only paid plan, so
 * an entitled (active/trialing/past_due) subscription maps to 'pro'; anything
 * else (canceled/unpaid/incomplete) drops to 'free'. The $0 Free tracking
 * price is always 'free', whatever its status.
 */
export function resolvePlanFromSubscription(subscription) {
    const status = subscription?.status;
    const entitled = status === 'active' || status === 'trialing' || status === 'past_due';
    if (!entitled) return 'free';
    if (isFreePriceSubscription(subscription)) return 'free';
    return 'pro';
}

/** True when the subscription's price is the $0 Free tracking price. */
export function isFreePriceSubscription(subscription) {
    const priceId = subscription?.items?.data?.[0]?.price?.id || '';
    return Boolean(priceId && config.stripe.freePriceId && priceId === config.stripe.freePriceId);
}

export function resolveCheckoutPriceId() {
	return config.stripe.proPriceId;
}

export function resolveCheckoutPlan() {
	return 'pro';
}

function stringifyId(value) {
	if (!value) return '';
	return value.toString ? value.toString() : String(value);
}

function isStripeCustomerExistsError(err) {
	const code = err?.code || err?.raw?.code;
	if (code === 'resource_already_exists') return true;
	return typeof err?.message === 'string' && err.message.toLowerCase().includes('already exists');
}

export function buildStripeCustomerParams(user, tenant = null) {
	const hostId = stringifyId(tenant?.host_id || user?.host_id);
	if (!hostId) {
		throw new Error('host_id is required to create a Stripe customer');
	}
	if (!user?.email) {
		throw new Error('email is required to create a Stripe customer');
	}
	if (!user?.name) {
		throw new Error('name is required to create a Stripe customer');
	}

	return {
		id: hostId,
		email: user.email,
		name: user.name,
		metadata: {
			'Customer Type': 'streamient',
			host_id: hostId,
			tenant_id: stringifyId(tenant?._id || user.tenant),
			streamient_user_id: stringifyId(user._id),
		},
	};
}

export async function ensureStripeCustomerForAccountHolder(user, tenant = null, options = {}) {
	if (!user) {
		throw new Error('user is required to create a Stripe customer');
	}
	if (user.stripe_customer_id) {
		return user.stripe_customer_id;
	}

	const stripe = options.stripe || getStripe();
	const userModel = options.userModel || User;
	const customerParams = buildStripeCustomerParams(user, tenant);
	let stripeCustomer;

	try {
		stripeCustomer = await stripe.customers.create(customerParams);
	} catch (err) {
		if (!isStripeCustomerExistsError(err)) {
			throw err;
		}
		stripeCustomer = await stripe.customers.retrieve(customerParams.id);
	}

	const customerId = stripeCustomer?.id || customerParams.id;
	await userModel.findByIdAndUpdate(user._id, { stripe_customer_id: customerId });
	user.stripe_customer_id = customerId;
	return customerId;
}

export function buildFreeSubscriptionParams(customerId, user, tenant = null) {
	return {
		customer: customerId,
		items: [{ price: config.stripe.freePriceId }],
		metadata: {
			plan: 'free',
			host_id: stringifyId(tenant?.host_id || user?.host_id),
			streamient_user_id: stringifyId(user._id),
		},
	};
}

/**
 * Subscribe a Free account holder to the $0 tracking price so every customer
 * shows up in Stripe. Recorded only in stripe_free_subscription_id — never in
 * stripe_subscription_id/subscription_status, which stay reserved for paid
 * subscriptions (and would otherwise block checkout). No-op unless Stripe and
 * STRIPE_FREE_PRICE_ID are configured. The caller must pass a user doc with
 * stripe_customer_id selected; there is deliberately no fallback customer
 * creation here (a legacy cus_* customer whose field simply wasn't selected
 * would end up with a duplicate host_id customer).
 */
export async function ensureFreeSubscriptionForAccountHolder(user, tenant = null, options = {}) {
	if (!user) {
		throw new Error('user is required to create a free subscription');
	}
	if (!config.stripe.secretKey || !config.stripe.freePriceId) return null;
	if (user.stripe_free_subscription_id) return user.stripe_free_subscription_id;
	// Accounts carrying a live paid subscription need no tracking subscription.
	// No-card trials have no stripe_subscription_id, so they still get one.
	if (user.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(user.subscription_status)) return null;
	const customerId = user.stripe_customer_id;
	if (!customerId) return null;

	const stripe = options.stripe || getStripe();
	const userModel = options.userModel || User;
	// Remote idempotency: reuse an existing active free-price subscription so
	// webhook replays and re-runs never create duplicates.
	const existing = await stripe.subscriptions.list({
		customer: customerId,
		price: config.stripe.freePriceId,
		status: 'active',
		limit: 1,
	});
	const subscription = existing?.data?.[0]
		|| await stripe.subscriptions.create(buildFreeSubscriptionParams(customerId, user, tenant));
	await userModel.findByIdAndUpdate(user._id, { stripe_free_subscription_id: subscription.id });
	user.stripe_free_subscription_id = subscription.id;
	return subscription.id;
}

/**
 * Cancel the $0 tracking subscription (used when a paid subscription takes
 * over). Tolerates already-canceled/missing subscriptions so webhook retries
 * stay idempotent.
 */
export async function cancelFreeSubscriptionForUser(userId, options = {}) {
	const userModel = options.userModel || User;
	const user = await userModel.findById(userId).select('+stripe_free_subscription_id');
	if (!user?.stripe_free_subscription_id) return false;
	const stripe = options.stripe || getStripe();
	try {
		await stripe.subscriptions.cancel(user.stripe_free_subscription_id);
	} catch (err) {
		const code = err?.code || err?.raw?.code;
		if (code !== 'resource_missing' && !/canceled/i.test(err?.message || '')) throw err;
	}
	await userModel.findByIdAndUpdate(userId, { $unset: { stripe_free_subscription_id: '' } });
	return true;
}

export async function applySubscriptionToUser(userId, subscription, stripeCustomerId = undefined) {
	const plan = resolvePlanFromSubscription(subscription);
	const user = await User.findByIdAndUpdate(
		userId,
		buildSubscriptionUserUpdate(subscription, stripeCustomerId),
		{ returnDocument: 'after' },
	);
	if (user?.host_id) {
		await Tenant.findOneAndUpdate({ host_id: user.host_id }, { plan });
	}
	return user;
}

export function buildCheckoutSessionParams(user, customerId, priceId) {
	return {
		customer: customerId,
		mode: 'subscription',
		payment_method_collection: 'always',
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: `${config.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: BILLING_SUBSCRIPTION_URL,
		metadata: { streamient_user_id: user._id.toString() },
	};
}

export function buildPortalSessionParams(user, customerId = user.stripe_customer_id) {
	return {
		customer: customerId,
		return_url: BILLING_SUBSCRIPTION_URL,
		...(config.stripe.portalConfigId && { configuration: config.stripe.portalConfigId }),
	};
}

export function buildSubscriptionUserUpdate(subscription, stripeCustomerId = undefined) {
	const update = {
		stripe_subscription_id: subscription.id,
		subscription_status: subscription.status,
		trial_source: subscription.trial_end ? 'stripe' : null,
		trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
		trial_reminder_3d_sent_at: null,
		trial_reminder_24h_sent_at: null,
		trial_locked_at: null,
	};
	if (stripeCustomerId) {
		update.stripe_customer_id = stripeCustomerId;
	}
	return update;
}

/**
 * Create a Stripe Checkout session for the Pro subscription.
 * Returns the Checkout URL to redirect the user to.
 */
export async function createCheckoutSession(user, options = {}) {
    const priceId = resolveCheckoutPriceId();
    if (!priceId) {
        throw new Error('Stripe price ID is not configured for the Pro plan (STRIPE_PRO_PRICE_ID).');
    }
    const stripe = options.stripe || getStripe();

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
        customerId = await ensureStripeCustomerForAccountHolder(user, null, {
            stripe,
            userModel: options.userModel || User,
        });
    }

    const session = await stripe.checkout.sessions.create(buildCheckoutSessionParams(user, customerId, priceId));

    return session.url;
}

/**
 * Create a Stripe Customer Portal session for subscription management.
 * Returns the portal URL.
 */
export async function createPortalSession(user, options = {}) {
    const stripe = options.stripe || getStripe();

    const customerId = user.stripe_customer_id || await ensureStripeCustomerForAccountHolder(user, null, {
        stripe,
        userModel: options.userModel || User,
    });

    const portalSession = await stripe.billingPortal.sessions.create(buildPortalSessionParams(user, customerId));

    return portalSession.url;
}

/**
 * Handle incoming Stripe webhook events.
 * rawBody must be the raw request buffer; sig is the Stripe-Signature header.
 */
export async function handleWebhook(rawBody, sig) {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(rawBody, sig, config.stripe.webhookSecret);

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            // kumbukum_user_id: checkout sessions created before the rebrand
            const userId = session.metadata?.streamient_user_id || session.metadata?.kumbukum_user_id;
            if (userId && session.subscription) {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                // Checkout only sells Pro; a free-price session would be a
                // misconfiguration and must not grant a paid plan.
                if (isFreePriceSubscription(subscription)) break;
                await applySubscriptionToUser(userId, subscription);
                // The paid subscription replaces the $0 tracking subscription.
                try {
                    await cancelFreeSubscriptionForUser(userId, { stripe });
                } catch (err) {
                    log.error({ err, user_id: userId }, 'Free subscription cancel after upgrade failed');
                }
            }
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            // The $0 tracking subscription never drives plan or status.
            if (isFreePriceSubscription(subscription)) break;
            const user = await hydratedQuery(User.findOne({ stripe_subscription_id: subscription.id }));
            if (user) {
                Object.assign(user, buildSubscriptionUserUpdate(subscription));
                await user.save();
                const plan = resolvePlanFromSubscription(subscription);
                await Tenant.findOneAndUpdate({ host_id: user.host_id }, { plan });
            }
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            // Deleting the $0 tracking subscription (e.g. on upgrade) must not
            // re-enter paid-cancellation handling or re-create anything.
            if (isFreePriceSubscription(subscription)) break;
            const user = await hydratedQuery(
                User.findOne({ stripe_subscription_id: subscription.id }).select('+stripe_customer_id +stripe_free_subscription_id'),
            );
            if (user) {
                user.subscription_status = 'canceled';
                user.trial_source = null;
                user.trial_ends_at = null;
                user.trial_reminder_3d_sent_at = null;
                user.trial_reminder_24h_sent_at = null;
                user.trial_locked_at = null;
                await user.save();
                await Tenant.findOneAndUpdate({ host_id: user.host_id }, { plan: 'free' });
                // Back on Free — resume tracking with a fresh $0 subscription.
                try {
                    await ensureFreeSubscriptionForAccountHolder(user, null, { stripe });
                } catch (err) {
                    log.error({ err, user_id: user._id.toString() }, 'Free subscription recreate after downgrade failed');
                }
            }
            break;
        }

        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            if (invoice.subscription) {
                const user = await hydratedQuery(User.findOne({ stripe_subscription_id: invoice.subscription }));
                if (user) {
                    user.subscription_status = 'past_due';
                    await user.save();
                }
            }
            break;
        }

        default:
            break;
    }
}
