import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { encrypt, decrypt } from '../modules/encryption.js';
import { hasProFeatureAccess, getBillingUserForHost } from './subscription_access_service.js';

export const BYO_AI_SCOPES = ['global', 'email'];
export const BYO_AI_PROVIDERS = ['openai', 'gemini'];
export const AI_INSTRUCTION_SCOPES = ['global', 'email', 'email_triage'];
export const EMAIL_SETTING_FIELDS = ['auto_triage_incoming', 'send_draft_emails_automatically', 'spam_guard'];

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
	return scope === 'email' ? 'email' : 'global';
}

function getStoredValue(tenant, scope, provider) {
	const field = PROVIDER_FIELDS[provider];
	return tenant?.settings?.byo_ai?.[scope]?.[field] || '';
}

function decryptStoredValue(value) {
	if (!value) return '';
	return decrypt(value);
}

function envApiKey(providerName) {
	if (providerName === 'google' || providerName === 'gemini') return config.llm.googleApiKey;
	if (providerName === 'openai') return config.llm.openaiApiKey;
	return '';
}

function summarizeProvider(tenant, scope, provider) {
	const configured = !!getStoredValue(tenant, scope, provider);
	return {
		configured,
		masked: configured ? '********' : '',
	};
}

export function summarizeEmailSettings(tenant) {
	return {
		auto_triage_incoming: Boolean(tenant?.settings?.email?.auto_triage_incoming),
		send_draft_emails_automatically: Boolean(tenant?.settings?.email?.send_draft_emails_automatically),
		spam_guard: tenant?.settings?.email?.spam_guard || '',
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
		email: tenant?.settings?.ai_instructions?.email || '',
		email_triage: tenant?.settings?.ai_instructions?.email_triage || '',
	};
	summary.email_settings = summarizeEmailSettings(tenant);
	return summary;
}

export async function getByoAiSettings(hostId) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.byo_ai settings.ai_instructions settings.email').lean();
	return summarizeByoAiSettings(tenant);
}

export async function updateByoAiSettings(hostId, payload = {}) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('BYO AI settings payload must be an object');
	}

	const update = {};
	for (const key of Object.keys(payload)) {
		if (key === 'instructions' || key === 'email_settings') continue;
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

	if (payload.email_settings !== undefined) {
		if (!payload.email_settings || typeof payload.email_settings !== 'object' || Array.isArray(payload.email_settings)) {
			throw new Error('Email settings payload must be an object');
		}
		for (const key of Object.keys(payload.email_settings)) {
			if (!EMAIL_SETTING_FIELDS.includes(key)) {
				throw new Error(`Unknown email setting: ${key}`);
			}
			const value = payload.email_settings[key];
			if (key === 'spam_guard') {
				if (typeof value !== 'string') {
					throw new Error(`${key} must be a string`);
				}
				update[`settings.email.${key}`] = value.trim();
				continue;
			}
			if (typeof value !== 'boolean') {
				throw new Error(`${key} must be a boolean`);
			}
			update[`settings.email.${key}`] = value;
		}
	}

	if (Object.keys(update).length === 0) {
		return getByoAiSettings(hostId);
	}

	const tenant = await Tenant.findOneAndUpdate(
		{ host_id: hostId },
		{ $set: update },
		{ returnDocument: 'after' },
	).select('settings.byo_ai settings.ai_instructions settings.email').lean();

	return summarizeByoAiSettings(tenant);
}

export async function getEmailSettings(hostId) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.email').lean();
	return summarizeEmailSettings(tenant);
}

export async function getAiInstructions(hostId) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.ai_instructions').lean();
	return {
		global: tenant?.settings?.ai_instructions?.global || '',
		email: tenant?.settings?.ai_instructions?.email || '',
		email_triage: tenant?.settings?.ai_instructions?.email_triage || '',
	};
}

/**
 * Resolve the API key to use for an LLM call.
 *
 * New pricing model:
 *  - Free plan = Bring Your Own Key. The tenant's own key is used for any plan
 *    (incl. Free); there is NO fallback to our managed (env) keys for Free.
 *  - Pro / active trial = Turnkey managed AI. Falls back to our env keys when
 *    no personal key is set (Pro users may still override with their own key).
 *  - Self-hosted = env keys only.
 *
 * Returns `null` when a hosted Free tenant has no key configured, so the caller
 * surfaces a "add your API key" error instead of silently using our managed key.
 */
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
 * none is set. Unlike resolveLlmApiKey this never falls back to managed/env keys
 * — used to verify the key the user actually saved.
 */
export async function getStoredProviderKey(hostId, provider, scope = 'global') {
	const byoProvider = normalizeProvider(provider);
	if (!hostId || !byoProvider) return '';
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.byo_ai').lean();
	if (!tenant) return '';
	const value = getStoredValue(tenant, normalizeLlmScope(scope), byoProvider);
	return value ? decryptStoredValue(value) : '';
}

export async function resolveLlmApiKey({ hostId = null, provider, scope = 'global' } = {}) {
	const byoProvider = normalizeProvider(provider);
	const fallback = envApiKey(provider);
	if (!hostId || !byoProvider) return fallback;
	const isHosted = config.isHosted;
	if (!isHosted) return fallback;

	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan settings.byo_ai').lean();
	if (!tenant) return fallback;

	// 1. Prefer the tenant's own BYO key (the Free BYOK path; also a Pro override).
	const normalizedScope = normalizeLlmScope(scope);
	const searchScopes = normalizedScope === 'email' ? ['email', 'global'] : ['global'];
	for (const candidateScope of searchScopes) {
		const value = getStoredValue(tenant, candidateScope, byoProvider);
		if (value) return decryptStoredValue(value);
	}

	// 2. No personal key: managed (turnkey) fallback only for plans that include
	//    managed AI — Pro or an active trial.
	if (tenant.plan === 'pro') return fallback;
	const billingUser = await getBillingUserForHost(hostId);
	if (hasProFeatureAccess(billingUser, tenant.plan, isHosted)) return fallback;

	// 3. Free plan without a key: no managed fallback.
	return null;
}
