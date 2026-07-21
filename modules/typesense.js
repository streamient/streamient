import { createHash } from 'node:crypto';
import Typesense from 'typesense';
import config, { getPlanLlmConfig } from '../config.js';
import { emitToTenant } from './socket.js';
import { getRedisClient } from './redis.js';
import { normalizeLlmScope, resolveLlmKeyContext } from '../services/byo_ai_service.js';
import { sanitizeDeep } from './text_sanitize.js';
import { buildEmailExcerpt } from './email_display.js';
import { createLogger } from './logger.js';

const log = createLogger('typesense');

let client;

const _ts_exlude_default = 'embedding';
const _chunk_size = 3000;
const _chunk_overlap = 200;

// Single shared collection for all tenants' conversation history.
// Isolation is enforced via the conversation model_id, which encodes host + user.
// Deliberately NOT prefixed: Typesense supports a single conversation store.
const CONVERSATION_STORE_COLLECTION = 'conversation_store';

// Per-product collection prefix (default 'st') so streamient, mailtwine, and
// managani can share one Typesense cluster without colliding on `${type}_${host_id}`.
export function buildCollectionName(type, host_id) {
	const prefix = config.typesense.collectionPrefix || '';
	return `${prefix ? `${prefix}_` : ''}${type}_${host_id}`;
}
// Default Typesense conversation model per provider, used when falling back to a
// provider the tenant has a key for (the configured model may be provider-specific).
const TS_CONVERSATION_FALLBACK_MODELS = { openai: config.llm.openaiModel, google: config.llm.googleModel };
const MISSING_IMPORT_RESULT_ERROR = 'Typesense import returned no result for this document';

const _chunk_fields = {
	notes: ['text_content'],
	memory: ['content'],
	urls: ['text_content'],
	emails: ['text_content', 'attachment_text_content'],
	pages: ['text_content'],
};
const _trash_filtered_types = new Set(['notes', 'memory', 'urls', 'emails']);

function chunkMetadataFields() {
	return [
		{ name: 'source_id', type: 'string', facet: true },
		{ name: 'chunk_index', type: 'int32', optional: true },
		{ name: 'chunk_count', type: 'int32', optional: true },
	];
}

function resolveExcludeFields(excludeFields, type) {
	if (excludeFields && typeof excludeFields === 'object' && !Array.isArray(excludeFields)) {
		return excludeFields[type] || excludeFields.default || _ts_exlude_default;
	}
	return excludeFields || _ts_exlude_default;
}

function resolveIncludeFields(includeFields, type) {
	if (includeFields && typeof includeFields === 'object' && !Array.isArray(includeFields)) {
		return includeFields[type] || includeFields.default || '';
	}
	return includeFields || '';
}

export function getConversationModelId(hostId, userId, llmScope = 'global') {
	const base = `convo-${hostId}-${userId}`;
	return normalizeLlmScope(llmScope) === 'email' ? `${base}-email` : base;
}

const _token_separators = ['+', '-', '@', '.', '_', ' ', '=', '\\', ';', ',', ':', "'", '|', '&', '(', ')', '[', ']', '{', '}', '<', '>', '/', '?', '!', '#', '$', '%', '^', '*', '~', '`', '"', '\n', '\t', '\r', '\f', '\v'];

// Track conversation model signatures synced in this process lifetime.
const syncedConvoModels = new Map();

const TRANSIENT_TYPESENSE_HTTP_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TYPESENSE_CIRCUIT_OPEN_MS = 30_000;

let typesenseCircuitOpenUntil = 0;
let lastCircuitLogAt = 0;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientTypesenseError(err) {
	if (!err) return false;
	if (TRANSIENT_TYPESENSE_HTTP_CODES.has(err.httpStatus)) return true;
	const msg = (err.message || '').toLowerCase();
	return msg.includes('econnrefused')
		|| msg.includes('etimedout')
		|| msg.includes('enotfound')
		|| msg.includes('eai_again')
		|| msg.includes('socket hang up')
		|| msg.includes('service unavailable')
		|| msg.includes('timed out');
}

function openTypesenseCircuit(err, operation) {
	typesenseCircuitOpenUntil = Date.now() + TYPESENSE_CIRCUIT_OPEN_MS;
	log.warn({ operation, err, open_seconds: TYPESENSE_CIRCUIT_OPEN_MS / 1000 }, 'Typesense circuit open');
}

function isTypesenseCircuitOpen() {
	return Date.now() < typesenseCircuitOpenUntil;
}

function logCircuitSkip(operation) {
	const now = Date.now();
	if (now - lastCircuitLogAt < 10000) return;
	lastCircuitLogAt = now;
	const remaining = Math.max(Math.ceil((typesenseCircuitOpenUntil - now) / 1000), 0);
	log.warn({ operation, remaining_seconds: remaining }, 'Typesense operation skipped; circuit open');
}

/**
 * Run a Typesense operation with short transient retries and graceful fallback.
 * The SDK also handles node retries and health-checking. `fallback` may be a
 * value (returned on error), a
 * function (called with the error), or omitted (the error is re-thrown).
 */
async function withTypesenseResilience(operation, fn, options = {}) {
	const {
		maxAttempts = 3,
		fallback,
	} = options;

	if (isTypesenseCircuitOpen()) {
		logCircuitSkip(operation);
		if (typeof fallback === 'function') return fallback();
		if (fallback !== undefined) return fallback;
		const err = new Error(`Typesense circuit open for ${operation}`);
		err.code = 'TS_CIRCUIT_OPEN';
		throw err;
	}

	let lastErr;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			const transient = isTransientTypesenseError(err);
			const canRetry = transient && attempt < maxAttempts;
			if (!canRetry) break;
			const waitMs = Math.min(2000, 200 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 150);
			log.warn({ operation, attempt, wait_ms: waitMs, err }, 'Typesense operation retrying');
			await sleep(waitMs);
		}
	}

	if (isTransientTypesenseError(lastErr)) {
		openTypesenseCircuit(lastErr, operation);
	}

	if (typeof fallback === 'function') return fallback(lastErr);
	if (fallback !== undefined) return fallback;
	throw lastErr;
}

function getConversationModelSyncKey(modelId) {
	return `conversation-model-sync:${modelId}`;
}

function buildConversationModelSignature(modelName, apiKey, maxBytes = 102400) {
	const keyHash = createHash('sha256').update(apiKey || '').digest('hex');
	return JSON.stringify({ modelName, keyHash, maxBytes });
}

async function getStoredConversationModelSignature(modelId) {
	try {
		const redis = getRedisClient();
		return await redis.get(getConversationModelSyncKey(modelId));
	} catch {
		return null;
	}
}

async function setStoredConversationModelSignature(modelId, signature) {
	try {
		const redis = getRedisClient();
		await redis.set(getConversationModelSyncKey(modelId), signature, 'EX', 86400);
	} catch {
		// ignore cache failures
	}
}

export function getTypesenseClient() {
	if (!client) {
		client = new Typesense.Client(config.typesense);
	}
	return client;
}

function chunkString(value) {
	const text = String(value || '');
	if (!text) return [''];
	if (text.length <= _chunk_size) return [text];

	const chunks = [];
	const step = _chunk_size - _chunk_overlap;
	for (let i = 0; i < text.length; i += step) {
		chunks.push(text.substring(i, i + _chunk_size));
	}
	return chunks;
}

function chunkTypesenseDoc(type, doc) {
	const fields = _chunk_fields[type];
	// Strip control/separator chars so they never reach the Typesense index
	// (and thus never reach search results / MCP clients).
	if (!fields?.length) return [sanitizeDeep(doc)];

	const sourceId = doc.source_id || doc.id;
	const chunkSpecs = [];
	for (const field of fields) {
		const value = String(doc[field] || '');
		if (!value) continue;
		const chunks = chunkString(value);
		for (const chunk of chunks) {
			chunkSpecs.push({ field, chunk });
		}
	}

	if (!chunkSpecs.length) chunkSpecs.push({ field: fields[0], chunk: '' });

	return chunkSpecs.map((spec, index) => {
		const chunkDoc = {
			...doc,
			id: index === 0 ? sourceId : `${sourceId}_chunk_${index}`,
			source_id: sourceId,
			chunk_index: index,
			chunk_count: chunkSpecs.length,
		};

		for (const field of fields) {
			chunkDoc[field] = field === spec.field ? spec.chunk : '';
		}

		return sanitizeDeep(chunkDoc);
	});
}

function applySourceIdToHit(hit) {
	if (!hit?.document?.source_id) return hit;
	return {
		...hit,
		document: {
			...hit.document,
			id: hit.document.source_id,
		},
	};
}

export function normalizeGroupedSearchResult(result) {
	if (!result?.grouped_hits) return result;

	return {
		...result,
		hits: result.grouped_hits
			.map((group) => group.hits?.[0])
			.filter(Boolean)
			.map(applySourceIdToHit),
	};
}

/**
 * Collapse chunked documents (same source_id) to one hit per source, preserving
 * rank order. Replaces Typesense group_by — content is indexed in 3000-char
 * chunks sharing a source_id, and we only need unique results per source.
 * Returns the document id mapped to source_id (matching the old grouped path).
 */
function dedupeHitsBySourceId(result, limit) {
	if (!result?.hits) return result;
	const seen = new Set();
	const hits = [];
	for (const hit of result.hits) {
		const key = hit?.document?.source_id || hit?.document?.id;
		if (key) {
			if (seen.has(key)) continue;
			seen.add(key);
		}
		hits.push(applySourceIdToHit(hit));
		if (limit && hits.length >= limit) break;
	}
	return { ...result, hits };
}

function isMissingSourceIdError(err) {
	return err?.httpStatus === 400 && (err.message || '').includes('source_id');
}

function withoutGrouping(params) {
	const retry = { ...params };
	delete retry.group_by;
	delete retry.group_limit;
	return retry;
}

function includeSourceIdField(includeFields) {
	if (!includeFields) return includeFields;
	const fields = includeFields.split(',').map((field) => field.trim()).filter(Boolean);
	if (!fields.includes('source_id')) fields.push('source_id');
	return fields.join(',');
}

function exactFilterValue(value) {
	return '`' + String(value).replace(/`/g, '\\`') + '`';
}

function hasTrashFilter(filterBy) {
	return typeof filterBy === 'string' && /\bin_trash\s*[:=]/.test(filterBy);
}

function combineFilters(...filters) {
	return filters.filter(Boolean).join(' && ');
}

function applyActiveTrashFilter(type, filterBy = '') {
	if (!_trash_filtered_types.has(type) || hasTrashFilter(filterBy)) return filterBy || '';
	return combineFilters(filterBy, 'in_trash:=false');
}

function unixSeconds(value) {
	if (!value) return 0;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? Math.floor(time / 1000) : 0;
}

function trashFields(doc = {}) {
	const fields = { in_trash: Boolean(doc.in_trash) };
	const trashedAt = unixSeconds(doc.trashed_at);
	if (trashedAt) fields.trashed_at = trashedAt;
	return fields;
}

function canonicalEmailMessageId(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';
	return raw.replace(/^<+|>+$/g, '').trim().toLowerCase();
}

function emailThreadIdentifiers(doc = {}) {
	const ids = [];
	const add = (value) => {
		const id = canonicalEmailMessageId(value);
		if (id && !ids.includes(id)) ids.push(id);
	};
	add(doc.message_id);
	for (const ref of doc.references || []) add(ref);
	add(doc.in_reply_to);
	if (!ids.length) ids.push(String(doc._id || doc.id || ''));
	return ids.filter(Boolean);
}

function emailThreadKey(doc = {}) {
	const references = (doc.references || []).map(canonicalEmailMessageId).filter(Boolean);
	return references[0]
		|| canonicalEmailMessageId(doc.in_reply_to)
		|| canonicalEmailMessageId(doc.message_id)
		|| String(doc._id || doc.id || '');
}

function normalizeEmailAddressValue(value) {
	const text = String(value || '').trim();
	if (!text) return '';
	const bracketMatch = text.match(/<([^<>]+)>/);
	const address = bracketMatch ? bracketMatch[1] : text;
	const emailMatch = address.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
	return String(emailMatch ? emailMatch[0] : address).trim().toLowerCase();
}

function normalizeEmailAddressList(value) {
	return [...new Set((Array.isArray(value) ? value : [value]).map(normalizeEmailAddressValue).filter(Boolean))];
}

/**
 * Collection schemas by type. Host ID is appended at runtime.
 */

/**
 * Transform a Mongoose / raw MongoDB document into a Typesense document.
 */
export function toTypesenseDoc(type, doc) {
	const base = {
		id: (doc._id || doc.id).toString(),
		project_id: doc.project?.toString() || '',
		created_at: Math.floor(new Date(doc.createdAt || Date.now()).getTime() / 1000),
		updated_at: Math.floor(new Date(doc.updatedAt || Date.now()).getTime() / 1000),
		...trashFields(doc),
	};

	switch (type) {
		case 'notes':
			return { ...base, title: doc.title || '', text_content: doc.text_content || '', tags: doc.tags || [] };
		case 'memory':
			return { ...base, title: doc.title || '', content: doc.content || '', tags: doc.tags || [], source: doc.source || '' };
		case 'urls':
			return { ...base, url: doc.url || '', title: doc.title || '', description: doc.description || '', text_content: doc.text_content || '' };
			case 'emails':
				const fromEmails = normalizeEmailAddressList(doc.from);
				const toEmails = normalizeEmailAddressList(doc.to);
				const ccEmails = normalizeEmailAddressList(doc.cc);
				const bccEmails = normalizeEmailAddressList(doc.bcc);
				return {
					...base,
					subject: doc.subject || '',
					text_content: doc.text_content || '',
					attachment_text_content: doc.attachment_text_content || '',
					from: doc.from || [],
					to: doc.to || [],
					cc: doc.cc || [],
					bcc: doc.bcc || [],
					from_emails: fromEmails,
					to_emails: toEmails,
					cc_emails: ccEmails,
					bcc_emails: bccEmails,
					participant_emails: [...new Set([...fromEmails, ...toEmails, ...ccEmails, ...bccEmails])],
					mailbox: doc.mailbox || 'inbox',
					labels: doc.labels || [],
					message_id: doc.message_id || '',
					references: doc.references || [],
					in_reply_to: doc.in_reply_to || '',
					thread_key: emailThreadKey(doc),
					thread_identifiers: emailThreadIdentifiers(doc),
					excerpt: buildEmailExcerpt(doc),
				};
		default:
			return base;
	}
}

export function toTypesenseDocs(type, doc) {
	return chunkTypesenseDoc(type, toTypesenseDoc(type, doc));
}
const schemas = {
	notes: (host_id) => ({
		name: buildCollectionName('notes', host_id),
		enable_nested_fields: true,
		fields: [
			{ name: 'title', type: 'string' },
			{ name: 'text_content', type: 'string' },
			{ name: 'project_id', type: 'string', facet: true },
			{ name: 'tags', type: 'string[]', facet: true, optional: true },
			{ name: 'in_trash', type: 'bool', facet: true, optional: true },
			{ name: 'trashed_at', type: 'int64', optional: true },
			{ name: 'created_at', type: 'int64' },
			{ name: 'updated_at', type: 'int64' },
			...chunkMetadataFields(),
			{
				name: 'embedding',
				type: 'float[]',
				num_dim: 384,
				embed: {
					from: ['title', 'text_content'],
					model_config: {
						model_name: 'ts/multilingual-e5-small',
					},
				},
			},
		],
		default_sorting_field: 'updated_at',
		token_separators: _token_separators,
	}),
	
	memory: (host_id) => ({
		name: buildCollectionName('memory', host_id),
		enable_nested_fields: true,
		fields: [
			{ name: 'title', type: 'string' },
			{ name: 'content', type: 'string' },
			{ name: 'project_id', type: 'string', facet: true },
			{ name: 'tags', type: 'string[]', facet: true, optional: true },
			{ name: 'source', type: 'string', optional: true },
			{ name: 'in_trash', type: 'bool', facet: true, optional: true },
			{ name: 'trashed_at', type: 'int64', optional: true },
			{ name: 'created_at', type: 'int64' },
			{ name: 'updated_at', type: 'int64' },
			...chunkMetadataFields(),
			{
				name: 'embedding',
				type: 'float[]',
				num_dim: 384,
				embed: {
					from: ['title', 'content'],
					model_config: {
						model_name: 'ts/multilingual-e5-small',
					},
				},
			},
		],
		default_sorting_field: 'updated_at',
		token_separators: _token_separators,
	}),
	
	urls: (host_id) => ({
		name: buildCollectionName('urls', host_id),
		enable_nested_fields: true,
		fields: [
			{ name: 'url', type: 'string' },
			{ name: 'title', type: 'string' },
			{ name: 'description', type: 'string', optional: true },
			{ name: 'text_content', type: 'string', optional: true },
			{ name: 'project_id', type: 'string', facet: true },
			{ name: 'in_trash', type: 'bool', facet: true, optional: true },
			{ name: 'trashed_at', type: 'int64', optional: true },
			{ name: 'created_at', type: 'int64' },
			{ name: 'updated_at', type: 'int64' },
			...chunkMetadataFields(),
			{
				name: 'embedding',
				type: 'float[]',
				num_dim: 384,
				embed: {
					from: ['title', 'description', 'text_content'],
					model_config: {
						model_name: 'ts/multilingual-e5-small',
					},
				},
			},
		],
		default_sorting_field: 'updated_at',
		token_separators: _token_separators,
	}),

	emails: (host_id) => ({
		name: buildCollectionName('emails', host_id),
		enable_nested_fields: true,
		fields: [
			{ name: 'subject', type: 'string', optional: true },
			{ name: 'text_content', type: 'string', optional: true },
			{ name: 'attachment_text_content', type: 'string', optional: true },
				{ name: 'from', type: 'string[]', optional: true },
				{ name: 'to', type: 'string[]', optional: true },
				{ name: 'cc', type: 'string[]', optional: true },
				{ name: 'bcc', type: 'string[]', optional: true },
				{ name: 'from_emails', type: 'string[]', facet: true, optional: true },
				{ name: 'to_emails', type: 'string[]', facet: true, optional: true },
				{ name: 'cc_emails', type: 'string[]', facet: true, optional: true },
				{ name: 'bcc_emails', type: 'string[]', facet: true, optional: true },
				{ name: 'participant_emails', type: 'string[]', facet: true, optional: true },
				{ name: 'mailbox', type: 'string', facet: true, optional: true },
				{ name: 'labels', type: 'string[]', facet: true, optional: true },
				{ name: 'message_id', type: 'string', optional: true },
				{ name: 'references', type: 'string[]', optional: true },
				{ name: 'in_reply_to', type: 'string', optional: true },
				{ name: 'thread_key', type: 'string', facet: true, optional: true },
				{ name: 'thread_identifiers', type: 'string[]', facet: true, optional: true },
				{ name: 'excerpt', type: 'string', optional: true },
				{ name: 'in_trash', type: 'bool', facet: true, optional: true },
				{ name: 'trashed_at', type: 'int64', optional: true },
				{ name: 'project_id', type: 'string', facet: true },
				{ name: 'created_at', type: 'int64' },
				{ name: 'updated_at', type: 'int64' },
			...chunkMetadataFields(),
			{
				name: 'embedding',
				type: 'float[]',
				num_dim: 384,
				embed: {
					from: ['subject', 'text_content', 'attachment_text_content', 'from', 'to', 'cc', 'bcc'],
					model_config: {
						model_name: 'ts/multilingual-e5-small',
					},
				},
			},
		],
		default_sorting_field: 'updated_at',
		token_separators: _token_separators,
	}),
	
	pages: (host_id) => ({
		name: buildCollectionName('pages', host_id),
		enable_nested_fields: true,
		fields: [
			{ name: 'url', type: 'string' },
			{ name: 'parent_url_id', type: 'string', facet: true },
			{ name: 'title', type: 'string' },
			{ name: 'text_content', type: 'string' },
			{ name: 'project_id', type: 'string', facet: true },
			{ name: 'crawled_at', type: 'int64' },
			...chunkMetadataFields(),
			{
				name: 'embedding',
				type: 'float[]',
				num_dim: 384,
				embed: {
					from: ['title', 'text_content'],
					model_config: {
						model_name: 'ts/multilingual-e5-small',
					},
				},
			},
		],
		default_sorting_field: 'crawled_at',
		token_separators: _token_separators,
	}),
};

/**
 * Ensure all 4 collections exist for a given host.
 */
export async function ensureCollections(host_id) {
	const ts = getTypesenseClient();
	for (const [type, schemaFn] of Object.entries(schemas)) {
		const schema = schemaFn(host_id);
		try {
			const existing = await ts.collections(schema.name).retrieve();
			const existingFields = new Set((existing.fields || []).map((field) => field.name));
			const missingFields = schema.fields.filter((field) => !existingFields.has(field.name));
			if (missingFields.length) {
				await ts.collections(schema.name).update({ fields: missingFields });
				log.info({ collection: schema.name }, 'Updated Typesense collection fields');
			}
		} catch (err) {
			if (err.httpStatus === 404) {
				try {
					await ts.collections().create(schema);
					log.info({ collection: schema.name }, 'Created Typesense collection');
				} catch (createErr) {
					if (createErr.httpStatus === 409) {
						// Another instance created it first — safe to ignore
					} else {
						throw createErr;
					}
				}
			} else {
				throw err;
			}
		}
	}
}

/**
 * Index a document into a collection.
 * If doc looks like a raw Mongoose document (has _id but no id), it is
 * transformed automatically via toTypesenseDoc.
 */
/**
 * Build the Typesense chunk documents to upsert for a single source document.
 *
 * A raw Mongo/Mongoose document still has `_id` (and a hydrated Mongoose doc
 * also exposes an `id` virtual), so it must go through toTypesenseDoc to map
 * fields like `project` -> `project_id`. Only treat the input as an
 * already-transformed Typesense doc (chunk it directly) when it has a string
 * `id` and no `_id` — otherwise transform it. Skipping the transform would
 * drop `project_id`, which silently breaks project-scoped counts/filters.
 */
export function toIndexDocs(type, doc) {
	return doc.id && !doc._id ? chunkTypesenseDoc(type, doc) : toTypesenseDocs(type, doc);
}

function sourceIdForIndexDocs(type, doc) {
	const tsDocs = toIndexDocs(type, doc);
	return {
		sourceId: tsDocs[0]?.source_id || tsDocs[0]?.id,
		docs: tsDocs,
	};
}

function summarizeSourceImportResults(sourceEntries, results) {
	const expectedCounts = new Map();
	const successCounts = new Map();
	const failures = new Map();

	for (const entry of sourceEntries) {
		expectedCounts.set(entry.sourceId, (expectedCounts.get(entry.sourceId) || 0) + 1);
	}

	for (let i = 0; i < sourceEntries.length; i++) {
		const entry = sourceEntries[i];
		const result = results?.[i];
		if (result?.success) {
			successCounts.set(entry.sourceId, (successCounts.get(entry.sourceId) || 0) + 1);
		} else {
			failures.set(entry.sourceId, result?.error || MISSING_IMPORT_RESULT_ERROR);
		}
	}

	return [...expectedCounts.keys()].map((sourceId) => {
		const success = (successCounts.get(sourceId) || 0) === expectedCounts.get(sourceId) && !failures.has(sourceId);
		return {
			id: sourceId,
			success,
			error: success ? null : failures.get(sourceId),
		};
	});
}

function summarizeImportError(err) {
	if (!err) return null;
	return {
		name: err.name,
		message: err.message,
		httpStatus: err.httpStatus,
		code: err.code,
	};
}

function summarizeImportResultErrors(results) {
	return [...new Set(
		results
			.filter((result) => !result?.success)
			.map((result) => result?.error || MISSING_IMPORT_RESULT_ERROR),
	)].slice(0, 5).join(' | ');
}

/**
 * Bulk-index source documents into a collection.
 * Raw Mongo/Mongoose docs are transformed and chunked first; the return value
 * reports success per source document, not per chunk.
 */
export async function bulkIndexDocuments(host_id, type, docs, options = {}) {
	const sourceDocs = (Array.isArray(docs) ? docs : [docs]).filter(Boolean);
	if (!sourceDocs.length) return [];

	const sourceEntries = [];
	const sourceIds = [];

	for (const sourceDoc of sourceDocs) {
		const { sourceId, docs: tsDocs } = sourceIdForIndexDocs(type, sourceDoc);
		if (!sourceId || !tsDocs.length) continue;
		sourceIds.push(sourceId);
		for (const tsDoc of tsDocs) {
			sourceEntries.push({ sourceId, doc: tsDoc });
		}
	}

	if (!sourceEntries.length) return [];
	if (options.removeExisting !== false) {
		await removeDocumentsBySourceIds(host_id, type, sourceIds);
	}

	const results = await importDocuments(host_id, type, sourceEntries.map((entry) => entry.doc), options.action || 'upsert');
	return summarizeSourceImportResults(sourceEntries, results);
}

export async function indexDocument(host_id, type, doc) {
	return bulkIndexDocuments(host_id, type, [doc]).then((results) => results[0] || null);
}

/**
 * Batch-import documents into a collection.
 * Uses Typesense's import endpoint which is optimised for bulk operations.
 * Returns the array of per-document result objects.
 */
export async function importDocuments(host_id, type, docs, action = 'upsert') {
	const ts = getTypesenseClient();
	const collectionName = buildCollectionName(type, host_id);
	try {
		return await withTypesenseResilience(
			`import ${collectionName}`,
			() => ts.collections(collectionName).documents().import(docs, { action, dirty_values: 'coerce_or_drop' }),
		);
	} catch (err) {
		if (Array.isArray(err.importResults) && err.importResults.length) {
			const failedCount = err.importResults.filter((result) => !result?.success).length;
			log.error({ errorInfo: summarizeImportError(err), docCount: docs.length, importResultCount: err.importResults.length, failedCount, errorSummary: summarizeImportResultErrors(err.importResults), collection: collectionName }, 'Streamient indexer: import returned partial failures');
			return err.importResults;
		}

		const error = err?.message || 'Typesense import failed';
		log.error({ errorInfo: summarizeImportError(err), docCount: docs.length, collection: collectionName }, 'Streamient indexer: import failed');
		return docs.map(() => ({ success: false, error }));
	}
}

/**
 * Remove a document from a collection.
 */
export async function removeDocument(host_id, type, docId) {
	const results = await bulkRemoveDocuments(host_id, type, [docId]);
	return results[0] || null;
}

/**
 * Remove documents by filter from a collection.
 */
export async function removeDocumentsByFilter(host_id, type, filterBy) {
	const ts = getTypesenseClient();
	const collectionName = buildCollectionName(type, host_id);
	try {
		return await ts.collections(collectionName).documents().delete({ filter_by: filterBy });
	} catch (err) {
		if (err?.httpStatus === 404) return null;
		throw err;
	}
}

/**
 * Bulk-remove all chunks for a set of source documents in a SINGLE
 * delete-by-filter request (mirrors helpmonks' bulk delete-by-query).
 *
 * Every chunk carries its parent's `source_id`, so one `source_id:=[...]`
 * filter clears every chunk for the whole batch at once. This replaces the
 * previous per-document fan-out (one delete request per doc), which round-
 * robined ~N/3 writes onto each Typesense node and stalled an entire batch
 * whenever a single node was momentarily slow.
 */
export async function removeDocumentsBySourceIds(host_id, type, sourceIds) {
	const ids = [...new Set((sourceIds || []).map((id) => String(id)).filter(Boolean))];
	if (!ids.length) return null;
	const ts = getTypesenseClient();
	const collectionName = buildCollectionName(type, host_id);
	const filterBy = `source_id:=[${ids.map(exactFilterValue).join(',')}]`;
	return withTypesenseResilience(
		`bulk delete ${collectionName} (${ids.length} sources)`,
		async () => {
			try {
				return await ts.collections(collectionName).documents().delete({ filter_by: filterBy });
			} catch (err) {
				if (err?.httpStatus === 404) return null;
				throw err;
			}
		},
		{ fallback: null },
	);
}

export async function bulkRemoveDocuments(host_id, type, sourceIds) {
	const ids = [...new Set((sourceIds || []).map((id) => String(id)).filter(Boolean))];
	if (!ids.length) return [];
	await removeDocumentsBySourceIds(host_id, type, ids);
	return ids.map((id) => ({ id, success: true, error: null }));
}

/**
 * Search a single collection.
 */
export async function searchCollection(host_id, type, query, options = {}) {
	const ts = getTypesenseClient();
	const collectionName = buildCollectionName(type, host_id);
	const isChunked = !!_chunk_fields[type] && options.group !== false;
	const requested = options.perPage || 10;
	// Over-fetch so source_id dedup (chunk collapse) can still fill the page.
	const fetchSize = isChunked ? Math.min(requested * 3, 250) : requested;
	const includeFields = resolveIncludeFields(options.include_fields, type);
	const params = {
		q: query,
		query_by: options.queryBy || 'title',
		prefix: false,
		per_page: fetchSize,
		page: options.page || 1,
		...options.extra,
	};
	if (includeFields) {
		params.include_fields = isChunked ? includeSourceIdField(includeFields) : includeFields;
	} else {
		params.exclude_fields = resolveExcludeFields(options.exclude_fields, type);
	}
	const filterBy = applyActiveTrashFilter(type, options.filter_by);
	if (filterBy) params.filter_by = filterBy;
	return withTypesenseResilience(
		`search ${collectionName}`,
		async () => {
			const result = await ts.collections(collectionName).documents().search(params);
			return isChunked ? dedupeHitsBySourceId(result, requested) : result;
		},
		{ fallback: { hits: [], found: 0, out_of: 0, page: params.page || 1 } },
	);
}

/**
 * List documents from a collection with minimal fields.
 * Uses q=* with title query_by to avoid embedding computation.
 * Automatically paginates if limit > 250 (Typesense max per_page).
 */
export async function listDocuments(host_id, type, options = {}) {
	const ts = getTypesenseClient();
	const collectionName = buildCollectionName(type, host_id);
	const limit = options.perPage || 250;
	const listQueryBy = type === 'emails' ? 'subject' : 'title';
	const listIncludeFields = type === 'emails' ? 'id,source_id,subject,project_id,created_at,updated_at' : 'id,title,tags,project_id,created_at';
	const baseParams = {
		q: '*',
		query_by: listQueryBy,
		include_fields: options.include_fields || listIncludeFields,
		exclude_fields: 'embedding',
	};
	const filterBy = applyActiveTrashFilter(type, options.filter_by);
	if (filterBy) baseParams.filter_by = filterBy;
	if (options.sort_by) baseParams.sort_by = options.sort_by;
	if (options.group_by) {
		baseParams.group_by = options.group_by;
		baseParams.group_limit = options.group_limit || 1;
		baseParams.include_fields = includeSourceIdField(baseParams.include_fields);
	} else if (_chunk_fields[type] && options.group !== false) {
		baseParams.group_by = 'source_id';
		baseParams.group_limit = 1;
		baseParams.include_fields = includeSourceIdField(baseParams.include_fields);
	}
	if (options.group_max_candidates) baseParams.group_max_candidates = options.group_max_candidates;

	if (limit <= 250) {
		return withTypesenseResilience(
			`list ${collectionName}`,
			async () => {
				const params = { ...baseParams, per_page: limit, page: options.page || 1 };
				try {
					return normalizeGroupedSearchResult(await ts.collections(collectionName).documents().search(params));
				} catch (err) {
					if (params.group_by && isMissingSourceIdError(err)) {
						return normalizeGroupedSearchResult(await ts.collections(collectionName).documents().search(withoutGrouping(params)));
					}
					throw err;
				}
			},
			{ fallback: { hits: [], found: 0 } },
		);
	}

	// Paginate to collect up to limit hits
	const allHits = [];
	let page = 1;
	let found = 0;
	while (allHits.length < limit) {
		const res = await withTypesenseResilience(
			`list page ${collectionName}`,
			async () => {
				const params = { ...baseParams, per_page: 250, page };
				try {
					return normalizeGroupedSearchResult(await ts.collections(collectionName).documents().search(params));
				} catch (err) {
					if (params.group_by && isMissingSourceIdError(err)) {
						return normalizeGroupedSearchResult(await ts.collections(collectionName).documents().search(withoutGrouping(params)));
					}
					throw err;
				}
			},
			{ fallback: { hits: [], found: 0 } },
		);
		found = res.found || 0;
		if (!res.hits?.length) break;
		allHits.push(...res.hits);
		if (allHits.length >= found) break;
		page++;
	}
	if (allHits.length > limit) allHits.length = limit;
	return { hits: allHits, found };
}

/**
 * Multi-search across all collections for a host.
 */
export async function searchAll(host_id, query, options = {}) {
	const ts = getTypesenseClient();
	const includeEmails = options.includeEmails !== false;
	const types = includeEmails ? ['notes', 'memory', 'urls', 'emails', 'pages'] : ['notes', 'memory', 'urls', 'pages'];
	const requested = options.perPage || 5;
	// Over-fetch so source_id dedup (chunk collapse) can still fill the page.
	const fetchSize = Math.min(requested * 3, 250);

	const searchRequests = {
		searches: types.map((type) => {
			const includeFields = resolveIncludeFields(options.include_fields, type);
			const search = { collection: buildCollectionName(type, host_id) };
			const filters = [];
			if (options.projectId) filters.push(`project_id:=${exactFilterValue(options.projectId)}`);
			const filterBy = applyActiveTrashFilter(type, filters.join(' && '));
			if (filterBy) search.filter_by = filterBy;
			if (includeFields) {
				search.include_fields = _chunk_fields[type] ? includeSourceIdField(includeFields) : includeFields;
			} else {
				search.exclude_fields = resolveExcludeFields(options.exclude_fields, type);
			}
			return search;
		}),
	};
	const commonSearchParams = {
		q: query,
		query_by: 'embedding',
		prefix: false,
		per_page: fetchSize,
	};

	const results = await withTypesenseResilience(
		`multiSearch host ${host_id}`,
		() => ts.multiSearch.perform(searchRequests, commonSearchParams),
		{
			fallback: {
				results: types.map(() => ({ hits: [], found: 0, out_of: 0, page: 1 })),
			},
		},
	);
	const merged = {};
	types.forEach((type, i) => {
		merged[type] = dedupeHitsBySourceId(results.results[i], requested);
	});
	return merged;
}

const QUICK_SEARCH_FIELDS = {
	notes: {
		query_by: 'title,text_content,tags',
		include_fields: 'id,source_id,title,text_content,tags,project_id,created_at,updated_at',
		highlight_fields: 'title,text_content,tags',
	},
	memory: {
		query_by: 'title,content,source,tags',
		include_fields: 'id,source_id,title,content,source,tags,project_id,created_at,updated_at',
		highlight_fields: 'title,content,source,tags',
	},
	urls: {
		query_by: 'title,url,description,text_content',
		include_fields: 'id,source_id,title,url,description,text_content,project_id,created_at,updated_at',
		highlight_fields: 'title,url,description,text_content',
	},
	emails: {
		query_by: 'subject,from,to,cc,bcc,from_emails,to_emails,cc_emails,bcc_emails,participant_emails,text_content,attachment_text_content',
		include_fields: 'id,source_id,subject,from,to,cc,bcc,mailbox,labels,text_content,attachment_text_content,project_id,created_at,updated_at',
		highlight_fields: 'subject,from,to,cc,bcc,from_emails,to_emails,cc_emails,bcc_emails,participant_emails,text_content,attachment_text_content',
	},
	pages: {
		query_by: 'title,url,text_content',
		include_fields: 'id,source_id,title,url,parent_url_id,text_content,project_id,crawled_at',
		highlight_fields: 'title,url,text_content',
	},
};

/**
 * Fast lexical multi-search for the authenticated app command palette.
 * This intentionally avoids embedding search and conversational AI so short
 * keyword queries such as email subjects return immediately with highlights.
 */
export async function quickSearch(host_id, query, options = {}) {
	const ts = getTypesenseClient();
	const includeEmails = options.includeEmails !== false;
	const types = includeEmails ? ['notes', 'memory', 'urls', 'emails', 'pages'] : ['notes', 'memory', 'urls', 'pages'];
	const perPage = Math.min(Math.max(parseInt(options.perPage, 10) || 6, 1), 20);
	const q = String(query || '').trim();
	if (!q) return {};

	const searches = types.map((type) => {
		const fields = QUICK_SEARCH_FIELDS[type];
		const filters = [];
		if (options.projectId) filters.push(`project_id:=${exactFilterValue(options.projectId)}`);
		const filterBy = applyActiveTrashFilter(type, filters.join(' && '));
		return {
			collection: buildCollectionName(type, host_id),
			q,
			query_by: fields.query_by,
			prefix: true,
			per_page: perPage * (_chunk_fields[type] ? 3 : 1),
			include_fields: includeSourceIdField(fields.include_fields),
			highlight_fields: fields.highlight_fields,
			highlight_start_tag: '__kk_hl_start__',
			highlight_end_tag: '__kk_hl_end__',
			exclude_fields: _ts_exlude_default,
			sort_by: type === 'pages' ? '_text_match:desc,crawled_at:desc' : '_text_match:desc,updated_at:desc',
			...(filterBy ? { filter_by: filterBy } : {}),
		};
	});

	const results = await withTypesenseResilience(
		`quick search host ${host_id}`,
		() => ts.multiSearch.perform({ searches }, {}),
		{
			fallback: {
				results: types.map(() => ({ hits: [], found: 0, out_of: 0, page: 1 })),
			},
		},
	);

	const merged = {};
	types.forEach((type, i) => {
		merged[type] = dedupeHitsBySourceId(results.results?.[i], perPage) || { hits: [], found: 0, out_of: 0, page: 1 };
	});
	return merged;
}

/**
 * Get document counts for each collection type for a host.
 * Uses Typesense collection stats.
 */
export async function getCollectionCounts(host_id) {
	const ts = getTypesenseClient();
	const types = ['notes', 'memory', 'urls', 'emails'];
	const counts = {};
	await Promise.all(types.map(async (type) => {
		try {
			const col = await withTypesenseResilience(
				`collection stats ${buildCollectionName(type, host_id)}`,
				() => ts.collections(buildCollectionName(type, host_id)).retrieve({ 'exclude_fields': 'fields' }),
				{ fallback: { num_documents: 0 } },
			);
			counts[type] = col.num_documents || 0;
		} catch (err) {
			log.error({ err, collection: buildCollectionName(type, host_id) }, 'getCollectionCounts failed');
			counts[type] = 0;
		}
	}));
	return counts;
}

/**
 * Get document count for a specific collection, optionally filtered by project.
 * Uses Typesense search with per_page=0 to get only the count.
 */
export async function getFilteredCount(host_id, type, projectId) {
	const ts = getTypesenseClient();
	const collectionName = buildCollectionName(type, host_id);
	try {
		const countQueryBy = type === 'emails' ? 'subject' : 'title';
		const search = {
			q: '*',
			query_by: countQueryBy,
			per_page: 0,
			exclude_fields: _ts_exlude_default,
		};
		const filters = [];
		if (projectId) filters.push(`project_id:=${exactFilterValue(projectId)}`);
		const filterBy = applyActiveTrashFilter(type, filters.join(' && '));
		if (filterBy) search.filter_by = filterBy;
		if (_chunk_fields[type]) {
			search.group_by = 'source_id';
			search.group_limit = 1;
		}
		const result = await withTypesenseResilience(
			`count search ${collectionName}`,
			async () => {
				try {
					return await ts.collections(collectionName).documents().search(search);
				} catch (err) {
					if (search.group_by && isMissingSourceIdError(err)) {
						return ts.collections(collectionName).documents().search(withoutGrouping(search));
					}
					throw err;
				}
			},
			{ fallback: { found: 0 } },
		);
		return result.found || 0;
	} catch (err) {
		log.error({ err, collection: collectionName }, 'getFilteredCount failed');
		return 0;
	}
}

/**
 * Queue all documents for scheduler-based reindexing for a host.
 * Drops and recreates collections, then marks MongoDB records as unindexed
 * so runStreamientIndexer() can repopulate Typesense in batches.
 */
export async function reindexHost(host_id, models) {
	const ts = getTypesenseClient();
	const typeModelMap = getIndexedTypeModelMap(models);
	const results = {};

	// Drop indexed content collections first. Keep conversation history intact:
	// reindexing search data should not break chat history or existing convo models.
	const allCollections = [...typeModelMap.map((t) => buildCollectionName(t.type, host_id)), buildCollectionName('pages', host_id)];
	for (const collectionName of allCollections) {
		try {
			await ts.collections(collectionName).delete();
			log.info({ collection: collectionName }, 'Dropped collection');
		} catch (err) {
			if (err.httpStatus !== 404) {
				log.error({ err, collection: collectionName }, 'Failed to drop collection');
			}
		}
	}

	// Clear synced conversation model tracking
	syncedConvoModels.clear();

	for (const { type, model } of typeModelMap) {
		const schemaFn = schemas[type];
		if (!schemaFn) continue;

		// Recreate empty collection so scheduler can repopulate it
		try {
			await ts.collections().create(schemaFn(host_id));
			log.info({ collection: buildCollectionName(type, host_id) }, 'Created empty collection for reindex');
		} catch (createErr) {
			if (createErr.httpStatus !== 409) throw createErr;
		}

		const query = { host_id };
		const total = await model.countDocuments(query);
		await model.updateMany(query, { $set: { is_indexed: false } }, { timestamps: false });
		results[type] = { queued: total };
		log.info({ count: total, type, host_id }, 'Queued docs for scheduler reindex');
	}

	// Recreate pages collection (populated by crawling, not reindexed from DB)
	if (schemas.pages) {
		try {
			await ts.collections().create(schemas.pages(host_id));
			log.info({ collection: buildCollectionName('pages', host_id) }, 'Recreated empty pages collection');
		} catch (createErr) {
			if (createErr.httpStatus !== 409) throw createErr;
		}
	}

	const totalQueued = Object.values(results).reduce((sum, entry) => sum + (entry.queued || 0), 0);
	if (totalQueued > 0) {
		await setStoredReindexStatus(host_id, {
			total_queued: totalQueued,
			started_at: new Date().toISOString(),
		});
	} else {
		await clearStoredReindexStatus(host_id);
	}

	return results;
}

/**
 * Initialize Typesense client — verify connectivity.
 */
export async function initTypesense() {
	try {
		const ts = getTypesenseClient();
		const health = await withTypesenseResilience(
			'health check',
			() => ts.health.retrieve({ 'exclude_fields': 'fields' }),
		);
		const nodes = config.typesense.nodes.map(n => `${n.host}:${n.port}`).join(', ');
		log.info({ healthy: health.ok, nodes }, 'Typesense connected');
	} catch (err) {
		log.warn({ err }, 'Typesense not available — indexing will fail until connected');
	}
}

/**
 * Index documents that have is_indexed: false.
 * Runs on a scheduler interval. Uses aggregate to group by host_id,
 * then batch-imports up to BATCH_LIMIT docs per host via Typesense import().
 */
const BATCH_LIMIT = 150;
const REINDEX_STATUS_TTL_SECONDS = 3600;

function getIndexedTypeModelMap(models) {
	const { Note, Memory, Url, Email } = models;
	return [
		{ type: 'notes', model: Note },
		{ type: 'memory', model: Memory },
		{ type: 'urls', model: Url },
		{ type: 'emails', model: Email },
	];
}

function getReindexStatusKey(host_id) {
	const prefix = config.typesense.collectionPrefix || '';
	return `reindex-status:${prefix ? `${prefix}:` : ''}${host_id}`;
}

async function getStoredReindexStatus(host_id) {
	try {
		const redis = getRedisClient();
		const raw = await redis.get(getReindexStatusKey(host_id));
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

async function setStoredReindexStatus(host_id, data) {
	try {
		const redis = getRedisClient();
		await redis.set(getReindexStatusKey(host_id), JSON.stringify(data), 'EX', REINDEX_STATUS_TTL_SECONDS);
	} catch {
		// ignore status cache failures — reindex still works
	}
}

async function clearStoredReindexStatus(host_id) {
	try {
		const redis = getRedisClient();
		await redis.del(getReindexStatusKey(host_id));
	} catch {
		// ignore status cache failures
	}
}

async function countTypeIndexStatus(host_id, model) {
	const query = { host_id };
	const [dbRecords, indexedRecords, notIndexedRecords] = await Promise.all([
		model.countDocuments(query),
		model.countDocuments({ ...query, is_indexed: true }),
		model.countDocuments({ ...query, is_indexed: { $ne: true } }),
	]);

	return {
		db_records: dbRecords,
		indexed_records: indexedRecords,
		not_indexed_records: notIndexedRecords,
	};
}

function emptySearchIndexCounts(typeModelMap = []) {
	return {
		db_records: 0,
		indexed_records: 0,
		not_indexed_records: 0,
		by_type: Object.fromEntries(typeModelMap.map(({ type }) => [type, {
			db_records: 0,
			indexed_records: 0,
			not_indexed_records: 0,
		}])),
	};
}

export async function getSearchIndexCounts(host_id, modelsOrMap) {
	const typeModelMap = Array.isArray(modelsOrMap) ? modelsOrMap : getIndexedTypeModelMap(modelsOrMap || {});
	const counts = emptySearchIndexCounts(typeModelMap);

	await Promise.all(typeModelMap.map(async ({ type, model }) => {
		const typeCounts = await countTypeIndexStatus(host_id, model);
		counts.by_type[type] = typeCounts;
		counts.db_records += typeCounts.db_records;
		counts.indexed_records += typeCounts.indexed_records;
		counts.not_indexed_records += typeCounts.not_indexed_records;
	}));

	return counts;
}

export function buildReindexStatus(reindexState, remaining = 0, counts = emptySearchIndexCounts()) {
	if (!reindexState?.total_queued) {
		return {
			status: 'idle',
			total_queued: 0,
			indexed: 0,
			remaining: 0,
			message: 'Search index is idle.',
			counts,
		};
	}

	const totalQueued = Math.max(Number(reindexState.total_queued) || 0, Number(remaining) || 0);
	const remainingCount = Math.max(Number(remaining) || 0, 0);
	const indexedTotal = Math.max(totalQueued - remainingCount, 0);
	const status = remainingCount === 0 ? 'complete' : (indexedTotal > 0 ? 'progress' : 'queued');
	const itemLabel = indexedTotal === 1 ? 'item' : 'items';
	const totalLabel = totalQueued === 1 ? 'item' : 'items';
	const message = status === 'complete'
		? `Reindex complete. Indexed ${indexedTotal} ${itemLabel}.`
		: status === 'queued'
			? `Reindexing is queued for ${totalQueued} ${totalLabel}.`
			: `Reindexing... ${indexedTotal} ${itemLabel} indexed, ${remainingCount} remaining.`;

	return {
		status,
		indexed: indexedTotal,
		remaining: remainingCount,
		total_queued: totalQueued,
		started_at: reindexState.started_at,
		message,
		counts,
	};
}

export async function getReindexStatus(host_id, models) {
	const typeModelMap = getIndexedTypeModelMap(models);
	const counts = await getSearchIndexCounts(host_id, typeModelMap);
	const reindexState = await getStoredReindexStatus(host_id);
	if (!reindexState?.total_queued) return buildReindexStatus(null, 0, counts);

	return buildReindexStatus(reindexState, counts.not_indexed_records, counts);
}

export async function runStreamientIndexer(models) {
	const typeModelMap = getIndexedTypeModelMap(models);

	let totalIndexed = 0;
	const hostProgress = new Map();

	for (const { type, model } of typeModelMap) {
		// Fast aggregate: get host_ids that have unindexed docs, sorted by most-recently-updated first
		const hosts = await model.aggregate([
			{ $match: { is_indexed: { $ne: true } } },
			{ $sort: { updatedAt: -1 } },
			{ $group: { _id: '$host_id' } },
		]);

		if (!hosts.length) continue;

		for (const { _id: host_id } of hosts) {
			await ensureCollections(host_id);

			const docs = await model
				.find({ host_id, is_indexed: { $ne: true } })
				.sort({ updatedAt: -1 })
				.limit(BATCH_LIMIT)
				.lean();

			if (!docs.length) continue;

			let progress = hostProgress.get(host_id);
			if (!progress) {
				progress = {
					indexed: 0,
					by_type: { notes: 0, memory: 0, urls: 0, emails: 0 },
				};
				hostProgress.set(host_id, progress);
			}

			// Clear existing chunks for the whole batch in ONE bulk delete-by-filter
			// (not one delete per doc) before re-importing — see removeDocumentsBySourceIds.
			await removeDocumentsBySourceIds(host_id, type, docs.map((doc) => doc._id.toString()));

			const tsDocEntries = [];
			const chunkCounts = new Map();
			for (const doc of docs) {
				const sourceId = doc._id.toString();
				const chunks = toTypesenseDocs(type, doc);
				chunkCounts.set(sourceId, chunks.length);
				for (const chunk of chunks) {
					tsDocEntries.push({ sourceId, doc: chunk });
				}
			}
			const results = await importDocuments(host_id, type, tsDocEntries.map((entry) => entry.doc));

			// Separate successes and failures
			const successCounts = new Map();
			const failedIds = new Map();
			for (let i = 0; i < tsDocEntries.length; i++) {
				const entry = tsDocEntries[i];
				if (results[i]?.success) {
					successCounts.set(entry.sourceId, (successCounts.get(entry.sourceId) || 0) + 1);
				} else {
					failedIds.set(entry.sourceId, results[i]?.error || MISSING_IMPORT_RESULT_ERROR);
				}
			}

			const successIds = [];
			for (const doc of docs) {
				const sourceId = doc._id.toString();
				if ((successCounts.get(sourceId) || 0) === chunkCounts.get(sourceId) && !failedIds.has(sourceId)) {
					successIds.push(doc._id);
				}
			}
			const failed = Array.from(failedIds.entries()).map(([id, error]) => ({ id, error }));

			// Mark successful docs as indexed in one updateMany
			if (successIds.length) {
				await model.updateMany({ _id: { $in: successIds } }, { $set: { is_indexed: true } }, { timestamps: false });
				totalIndexed += successIds.length;
				progress.indexed += successIds.length;
				progress.by_type[type] += successIds.length;
			}

			if (failed.length) {
				const failedIdsSample = failed.slice(0, 10).map((item) => item.id).join(',');
				const errorSummary = [...new Set(failed.map((item) => item.error))].slice(0, 5).join(' | ');
				log.error({ failedCount: failed.length, failedSampleCount: Math.min(failed.length, 10), errorSummary, type, host_id, failedIdsSample }, 'Streamient indexer: failures');
			}

			if (docs.length > 0) {
				log.info({ imported: successIds.length, total: docs.length, type, host_id }, 'Streamient indexer: imported docs');
			}
		}
	}

	for (const [host_id, progress] of hostProgress.entries()) {
		const reindexState = await getStoredReindexStatus(host_id);
		if (!reindexState?.total_queued) continue;

		const counts = await getSearchIndexCounts(host_id, typeModelMap);
		const statusData = buildReindexStatus(reindexState, counts.not_indexed_records, counts);

		emitToTenant(host_id, 'reindex:status', {
			...statusData,
			by_type: progress.by_type,
		});

		if (statusData.status === 'complete') {
			await clearStoredReindexStatus(host_id);
		}
	}

	if (totalIndexed > 0) {
		log.info({ totalIndexed }, 'Streamient indexer: indexed documents total');
	}

	return totalIndexed;
}

// ────────────────────────────────────────────────────────────────────
// Conversation Model Management
// ────────────────────────────────────────────────────────────────────

/**
 * Build the system prompt for the conversation model.
 * This tells the LLM how to interpret search results and respond.
 */
function buildConversationSystemPrompt() {
	const now = new Date();
	return `You are Streamient, a personal knowledge assistant. You help users find, organize, and manage their notes, memories, saved URLs, and emails.

## CURRENT TIMESTAMP
${now.toISOString()}

## DATA TYPES
The user's knowledge base contains:
- **Notes**: Rich text documents with title, text_content, project_id, tags
- **Memories**: Facts, decisions, context with title, content, project_id, tags, source
- **URLs**: Saved web pages with url, title, description, text_content, project_id
- **Emails**: Ingested email messages with subject, sender, recipients, text_content, attachments text, message_id, references, project_id
- **Pages**: Crawled sub-pages with url, title, text_content, parent_url_id, project_id

## RESPONSE FORMAT
You MUST respond with valid JSON only. No markdown, no text outside JSON.
{
  "response": "Brief 1-2 sentence answer. Do NOT list or enumerate individual items — they are displayed visually to the user in a separate panel.",
  "item_ids": ["id1", "id2"],
  "action": null
}

## RULES
- Be SELECTIVE: only include items that truly match the user's intent in item_ids
- Do NOT list, describe, or enumerate individual files/items in the response text — they are shown visually
- For follow-up queries, the user may refer to "the results" or "those items" — use context from prior messages
- Keep responses concise (1-2 sentences)
- If no relevant results, say so honestly

## ACTIONS
When the user asks to perform an action, include an action object:
{
  "response": "Description of what will happen",
  "item_ids": ["id1"],
  "action": {
    "type": "create_note|create_memory|save_url|move_to_project|delete",
    "params": { ... }
  }
}

Action types and params:
- create_note: { "title": "...", "content": "...", "project_id": "..." }
- create_memory: { "title": "...", "content": "...", "project_id": "..." }
- save_url: { "url": "...", "project_id": "..." }
- move_to_project: { "item_ids": ["..."], "item_type": "notes|memories|urls|emails", "project_id": "..." }
- delete: { "item_ids": ["..."], "item_type": "notes|memories|urls|emails", "confirmation_required": true }

Always include project_id in action params. If the user doesn't specify a project, ask which project to use.`;
}

/**
 * Ensure the conversation store collection and conversation model exist for a user.
 * Model ID: convo-{hostId}-{userId}, one per host + user + scope.
 * Collection: conversation_store, a single shared collection for all tenants.
 */
export async function ensureConversationModel(hostId, userId, options = {}) {
	const ts = getTypesenseClient();
	const collectionName = CONVERSATION_STORE_COLLECTION;
	const llmScope = normalizeLlmScope(options.llmScope);
	const modelId = getConversationModelId(hostId, userId, llmScope);

	// 1. Resolve model configuration. Managed (platform-key) tenants get their
	//    plan's conversation model (config.llm.planModels); BYOK tenants and
	//    self-hosted installs keep the deployment-global config. Honor the BYO
	//    "one key is enough" rule: prefer the configured provider/model, but fall
	//    back to the other provider when its key isn't available — e.g. a BYOK
	//    tenant that supplied only a Gemini key still gets a working conversation
	//    model instead of a null OpenAI key (Typesense: "API key is not a
	//    string"). This mirrors the LLM client's BYO_FALLBACK_ORDER.
	const ctx = await resolveLlmKeyContext({ hostId, scope: llmScope });
	let configuredProvider;
	let configuredModel;
	if (ctx.mode === 'managed') {
		const planConfig = getPlanLlmConfig(ctx.plan, 'conversation');
		configuredProvider = planConfig.provider;
		configuredModel = planConfig.model || TS_CONVERSATION_FALLBACK_MODELS[configuredProvider] || config.llm.googleModel;
	} else {
		configuredProvider = config.llm.tsConversationProvider || 'google';
		configuredModel = config.llm.tsConversationModel || TS_CONVERSATION_FALLBACK_MODELS[configuredProvider] || config.llm.googleModel;
	}
	const providerOrder = configuredProvider === 'openai' ? ['openai', 'google'] : ['google', 'openai'];

	let apiKey = null;
	let resolvedProvider = configuredProvider;
	let resolvedModel = configuredModel;
	for (const prov of providerOrder) {
		const candidate = ctx.keys[prov];
		if (candidate) {
			apiKey = candidate;
			resolvedProvider = prov;
			resolvedModel = prov === configuredProvider ? configuredModel : TS_CONVERSATION_FALLBACK_MODELS[prov];
			break;
		}
	}

	let tsModelName = resolvedModel;
	if (!tsModelName.includes('/')) {
		tsModelName = `${resolvedProvider}/${tsModelName}`;
	}
	const desiredSignature = buildConversationModelSignature(tsModelName, apiKey);

	if (syncedConvoModels.get(modelId) === desiredSignature) {
		return;
	}

	// 2. Ensure conversation store collection exists
	try {
		await ts.collections(collectionName).retrieve({ 'exclude_fields': 'fields' });
	} catch (err) {
		if (err.httpStatus === 404) {
			const schema = {
				name: collectionName,
				fields: [
					{ name: 'conversation_id', type: 'string' },
					{ name: 'model_id', type: 'string' },
					{ name: 'timestamp', type: 'int32' },
					{ name: 'role', type: 'string', index: false },
					{ name: 'message', type: 'string', index: false },
				],
			};
			try {
				await ts.collections().create(schema);
				log.info({ collection: collectionName }, 'Created conversation store collection');
			} catch (createErr) {
				if (createErr.httpStatus !== 409) throw createErr;
			}
		} else {
			throw err;
		}
	}

	// 3. Check if conversation model exists and sync if needed
	let existing = null;
	try {
		existing = await ts.conversations().models(modelId).retrieve({ exclude_fields: 'fields' });
	} catch {
		// Model doesn't exist
	}

	if (existing) {
		const updateFields = {};
		if (existing.history_collection !== collectionName) {
			updateFields.history_collection = collectionName;
		}

		// Model exists — sync when the desired model/key signature has changed.
		if (syncedConvoModels.get(modelId) !== desiredSignature) {
			const storedSignature = await getStoredConversationModelSignature(modelId);
			if (storedSignature === desiredSignature && !updateFields.history_collection) {
				syncedConvoModels.set(modelId, desiredSignature);
				return;
			}

			updateFields.api_key = apiKey;
			if (existing.model_name !== tsModelName) {
				updateFields.model_name = tsModelName;
			}
			if (existing.max_bytes !== 102400) {
				updateFields.max_bytes = 102400;
			}
		}

		if (Object.keys(updateFields).length > 0) {
			try {
				await _updateConversationModel(modelId, updateFields);
				await setStoredConversationModelSignature(modelId, desiredSignature);
			} catch (err) {
				log.error({ err, modelId }, 'Error updating conversation model');
				throw err;
			}
		}

		syncedConvoModels.set(modelId, desiredSignature);
		return;
	}

	// 4. Create new conversation model
	// Using raw fetch due to Typesense v30.1 bug: large payloads cause custom 'id' to be ignored.
	// Workaround: create without system_prompt first, then PUT the system_prompt separately.
	const node = ts.configuration.nodes[0];
	const baseUrl = `${node.protocol}://${node.host}:${node.port}/conversations/models`;
	const headers = { 'Content-Type': 'application/json', 'X-TYPESENSE-API-KEY': ts.configuration.apiKey };
	const systemPrompt = buildConversationSystemPrompt();

	const modelBody = {
		id: modelId,
		model_name: tsModelName,
		api_key: apiKey,
		history_collection: collectionName,
		max_bytes: 102400,
		ttl: 604800, // 7 days
	};

	try {
		const createResp = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(modelBody) });
		if (!createResp.ok) {
			const body = await createResp.text();
			if (createResp.status === 409) {
				log.info({ modelId }, 'Conversation model already exists');
				await setStoredConversationModelSignature(modelId, desiredSignature);
				syncedConvoModels.set(modelId, desiredSignature);
				return;
			}
			throw new Error(`Create conversation model failed (${createResp.status}): ${body}`);
		}

		// Step 2: PUT system_prompt separately
		const updateResp = await fetch(`${baseUrl}/${modelId}`, { method: 'PUT', headers, body: JSON.stringify({ system_prompt: systemPrompt }) });
		if (!updateResp.ok) {
			log.warn({ modelId, status: updateResp.status }, 'Conversation model created but system_prompt update failed');
		}

		await setStoredConversationModelSignature(modelId, desiredSignature);
		syncedConvoModels.set(modelId, desiredSignature);
		log.info({ modelId }, 'Created conversation model');
	} catch (err) {
		log.error({ err, modelId }, 'Error creating conversation model');
		throw err;
	}
}

/**
 * Update a conversation model via raw HTTP PUT.
 */
async function _updateConversationModel(modelId, fields) {
	const ts = getTypesenseClient();
	const node = ts.configuration.nodes[0];
	const url = `${node.protocol}://${node.host}:${node.port}/conversations/models/${modelId}`;
	const resp = await fetch(url, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', 'X-TYPESENSE-API-KEY': ts.configuration.apiKey },
		body: JSON.stringify(fields),
	});
	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`Update conversation model failed (${resp.status}): ${body}`);
	}
	return resp.json();
}

/**
 * Conversational search across all collections for a host using the Typesense conversation model.
 * Returns search results + LLM-generated conversational answer.
 *
 * @param {string} hostId - Tenant host ID
 * @param {string} userId - User ID (for conversation model)
 * @param {string} query - User's search query
 * @param {object} options
 * @param {string} options.conversationId - Continue existing conversation (optional)
 * @param {string} options.projectId - Filter by project (optional)
 * @param {number} options.perPage - Results per collection (default 10)
 * @param {string} options.llmScope - LLM key scope: global or email
 * @returns {{ results: object, conversation: { answer: string, conversationId: string, itemIds: string[] }, action: object|null }}
 */
export async function conversationSearch(hostId, userId, query, options = {}) {
	const ts = getTypesenseClient();
	const llmScope = normalizeLlmScope(options.llmScope);
	const convoModelId = getConversationModelId(hostId, userId, llmScope);
	const { conversationId, projectId, perPage = 10, includeEmails = true } = options;

	await ensureConversationModel(hostId, userId, { llmScope });

	// Build per-collection search requests — embedding-only makes every param
	// identical across collections, so only the collection name varies here.
	const types = includeEmails ? ['notes', 'memory', 'urls', 'emails', 'pages'] : ['notes', 'memory', 'urls', 'pages'];
	const searches = types.map((type) => {
		const filters = [];
		if (projectId) filters.push(`project_id:=${exactFilterValue(projectId)}`);
		const filterBy = applyActiveTrashFilter(type, filters.join(' && '));
		return {
			collection: buildCollectionName(type, hostId),
			...(filterBy ? { filter_by: filterBy } : {}),
		};
	});

	// Common search params — q must be top-level when conversation is enabled.
	// No group_by: chunks (shared source_id) are deduped app-side after the
	// search so the conversation model still sees full context.
	const searchParams = {
		q: query,
		query_by: 'embedding',
		prefix: false,
		per_page: perPage,
		exclude_fields: _ts_exlude_default,
		conversation: true,
		conversation_model_id: convoModelId,
	};
	if (conversationId) {
		searchParams.conversation_id = conversationId;
	}

	function isInvalidConversationIdError(err) {
		const message = err?.message || '';
		return err?.httpStatus === 400
			&& !!searchParams.conversation_id
			&& message.includes('conversation_id')
			&& message.includes('invalid');
	}

	async function performConversationMultiSearch() {
		return ts.multiSearch.perform({ searches }, searchParams);
	}

	async function retryWithoutConversationId(reason) {
		const staleConversationId = searchParams.conversation_id;
		if (!staleConversationId) {
			throw reason;
		}

		delete searchParams.conversation_id;
		log.warn({ staleConversationId, convoModelId }, 'Conversation is invalid for model; starting a new conversation');
		return performConversationMultiSearch();
	}

	// Execute with auto-recovery for missing conversation models
	let data;
	try {
		data = await performConversationMultiSearch();
	} catch (err) {
		const message = err.message || '';
		const needsConversationRepair = err.httpStatus === 400 && (
			message.includes('conversation_model_id')
			|| message.includes('history_collection')
			|| message.includes('history collection')
		);

		if (needsConversationRepair) {
			log.warn({ convoModelId }, 'Conversation model needs repair, recreating metadata...');
			await ensureConversationModel(hostId, userId, { llmScope });
			try {
				data = await performConversationMultiSearch();
			} catch (retryErr) {
				if (isInvalidConversationIdError(retryErr)) {
					data = await retryWithoutConversationId(retryErr);
				} else {
					throw retryErr;
				}
			}
		} else if (isInvalidConversationIdError(err)) {
			data = await retryWithoutConversationId(err);
		} else {
			throw err;
		}
	}

	// Merge results by type, deduping chunked docs by source_id
	const merged = {};
	types.forEach((type, i) => {
		merged[type] = dedupeHitsBySourceId(data.results?.[i], perPage) || { found: 0, hits: [] };
	});

	// Parse conversation answer
	const rawAnswer = data.conversation?.answer || '';
	const convId = data.conversation?.conversation_id || searchParams.conversation_id || '';
	const parsed = parseConversationAnswer(rawAnswer);

	return {
		results: merged,
		conversation: {
			answer: parsed.response,
			conversationId: convId,
			itemIds: parsed.item_ids || [],
		},
		action: parsed.action || null,
	};
}

/**
 * Parse the JSON conversation answer from the LLM.
 * Handles: pure JSON, markdown fences, embedded JSON, fallback to text.
 */
function parseConversationAnswer(raw) {
	if (!raw) return { response: '', item_ids: [], action: null };

	// 1. Try pure JSON
	try {
		const parsed = JSON.parse(raw);
		if (parsed.response !== undefined) return parsed;
	} catch {}

	// 2. Try markdown code fences
	const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenceMatch) {
		try {
			const parsed = JSON.parse(fenceMatch[1].trim());
			if (parsed.response !== undefined) return parsed;
		} catch {}
	}

	// 3. Try embedded JSON object
	const braceMatch = raw.match(/\{[\s\S]*"response"[\s\S]*\}/);
	if (braceMatch) {
		try {
			const parsed = JSON.parse(braceMatch[0]);
			if (parsed.response !== undefined) return parsed;
		} catch {}
	}

	// 4. Fallback: return raw text as response
	return { response: raw.replace(/```[\s\S]*?```/g, '').trim(), item_ids: [], action: null };
}

/**
 * List recent conversations for a user from the conversation store.
 */
export async function listConversations(hostId, userId, { limit = 10 } = {}) {
	const ts = getTypesenseClient();
	const collectionName = CONVERSATION_STORE_COLLECTION;
	const modelId = getConversationModelId(hostId, userId);

	try {
		const result = await withTypesenseResilience(
			`list conversations ${collectionName}`,
			() => ts.collections(collectionName).documents().search({
				q: '*',
				query_by: 'conversation_id',
				filter_by: `model_id:=${modelId}`,
				sort_by: 'timestamp:desc',
				per_page: limit * 5,
				exclude_fields: _ts_exlude_default,
			}),
			{ fallback: { hits: [] } },
		);

		// Group by conversation_id, extract first user message as title
		const conversationMap = new Map();
		for (const hit of (result.hits || [])) {
			const doc = hit.document;
			const convoId = doc.conversation_id;
			if (!conversationMap.has(convoId)) {
				conversationMap.set(convoId, {
					conversation_id: convoId,
					first_message: doc.role === 'user' ? doc.message : '',
					latest_timestamp: doc.timestamp,
				});
			} else {
				const existing = conversationMap.get(convoId);
				if (doc.role === 'user' && !existing.first_message) {
					existing.first_message = doc.message;
				}
				if (doc.timestamp > existing.latest_timestamp) {
					existing.latest_timestamp = doc.timestamp;
				}
			}
		}

		return Array.from(conversationMap.values())
			.sort((a, b) => b.latest_timestamp - a.latest_timestamp)
			.slice(0, limit)
			.map((c) => {
				let title = c.first_message || 'Untitled conversation';
				if (title.length > 80) title = title.slice(0, 80) + '...';
				return {
					conversation_id: c.conversation_id,
					title,
					timestamp: c.latest_timestamp,
				};
			});
	} catch (err) {
		if (err.httpStatus === 404) return [];
		throw err;
	}
}

/**
 * Fetch all messages for a single past conversation, oldest → newest.
 * Scoped to the user via model_id (host + user) so a conversation can never be read
 * across users or hosts. Assistant turns are stored as the raw JSON answer, so we parse
 * them down to their display text — matching how the live chat renders an answer.
 */
export async function getConversationMessages(hostId, userId, conversationId) {
	const ts = getTypesenseClient();
	const collectionName = CONVERSATION_STORE_COLLECTION;
	const modelId = getConversationModelId(hostId, userId);

	const result = await withTypesenseResilience(
		`get conversation messages ${collectionName}/${conversationId}`,
		() => ts.collections(collectionName).documents().search({
			q: '*',
			query_by: 'conversation_id',
			filter_by: `conversation_id:=${conversationId} && model_id:=${modelId}`,
			sort_by: 'timestamp:asc',
			per_page: 200,
			exclude_fields: _ts_exlude_default,
		}),
		{ fallback: { hits: [] } },
	);

	return (result.hits || []).map((hit) => {
		const doc = hit.document;
		const message = doc.role === 'assistant'
			? (parseConversationAnswer(doc.message).response || doc.message)
			: doc.message;
		return { role: doc.role, message, timestamp: doc.timestamp };
	});
}

/**
 * Delete a conversation's messages from the store.
 */
export async function deleteConversation(hostId, userId, conversationId) {
	const ts = getTypesenseClient();
	const collectionName = CONVERSATION_STORE_COLLECTION;
	const modelId = getConversationModelId(hostId, userId);
	return withTypesenseResilience(
		`delete conversation ${collectionName}/${conversationId}`,
		() => ts.collections(collectionName).documents().delete({
			filter_by: `conversation_id:=${conversationId} && model_id:=${modelId}`,
		}),
		{ fallback: null },
	);
}

/**
 * Delete all conversation history and conversation models for a host's users.
 * Used during tenant deletion — the shared conversation_store collection itself
 * is never dropped, so we remove only this host's documents and models.
 */
export async function deleteConversationDataForHost(hostId, userIds = []) {
	const ts = getTypesenseClient();
	const scopes = ['global', 'email'];
	for (const userId of userIds) {
		for (const scope of scopes) {
			const modelId = getConversationModelId(hostId, userId, scope);
			await withTypesenseResilience(
				`delete conversation docs ${CONVERSATION_STORE_COLLECTION}/${modelId}`,
				() => ts.collections(CONVERSATION_STORE_COLLECTION).documents().delete({ filter_by: `model_id:=${modelId}` }),
				{ fallback: null },
			);
			try {
				await ts.conversations().models(modelId).delete();
			} catch (err) {
				if (err.httpStatus !== 404) {
					log.error({ err, modelId }, 'Failed to delete conversation model during tenant cleanup');
				}
			}
		}
	}
}
