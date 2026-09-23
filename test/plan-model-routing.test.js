import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config, { getPlanLlmConfig } from '../config.js';
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
	const originalFreePlanModels = { ...config.llm.planModels.free };
	const originalProPlanModels = { ...config.llm.planModels.pro };
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
		config.llm.chatModel = 'gpt-6-sol';
		config.llm.planModels.free = {
			provider: 'openai',
			chatProvider: 'openai',
			nlSearchProvider: 'openai',
			conversationProvider: 'openai',
			chat: 'gpt-6-luna',
			nlSearch: 'gpt-6-luna',
			conversation: 'gpt-6-luna',
		};
		config.llm.planModels.pro = {
			provider: 'openai',
			chatProvider: 'openai',
			nlSearchProvider: 'openai',
			conversationProvider: 'openai',
			chat: 'gpt-6-sol',
			nlSearch: 'gpt-6-luna',
			conversation: 'gpt-6-luna',
		};
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
		config.llm.planModels.free = { ...originalFreePlanModels };
		config.llm.planModels.pro = { ...originalProPlanModels };
		Tenant.findOne = originalTenantFindOne;
	});

	it('routes managed Free chat to GPT-6 Luna', async () => {
		const content = await chatCompletion({
			hostId: 'host-1',
			provider: config.llm.chatProvider,
			model: config.llm.chatModel,
			messages: [{ role: 'user', content: 'hi' }],
		});

		assert.equal(content, 'ok');
		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-6-luna');
		assert.equal(requests[0].body.reasoning_effort, 'none');
		assert.equal(requests[0].options.headers.Authorization, 'Bearer env-openai');
	});

	it('routes managed Pro chat to GPT-6 Sol', async () => {
		tenant.plan = 'pro';

		await chatCompletion({
			hostId: 'host-1',
			provider: config.llm.chatProvider,
			model: config.llm.chatModel,
			messages: [{ role: 'user', content: 'hi' }],
		});

		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-6-sol');
		assert.equal(requests[0].body.reasoning_effort, 'none');
	});

	it('routes Free intent classification to GPT-6 Luna', async () => {
		await nlSearchCompletion({ hostId: 'host-1', messages: [{ role: 'user', content: 'hi' }] });

		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-6-luna');
	});

	it('routes Pro intent classification to GPT-6 Luna', async () => {
		tenant.plan = 'pro';

		await nlSearchCompletion({ hostId: 'host-1', messages: [{ role: 'user', content: 'hi' }] });

		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-6-luna');
	});

	it('routes Pro Typesense conversations to GPT-6 Luna', () => {
		assert.deepEqual(getPlanLlmConfig('pro', 'conversation'), {
			provider: 'openai',
			model: 'gpt-6-luna',
			thinkingLevel: '',
		});
	});

	it('falls back to the legacy plan provider when a slot provider is unset', async () => {
		config.llm.planModels.free.provider = 'google';
		delete config.llm.planModels.free.chatProvider;
		config.llm.planModels.free.chat = 'gemini-3.5-flash-lite';

		await chatCompletion({ hostId: 'host-1', messages: [{ role: 'user', content: 'hi' }] });

		assert.match(requests[0].url, /models\/gemini-3\.5-flash-lite:/);
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
		assert.equal(requests[0].body.model, 'gpt-6-sol');
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
		assert.equal(requests[0].body.model, 'gpt-6-sol');
		assert.equal(requests[0].options.headers.Authorization, 'Bearer env-openai');
	});

	it('falls back to the other provider default when the slot provider has no env key', async () => {
		config.llm.openaiApiKey = '';

		await chatCompletion({ hostId: 'host-1', messages: [{ role: 'user', content: 'hi' }] });

		// Provider switched away from the plan's provider, so the plan model no
		// longer applies — the resolved provider's default model does.
		assert.match(requests[0].url, /models\/gemini-3\.6-flash:/);
		assert.match(requests[0].url, /key=env-gemini/);
	});
});
