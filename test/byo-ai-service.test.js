import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { User } from '../model/user.js';
import { decrypt } from '../modules/encryption.js';
import { getConversationModelId } from '../modules/typesense.js';
import { getByoAiSettings, resolveLlmKeyContext, tenantHasByoKey, updateByoAiSettings } from '../services/byo_ai_service.js';

function baseByoAi() {
	return {
		global: {
			openai_api_key: '',
			gemini_api_key: '',
		},
	};
}

function baseAiInstructions() {
	return {
		global: '',
	};
}

function setPath(obj, path, value) {
	const parts = path.split('.');
	let ref = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		ref[parts[i]] = ref[parts[i]] || {};
		ref = ref[parts[i]];
	}
	ref[parts[parts.length - 1]] = value;
}

describe('BYO AI service', () => {
	const originalFindOne = Tenant.findOne;
	const originalFindOneAndUpdate = Tenant.findOneAndUpdate;
	const originalEncryptionKey = config.gitEncryptionKey;
	const originalAppUrl = config.appUrl;
	const originalIsHosted = config.isHosted;
	const originalGoogleKey = config.llm.googleApiKey;
	const originalOpenAiKey = config.llm.openaiApiKey;
	let tenant;

	beforeEach(() => {
		config.gitEncryptionKey = '12345678901234567890123456789012';
		config.appUrl = 'https://app.streamient.com';
		config.isHosted = true;
		config.llm.googleApiKey = 'env-gemini';
		config.llm.openaiApiKey = 'env-openai';
		tenant = { host_id: 'host-1', plan: 'pro', settings: { byo_ai: baseByoAi(), ai_instructions: baseAiInstructions() } };

		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => tenant,
			}),
		});
		Tenant.findOneAndUpdate = (filter, update) => {
			for (const [path, value] of Object.entries(update.$set || {})) {
				setPath(tenant, path, value);
			}
			return {
				select: () => ({
					lean: async () => tenant,
				}),
			};
		};
	});

	afterEach(() => {
		Tenant.findOne = originalFindOne;
		Tenant.findOneAndUpdate = originalFindOneAndUpdate;
		config.gitEncryptionKey = originalEncryptionKey;
		config.appUrl = originalAppUrl;
		config.isHosted = originalIsHosted;
		config.llm.googleApiKey = originalGoogleKey;
		config.llm.openaiApiKey = originalOpenAiKey;
	});

	it('stores keys encrypted and returns only configured status', async () => {
		const settings = await updateByoAiSettings('host-1', {
			global: {
				openai_api_key: 'sk-global-openai',
			},
		});

		const stored = tenant.settings.byo_ai.global.openai_api_key;
		assert.notEqual(stored, 'sk-global-openai');
		assert.equal(decrypt(stored), 'sk-global-openai');
		assert.deepEqual(settings.global.openai_api_key, {
			configured: true,
			masked: '********',
		});
		assert.equal(settings.global.gemini_api_key.configured, false);
	});

	it('clears individual keys with null or an empty string', async () => {
		await updateByoAiSettings('host-1', {
			global: {
				openai_api_key: 'sk-global-openai',
				gemini_api_key: 'gemini-global',
			},
		});

		const settings = await updateByoAiSettings('host-1', {
			global: {
				openai_api_key: null,
				gemini_api_key: '',
			},
		});

		assert.equal(tenant.settings.byo_ai.global.openai_api_key, '');
		assert.equal(tenant.settings.byo_ai.global.gemini_api_key, '');
		assert.equal(settings.global.openai_api_key.configured, false);
		assert.equal(settings.global.gemini_api_key.configured, false);
	});

	it('prefers stored tenant keys (byok mode) over environment keys', async () => {
		await updateByoAiSettings('host-1', {
			global: {
				gemini_api_key: 'custom-gemini',
			},
		});

		const ctx = await resolveLlmKeyContext({ hostId: 'host-1', scope: 'global' });

		assert.equal(ctx.mode, 'byok');
		assert.equal(ctx.keys.google, 'custom-gemini');
		assert.equal(ctx.keys.openai, '');
		assert.equal(tenantHasByoKey(tenant), true);
	});

	it('uses stored keys for any hosted plan (BYOK), env keys when self-hosted', async () => {
		await updateByoAiSettings('host-1', {
			global: {
				openai_api_key: 'global-openai',
			},
		});

		// Free plan on hosted uses the tenant's own key when one is stored.
		tenant.plan = 'free';
		const freeCtx = await resolveLlmKeyContext({ hostId: 'host-1', scope: 'global' });
		assert.equal(freeCtx.mode, 'byok');
		assert.equal(freeCtx.keys.openai, 'global-openai');

		// Self-hosted always uses env keys regardless of stored keys.
		tenant.plan = 'pro';
		config.isHosted = false;
		const selfCtx = await resolveLlmKeyContext({ hostId: 'host-1', scope: 'global' });
		assert.equal(selfCtx.mode, 'env');
		assert.equal(selfCtx.plan, null);
		assert.equal(selfCtx.keys.openai, 'env-openai');
	});

	it('falls back to managed env keys for a hosted Free tenant with no key', async () => {
		// Mocked tenant has no owner, so getBillingUserForHost resolves to no
		// billing user → no active trial → managed Free (platform key + Free models).
		tenant.plan = 'free';
		const ctx = await resolveLlmKeyContext({ hostId: 'host-1', scope: 'global' });
		assert.equal(ctx.mode, 'managed');
		assert.equal(ctx.plan, 'free');
		assert.deepEqual(ctx.keys, { openai: 'env-openai', google: 'env-gemini' });
		assert.equal(tenantHasByoKey(tenant), false);
	});

	it('marks keyless Pro tenants as managed pro', async () => {
		tenant.plan = 'pro';
		const ctx = await resolveLlmKeyContext({ hostId: 'host-1', scope: 'global' });
		assert.equal(ctx.mode, 'managed');
		assert.equal(ctx.plan, 'pro');
		assert.deepEqual(ctx.keys, { openai: 'env-openai', google: 'env-gemini' });
	});

	it('gives active no-card trials the pro managed tier', async () => {
		const originalUserFindById = User.findById;
		tenant.plan = 'free';
		tenant.owner = 'owner-1';
		User.findById = () => ({
			select: async () => ({
				subscription_status: 'trialing',
				trial_source: 'no_card',
				trial_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			}),
		});
		try {
			const ctx = await resolveLlmKeyContext({ hostId: 'host-1', scope: 'global' });
			assert.equal(ctx.mode, 'managed');
			assert.equal(ctx.plan, 'pro');
		} finally {
			User.findById = originalUserFindById;
		}
	});

	it('validates BYO AI scope and provider keys', async () => {
		await assert.rejects(
			updateByoAiSettings('host-1', { personal: { openai_api_key: 'x' } }),
			/Unknown BYO AI scope/,
		);
		await assert.rejects(
			updateByoAiSettings('host-1', { global: { anthropic_api_key: 'x' } }),
			/Unknown BYO AI provider key/,
		);
	});

	it('stores AI instructions as plain tenant settings', async () => {
		const settings = await updateByoAiSettings('host-1', {
			instructions: {
				global: 'Use account context.',
			},
		});

		assert.equal(tenant.settings.ai_instructions.global, 'Use account context.');
		assert.deepEqual(settings.instructions, {
			global: 'Use account context.',
		});
	});

	it('uses distinct Typesense conversation model IDs per LLM scope', () => {
		assert.equal(getConversationModelId('host-1', 'user-1', 'global'), 'convo-host-1-user-1');
	});
});
