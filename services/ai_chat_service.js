import { searchAll, conversationSearch, getCollectionCounts } from '../modules/typesense.js';
import { nlSearchCompletion, chatModelCompletion, parseStreamChunks, getChatProviderName } from '../modules/llm_client.js';
import * as noteService from './note_service.js';
import * as memoryService from './memory_service.js';
import * as urlService from './url_service.js';
import * as emailIngestService from './email_ingest_service.js';
import { listProjects } from './project_service.js';

// ────────────────────────────────────────────────────────────────────
// Intent Classification (using lightweight NL_SEARCH_MODEL)
// ────────────────────────────────────────────────────────────────────

const INTENT_PROMPT = `You classify user messages for a knowledge management system.
Respond with JSON only. No markdown, no text outside JSON.

Intent types:
- "search": User wants to find notes, memories, URLs, emails, or pages (e.g. "find my notes about X", "what do I know about Y")
- "stats": User wants counts, totals, or statistics about their knowledge base (e.g. "how many notes do I have", "what's in my knowledge base", "show me stats", "how many items")
- "action": User wants to create, update, move, or delete items (e.g. "create a note about X", "save this URL", "move these to project Y", "remember that X")
- "analysis": User wants a summary, comparison, or deeper insight from their knowledge (e.g. "summarize my notes about X", "compare these topics")
- "conversation": Follow-up, clarification, or general chat (e.g. "tell me more", "what did you mean", "thanks")

Respond:
{"intent": "search|stats|action|analysis|conversation", "query": "extracted search keywords (for search/analysis)", "action_type": "create_note|create_memory|save_url|move_to_project|delete|null", "params": {}, "limit": null, "types": null}

Rules for "limit": if the user specifies a count (e.g. "show me 3 notes", "latest 5 URLs"), set limit to that number. Otherwise null.
Rules for "types": if the user specifies a content type (e.g. "notes", "memories", "urls", "emails"), set types to an array like ["notes"] or ["notes","memory"]. Use these type names: notes, memory, urls, emails, pages. Otherwise null (search all).

For action intents, extract params from the user message:
- create_note: {"title": "...", "content": "..."}
- create_memory: {"title": "...", "content": "..."} (also triggered by "remember this/that")
- save_url: {"url": "..."}
- move_to_project: {"item_type": "notes|memories|urls|emails", "project_name": "..."}
- delete: {"item_type": "notes|memories|urls|emails"}`;

/**
 * Classify user intent using the lightweight NL search model.
 */
async function classifyIntent(hostId, query) {
	try {
		const raw = await nlSearchCompletion({
			messages: [
				{ role: 'system', content: INTENT_PROMPT },
				{ role: 'user', content: query },
			],
			maxTokens: 256,
			hostId,
		});

		// Parse JSON from response
		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch {
			const match = raw.match(/\{[\s\S]*\}/);
			if (match) parsed = JSON.parse(match[0]);
		}

		if (parsed?.intent) return parsed;
	} catch (err) {
		console.error('Intent classification failed:', err.message);
	}

	// Fallback: treat as search
	return { intent: 'search', query, action_type: null, params: {} };
}

export function isEmailOnlyIntent(intent = {}) {
	return Array.isArray(intent.types)
		&& intent.types.length === 1
		&& intent.types[0] === 'emails';
}

export function getLlmScopeForIntent(intent = {}) {
	return isEmailOnlyIntent(intent) ? 'email' : 'global';
}

const EXPLICIT_ACTION_PATTERNS = [
	/\b(create|add|save|store|remember|delete|remove|move|copy|update|edit|rename|trash|archive)\b/i,
	/\bmake\s+(?:a|an|this|that|new)?\s*(?:note|memory)\b/i,
	/\bsave\s+this\s+url\b/i,
];

const FOLLOW_UP_REFERENCE_PATTERNS = [
	/^\s*(which|what|who|why|how|when)\b/i,
	/^\s*(tell me more|summarize|compare|explain|expand|continue)\b/i,
	/\b(the|those|these)\s+(results|items|notes|memories|urls|emails)\b/i,
	/\b(that|those|them|it|one)\b/i,
];

function hasExplicitActionLanguage(query = '', intent = {}) {
	if (!query.trim()) return false;
	if (intent.action_type === 'save_url' && /https?:\/\//i.test(query)) return true;
	return EXPLICIT_ACTION_PATTERNS.some((pattern) => pattern.test(query));
}

function looksLikeFollowUpReference(query = '') {
	if (!query.trim()) return false;
	return FOLLOW_UP_REFERENCE_PATTERNS.some((pattern) => pattern.test(query));
}

export function normalizeIntentForConversationFollowup(intent, query, conversationId) {
	if (!conversationId || !intent?.intent) return intent;

	if (intent.intent === 'action' && !hasExplicitActionLanguage(query, intent)) {
		return {
			...intent,
			intent: 'conversation',
			action_type: null,
			params: {},
		};
	}

	if ((intent.intent === 'search' || intent.intent === 'analysis') && looksLikeFollowUpReference(query)) {
		return {
			...intent,
			intent: 'conversation',
		};
	}

	return intent;
}

// ────────────────────────────────────────────────────────────────────
// Main Chat Orchestrator
// ────────────────────────────────────────────────────────────────────

/**
 * Process a chat message. Routes by intent to the appropriate handler.
 *
 * @param {object} opts
 * @param {string} opts.hostId - Tenant host ID
 * @param {string} opts.userId - User ID
 * @param {string} opts.query - User's message
 * @param {string} opts.conversationId - Continue existing conversation (optional)
 * @param {string} opts.projectId - Scope to project (optional)
 * @returns {{ answer: string, results: object, action: object|null, conversationId: string, displayIn: 'panel'|'chat' }}
 */
export async function processChat({ hostId, userId, query, conversationId, projectId, includeEmails = true, ctx = {} }) {
	// Classify intent
	const classifiedIntent = await classifyIntent(hostId, query);
	const intent = normalizeIntentForConversationFollowup(classifiedIntent, query, conversationId);
	const llmScope = getLlmScopeForIntent(intent);

	switch (intent.intent) {
		case 'action':
			return handleAction({ hostId, userId, query, conversationId, projectId, intent, includeEmails, ctx });

		case 'stats':
			return handleStats({ hostId, userId, query, conversationId, projectId, intent, includeEmails, llmScope });

		case 'analysis':
			return handleAnalysis({ hostId, userId, query, conversationId, projectId, intent, includeEmails, llmScope });

		case 'conversation':
			return handleConversation({ hostId, userId, query, conversationId, projectId, includeEmails, llmScope });

		case 'search':
		default:
			return handleSearch({ hostId, userId, query, conversationId, projectId, intent, includeEmails, llmScope });
	}
}

/**
 * Streaming variant of processChat.
 * Returns { stream: AsyncGenerator|null, answer: string|null, metadata: object }.
 * If stream is set, the caller should iterate it for text tokens; answer will be null.
 * If answer is set, the response is already complete (no streaming needed).
 */
export async function processChatStream({ hostId, userId, query, conversationId, projectId, includeEmails = true, ctx = {} }) {
	const classifiedIntent = await classifyIntent(hostId, query);
	const intent = normalizeIntentForConversationFollowup(classifiedIntent, query, conversationId);
	const llmScope = getLlmScopeForIntent(intent);

	switch (intent.intent) {
		case 'action': {
			const result = await handleAction({ hostId, userId, query, conversationId, projectId, intent, includeEmails, ctx });
			return { stream: null, answer: result.answer, metadata: { results: result.results, action: result.action, conversationId: result.conversationId, displayIn: result.displayIn } };
		}

		case 'stats': {
			const result = await handleStatsStream({ hostId, query, conversationId, includeEmails, llmScope });
			return { stream: result.stream, answer: null, metadata: { results: [], action: null, conversationId: result.conversationId, displayIn: 'chat' } };
		}

		case 'analysis': {
			const result = await handleAnalysisStream({ hostId, userId, query, conversationId, projectId, intent, includeEmails, llmScope });
			return { stream: result.stream, answer: null, metadata: { results: result.results, action: null, conversationId: result.conversationId, displayIn: 'panel' } };
		}

		case 'conversation': {
			const result = await handleConversation({ hostId, userId, query, conversationId, projectId, includeEmails, llmScope });
			return { stream: null, answer: result.answer, metadata: { results: result.results, action: result.action, conversationId: result.conversationId, displayIn: result.displayIn } };
		}

		case 'search':
		default: {
			const result = await handleSearch({ hostId, userId, query, conversationId, projectId, intent, includeEmails, llmScope });
			return { stream: null, answer: result.answer, metadata: { results: result.results, action: result.action, conversationId: result.conversationId, displayIn: result.displayIn } };
		}
	}
}

// ────────────────────────────────────────────────────────────────────
// Search Handler
// ────────────────────────────────────────────────────────────────────

async function handleSearch({ hostId, userId, query, conversationId, projectId, intent, includeEmails = true, llmScope = 'global' }) {
	const searchQuery = intent.query || query;
	const limit = intent.limit || null;
	const types = intent.types || null;

	const { results, conversation, action } = await conversationSearch(hostId, userId, searchQuery, {
		conversationId,
		projectId,
		perPage: limit || 10,
		includeEmails,
		llmScope,
	});

	let flat = flattenResults(results, types);
	if (limit) flat = flat.slice(0, limit);

	return {
		answer: conversation.answer,
		results: flat,
		action,
		conversationId: conversation.conversationId,
		displayIn: 'panel',
	};
}

// ────────────────────────────────────────────────────────────────────
// Stats Handler
// ────────────────────────────────────────────────────────────────────

async function handleStats({ hostId, query, conversationId, includeEmails = true, llmScope = 'global' }) {
	const counts = await getCollectionCounts(hostId);
	if (!includeEmails) counts.emails = 0;
	const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

	const statsContext = `Collection counts: ${counts.notes} notes, ${counts.memory} memories, ${counts.urls} URLs, ${counts.emails || 0} emails. Total items: ${total}.`;

	const answer = await chatModelCompletion({
		messages: [
			{
				role: 'system',
				content: `You are Kumbukum, a knowledge assistant. Answer the user's question using the stats below. Be concise.\n\nSTATS:\n${statsContext}`,
			},
			{ role: 'user', content: query },
		],
		maxTokens: 256,
		hostId,
		scope: llmScope,
	});

	return {
		answer,
		results: [],
		action: null,
		conversationId: conversationId || null,
		displayIn: 'chat',
	};
}

// ────────────────────────────────────────────────────────────────────
// Analysis Handler
// ────────────────────────────────────────────────────────────────────

async function handleAnalysis({ hostId, userId, query, conversationId, projectId, intent, includeEmails = true, llmScope = 'global' }) {
	const searchQuery = intent.query || query;

	// First, search for relevant items
	const { results, conversation } = await conversationSearch(hostId, userId, searchQuery, {
		conversationId,
		projectId,
		perPage: 10,
		includeEmails,
		llmScope,
	});

	const flatResults = flattenResults(results);

	// Build context for deeper analysis
	const context = flatResults.map((r) => {
		const snippet = (r.text_content || r.content || r.description || '').slice(0, 500);
		return `[${r._type}] ${r.title || r.url || 'Untitled'}: ${snippet}`;
	}).join('\n\n');

	const analysisAnswer = await chatModelCompletion({
		messages: [
			{
				role: 'system',
				content: `You are Kumbukum, a knowledge assistant. The user wants an analysis of their knowledge items. Be concise and insightful. Use the context below.\n\nCONTEXT:\n${context}`,
			},
			{ role: 'user', content: query },
		],
		maxTokens: 2048,
		hostId,
		scope: llmScope,
	});

	return {
		answer: analysisAnswer,
		results: flatResults,
		action: null,
		conversationId: conversation.conversationId,
		displayIn: 'panel',
	};
}

// ────────────────────────────────────────────────────────────────────
// Streaming Stats Handler
// ────────────────────────────────────────────────────────────────────

async function handleStatsStream({ hostId, query, conversationId, includeEmails = true, llmScope = 'global' }) {
	const counts = await getCollectionCounts(hostId);
	if (!includeEmails) counts.emails = 0;
	const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
	const statsContext = `Collection counts: ${counts.notes} notes, ${counts.memory} memories, ${counts.urls} URLs, ${counts.emails || 0} emails. Total items: ${total}.`;

	const body = await chatModelCompletion({
		messages: [
			{
				role: 'system',
				content: `You are Kumbukum, a knowledge assistant. Answer the user's question using the stats below. Be concise.\n\nSTATS:\n${statsContext}`,
			},
			{ role: 'user', content: query },
		],
		stream: true,
		maxTokens: 256,
		hostId,
		scope: llmScope,
	});

	return {
		stream: parseStreamChunks(body, getChatProviderName()),
		conversationId: conversationId || null,
	};
}

// ────────────────────────────────────────────────────────────────────
// Streaming Analysis Handler
// ────────────────────────────────────────────────────────────────────

async function handleAnalysisStream({ hostId, userId, query, conversationId, projectId, intent, includeEmails = true, llmScope = 'global' }) {
	const searchQuery = intent.query || query;

	const { results, conversation } = await conversationSearch(hostId, userId, searchQuery, {
		conversationId,
		projectId,
		perPage: 10,
		includeEmails,
		llmScope,
	});

	const flatResults = flattenResults(results);

	const context = flatResults.map((r) => {
		const snippet = (r.text_content || r.content || r.description || '').slice(0, 500);
		return `[${r._type}] ${r.title || r.url || 'Untitled'}: ${snippet}`;
	}).join('\n\n');

	const body = await chatModelCompletion({
		messages: [
			{
				role: 'system',
				content: `You are Kumbukum, a knowledge assistant. The user wants an analysis of their knowledge items. Be concise and insightful. Use the context below.\n\nCONTEXT:\n${context}`,
			},
			{ role: 'user', content: query },
		],
		stream: true,
		maxTokens: 2048,
		hostId,
		scope: llmScope,
	});

	return {
		stream: parseStreamChunks(body, getChatProviderName()),
		results: flatResults,
		conversationId: conversation.conversationId,
	};
}

// ────────────────────────────────────────────────────────────────────
// Action Handler
// ────────────────────────────────────────────────────────────────────

async function handleAction({ hostId, userId, query, conversationId, projectId, intent, includeEmails = true, ctx = {} }) {
	const actionType = intent.action_type;
	const params = intent.params || {};

	// Resolve project — use explicit param, or chat projectId, or ask user
	const resolvedProjectId = params.project_id || projectId;

	// If action needs a project and none specified, resolve from project name or ask
	if (!resolvedProjectId && params.project_name) {
		const projects = await listProjects(hostId);
		const match = projects.find((p) => p.name.toLowerCase() === params.project_name.toLowerCase());
		if (match) {
			params.project_id = match._id.toString();
		}
	}

	const effectiveProjectId = params.project_id || resolvedProjectId;

	if (!effectiveProjectId && ['create_note', 'create_memory', 'save_url'].includes(actionType)) {
		// Try to get default project
		const projects = await listProjects(hostId);
		const defaultProject = projects.find((p) => p.is_default) || projects[0];
		if (defaultProject) {
			params.project_id = defaultProject._id.toString();
		} else {
			return {
				answer: 'Please specify a project for this action. Which project should I use?',
				results: [],
				action: { type: actionType, params, confirmation_required: true },
				conversationId,
				displayIn: 'chat',
			};
		}
	}

	const finalProjectId = params.project_id || effectiveProjectId;

	try {
		switch (actionType) {
			case 'create_note': {
				const note = await noteService.createNote(userId, hostId, {
					title: params.title || 'Untitled Note',
					content: params.content || '',
					project: finalProjectId,
			}, ctx);
				return {
					answer: `Note "${note.title}" created.`,
					results: [{ ...note.toObject?.() || note, _type: 'notes' }],
					action: { type: 'create_note', completed: true },
					conversationId,
					displayIn: 'panel',
				};
			}

			case 'create_memory': {
				const memory = await memoryService.storeMemory(userId, hostId, {
					title: params.title || 'Untitled Memory',
					content: params.content || query,
					project: finalProjectId,
					source: 'chat',
			}, ctx);
				return {
					answer: `Memory "${memory.title}" stored.`,
					results: [{ ...memory.toObject?.() || memory, _type: 'memory' }],
					action: { type: 'create_memory', completed: true },
					conversationId,
					displayIn: 'panel',
				};
			}

			case 'save_url': {
				if (!params.url) {
					return {
						answer: 'Which URL should I save?',
						results: [],
						action: null,
						conversationId,
						displayIn: 'chat',
					};
				}
				const url = await urlService.saveUrl(userId, hostId, {
					url: params.url,
					project: finalProjectId,
				}, ctx);
				return {
					answer: url.$locals?.wasDuplicate ? `URL "${url.title || url.url}" was already saved.` : `URL "${url.title || url.url}" saved.`,
					results: [{ ...url.toObject?.() || url, _type: 'urls' }],
					action: { type: 'save_url', completed: true },
					conversationId,
					displayIn: 'panel',
				};
			}

			case 'move_to_project': {
				if (!params.item_ids?.length) {
					return {
						answer: 'Which items should I move? Search for them first, then ask me to move the results.',
						results: [],
						action: null,
						conversationId,
						displayIn: 'chat',
					};
				}
				const itemType = params.item_type || 'notes';
				const updateFn = { notes: noteService.updateNote, memories: memoryService.updateMemory, urls: urlService.updateUrl, emails: includeEmails ? emailIngestService.updateEmail : null }[itemType];
				if (!updateFn) {
					return { answer: `Unknown item type: ${itemType}`, results: [], action: null, conversationId, displayIn: 'chat' };
				}
				const results = await Promise.all(params.item_ids.map((id) => updateFn(hostId, id, { project: finalProjectId }, ctx).catch(() => null)));
				const moved = results.filter(Boolean).length;
				return {
					answer: `Moved ${moved} ${itemType} to project.`,
					results: [],
					action: { type: 'move_to_project', completed: true, moved },
					conversationId,
					displayIn: 'chat',
				};
			}

			case 'delete': {
				// Destructive — always require confirmation
				return {
					answer: `Are you sure you want to delete ${params.item_ids?.length || 'these'} items? This action cannot be undone.`,
					results: [],
					action: { type: 'delete', params, confirmation_required: true },
					conversationId,
					displayIn: 'chat',
				};
			}

			default:
				return {
					answer: `I understood you want to "${actionType}" but I don't know how to do that yet.`,
					results: [],
					action: null,
					conversationId,
					displayIn: 'chat',
				};
		}
	} catch (err) {
		console.error(`Action ${actionType} failed:`, err.message);
		return {
			answer: `Action failed: ${err.message}`,
			results: [],
			action: null,
			conversationId,
			displayIn: 'chat',
		};
	}
}

// ────────────────────────────────────────────────────────────────────
// Conversation Handler (follow-ups)
// ────────────────────────────────────────────────────────────────────

async function handleConversation({ hostId, userId, query, conversationId, projectId, includeEmails = true, llmScope = 'global' }) {
	// Use the conversation model for context-aware follow-up
	const { results, conversation, action } = await conversationSearch(hostId, userId, query, {
		conversationId,
		projectId,
		perPage: 5,
		includeEmails,
		llmScope,
	});

	const flatResults = flattenResults(results);
	const hasResults = flatResults.length > 0;

	return {
		answer: conversation.answer,
		results: hasResults ? flatResults : [],
		action,
		conversationId: conversation.conversationId,
		displayIn: hasResults ? 'panel' : 'chat',
	};
}

// ────────────────────────────────────────────────────────────────────
// Shared Search (used by both chat and MCP)
// ────────────────────────────────────────────────────────────────────

/**
 * Search across all knowledge types. Shared between web chat and MCP.
 *
 * @param {string} hostId - Tenant host ID
 * @param {string} query - Search query
 * @param {object} options
 * @param {string} options.projectId - Filter by project (optional)
 * @param {number} options.perPage - Results per collection (default 5)
 * @param {string|object} options.exclude_fields - Typesense fields to exclude from result documents (optional)
 * @returns {object} Raw Typesense results keyed by type
 */
export async function searchKnowledge(hostId, query, options = {}) {
	const { projectId, perPage = 5, includeEmails = true, exclude_fields } = options;
	return searchAll(hostId, query, { projectId, perPage, includeEmails, exclude_fields });
}

// ────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────

/**
 * Flatten multi-collection results into a single array with _type labels.
 */
function flattenResults(results, types = null) {
	const items = [];
	const typeMap = { notes: 'notes', memory: 'memory', urls: 'urls', emails: 'emails', pages: 'pages' };

	for (const [type, data] of Object.entries(results)) {
		const mappedType = typeMap[type] || type;
		if (types && !types.includes(mappedType)) continue;
		if (!data?.hits) continue;
		for (const hit of data.hits) {
			items.push({ ...hit.document, _type: mappedType, _score: hit.text_match_info?.score });
		}
	}

	return items;
}

/**
 * Legacy function — kept for backward compatibility.
 * Use processChat() for new code.
 * @deprecated
 */
export async function aiChatSearch(host_id, query, { stream = false } = {}) {
	const results = await searchAll(host_id, query, { perPage: 5 });
	const context = buildLegacyContext(results);

	const { chatCompletion } = await import('../modules/llm_client.js');
	const messages = [
		{
			role: 'system',
			content: `You are Kumbukum, a personal knowledge assistant. Answer the user's question using ONLY the context provided below. If the context doesn't contain relevant information, say so honestly. Be concise and helpful.\n\nCONTEXT:\n${context}`,
		},
		{ role: 'user', content: query },
	];

	return chatCompletion({ messages, stream });
}

function buildLegacyContext(results) {
	const sections = [];

	if (results.notes?.found > 0) {
		const noteItems = results.notes.hits.map((h) => `[Note] ${h.document.title}: ${h.document.text_content?.slice(0, 500)}`);
		sections.push('NOTES:\n' + noteItems.join('\n'));
	}

	if (results.memory?.found > 0) {
		const memItems = results.memory.hits.map((h) => `[Memory] ${h.document.title}: ${h.document.content?.slice(0, 500)}`);
		sections.push('MEMORIES:\n' + memItems.join('\n'));
	}

	if (results.urls?.found > 0) {
		const urlItems = results.urls.hits.map((h) => `[URL] ${h.document.title} (${h.document.url}): ${h.document.text_content?.slice(0, 500)}`);
		sections.push('SAVED URLS:\n' + urlItems.join('\n'));
	}

	if (results.emails?.found > 0) {
		const emailItems = results.emails.hits.map((h) => `[Email] ${h.document.subject || '(No subject)'}: ${(h.document.text_content || '').slice(0, 500)}`);
		sections.push('EMAILS:\n' + emailItems.join('\n'));
	}

	if (results.pages?.found > 0) {
		const pageItems = results.pages.hits.map((h) => `[Page] ${h.document.title} (${h.document.url}): ${h.document.text_content?.slice(0, 500)}`);
		sections.push('CRAWLED PAGES:\n' + pageItems.join('\n'));
	}

	return sections.join('\n\n') || 'No relevant information found in your knowledge base.';
}
