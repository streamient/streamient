import config, { getPlanLlmConfig } from '../config.js';
import { resolveLlmKeyContext } from '../services/byo_ai_service.js';
import * as OtelRuntime from './otel_runtime.js';

const PROVIDERS = {
	openai: {
		baseUrl: 'https://api.openai.com/v1',
		defaultModel: config.llm.openaiModel,
	},
	google: {
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		defaultModel: config.llm.googleModel,
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

function supportsGoogleThinkingLevel(model = '') {
	return /^gemini-3(?:[.-]|$)/i.test(String(model));
}

// BYOK provider fallback order: try the requested provider first, then the
// other user-facing provider. This makes "bring your own OpenAI OR Gemini key"
// work — a tenant only needs one key, whichever provider it's for.
const BYO_FALLBACK_ORDER = {
	openai: ['openai', 'google'],
	google: ['google', 'openai'],
	gemini: ['google', 'openai'],
};

/**
 * Resolve provider name, API key, and key context.
 * Accepts an explicit provider string or falls back to config.llm.chatProvider —
 * except for managed (platform-key) tenants, whose provider comes from the
 * plan's model matrix (config.llm.planModels) regardless of the deployment's
 * global provider setting. If the resolved provider has no key but the other
 * one does, it switches (the caller then uses that provider's default model).
 */
async function resolveProvider(providerName, options = {}) {
	const ctx = await resolveLlmKeyContext({ hostId: options.hostId, scope: options.scope });
	let requested = providerName || config.llm.chatProvider || 'google';
	if (ctx.mode === 'managed') {
		requested = getPlanLlmConfig(ctx.plan, options.purpose).provider;
	}
	if (!PROVIDERS[requested]) throw new Error(`Unknown LLM provider: ${requested}`);
	const candidates = BYO_FALLBACK_ORDER[requested] || [requested];

	for (const name of candidates) {
		const provider = PROVIDERS[name];
		if (!provider) continue;
		const apiKey = ctx.keys[name] || '';
		if (apiKey) return { name, provider, apiKey, ctx, switched: name !== requested };
	}

	const err = new Error('No AI API key is configured. Add your OpenAI or Gemini API key in Settings → AI to enable AI features.');
	err.code = 'NO_AI_API_KEY';
	err.status = 400;
	throw err;
}

/**
 * True when an LLM API key is resolvable for this host — a personal BYO key, or
 * a managed/env key for Pro / active trial / self-hosted. Lets callers surface a
 * friendly "add your key" message before attempting any LLM or Typesense call.
 */
export async function hasLlmApiKey({ hostId = null, provider, scope = 'global', purpose = 'chat' } = {}) {
	try {
		await resolveProvider(provider, { hostId, scope, purpose });
		return true;
	} catch (err) {
		if (err?.code === 'NO_AI_API_KEY') return false;
		throw err;
	}
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
 *   purpose   - Managed model matrix slot: 'chat' | 'nlSearch' (default 'chat')
 *   thinkingLevel - Gemini thinking level override (minimal, low, medium, high)
 */
export async function chatCompletion({ messages, stream = false, provider: providerOverride, model: modelOverride, maxTokens = 4096, hostId = null, scope = 'global', purpose = 'chat', thinkingLevel: thinkingLevelOverride }) {
	const { name, provider, apiKey, ctx, switched } = await resolveProvider(providerOverride, { hostId, scope, purpose });
	// When we fell back to a different provider than requested, the configured
	// model override was for the original provider — use the resolved provider's
	// default model instead. Managed (platform-key) tenants are forced onto their
	// plan's model — the caller's override only applies to BYOK/self-hosted.
	let model;
	let thinkingLevel = thinkingLevelOverride;
	if (ctx.mode === 'managed') {
		const planConfig = getPlanLlmConfig(ctx.plan, purpose);
		model = (switched ? '' : planConfig.model) || provider.defaultModel;
		if (thinkingLevel === undefined) thinkingLevel = planConfig.thinkingLevel;
	} else {
		model = (switched ? '' : modelOverride) || provider.defaultModel;
		if (thinkingLevel === undefined) thinkingLevel = config.llm[`${purpose}ThinkingLevel`] || '';
	}
	const googleThinkingLevel = name === 'google' && supportsGoogleThinkingLevel(model) ? thinkingLevel : '';

	return OtelRuntime.createCustomSpan('gen_ai.chat.completion', async (span) => {
		span.setAttribute('gen_ai.system', name);
		span.setAttribute('gen_ai.request.model', model);
		span.setAttribute('gen_ai.request.max_tokens', maxTokens);
		span.setAttribute('gen_ai.request.stream', stream);
		span.setAttribute('gen_ai.input.messages', messages.length);
		span.setAttribute('gen_ai.input.estimated_tokens', estimateMessageTokens(messages));
		if (googleThinkingLevel) span.setAttribute('gen_ai.request.thinking_level', googleThinkingLevel);

		if (name === 'google') {
			const result = await googleChat({ messages, model, stream, apiKey, maxTokens, thinkingLevel: googleThinkingLevel });
			if (!stream) span.setAttribute('gen_ai.output.estimated_tokens', estimateTextTokens(result));
			return result;
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

		span.setAttribute('http.response.status_code', response.status);

		if (!response.ok) {
			const err = await response.text();
			throw new Error(`LLM API error (${response.status}): ${err}`);
		}

		if (stream) return response.body;

		const data = await response.json();
		const content = data.choices[0].message.content;
		span.setAttribute('gen_ai.output.estimated_tokens', estimateTextTokens(content));
		if (data.usage) {
			span.setAttribute('gen_ai.usage.input_tokens', data.usage.prompt_tokens || 0);
			span.setAttribute('gen_ai.usage.output_tokens', data.usage.completion_tokens || 0);
		}
		return content;
	});
}

function estimateTextTokens(value) {
	return Math.ceil(String(value || '').length / 4);
}

function estimateMessageTokens(messages = []) {
	return messages.reduce((sum, message) => sum + estimateTextTokens(message.content), 0);
}

async function googleChat({ messages, model, stream, apiKey, maxTokens = 4096, thinkingLevel = '' }) {
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
	if (thinkingLevel) body.generationConfig.thinkingConfig = { thinkingLevel };
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
		purpose: 'nlSearch',
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
		purpose: 'chat',
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
					text = json.candidates?.[0]?.content?.parts?.[0]?.text || json.choices?.[0]?.delta?.content;
				} else {
					text = json.choices?.[0]?.delta?.content || json.candidates?.[0]?.content?.parts?.[0]?.text;
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
