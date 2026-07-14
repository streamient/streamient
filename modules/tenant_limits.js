import config from '../config.js';

export const TENANT_PLANS = ['free', 'pro'];

export const TENANT_LIMIT_FIELDS = [
	'limit_projects',
	'limit_users',
	'limit_ai_workflows_per_day',
];

const PLAN_LIMIT_KEYS = {
	limit_projects: 'projects',
	limit_users: 'users',
};

export function normalizeTenantLimit(value, field) {
	if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
		throw new Error(`${field} must be a whole number greater than or equal to 0`);
	}
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number < 0) {
		throw new Error(`${field} must be a whole number greater than or equal to 0`);
	}
	return number;
}

export function resolvePlanTenantLimits(plan = 'free') {
	const normalizedPlan = TENANT_PLANS.includes(plan) ? plan : 'free';
	const resourceLimits = config.planLimits?.[normalizedPlan] || config.planLimits?.free || {};
	const aiLimit = config.plans?.[normalizedPlan]?.aiDaily ?? 0;
	return Object.fromEntries(TENANT_LIMIT_FIELDS.map((field) => [
		field,
		normalizeTenantLimit(field === 'limit_ai_workflows_per_day' ? aiLimit : (resourceLimits[PLAN_LIMIT_KEYS[field]] ?? 0), field),
	]));
}

export function normalizeTenantLimits(input = {}, fallback = null) {
	const normalized = {};
	for (const field of TENANT_LIMIT_FIELDS) {
		const hasValue = Object.prototype.hasOwnProperty.call(input, field);
		normalized[field] = normalizeTenantLimit(hasValue ? input[field] : fallback?.[field], field);
	}
	return normalized;
}

export function resolveStoredTenantLimits(tenant = {}) {
	return normalizeTenantLimits(tenant, resolvePlanTenantLimits(tenant.plan || 'free'));
}

export function isTenantLimitReached(limit, count) {
	return Boolean(limit) && Number(count || 0) >= limit;
}
