import crypto from 'node:crypto';
import mongoose from '../model/mongoose.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { TENANT_PLANS, normalizeTenantLimits, resolvePlanTenantLimits } from './tenant_limits.js';

const whiteLabelAssetSchema = new mongoose.Schema(
	{
		url: { type: String, default: '' },
		storage_key: { type: String, default: '' },
		mime_type: { type: String, default: '' },
		size: { type: Number, default: 0 },
		width: { type: Number, default: 0 },
		height: { type: Number, default: 0 },
		updated_at: { type: Date, default: null },
	},
	{ _id: false },
);

const tenantSchema = new mongoose.Schema(
	{
		host_id: { type: String, required: true, unique: true, index: true },
		name: { type: String, required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		is_active: { type: Boolean, default: true },
		deletion: { type: mongoose.Schema.Types.Mixed, default: null },
		active_work: { type: mongoose.Schema.Types.Mixed, default: {} },
		plan: { type: String, enum: TENANT_PLANS, default: 'free' },
		limit_projects: {
			type: Number,
			default: function () {
				return resolvePlanTenantLimits(this.plan || 'free').limit_projects;
			},
			min: 0,
			validate: Number.isSafeInteger,
		},
		limit_users: {
			type: Number,
			default: function () {
				return resolvePlanTenantLimits(this.plan || 'free').limit_users;
			},
			min: 0,
			validate: Number.isSafeInteger,
		},
		limit_ai_workflows_per_day: {
			type: Number,
			default: function () {
				return resolvePlanTenantLimits(this.plan || 'free').limit_ai_workflows_per_day;
			},
			min: 0,
			validate: Number.isSafeInteger,
		},
		settings: {
			timezone: { type: String, default: 'UTC' },
			byo_ai: {
				global: {
					openai_api_key: { type: String, default: '' },
					gemini_api_key: { type: String, default: '' },
				},
				email: {
					openai_api_key: { type: String, default: '' },
					gemini_api_key: { type: String, default: '' },
				},
			},
			ai_instructions: {
				global: { type: String, default: '' },
			},
			white_label: {
				logo: { type: whiteLabelAssetSchema, default: null },
				favicon: { type: whiteLabelAssetSchema, default: null },
				login_logo: { type: whiteLabelAssetSchema, default: null },
				dns_name_custom: { type: String, default: '' },
				dns_verified: { type: Boolean, default: false },
				ssl_ready: { type: Boolean, default: false },
				cloudflare_custom_hostname_id: { type: String, default: '' },
				cloudflare_status: { type: String, default: '' },
				cloudflare_ssl_status: { type: String, default: '' },
				dns_checked_at: { type: Date, default: null },
				cloudflare_checked_at: { type: Date, default: null },
				last_error: { type: String, default: '' },
			},
		},
	},
	{ timestamps: true },
);

tenantSchema.index(
	{ 'settings.white_label.dns_name_custom': 1 },
	{
		unique: true,
		partialFilterExpression: {
			'settings.white_label.dns_name_custom': { $type: 'string', $gt: '' },
		},
	},
);

export const Tenant = mongoose.model('Tenant', tenantSchema);

function primaryTenantQuery(query) {
	if (typeof query?.read === 'function') query = query.read('primary');
	if (typeof query?.lean === 'function') query = query.lean();
	return query;
}

// Always read the authoritative tenant state for access/side-effect checks.
async function assertTenantAvailableImpl(hostId) {
	if (!hostId) throw Object.assign(new Error('Account context is required'), { status: 403, code: 'account_context_required' });
	const tenant = await Tenant.findOne({ host_id: String(hostId), is_active: { $ne: false }, 'deletion.requested_at': null }).select('_id').read('primary').lean();
	if (!tenant) throw Object.assign(new Error('Account access is unavailable'), { status: 403, code: 'account_unavailable' });
}

// Deletion waits for accepted writers to finish. Heartbeats distinguish a
// slow live operation from a process that died without releasing its lease.
async function acquireTenantWorkImpl(hostId) {
	const key = `active_work.${crypto.randomUUID()}`;
	const expiry = () => new Date(Date.now() + 5 * 60 * 1000);
	const result = await Tenant.updateOne({ host_id: hostId, is_active: { $ne: false }, 'deletion.requested_at': null }, { $set: { [key]: expiry() } }, { timestamps: false });
	if (!result.matchedCount) throw Object.assign(new Error('Account access is unavailable'), { status: 403, code: 'account_unavailable' });
	const timer = setInterval(() => { void Tenant.updateOne({ host_id: hostId, [key]: { $exists: true } }, { $set: { [key]: expiry() } }, { timestamps: false }).catch(() => {}); }, 20000);
	timer.unref();
	return async () => { clearInterval(timer); await Tenant.updateOne({ host_id: hostId }, { $unset: { [key]: '' } }, { timestamps: false }); };
}


export async function withTenantWork(hostId, callback) {
	const release = await acquireTenantWork(hostId);
	try { return await callback(); } finally { await release(); }
}


/**
 * One-off migration: the legacy `starter` plan has been removed. Convert any
 * stray `plan: 'starter'` tenants to `free` so they don't fail enum validation
 * on the next save. (There are no paying starter subscribers.)
 */
export async function backfillStarterPlan() {
	const result = await Tenant.updateMany(
		{ plan: 'starter' },
		{ $set: { plan: 'free' } },
		{ timestamps: false },
	);
	return { migrated: result?.modifiedCount || 0 };
}

/** Populate only missing legacy fields. Existing values, including 0, remain unchanged. */
export async function backfillTenantLimits() {
	let migrated = 0;
	for (const plan of TENANT_PLANS) {
		const planFilter = plan === 'free'
			? { $or: [{ plan: 'free' }, { plan: { $exists: false } }] }
			: { plan };
		for (const [field, value] of Object.entries(resolvePlanTenantLimits(plan))) {
			const result = await Tenant.updateMany(
				{ ...planFilter, [field]: { $exists: false } },
				{ $set: { [field]: value } },
				{ timestamps: false },
			);
			migrated += result?.modifiedCount || 0;
		}
	}
	return { migrated };
}

function mapAccessibleTenant(user, membership) {
	const tenant = membership.tenant;
	if (!tenant) return null;
	return {
		tenantId: tenant._id.toString(),
		host_id: tenant.host_id,
		name: tenant.name,
		role: membership.role,
		membershipId: membership._id.toString(),
		is_primary: user?.tenant && user.tenant.toString() === tenant._id.toString(),
	};
}

export function pickActiveTenantContext(accessibleTenants, preferredTenantId = null, preferredHostId = null) {
	if (!accessibleTenants?.length) return null;

	if (preferredTenantId) {
		const preferred = accessibleTenants.find((tenant) => tenant.tenantId === preferredTenantId);
		if (preferred) return preferred;
	}

	if (preferredHostId) {
		const preferred = accessibleTenants.find((tenant) => tenant.host_id === preferredHostId);
		if (preferred) return preferred;
	}

	const primary = accessibleTenants.find((tenant) => tenant.is_primary);
	if (primary) return primary;

	return accessibleTenants[0];
}

export async function ensureOwnerMembershipForUser(userOrId) {
	const user = typeof userOrId === 'object'
		? userOrId
		: await User.findById(userOrId).select('tenant host_id');

	if (!user?.tenant || !user?.host_id) return null;
	const ownedTenant = await primaryTenantQuery(Tenant.findOne({ _id: user.tenant, host_id: user.host_id, owner: user._id, is_active: { $ne: false }, 'deletion.requested_at': null }).select('_id'));
	if (!ownedTenant) return null;

	let release;
	try { release = await acquireTenantWork(user.host_id); } catch (error) { if (error.code === 'account_unavailable') return null; throw error; }
	try {
	return await TenantMember.findOneAndUpdate(
		{ tenant: user.tenant, user: user._id },
		{
			$setOnInsert: {
				host_id: user.host_id,
				role: 'owner',
				joined_at: new Date(),
			},
		},
		{ upsert: true, returnDocument: 'after' },
	);
	} finally { await release(); }
}

export async function listAccessibleTenantsForUser(userId) {
	const user = await primaryTenantQuery(User.findById(userId).select('tenant host_id is_active'));
	if (!user || user.is_active === false) return [];

	if (user.tenant && user.host_id) {
		await ensureOwnerMembershipForUser(user);
	}

	const memberships = await primaryTenantQuery(TenantMember.find({ user: userId }).populate({ path: 'tenant', select: 'name host_id is_active deletion.requested_at', options: { readPreference: 'primary' } }));

	return memberships
		.filter((membership) => membership.tenant && membership.tenant.is_active !== false && !membership.tenant.deletion?.requested_at)
		.map((membership) => mapAccessibleTenant(user, membership))
		.filter(Boolean)
		.sort((a, b) => {
			if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
}

export async function resolveActiveTenantContext(userId, preferredTenantId = null, preferredHostId = null) {
	const accessibleTenants = await listAccessibleTenantsForUser(userId);
	const activeTenant = pickActiveTenantContext(accessibleTenants, preferredTenantId, preferredHostId);

	if (!activeTenant) {
		return {
			activeTenant: null,
			accessibleTenants,
		};
	}

	return {
		activeTenant,
		accessibleTenants,
	};
}

export function applyTenantContextToSession(session, activeTenant) {
	if (!session) return;
	if (!activeTenant) {
		delete session.tenantId;
		delete session.host_id;
		delete session.memberRole;
		return;
	}

	session.tenantId = activeTenant.tenantId;
	session.host_id = activeTenant.host_id;
	session.memberRole = activeTenant.role;
}

export async function initializeSessionTenant(session, userId, preferredTenantId = null, preferredHostId = null) {
	const context = await resolveActiveTenantContext(userId, preferredTenantId, preferredHostId);
	applyTenantContextToSession(session, context.activeTenant);
	return context;
}

export function resolveTenant(req, res, next) {
	if (req.path.startsWith('/login') || req.path.startsWith('/signup') || req.path.startsWith('/static') || req.path.startsWith('/white-label-assets') || req.path.startsWith('/admin') || req.path.startsWith('/sysadmin')) {
		return next();
	}

	if (req.session?.tenantId) {
		req.tenantId = req.session.tenantId;
		req.host_id = req.session.host_id;
	}

	next();
}

export async function createTenant(userId, name, data = {}, options = {}) {
	const plan = TENANT_PLANS.includes(data.plan) ? data.plan : 'free';
	const limits = normalizeTenantLimits(data, resolvePlanTenantLimits(plan));
	const host_id = new mongoose.Types.ObjectId().toString();
	const payload = {
		host_id,
		name,
		owner: userId,
		plan,
		...limits,
	};
	if (!options.session) return Tenant.create(payload);
	const [tenant] = await Tenant.create([payload], { session: options.session });
	return tenant;
}

export function requireTenant(req, res, next) {
	if (!req.tenantId) {
		return res.status(401).json({ error: 'Tenant not resolved' });
	}
	next();
}

export async function holdTenantRequest(hostId, req, res) {
	const release = await acquireTenantWork(hostId);
	let finished = false;
	const finish = () => { if (!finished) { finished = true; void release().catch(() => {}); } };
	res.once('finish', finish);
	const end = res.end;
	res.end = function (...args) { const result = end.apply(this, args); finish(); return result; };
}

// A small injectable boundary lets service unit fixtures model account
// availability without replacing their business-data writes.
export const accountWork = { acquire: acquireTenantWorkImpl, assertAvailable: assertTenantAvailableImpl };
export function acquireTenantWork(hostId) { return accountWork.acquire(hostId); }
export function assertTenantAvailable(hostId) { return accountWork.assertAvailable(hostId); }
