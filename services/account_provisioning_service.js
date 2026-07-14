import crypto from 'node:crypto';
import mongoose from '../model/mongoose.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { createTenant } from '../modules/tenancy.js';
import { TENANT_PLANS, normalizeTenantLimits, resolvePlanTenantLimits } from '../modules/tenant_limits.js';
import { createDefaultProject } from './project_service.js';
import { ensureFreeSubscriptionForAccountHolder, ensureStripeCustomerForAccountHolder } from './billing_service.js';

export class AccountProvisioningError extends Error {
	constructor(message, code = 'ACCOUNT_PROVISIONING_INVALID', status = 400) {
		super(message);
		this.name = 'AccountProvisioningError';
		this.code = code;
		this.status = status;
	}
}

function normalizeName(value, field) {
	const normalized = typeof value === 'string' ? value.trim() : '';
	if (!normalized) throw new AccountProvisioningError(`${field} is required`);
	return normalized;
}

function normalizeEmail(value) {
	const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
		throw new AccountProvisioningError('owner_email must be a valid email address');
	}
	return normalized;
}

function withSession(query, session) {
	if (!session || typeof query?.session !== 'function') return query;
	const sessionQuery = query.session(session);
	return typeof sessionQuery?.read === 'function' ? sessionQuery.read('primary') : sessionQuery;
}

export function normalizeAccountProvisioningInput(input = {}) {
	const plan = typeof input.plan === 'string' ? input.plan.trim().toLowerCase() : '';
	if (!TENANT_PLANS.includes(plan)) throw new AccountProvisioningError('plan is invalid');

	let limits;
	try {
		limits = normalizeTenantLimits(input, resolvePlanTenantLimits(plan));
	} catch (err) {
		throw new AccountProvisioningError(err.message);
	}

	return {
		name: normalizeName(input.name, 'name'),
		owner_name: normalizeName(input.owner_name, 'owner_name'),
		owner_email: normalizeEmail(input.owner_email),
		password: typeof input.password === 'string' && input.password
			? input.password
			: crypto.randomBytes(24).toString('base64url'),
		plan,
		...limits,
	};
}

export async function provisionAccount(input, options = {}) {
	const data = normalizeAccountProvisioningInput(input);
	const userModel = options.userModel || User;
	const tenantMemberModel = options.tenantMemberModel || TenantMember;
	const createTenantFn = options.createTenant || createTenant;
	const createDefaultProjectFn = options.createDefaultProject || createDefaultProject;
	const transaction = options.transaction || ((callback) => mongoose.connection.transaction(callback));

	try {
		return await transaction(async (session) => {
			const existing = await withSession(userModel.findOne({ email: data.owner_email }), session);
			if (existing) {
				throw new AccountProvisioningError('Owner email is already registered', 'ACCOUNT_EMAIL_EXISTS', 409);
			}

			const [user] = await userModel.create([{
				email: data.owner_email,
				password: data.password,
				name: data.owner_name,
				is_verified: true,
				is_active: true,
			}], { session });

			const tenant = await createTenantFn(user._id, data.name, data, { session });
			user.tenant = tenant._id;
			user.host_id = tenant.host_id;
			await user.save({ session });

			await tenantMemberModel.create([{
				tenant: tenant._id,
				user: user._id,
				host_id: tenant.host_id,
				role: 'owner',
				joined_at: new Date(),
			}], { session });
			await createDefaultProjectFn(user._id, tenant.host_id, { session });

			return { user, tenant };
		});
	} catch (err) {
		if (err instanceof AccountProvisioningError) throw err;
		if (err?.code === 11000 && (err?.keyPattern?.email || err?.keyValue?.email)) {
			throw new AccountProvisioningError('Owner email is already registered', 'ACCOUNT_EMAIL_EXISTS', 409);
		}
		throw err;
	}
}

export async function provisionSignupAccount(pendingSignup, options = {}) {
	const defaults = resolvePlanTenantLimits('free');
	const provision = options.provisionAccount || provisionAccount;
	const { user, tenant } = await provision({
		name: pendingSignup.name,
		owner_name: pendingSignup.name,
		owner_email: pendingSignup.email,
		password: pendingSignup.password,
		plan: 'free',
		...defaults,
	}, options);

	const ensureStripeCustomer = options.ensureStripeCustomer || ensureStripeCustomerForAccountHolder;
	const ensureFreeSubscription = options.ensureFreeSubscription || ensureFreeSubscriptionForAccountHolder;
	try {
		await ensureStripeCustomer(user, tenant);
		await ensureFreeSubscription(user, tenant);
	} catch (err) {
		console.error('Stripe customer/free subscription setup failed during signup:', err);
	}
	return { user, tenant };
}
