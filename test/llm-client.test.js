import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { emailAiCompletion, emailTriageCompletion } from '../modules/llm_client.js';

describe('LLM client email model routing', () => {
	const originalFetch = globalThis.fetch;
	const originalAppUrl = config.appUrl;
	const originalOpenAiKey = config.llm.openaiApiKey;
	const originalEmailAiModel = config.llm.emailAiModel;
	const originalEmailAiProvider = config.llm.emailAiProvider;
	const originalEmailTriageModel = config.llm.emailTriageModel;
	const originalEmailTriageProvider = config.llm.emailTriageProvider;
	let requests;

	beforeEach(() => {
		requests = [];
		config.appUrl = 'http://localhost:3000';
		config.llm.openaiApiKey = 'env-openai';
		config.llm.emailAiModel = 'email-ai-model';
		config.llm.emailAiProvider = 'openai';
		config.llm.emailTriageModel = 'email-triage-model';
		config.llm.emailTriageProvider = 'openai';
		globalThis.fetch = async (url, options) => {
			requests.push({ url, options, body: JSON.parse(options.body) });
			return {
				ok: true,
				json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
			};
		};
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		config.appUrl = originalAppUrl;
		config.llm.openaiApiKey = originalOpenAiKey;
		config.llm.emailAiModel = originalEmailAiModel;
		config.llm.emailAiProvider = originalEmailAiProvider;
		config.llm.emailTriageModel = originalEmailTriageModel;
		config.llm.emailTriageProvider = originalEmailTriageProvider;
	});

	it('uses the Email AI model for email chat completions', async () => {
		const content = await emailAiCompletion({
			hostId: 'host-1',
			messages: [{ role: 'user', content: 'Summarize this email' }],
		});

		assert.equal(content, 'ok');
		assert.equal(requests[0].body.model, 'email-ai-model');
		assert.equal(requests[0].options.headers.Authorization, 'Bearer env-openai');
	});

	it('uses the Email triage model for email triage completions', async () => {
		await emailTriageCompletion({
			hostId: 'host-1',
			messages: [{ role: 'user', content: 'Triage this email' }],
		});

		assert.equal(requests[0].body.model, 'email-triage-model');
	});
});
