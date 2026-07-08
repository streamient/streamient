import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { encrypt } from '../modules/encryption.js';
import { chatCompletion, nlSearchCompletion } from '../modules/llm_client.js';

describe('per-plan managed model routing', () => {
	const originalFetch = globalThis.fetch;
	const originalIsHosted = config.isHosted;
	const originalGoogleKey = config.llm.googleApiKey;
	const originalOpenAiKey = config.llm.openaiApiKey;
	const originalChatProvider = config.llm.chatProvider;
	const originalChatModel = config.llm.chatModel;
	const originalEncryptionKey = config.gitEncryptionKey;
	const originalTenantFindOne = Tenant.findOne;
	let requests;
	let tenant;

	beforeEach(() => {
		requests = [];
		config.isHosted = true;
		config.gitEncryptionKey = '12345678901234567890123456789012';
		config.llm.googleApiKey = 'env-gemini';
		config.llm.openaiApiKey = 'env-openai';
		// Production-style global config points at OpenAI. Managed tenants must
		// land on their plan's model matrix, not the global model.
		config.llm.chatProvider = 'openai';
		config.llm.chatModel = 'gpt-5.4-mini';
		tenant = {
			host_id: 'host-1',
			plan: 'free',
			settings: { byo_ai: { global: { openai_api_key: '', gemini_api_key: '' } } },
		};
		Tenant.findOne = () => ({ select: () => ({ lean: async () => tenant }) });
		globalThis.fetch = async (url, options) => {
			requests.push({ url: String(url), options, body: JSON.parse(options.body) });
			return {
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'ok' } }],
					candidates: [{ content: { parts: [{ text: 'ok' }] } }],
				}),
			};
		};
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		config.isHosted = originalIsHosted;
		config.gitEncryptionKey = originalEncryptionKey;
		config.llm.googleApiKey = originalGoogleKey;
		config.llm.openaiApiKey = originalOpenAiKey;
		config.llm.chatProvider = originalChatProvider;
		config.llm.chatModel = originalChatModel;
		Tenant.findOne = originalTenantFindOne;
	});

	it('routes managed Free tenants to the Free plan model on Gemini', async () => {
		const content = await chatCompletion({
			hostId: 'host-1',
			provider: config.llm.chatProvider,
			model: config.llm.chatModel,
			messages: [{ role: 'user', content: 'hi' }],
		});

		assert.equal(content, 'ok');
		assert.match(requests[0].url, /generativelanguage\.googleapis\.com/);
		assert.match(requests[0].url, /models\/gemini-2\.5-flash-lite:/);
		assert.match(requests[0].url, /key=env-gemini/);
	});

	it('routes managed Pro tenants to the Pro chat model on OpenAI', async () => {
		tenant.plan = 'pro';

		await chatCompletion({
			hostId: 'host-1',
			provider: config.llm.chatProvider,
			model: config.llm.chatModel,
			messages: [{ role: 'user', content: 'hi' }],
		});

		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-5.5');
		assert.equal(requests[0].options.headers.Authorization, 'Bearer env-openai');
	});

	it('uses the nlSearch plan slot for intent classification', async () => {
		await nlSearchCompletion({ hostId: 'host-1', messages: [{ role: 'user', content: 'hi' }] });

		assert.match(requests[0].url, /models\/gemini-2\.5-flash-lite:/);
	});

	it('uses the Pro nlSearch model for Pro intent classification', async () => {
		tenant.plan = 'pro';

		await nlSearchCompletion({ hostId: 'host-1', messages: [{ role: 'user', content: 'hi' }] });

		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-5.4-mini');
	});

	it('keeps the Pro conversation model on the high-quality chat tier', () => {
		assert.equal(config.llm.planModels.pro.conversation, 'gpt-5.5');
	});

	it('keeps BYOK tenants on their own key and the global model config', async () => {
		tenant.settings.byo_ai.global.openai_api_key = encrypt('tenant-openai');

		await chatCompletion({
			hostId: 'host-1',
			provider: config.llm.chatProvider,
			model: config.llm.chatModel,
			messages: [{ role: 'user', content: 'hi' }],
		});

		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-5.4-mini');
		assert.equal(requests[0].options.headers.Authorization, 'Bearer tenant-openai');
	});

	it('keeps self-hosted installs on the deployment-global model and env keys', async () => {
		config.isHosted = false;

		await chatCompletion({
			hostId: 'host-1',
			provider: config.llm.chatProvider,
			model: config.llm.chatModel,
			messages: [{ role: 'user', content: 'hi' }],
		});

		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-5.4-mini');
		assert.equal(requests[0].options.headers.Authorization, 'Bearer env-openai');
	});

	it('falls back to the other provider default when the plan provider has no env key', async () => {
		config.llm.googleApiKey = '';

		await chatCompletion({ hostId: 'host-1', messages: [{ role: 'user', content: 'hi' }] });

		// Provider switched away from the plan's provider, so the plan model no
		// longer applies — the resolved provider's default model does.
		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, config.llm.openaiModel);
		assert.equal(requests[0].options.headers.Authorization, 'Bearer env-openai');
	});
});
