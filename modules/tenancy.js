import mongoose from 'mongoose';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';

const tenantSchema = new mongoose.Schema(
	{
		host_id: { type: String, required: true, unique: true, index: true },
		name: { type: String, required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		is_active: { type: Boolean, default: true },
		plan: { type: String, enum: ['free', 'starter', 'pro'], default: 'free' },
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
				email: { type: String, default: '' },
				email_triage: { type: String, default: '' },
			},
			email: {
				auto_triage_incoming: { type: Boolean, default: false },
				send_draft_emails_automatically: { type: Boolean, default: false },
			},
		},
	},
	{ timestamps: true },
);

export const Tenant = mongoose.model('Tenant', tenantSchema);

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

	return TenantMember.findOneAndUpdate(
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
}

export async function listAccessibleTenantsForUser(userId) {
	const user = await User.findById(userId).select('tenant host_id');
	if (!user) return [];

	if (user.tenant && user.host_id) {
		await ensureOwnerMembershipForUser(user);
	}

	const memberships = await TenantMember.find({ user: userId })
		.populate('tenant', 'name host_id is_active')
		.lean();

	return memberships
		.filter((membership) => membership.tenant && membership.tenant.is_active !== false)
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
	if (req.path.startsWith('/login') || req.path.startsWith('/signup') || req.path.startsWith('/static') || req.path.startsWith('/admin') || req.path.startsWith('/sysadmin')) {
		return next();
	}

	if (req.session?.tenantId) {
		req.tenantId = req.session.tenantId;
		req.host_id = req.session.host_id;
	}

	next();
}

export async function createTenant(userId, name) {
	const host_id = new mongoose.Types.ObjectId().toString();
	const tenant = await Tenant.create({
		host_id,
		name,
		owner: userId,
	});
	return tenant;
}

export function requireTenant(req, res, next) {
	if (!req.tenantId) {
		return res.status(401).json({ error: 'Tenant not resolved' });
	}
	next();
}
