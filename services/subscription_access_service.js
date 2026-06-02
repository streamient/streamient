import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BILLING_USER_FIELDS = '+stripe_customer_id subscription_status trial_source trial_ends_at host_id tenant email name';

export function pickBillingUser(currentUser, tenantOwnerUser) {
	return tenantOwnerUser || currentUser || null;
}

export async function getBillingUserForHost(host_id, currentUserId = null) {
	const tenant = await Tenant.findOne({ host_id }).select('owner').lean();
	const [currentUser, tenantOwnerUser] = await Promise.all([
		currentUserId ? User.findById(currentUserId).select(BILLING_USER_FIELDS) : null,
		tenant?.owner ? User.findById(tenant.owner).select(BILLING_USER_FIELDS) : null,
	]);

	return pickBillingUser(currentUser, tenantOwnerUser);
}

export function hasProductAccess(user, now = new Date()) {
	if (!user) return false;
	const status = user.subscription_status || 'incomplete';
	if (status === 'active') return true;
	if (status !== 'trialing') return false;
	if (user.trial_source !== 'no_card') return true;
	if (!user.trial_ends_at) return true;
	return new Date(user.trial_ends_at).getTime() > now.getTime();
}

export function getTrialDaysRemaining(user, now = new Date()) {
	if (!user?.trial_ends_at) return null;
	const diff = new Date(user.trial_ends_at).getTime() - now.getTime();
	if (!Number.isFinite(diff)) return null;
	return Math.max(0, Math.ceil(diff / DAY_MS));
}

export function formatTrialEndsIn(user, now = new Date()) {
	const days = getTrialDaysRemaining(user, now);
	if (days === null) return 'Trial';
	if (days === 0) return 'Trial ends today';
	return `Trial ends in ${days} day${days === 1 ? '' : 's'}`;
}

export function hasProFeatureAccess(user, plan, isHosted, now = new Date()) {
	if (!isHosted) return true;
	if (plan === 'pro') return true;
	if (!user) return false;
	return user.subscription_status === 'trialing' && hasProductAccess(user, now);
}
