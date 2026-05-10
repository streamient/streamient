import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { encrypt, decrypt } from '../modules/encryption.js';

export const BYO_AI_SCOPES = ['global', 'email'];
export const BYO_AI_PROVIDERS = ['openai', 'gemini'];

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
			if (!BYO_AI_SCOPES.includes(key)) {
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
		email: tenant?.settings?.ai_instructions?.email || '',
	};
}

export async function resolveLlmApiKey({ hostId = null, provider, scope = 'global' } = {}) {
	const byoProvider = normalizeProvider(provider);
	const fallback = envApiKey(provider);
	if (!hostId || !byoProvider) return fallback;
	const isHosted = new URL(config.appUrl).hostname.endsWith('kumbukum.com');
	if (!isHosted) return fallback;

	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan settings.byo_ai').lean();
	if (!tenant) return fallback;
	if (tenant.plan !== 'pro') return fallback;

	const normalizedScope = normalizeLlmScope(scope);
	const searchScopes = normalizedScope === 'email' ? ['email', 'global'] : ['global'];

	for (const candidateScope of searchScopes) {
		const value = getStoredValue(tenant, candidateScope, byoProvider);
		if (value) return decryptStoredValue(value);
	}

	return fallback;
}
