import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { encrypt, decrypt } from '../modules/encryption.js';
import { hasProFeatureAccess, getBillingUserForHost } from './subscription_access_service.js';

export const BYO_AI_SCOPES = ['global'];
export const BYO_AI_PROVIDERS = ['openai', 'gemini'];
export const AI_INSTRUCTION_SCOPES = ['global'];

const PROVIDER_FIELDS = {
	openai: 'openai_api_key',
	gemini: 'gemini_api_key',
};

function normalizeProvider(provider) {
	if (provider === 'google') return 'gemini';
	if (provider === 'gemini') return 'gemini';
	if (provider === 'openai') return 'openai';
	return null;
}

export function normalizeLlmScope(scope) {
	return 'global';
}

function getStoredValue(tenant, scope, provider) {
	const field = PROVIDER_FIELDS[provider];
	return tenant?.settings?.byo_ai?.[scope]?.[field] || '';
}

function decryptStoredValue(value) {
	if (!value) return '';
	return decrypt(value);
}

function summarizeProvider(tenant, scope, provider) {
	const configured = !!getStoredValue(tenant, scope, provider);
	return {
		configured,
		masked: configured ? '********' : '',
	};
}

export function summarizeByoAiSettings(tenant) {
	const summary = {};
	for (const scope of BYO_AI_SCOPES) {
		summary[scope] = {};
		for (const provider of BYO_AI_PROVIDERS) {
			summary[scope][PROVIDER_FIELDS[provider]] = summarizeProvider(tenant, scope, provider);
		}
	}
	summary.instructions = {
		global: tenant?.settings?.ai_instructions?.global || '',
	};
	return summary;
}

export async function getByoAiSettings(hostId) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.byo_ai settings.ai_instructions').lean();
	return summarizeByoAiSettings(tenant);
}

export async function updateByoAiSettings(hostId, payload = {}) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('BYO AI settings payload must be an object');
	}

	const update = {};
	for (const key of Object.keys(payload)) {
		if (key === 'instructions') continue;
		if (!BYO_AI_SCOPES.includes(key)) {
			throw new Error(`Unknown BYO AI scope: ${key}`);
		}
	}

	for (const scope of BYO_AI_SCOPES) {
		const section = payload[scope];
		if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
		for (const key of Object.keys(section)) {
			if (!Object.values(PROVIDER_FIELDS).includes(key)) {
				throw new Error(`Unknown BYO AI provider key: ${key}`);
			}
		}

		for (const provider of BYO_AI_PROVIDERS) {
			const field = PROVIDER_FIELDS[provider];
			if (!Object.prototype.hasOwnProperty.call(section, field)) continue;

			const path = `settings.byo_ai.${scope}.${field}`;
			const value = section[field];
			if (value === null || value === '') {
				update[path] = '';
				continue;
			}
			if (typeof value !== 'string') {
				throw new Error(`${field} must be a string`);
			}

			const trimmed = value.trim();
			update[path] = trimmed ? encrypt(trimmed) : '';
		}
	}

	if (payload.instructions !== undefined) {
		if (!payload.instructions || typeof payload.instructions !== 'object' || Array.isArray(payload.instructions)) {
			throw new Error('AI instructions payload must be an object');
		}
		for (const key of Object.keys(payload.instructions)) {
			if (!AI_INSTRUCTION_SCOPES.includes(key)) {
				throw new Error(`Unknown AI instructions scope: ${key}`);
			}
			const value = payload.instructions[key];
			if (value !== null && typeof value !== 'string') {
				throw new Error(`${key} instructions must be a string`);
			}
			update[`settings.ai_instructions.${key}`] = value ? value.trim() : '';
		}
	}

	if (Object.keys(update).length === 0) {
		return getByoAiSettings(hostId);
	}

	const tenant = await Tenant.findOneAndUpdate(
		{ host_id: hostId },
		{ $set: update },
		{ returnDocument: 'after' },
	).select('settings.byo_ai settings.ai_instructions').lean();

	return summarizeByoAiSettings(tenant);
}

export async function getAiInstructions(hostId) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.ai_instructions').lean();
	return {
		global: tenant?.settings?.ai_instructions?.global || '',
	};
}

/**
 * Turn a failed provider response into a concise, user-facing reason. Distinguishes
 * a rejected key from a depleted-credits/quota state so the verify result reflects
 * whether the key can actually run AI (not just that it authenticates).
 */
async function describeProviderError(label, res) {
	let detail = '';
	try {
		const data = await res.json();
		detail = data?.error?.message || data?.error?.status || '';
	} catch {
		/* non-JSON body */
	}
	const hay = `${res.status} ${detail}`.toLowerCase();
	if (/insufficient_quota|exceeded your current quota|\bquota\b|\bcredit|resource_exhausted|billing|prepayment/.test(hay)) {
		return `${label} key has no remaining credits or quota`;
	}
	if (res.status === 401 || res.status === 403 || /api key not valid|invalid.*key|unauthor|permission_denied|api_key_invalid/.test(hay)) {
		return `Invalid ${label} key`;
	}
	if (res.status === 429 || /rate.?limit/.test(hay)) {
		return `${label} is rate-limiting right now — try again in a moment`;
	}
	return `${label} error (${res.status})${detail ? ': ' + detail.slice(0, 140) : ''}`;
}

/**
 * Validate a user-supplied API key by making a minimal real generation call to the
 * provider (1 output token). Unlike an auth-only models-list check, this also
 * catches depleted credits / exhausted quota — so a key that authenticates but
 * can't actually generate is reported invalid. Returns { valid, error? }. Used by
 * the settings "Verify" button and the onboarding key-entry flow.
 */
export async function verifyProviderKey(provider, apiKey) {
	const byoProvider = normalizeProvider(provider);
	const key = typeof apiKey === 'string' ? apiKey.trim() : '';
	if (!byoProvider) return { valid: false, error: 'Unknown provider' };
	if (!key) return { valid: false, error: 'Enter an API key' };
	try {
		if (byoProvider === 'openai') {
			const res = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: config.llm.openaiModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
			});
			if (res.ok) return { valid: true };
			return { valid: false, error: await describeProviderError('OpenAI', res) };
		}
		// gemini
		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${config.llm.googleModel}:generateContent?key=${encodeURIComponent(key)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 1 } }),
			},
		);
		if (res.ok) return { valid: true };
		return { valid: false, error: await describeProviderError('Gemini', res) };
	} catch {
		return { valid: false, error: 'Could not reach the provider' };
	}
}

/**
 * Return the tenant's own stored (decrypted) BYO key for a provider, or '' when
 * none is set. Unlike resolveLlmKeyContext this never falls back to managed/env
 * keys — used to verify the key the user actually saved.
 */
export async function getStoredProviderKey(hostId, provider, scope = 'global') {
	const byoProvider = normalizeProvider(provider);
	if (!hostId || !byoProvider) return '';
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.byo_ai').lean();
	if (!tenant) return '';
	const value = getStoredValue(tenant, normalizeLlmScope(scope), byoProvider);
	return value ? decryptStoredValue(value) : '';
}

/**
 * Resolve LLM key material + routing context for a host.
 *
 *  - mode 'env'     — self-hosted install or no hostId: deployment env keys and
 *                     the global model config apply; plan is null.
 *  - mode 'byok'    — hosted tenant with at least one stored key: the tenant's
 *                     own (decrypted) keys are used — their cost, no daily cap,
 *                     deployment-global model config applies.
 *  - mode 'managed' — hosted tenant on our platform keys: env keys plus the
 *                     plan's managed model matrix (config.llm.planModels);
 *                     plan is 'pro' (Pro or active trial) or 'free'.
 *
 * keys.openai / keys.google are '' when unavailable — callers keep their
 * provider-fallback behavior for one-key tenants.
 */
export async function resolveLlmKeyContext({ hostId = null, scope = 'global' } = {}) {
	const envKeys = { openai: config.llm.openaiApiKey, google: config.llm.googleApiKey };
	if (!hostId || !config.isHosted) return { mode: 'env', plan: null, keys: envKeys };

	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan settings.byo_ai').lean();
	if (!tenant) return { mode: 'env', plan: null, keys: envKeys };

	const normalizedScope = normalizeLlmScope(scope);
	const storedOpenai = getStoredValue(tenant, normalizedScope, 'openai');
	const storedGemini = getStoredValue(tenant, normalizedScope, 'gemini');
	if (storedOpenai || storedGemini) {
		return {
			mode: 'byok',
			plan: tenant.plan || 'free',
			keys: {
				openai: storedOpenai ? decryptStoredValue(storedOpenai) : '',
				google: storedGemini ? decryptStoredValue(storedGemini) : '',
			},
		};
	}

	// Managed (platform-key) AI: every hosted plan falls back to our env keys —
	// the plan only decides which managed model matrix applies.
	let plan = 'free';
	if (tenant.plan === 'pro') {
		plan = 'pro';
	} else {
		const billingUser = await getBillingUserForHost(hostId);
		if (hasProFeatureAccess(billingUser, tenant.plan, true)) plan = 'pro';
	}
	return { mode: 'managed', plan, keys: envKeys };
}

/**
 * Whether a tenant (lean doc with settings.byo_ai selected) has any stored BYO
 * key. Cheap predicate for gate/limiter checks that already hold the tenant.
 */
export function tenantHasByoKey(tenant) {
	const scope = tenant?.settings?.byo_ai?.global;
	return Boolean(scope?.openai_api_key || scope?.gemini_api_key);
}
