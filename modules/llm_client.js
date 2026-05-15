import config from '../config.js';
import { resolveLlmApiKey } from '../services/byo_ai_service.js';

const PROVIDERS = {
	openai: {
		baseUrl: 'https://api.openai.com/v1',
		defaultModel: 'gpt-4o',
	},
	google: {
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		defaultModel: 'gemini-2.0-flash',
	},
	groq: {
		baseUrl: 'https://api.groq.com/openai/v1',
		defaultModel: 'llama-3.3-70b-versatile',
	},
	cerebras: {
		baseUrl: 'https://api.cerebras.ai/v1',
		defaultModel: 'llama-3.3-70b',
	},
};

function usesMaxCompletionTokens(providerName, model = '') {
	if (providerName !== 'openai') return false;
	return /^(gpt-5|gpt-4\.1|o[134]|o\d)/i.test(String(model || ''));
}

function applyTokenLimit(body, providerName, model, maxTokens) {
	if (usesMaxCompletionTokens(providerName, model)) {
		body.max_completion_tokens = maxTokens;
		return body;
	}
	body.max_tokens = maxTokens;
	return body;
}

/**
 * Resolve provider name and API key.
 * Accepts an explicit provider string or falls back to config.llm.chatProvider.
 */
async function resolveProvider(providerName, options = {}) {
	const name = providerName || config.llm.chatProvider || 'google';
	const provider = PROVIDERS[name];
	if (!provider) throw new Error(`Unknown LLM provider: ${name}`);

	const apiKey = await resolveLlmApiKey({
		hostId: options.hostId,
		provider: name,
		scope: options.scope,
	});
	if (!apiKey) throw new Error(`API key not configured for provider: ${name}`);

	return { name, provider, apiKey };
}

/**
 * Chat completion — returns streaming response or full text.
 *
 * Options:
 *   messages  - Array of {role, content} messages
 *   stream    - Boolean, return a ReadableStream (default false)
 *   provider  - Explicit provider name (overrides config)
 *   model     - Explicit model name (overrides config)
 *   maxTokens - Max tokens (default 4096)
 *   hostId    - Tenant host ID for account-scoped API key resolution
 *   scope     - LLM key scope: global or email
 */
export async function chatCompletion({ messages, stream = false, provider: providerOverride, model: modelOverride, maxTokens = 4096, hostId = null, scope = 'global' }) {
	const { name, provider, apiKey } = await resolveProvider(providerOverride, { hostId, scope });
	const model = modelOverride || provider.defaultModel;

	if (name === 'google') {
		return googleChat({ messages, model, stream, apiKey, maxTokens });
	}

	// OpenAI-compatible API (OpenAI, Groq, Cerebras)
	const body = applyTokenLimit({
		model,
		messages,
		stream,
	}, name, model, maxTokens);
	const response = await fetch(`${provider.baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`LLM API error (${response.status}): ${err}`);
	}

	if (stream) return response.body;

	const data = await response.json();
	return data.choices[0].message.content;
}

async function googleChat({ messages, model, stream, apiKey, maxTokens = 4096 }) {
	// Convert OpenAI format to Gemini format
	const contents = messages
		.filter((m) => m.role !== 'system')
		.map((m) => ({
			role: m.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: m.content }],
		}));

	const systemInstruction = messages.find((m) => m.role === 'system');

	const endpoint = stream ? 'streamGenerateContent' : 'generateContent';
	const url = `${PROVIDERS.google.baseUrl}/models/${model}:${endpoint}?key=${apiKey}${stream ? '&alt=sse' : ''}`;

	const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
	if (systemInstruction) {
		body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
	}

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Gemini API error (${response.status}): ${err}`);
	}

	if (stream) return response.body;

	const data = await response.json();
	return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Convenience: chat completion using the NL search model (lightweight, fast).
 */
export async function nlSearchCompletion({ messages, maxTokens = 1024, hostId = null, scope = 'global' }) {
	return chatCompletion({
		messages,
		provider: config.llm.nlSearchProvider,
		model: config.llm.nlSearchModel,
		maxTokens,
		hostId,
		scope,
	});
}

/**
 * Convenience: chat completion using the main chat model (richer).
 */
export async function chatModelCompletion({ messages, stream = false, maxTokens = 4096, hostId = null, scope = 'global' }) {
	return chatCompletion({
		messages,
		stream,
		provider: config.llm.chatProvider,
		model: config.llm.chatModel,
		maxTokens,
		hostId,
		scope,
	});
}

/**
 * Convenience: email chat completion using the Email AI model.
 */
export async function emailAiCompletion({ messages, stream = false, maxTokens = 4096, hostId = null }) {
	return chatCompletion({
		messages,
		stream,
		provider: config.llm.emailAiProvider,
		model: config.llm.emailAiModel,
		maxTokens,
		hostId,
		scope: 'email',
	});
}

/**
 * Convenience: email triage completion using the Email triage model.
 */
export async function emailTriageCompletion({ messages, maxTokens = 4096, hostId = null }) {
	return chatCompletion({
		messages,
		provider: config.llm.emailTriageProvider,
		model: config.llm.emailTriageModel,
		maxTokens,
		hostId,
		scope: 'email',
	});
}

/**
 * Parse an LLM streaming response body into an async iterator of text chunks.
 * Handles both OpenAI-compatible SSE and Google Gemini SSE formats.
 */
export async function* parseStreamChunks(body, providerName) {
	const decoder = new TextDecoder();
	let buffer = '';
	const isGoogle = providerName === 'google';

	for await (const chunk of body) {
		buffer += decoder.decode(chunk, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (!line.startsWith('data: ')) continue;
			const payload = line.slice(6).trim();
			if (payload === '[DONE]') return;

			try {
				const json = JSON.parse(payload);
				let text;
				if (isGoogle) {
					text = json.candidates?.[0]?.content?.parts?.[0]?.text;
				} else {
					text = json.choices?.[0]?.delta?.content;
				}
				if (text) yield text;
			} catch {
				// skip malformed chunks
			}
		}
	}
}

/**
 * Resolve the current chat provider name.
 */
export function getChatProviderName() {
	return config.llm.chatProvider || 'google';
}
