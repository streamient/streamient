import { Project } from '../model/project.js';
import { TenantMember } from '../model/tenant_member.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { isTenantLimitReached, resolveStoredTenantLimits } from '../modules/tenant_limits.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BILLING_USER_FIELDS = '+stripe_customer_id +stripe_subscription_id subscription_status trial_source trial_ends_at host_id tenant email name';

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

const UNLIMITED = { projects: 0, users: 0 };

/** Stored tenant limits are authoritative for hosted accounts. Self-hosted is unlimited. */
export function effectiveResourceLimits(tenant, isHosted) {
	if (!isHosted) return UNLIMITED;
	const stored = resolveStoredTenantLimits(tenant || {});
	return {
		projects: stored.limit_projects,
		users: stored.limit_users,
	};
}

/** True when `count` is at/over a non-zero limit (0 = unlimited). */
export const isAtLimit = isTenantLimitReached;

/** Call inside the same transaction as creation; the tenant write serializes quota decisions. */
export async function requireResourceQuota(host_id, resource, session) {
	if (!session || !['projects', 'users'].includes(resource)) throw new Error('A transaction and valid resource are required for quota checks');
	const tenant = await Tenant.findOneAndUpdate({ host_id, is_active: true }, { $inc: { __v: 1 } }, { session, new: true }).lean();
	if (!tenant) throw new Error('Tenant not found');
	const limit = effectiveResourceLimits(tenant, true)[resource];
	if (!limit) return;
	const count = resource === 'projects'
		? await Project.countDocuments({ host_id, is_active: true }).session(session).read('primary')
		: 1 + await TenantMember.countDocuments({ host_id, user: { $ne: tenant.owner } }).session(session).read('primary');
	if (isAtLimit(limit, count)) {
		const label = resource === 'projects' ? 'Project' : 'User';
		throw Object.assign(new Error(`${label} limit reached. This account allows ${limit} ${label.toLowerCase()}${limit === 1 ? '' : 's'}.`), { status: 403, code: 'ACCOUNT_LIMIT', limit: resource });
	}
}
