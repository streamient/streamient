import mongoose from '../model/mongoose.js';
import { User } from '../model/user.js';
import { TenantMember, TEAM_MEMBER_ROLE_RANK } from '../model/tenant_member.js';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Tenant } from '../modules/tenancy.js';
import { TENANT_PLANS, normalizeTenantLimit, resolveStoredTenantLimits } from '../modules/tenant_limits.js';

export class AdminAccountError extends Error {
	constructor(message, status = 400, code = 'ADMIN_ACCOUNT_INVALID') {
		super(message);
		this.name = 'AdminAccountError';
		this.status = status;
		this.code = code;
	}
}

function normalizeRequiredName(value, field) {
	const normalized = typeof value === 'string' ? value.trim() : '';
	if (!normalized) throw new AdminAccountError(`${field} is required`);
	return normalized;
}

function normalizeOwnerEmail(value) {
	const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
		throw new AdminAccountError('owner_email must be a valid email address');
	}
	return normalized;
}

function formatUser(user) {
	if (!user || typeof user !== 'object') return null;
	return {
		_id: user._id?.toString() || '',
		name: user.name || '',
		email: user.email || '',
		is_active: user.is_active !== false,
		last_login: user.last_login || null,
		createdAt: user.createdAt || null,
	};
}

function formatMember(member) {
	if (!member?.user) return null;
	return {
		_id: member._id?.toString() || null,
		role: member.role || 'member',
		joined_at: member.joined_at || member.createdAt || null,
		user: formatUser(member.user),
	};
}

function sortMembers(a, b) {
	const roleDiff = (TEAM_MEMBER_ROLE_RANK[b.role] || 0) - (TEAM_MEMBER_ROLE_RANK[a.role] || 0);
	if (roleDiff) return roleDiff;
	return (a.user?.name || '').localeCompare(b.user?.name || '');
}

export function formatAdminAccount(tenant, counts = {}) {
	return {
		_id: tenant._id?.toString() || '',
		host_id: tenant.host_id || '',
		name: tenant.name || '',
		is_active: tenant.is_active !== false,
		plan: tenant.plan || 'free',
		...resolveStoredTenantLimits(tenant),
		owner: formatUser(tenant.owner),
		memberCount: counts.memberCount ?? 0,
		projectCount: counts.projectCount ?? 0,
		itemCount: counts.itemCount ?? 0,
		createdAt: tenant.createdAt || null,
		updatedAt: tenant.updatedAt || null,
	};
}

async function countAccountItems(hostId) {
	const filter = { host_id: hostId, in_trash: { $ne: true } };
	const counts = await Promise.all([
		Note.countDocuments(filter),
		Memory.countDocuments(filter),
		Url.countDocuments(filter),
	]);
	return counts.reduce((sum, count) => sum + count, 0);
}

export async function listAdminAccounts({ status = 'active', page = 1, limit = 50 } = {}) {
	const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
	const normalizedStatus = status === 'inactive' ? 'inactive' : 'active';
	const filter = normalizedStatus === 'inactive' ? { is_active: false } : { is_active: { $ne: false } };
	const [tenants, total] = await Promise.all([
		Tenant.find(filter)
			.select('host_id name owner is_active plan limit_projects limit_users limit_ai_workflows_per_day createdAt updatedAt')
			.populate('owner', 'name email is_active last_login createdAt')
			.sort({ createdAt: -1 })
			.skip((normalizedPage - 1) * limit)
			.limit(limit)
			.lean(),
		Tenant.countDocuments(filter),
	]);

	const accounts = await Promise.all(tenants.map(async (tenant) => {
		const [projectCount, itemCount, memberCount] = await Promise.all([
			Project.countDocuments({ host_id: tenant.host_id, is_active: { $ne: false } }),
			countAccountItems(tenant.host_id),
			TenantMember.countDocuments({ tenant: tenant._id }),
		]);
		return formatAdminAccount(tenant, { projectCount, itemCount, memberCount });
	}));

	return {
		accounts,
		total,
		page: normalizedPage,
		pages: Math.ceil(total / limit),
		status: normalizedStatus,
	};
}

export async function getAdminAccount(tenantId) {
	if (!mongoose.isValidObjectId(tenantId)) return null;
	const tenant = await Tenant.findById(tenantId)
		.select('host_id name owner is_active plan limit_projects limit_users limit_ai_workflows_per_day createdAt updatedAt')
		.populate('owner', 'name email is_active last_login createdAt')
		.lean();
	if (!tenant) return null;

	const [projectCount, itemCount, memberships] = await Promise.all([
		Project.countDocuments({ host_id: tenant.host_id, is_active: { $ne: false } }),
		countAccountItems(tenant.host_id),
		TenantMember.find({ tenant: tenant._id })
			.populate('user', 'name email is_active last_login createdAt')
			.sort({ createdAt: 1 })
			.lean(),
	]);

	const members = memberships.map(formatMember).filter(Boolean);
	const ownerId = tenant.owner?._id?.toString();
	if (ownerId && !members.some((member) => member.user?._id === ownerId)) {
		members.push({
			_id: null,
			role: 'owner',
			joined_at: tenant.createdAt || null,
			user: formatUser(tenant.owner),
		});
	}

	return {
		...formatAdminAccount(tenant, { projectCount, itemCount, memberCount: members.length }),
		members: members.sort(sortMembers),
	};
}

export async function updateAdminAccount(tenantId, input = {}, options = {}) {
	if (!mongoose.isValidObjectId(tenantId)) return null;
	const tenant = await Tenant.findById(tenantId).select('owner').lean();
	if (!tenant) return null;

	const tenantUpdate = {};
	const ownerUpdate = {};
	if (input.name !== undefined) tenantUpdate.name = normalizeRequiredName(input.name, 'name');
	if (input.owner_name !== undefined) ownerUpdate.name = normalizeRequiredName(input.owner_name, 'owner_name');
	if (input.owner_email !== undefined) ownerUpdate.email = normalizeOwnerEmail(input.owner_email);
	if (input.is_active !== undefined) {
		if (typeof input.is_active !== 'boolean') throw new AdminAccountError('is_active must be a boolean');
		tenantUpdate.is_active = input.is_active;
	}
	if (input.plan !== undefined) {
		if (!TENANT_PLANS.includes(input.plan)) throw new AdminAccountError('Invalid plan');
		tenantUpdate.plan = input.plan;
	}
	for (const field of ['limit_projects', 'limit_users', 'limit_ai_workflows_per_day']) {
		if (input[field] === undefined) continue;
		try {
			tenantUpdate[field] = normalizeTenantLimit(input[field], field);
		} catch (err) {
			throw new AdminAccountError(err.message);
		}
	}

	const ownerId = tenant.owner?.toString();
	if (Object.keys(ownerUpdate).length && !ownerId) {
		throw new AdminAccountError('Account owner not found', 409, 'ACCOUNT_OWNER_MISSING');
	}
	if (ownerUpdate.email) {
		const duplicate = await User.findOne({ email: ownerUpdate.email, _id: { $ne: ownerId } }).select('_id').lean();
		if (duplicate) throw new AdminAccountError('Owner email is already registered', 409, 'ACCOUNT_EMAIL_EXISTS');
	}

	const transaction = options.transaction || ((callback) => mongoose.connection.transaction(callback));
	try {
		await transaction(async (session) => {
			if (Object.keys(tenantUpdate).length) {
				await Tenant.findByIdAndUpdate(tenantId, tenantUpdate, { session, runValidators: true });
			}
			if (Object.keys(ownerUpdate).length) {
				await User.findByIdAndUpdate(ownerId, ownerUpdate, { session, runValidators: true });
			}
		});
	} catch (err) {
		if (err?.code === 11000 && (err?.keyPattern?.email || err?.keyValue?.email)) {
			throw new AdminAccountError('Owner email is already registered', 409, 'ACCOUNT_EMAIL_EXISTS');
		}
		throw err;
	}

	const loadAccount = options.getAccount || getAdminAccount;
	return loadAccount(tenantId);
}
