import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { decrypt } from '../modules/encryption.js';
import { getConversationModelId } from '../modules/typesense.js';
import { getByoAiSettings, resolveLlmApiKey, updateByoAiSettings } from '../services/byo_ai_service.js';

function baseByoAi() {
	return {
		global: {
			openai_api_key: '',
			gemini_api_key: '',
		},
		email: {
			openai_api_key: '',
			gemini_api_key: '',
		},
	};
}

function baseAiInstructions() {
	return {
		global: '',
		email: '',
		email_triage: '',
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
	const originalGoogleKey = config.llm.googleApiKey;
	const originalOpenAiKey = config.llm.openaiApiKey;
	let tenant;

	beforeEach(() => {
		config.gitEncryptionKey = '12345678901234567890123456789012';
		config.appUrl = 'https://app.kumbukum.com';
		config.llm.googleApiKey = 'env-gemini';
		config.llm.openaiApiKey = 'env-openai';
		tenant = { host_id: 'host-1', plan: 'pro', settings: { byo_ai: baseByoAi(), ai_instructions: baseAiInstructions(), email: {} } };

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

	it('resolves global custom keys before environment keys', async () => {
		await updateByoAiSettings('host-1', {
			global: {
				gemini_api_key: 'custom-gemini',
			},
		});

		const key = await resolveLlmApiKey({ hostId: 'host-1', provider: 'google', scope: 'global' });

		assert.equal(key, 'custom-gemini');
	});

	it('ignores stored keys outside hosted Pro runtime resolution', async () => {
		await updateByoAiSettings('host-1', {
			global: {
				openai_api_key: 'global-openai',
			},
		});

		tenant.plan = 'starter';
		assert.equal(
			await resolveLlmApiKey({ hostId: 'host-1', provider: 'openai', scope: 'global' }),
			'env-openai',
		);

		tenant.plan = 'pro';
		config.appUrl = 'http://localhost:3000';
		assert.equal(
			await resolveLlmApiKey({ hostId: 'host-1', provider: 'openai', scope: 'global' }),
			'env-openai',
		);
	});

	it('falls back from email to global to environment keys', async () => {
		assert.equal(
			await resolveLlmApiKey({ hostId: 'host-1', provider: 'openai', scope: 'email' }),
			'env-openai',
		);

		await updateByoAiSettings('host-1', {
			global: {
				openai_api_key: 'global-openai',
			},
		});
		assert.equal(
			await resolveLlmApiKey({ hostId: 'host-1', provider: 'openai', scope: 'email' }),
			'global-openai',
		);

		await updateByoAiSettings('host-1', {
			email: {
				openai_api_key: 'email-openai',
			},
		});
		assert.equal(
			await resolveLlmApiKey({ hostId: 'host-1', provider: 'openai', scope: 'email' }),
			'email-openai',
		);
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
				email: 'Prioritize support replies.',
				email_triage: 'Escalate billing issues.',
			},
		});

		assert.equal(tenant.settings.ai_instructions.global, 'Use account context.');
		assert.equal(tenant.settings.ai_instructions.email, 'Prioritize support replies.');
		assert.equal(tenant.settings.ai_instructions.email_triage, 'Escalate billing issues.');
		assert.deepEqual(settings.instructions, {
			global: 'Use account context.',
			email: 'Prioritize support replies.',
			email_triage: 'Escalate billing issues.',
		});
	});

	it('stores email settings as booleans with false defaults', async () => {
		let settings = await getByoAiSettings('host-1');
		assert.deepEqual(settings.email_settings, {
			auto_triage_incoming: false,
			send_draft_emails_automatically: false,
		});

		settings = await updateByoAiSettings('host-1', {
			email_settings: {
				auto_triage_incoming: true,
				send_draft_emails_automatically: true,
			},
		});

		assert.equal(tenant.settings.email.auto_triage_incoming, true);
		assert.equal(tenant.settings.email.send_draft_emails_automatically, true);
		assert.deepEqual(settings.email_settings, {
			auto_triage_incoming: true,
			send_draft_emails_automatically: true,
		});
	});

	it('validates email setting keys and types', async () => {
		await assert.rejects(
			updateByoAiSettings('host-1', { email_settings: { unknown: true } }),
			/Unknown email setting/,
		);
		await assert.rejects(
			updateByoAiSettings('host-1', { email_settings: { auto_triage_incoming: 'true' } }),
			/auto_triage_incoming must be a boolean/,
		);
	});

	it('uses distinct Typesense conversation model IDs per LLM scope', () => {
		assert.equal(getConversationModelId('host-1', 'user-1', 'global'), 'convo-host-1-user-1');
		assert.equal(getConversationModelId('host-1', 'user-1', 'email'), 'convo-host-1-user-1-email');
	});
});
