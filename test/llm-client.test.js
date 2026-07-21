import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { chatCompletion } from '../modules/llm_client.js';

describe('LLM client model routing', () => {
	const originalFetch = globalThis.fetch;
	const originalAppUrl = config.appUrl;
	const originalGoogleKey = config.llm.googleApiKey;
	const originalOpenAiKey = config.llm.openaiApiKey;
	const originalIsHosted = config.isHosted;
	let requests;

	beforeEach(() => {
		requests = [];
		config.appUrl = 'http://localhost:3000';
		config.isHosted = false;
		config.llm.openaiApiKey = 'env-openai';
		globalThis.fetch = async (url, options) => {
			requests.push({ url, options, body: JSON.parse(options.body) });
			return {
				ok: true,
				json: async () => ({ choices: [{ message: { content: 'ok' } }], candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
			};
		};
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		config.appUrl = originalAppUrl;
		config.llm.googleApiKey = originalGoogleKey;
		config.llm.openaiApiKey = originalOpenAiKey;
		config.isHosted = originalIsHosted;
	});

	it('falls back to the other provider and its default model when the requested provider has no key', async () => {
		config.llm.googleApiKey = '';
		config.llm.openaiApiKey = 'env-openai';

		const content = await chatCompletion({
			provider: 'google',
			model: 'gemini-2.5-flash',
			messages: [{ role: 'user', content: 'hi' }],
		});

		assert.equal(content, 'ok');
		assert.match(requests[0].url, /api\.openai\.com/);
		assert.equal(requests[0].body.model, 'gpt-5.4-mini');
		assert.equal(requests[0].options.headers.Authorization, 'Bearer env-openai');
	});

	it('uses max_completion_tokens for GPT-5 OpenAI models', async () => {
		await chatCompletion({
			provider: 'openai',
			model: 'gpt-5.4-mini',
			maxTokens: 400,
			messages: [{ role: 'user', content: 'Summarize this note' }],
		});

		assert.equal(requests[0].body.model, 'gpt-5.4-mini');
		assert.equal(requests[0].body.max_tokens, undefined);
		assert.equal(requests[0].body.max_completion_tokens, 400);
	});

	it('sends the configured Gemini thinking level', async () => {
		config.llm.googleApiKey = 'env-gemini';

		await chatCompletion({
			provider: 'google',
			model: 'gemini-3.6-flash',
			thinkingLevel: 'minimal',
			maxTokens: 256,
			messages: [{ role: 'user', content: 'Classify this request' }],
		});

		assert.match(requests[0].url, /models\/gemini-3\.6-flash:/);
		assert.deepEqual(requests[0].body.generationConfig, {
			maxOutputTokens: 256,
			thinkingConfig: { thinkingLevel: 'minimal' },
		});
	});

	it('omits thinkingLevel for older Gemini models', async () => {
		config.llm.googleApiKey = 'env-gemini';

		await chatCompletion({
			provider: 'google',
			model: 'gemini-2.5-flash',
			thinkingLevel: 'minimal',
			messages: [{ role: 'user', content: 'Summarize this note' }],
		});

		assert.equal(requests[0].body.generationConfig.thinkingConfig, undefined);
	});
});
