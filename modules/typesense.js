import { createHash } from 'node:crypto';
import Typesense from 'typesense';
import config from '../config.js';
import { emitToTenant } from './socket.js';
import { getRedisClient } from './redis.js';

let client;

const _ts_exlude_default = 'embedding';
const _chunk_size = 3000;
const _chunk_overlap = 200;

const _chunk_fields = {
	notes: ['text_content'],
	memory: ['content'],
	urls: ['text_content'],
	emails: ['text_content', 'attachment_text_content'],
	pages: ['text_content'],
};

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

const _token_separators = ['+', '-', '@', '.', '_', ' ', '=', '\\', ';', ',', ':', "'", '|', '&', '(', ')', '[', ']', '{', '}', '<', '>', '/', '?', '!', '#', '$', '%', '^', '*', '~', '`', '"', '\n', '\t', '\r', '\f', '\v'];

// Track conversation models whose api_key has been synced this process lifetime
const syncedConvoModels = new Set();
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
		|| msg.includes('socket hang up')
		|| msg.includes('service unavailable')
		|| msg.includes('timed out');
}

function openTypesenseCircuit(err, operation) {
	typesenseCircuitOpenUntil = Date.now() + TYPESENSE_CIRCUIT_OPEN_MS;
	console.warn(
		`[TYPESENSE] Circuit open for ${TYPESENSE_CIRCUIT_OPEN_MS / 1000}s after ${operation}: ${err?.message || err}`,
	);
}

function isTypesenseCircuitOpen() {
	return Date.now() < typesenseCircuitOpenUntil;
}

function logCircuitSkip(operation) {
	const now = Date.now();
	if (now - lastCircuitLogAt < 10_000) return;
	lastCircuitLogAt = now;
	const remaining = Math.max(Math.ceil((typesenseCircuitOpenUntil - now) / 1000), 0);
	console.warn(`[TYPESENSE] Skipping ${operation}; circuit open (${remaining}s remaining)`);
}

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
	if (!fields?.length) return [doc];

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

		return chunkDoc;
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
	};

	switch (type) {
		case 'notes':
			return { ...base, title: doc.title || '', text_content: doc.text_content || '', tags: doc.tags || [] };
		case 'memory':
			return { ...base, title: doc.title || '', content: doc.content || '', tags: doc.tags || [], source: doc.source || '' };
		case 'urls':
			return { ...base, url: doc.url || '', title: doc.title || '', description: doc.description || '', text_content: doc.text_content || '' };
		case 'emails':
			return {
				...base,
				subject: doc.subject || '',
				text_content: doc.text_content || '',
				attachment_text_content: doc.attachment_text_content || '',
				from: doc.from || [],
				to: doc.to || [],
				cc: doc.cc || [],
				bcc: doc.bcc || [],
				message_id: doc.message_id || '',
				references: doc.references || [],
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
		name: `notes_${host_id}`,
		enable_nested_fields: true,
		fields: [
			{ name: 'title', type: 'string' },
			{ name: 'text_content', type: 'string' },
			{ name: 'project_id', type: 'string', facet: true },
			{ name: 'tags', type: 'string[]', facet: true, optional: true },
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
		name: `memory_${host_id}`,
		enable_nested_fields: true,
		fields: [
			{ name: 'title', type: 'string' },
			{ name: 'content', type: 'string' },
			{ name: 'project_id', type: 'string', facet: true },
			{ name: 'tags', type: 'string[]', facet: true, optional: true },
			{ name: 'source', type: 'string', optional: true },
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
		name: `urls_${host_id}`,
		enable_nested_fields: true,
		fields: [
			{ name: 'url', type: 'string' },
			{ name: 'title', type: 'string' },
			{ name: 'description', type: 'string', optional: true },
			{ name: 'text_content', type: 'string', optional: true },
			{ name: 'project_id', type: 'string', facet: true },
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
		name: `emails_${host_id}`,
		enable_nested_fields: true,
		fields: [
			{ name: 'subject', type: 'string', optional: true },
			{ name: 'text_content', type: 'string', optional: true },
			{ name: 'attachment_text_content', type: 'string', optional: true },
			{ name: 'from', type: 'string[]', optional: true },
			{ name: 'to', type: 'string[]', optional: true },
			{ name: 'cc', type: 'string[]', optional: true },
			{ name: 'bcc', type: 'string[]', optional: true },
			{ name: 'message_id', type: 'string', optional: true },
			{ name: 'references', type: 'string[]', optional: true },
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
		name: `pages_${host_id}`,
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
			const missingChunkFields = chunkMetadataFields().filter((field) => !existingFields.has(field.name));
			if (missingChunkFields.length) {
				await ts.collections(schema.name).update({ fields: missingChunkFields });
				console.log(`Updated Typesense collection fields: ${schema.name}`);
			}
		} catch (err) {
			if (err.httpStatus === 404) {
				try {
					await ts.collections().create(schema);
					console.log(`Created Typesense collection: ${schema.name}`);
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
export async function indexDocument(host_id, type, doc) {
	const ts = getTypesenseClient();
	const collectionName = `${type}_${host_id}`;
	const tsDocs = doc.id ? chunkTypesenseDoc(type, doc) : toTypesenseDocs(type, doc);
	const sourceId = tsDocs[0]?.source_id || tsDocs[0]?.id;
	if (sourceId) {
		await removeDocument(host_id, type, sourceId);
	}
	return withTypesenseResilience(
		`upsert ${collectionName}`,
		() => ts.collections(collectionName).documents().import(tsDocs, { action: 'upsert', dirty_values: 'coerce_or_drop' }),
		{ fallback: null },
	);
}

/**
 * Batch-import documents into a collection.
 * Uses Typesense's import endpoint which is optimised for bulk operations.
 * Returns the array of per-document result objects.
 */
export async function importDocuments(host_id, type, docs, action = 'upsert') {
	const ts = getTypesenseClient();
	const collectionName = `${type}_${host_id}`;
	try {
		return await withTypesenseResilience(
			`import ${collectionName}`,
			() => ts.collections(collectionName).documents().import(docs, { action, dirty_values: 'coerce_or_drop' }),
			{ fallback: [] },
		);
	} catch (err) {
		console.error(`[TYPESENSE] import error (${docs.length} docs → ${collectionName}):`, err.message);
		return err.importResults || [];
	}
}

/**
 * Remove a document from a collection.
 */
export async function removeDocument(host_id, type, docId) {
	const ts = getTypesenseClient();
	const collectionName = `${type}_${host_id}`;
	try {
		return await withTypesenseResilience(
			`delete ${collectionName}/${docId}`,
			async () => {
				try {
					return await ts.collections(collectionName).documents().delete({
						filter_by: `source_id:=${exactFilterValue(docId)} || id:=${exactFilterValue(docId)}`,
					});
				} catch (err) {
					if (err?.httpStatus === 400 && (err.message || '').includes('source_id')) {
						return ts.collections(collectionName).documents(docId).delete();
					}
					throw err;
				}
			},
			{ fallback: null },
		);
	} catch (err) {
		if (err?.httpStatus === 404) return null;
		throw err;
	}
}

/**
 * Remove documents by filter from a collection.
 */
export async function removeDocumentsByFilter(host_id, type, filterBy) {
	const ts = getTypesenseClient();
	const collectionName = `${type}_${host_id}`;
	try {
		return await ts.collections(collectionName).documents().delete({ filter_by: filterBy });
	} catch (err) {
		if (err?.httpStatus === 404) return null;
		throw err;
	}
}

/**
 * Search a single collection.
 */
export async function searchCollection(host_id, type, query, options = {}) {
	const ts = getTypesenseClient();
	const collectionName = `${type}_${host_id}`;
	const params = {
		q: query,
		query_by: options.queryBy || 'title',
		prefix: false,
		per_page: options.perPage || 10,
		page: options.page || 1,
		exclude_fields: resolveExcludeFields(options.exclude_fields, type),
		...options.extra,
	};
	if (options.include_fields) params.include_fields = options.include_fields;
	if (options.filter_by) params.filter_by = options.filter_by;
	if (_chunk_fields[type] && options.group !== false && !params.group_by) {
		params.group_by = 'source_id';
		params.group_limit = params.group_limit || 1;
		params.include_fields = includeSourceIdField(params.include_fields);
	}
	return withTypesenseResilience(
		`search ${collectionName}`,
		async () => {
			try {
				return normalizeGroupedSearchResult(await ts.collections(collectionName).documents().search(params));
			} catch (err) {
				if (params.group_by && isMissingSourceIdError(err)) {
					return normalizeGroupedSearchResult(await ts.collections(collectionName).documents().search(withoutGrouping(params)));
				}
				throw err;
			}
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
	const collectionName = `${type}_${host_id}`;
	const limit = options.perPage || 250;
	const baseParams = {
		q: '*',
		query_by: 'title',
		include_fields: options.include_fields || 'id,title,tags,project_id,created_at',
		exclude_fields: 'embedding',
	};
	if (options.filter_by) baseParams.filter_by = options.filter_by;
	if (options.sort_by) baseParams.sort_by = options.sort_by;
	if (_chunk_fields[type] && options.group !== false) {
		baseParams.group_by = 'source_id';
		baseParams.group_limit = 1;
		baseParams.include_fields = includeSourceIdField(baseParams.include_fields);
	}

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
	const searches = types.map((type) => {
		const search = {
			collection: `${type}_${host_id}`,
			q: query,
			query_by: 'embedding',
			prefix: false,
			per_page: options.perPage || 5,
			exclude_fields: resolveExcludeFields(options.exclude_fields, type),
		};
		if (options.projectId) search.filter_by = `project_id:=${options.projectId}`;
		if (_chunk_fields[type] && options.group !== false) {
			search.group_by = 'source_id';
			search.group_limit = 1;
		}
		return search;
	});

	const results = await withTypesenseResilience(
		`multiSearch host ${host_id}`,
		async () => {
			try {
				return await ts.multiSearch.perform({ searches });
			} catch (err) {
				if (isMissingSourceIdError(err)) {
					const ungrouped = searches.map(withoutGrouping);
					return ts.multiSearch.perform({ searches: ungrouped });
				}
				throw err;
			}
		},
		{
			fallback: {
				results: searches.map(() => ({ hits: [], found: 0, out_of: 0, page: 1 })),
			},
		},
	);
	const merged = {};
	types.forEach((type, i) => {
		merged[type] = normalizeGroupedSearchResult(results.results[i]);
	});
	return merged;
}

/**
 * Get document counts for each collection type for a host.
 * Uses Typesense collection stats.
 */
export async function getCollectionCounts(host_id) {
	const ts = getTypesenseClient();
	const counts = {};
	for (const type of ['notes', 'memory', 'urls', 'emails']) {
		try {
			const col = await withTypesenseResilience(
				`collection stats ${type}_${host_id}`,
				() => ts.collections(`${type}_${host_id}`).retrieve({ 'exclude_fields': 'fields' }),
				{ fallback: { num_documents: 0 } },
			);
			counts[type] = col.num_documents || 0;
		} catch (err) {
			console.error(`getCollectionCounts: ${type}_${host_id} failed:`, err.message);
			counts[type] = 0;
		}
	}
	return counts;
}

/**
 * Get document count for a specific collection, optionally filtered by project.
 * Uses Typesense search with per_page=0 to get only the count.
 */
export async function getFilteredCount(host_id, type, projectId) {
	const ts = getTypesenseClient();
	const collectionName = `${type}_${host_id}`;
	try {
		const countQueryBy = type === 'emails' ? 'subject' : 'title';
		const search = {
			q: '*',
			query_by: countQueryBy,
			per_page: 0,
			exclude_fields: _ts_exlude_default,
		};
		if (projectId) search.filter_by = `project_id:=${projectId}`;
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
		console.error(`getFilteredCount: ${collectionName} failed:`, err.message);
		return 0;
	}
}

/**
 * Queue all documents for scheduler-based reindexing for a host.
 * Drops and recreates collections, then marks MongoDB records as unindexed
 * so indexMissing() can repopulate Typesense in batches.
 */
export async function reindexHost(host_id, models) {
	const ts = getTypesenseClient();
	const { Note, Memory, Url, Email } = models;

	const typeModelMap = [
		{ type: 'notes', model: Note },
		{ type: 'memory', model: Memory },
		{ type: 'urls', model: Url },
		{ type: 'emails', model: Email },
	];

	const results = {};

	// Drop indexed content collections first. Keep conversation history intact:
	// reindexing search data should not break chat history or existing convo models.
	const allCollections = [...typeModelMap.map((t) => `${t.type}_${host_id}`), `pages_${host_id}`];
	for (const collectionName of allCollections) {
		try {
			await ts.collections(collectionName).delete();
			console.log(`Dropped collection: ${collectionName}`);
		} catch (err) {
			if (err.httpStatus !== 404) {
				console.error(`Failed to drop collection ${collectionName}:`, err.message);
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
			console.log(`Created empty collection for reindex: ${type}_${host_id}`);
		} catch (createErr) {
			if (createErr.httpStatus !== 409) throw createErr;
		}

		const query = { host_id, in_trash: { $ne: true } };
		const total = await model.countDocuments(query);
		await model.updateMany(query, { $set: { is_indexed: false } }, { timestamps: false });
		results[type] = { queued: total };
		console.log(`Queued ${total} ${type} docs for scheduler reindex on host ${host_id}`);
	}

	// Recreate pages collection (populated by crawling, not reindexed from DB)
	if (schemas.pages) {
		try {
			await ts.collections().create(schemas.pages(host_id));
			console.log(`Recreated empty pages collection: pages_${host_id}`);
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
		console.log(`Typesense connected (${health.ok ? 'healthy' : 'unhealthy'}): ${nodes}`);
	} catch (err) {
		console.warn('Typesense not available — indexing will fail until connected:', err.message);
	}
}

/**
 * Index documents that have is_indexed: false.
 * Runs on a scheduler interval. Uses aggregate to group by host_id,
 * then batch-imports up to BATCH_LIMIT docs per host via Typesense import().
 */
const BATCH_LIMIT = 100;
const REINDEX_STATUS_TTL_SECONDS = 3600;

function getReindexStatusKey(host_id) {
	return `reindex-status:${host_id}`;
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

async function countPendingForHost(host_id, typeModelMap) {
	const counts = await Promise.all(
		typeModelMap.map(({ model }) => model.countDocuments({ host_id, is_indexed: { $ne: true }, in_trash: { $ne: true } })),
	);
	return counts.reduce((sum, count) => sum + count, 0);
}

export async function indexMissing(models) {
	const { Note, Memory, Url, Email } = models;

	const typeModelMap = [
		{ type: 'notes', model: Note },
		{ type: 'memory', model: Memory },
		{ type: 'urls', model: Url },
		{ type: 'emails', model: Email },
	];

	let totalIndexed = 0;
	const hostProgress = new Map();

	for (const { type, model } of typeModelMap) {
		// Fast aggregate: get host_ids that have unindexed docs, sorted by most-recently-updated first
		const hosts = await model.aggregate([
			{ $match: { is_indexed: { $ne: true }, in_trash: { $ne: true } } },
			{ $sort: { updatedAt: -1 } },
			{ $group: { _id: '$host_id' } },
		]);

		if (!hosts.length) continue;

		for (const { _id: host_id } of hosts) {
			await ensureCollections(host_id);

			const docs = await model
				.find({ host_id, is_indexed: { $ne: true }, in_trash: { $ne: true } })
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

			await Promise.all(docs.map((doc) => removeDocument(host_id, type, doc._id.toString())));

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
					failedIds.set(entry.sourceId, results[i]?.error || 'missing import result');
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
				console.error(`indexMissing: ${failed.length} ${type} failed for host ${host_id}:`, failed);
			}

			if (docs.length > 0) {
				console.log(`indexMissing: imported ${successIds.length}/${docs.length} ${type} docs for host ${host_id}`);
			}
		}
	}

	for (const [host_id, progress] of hostProgress.entries()) {
		const reindexState = await getStoredReindexStatus(host_id);
		if (!reindexState?.total_queued) continue;

		const remaining = await countPendingForHost(host_id, typeModelMap);
		const totalQueued = Math.max(reindexState.total_queued, remaining);
		const indexedTotal = Math.max(totalQueued - remaining, 0);
		const status = remaining === 0 ? 'complete' : 'progress';
		const itemLabel = indexedTotal === 1 ? 'item' : 'items';
		const message = status === 'complete'
			? `Reindex complete. Indexed ${indexedTotal} ${itemLabel}.`
			: `Reindexing... ${indexedTotal} ${itemLabel} indexed, ${remaining} remaining.`;

		emitToTenant(host_id, 'reindex:status', {
			status,
			indexed: indexedTotal,
			remaining,
			total_queued: totalQueued,
			by_type: progress.by_type,
			message,
		});

		if (status === 'complete') {
			await clearStoredReindexStatus(host_id);
		}
	}

	if (totalIndexed > 0) {
		console.log(`indexMissing: indexed ${totalIndexed} documents total`);
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
	return `You are Kumbukum, a personal knowledge assistant. You help users find, organize, and manage their notes, memories, saved URLs, and emails.

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
 * Model ID: convo-{userId}, one per user.
 * Collection: conversation_store_{hostId}, shared per tenant.
 */
export async function ensureConversationModel(hostId, userId) {
	const ts = getTypesenseClient();
	const collectionName = `conversation_store_${hostId}`;
	const modelId = `convo-${userId}`;

	// 1. Ensure conversation store collection exists
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
				console.log(`Created conversation store collection: ${collectionName}`);
			} catch (createErr) {
				if (createErr.httpStatus !== 409) throw createErr;
			}
		} else {
			throw err;
		}
	}

	// 2. Resolve model configuration
	let tsModelName = config.llm.tsConversationModel || 'gemini-2.0-flash';
	const tsProvider = config.llm.tsConversationProvider || 'google';
	if (!tsModelName.includes('/')) {
		tsModelName = `${tsProvider}/${tsModelName}`;
	}
	const apiKey = tsProvider === 'google' ? config.llm.googleApiKey : config.llm.openaiApiKey;
	const desiredSignature = buildConversationModelSignature(tsModelName, apiKey);

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

		// Model exists — sync provider config at most once per process unless the history collection drifted.
		if (!syncedConvoModels.has(modelId)) {
			const storedSignature = await getStoredConversationModelSignature(modelId);
			if (storedSignature === desiredSignature && !updateFields.history_collection) {
				syncedConvoModels.add(modelId);
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
				console.error(`Error updating conversation model ${modelId}:`, err.message);
				throw err;
			}
		}

		syncedConvoModels.add(modelId);
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
				console.log(`Conversation model ${modelId} already exists`);
				await setStoredConversationModelSignature(modelId, desiredSignature);
				syncedConvoModels.add(modelId);
				return;
			}
			throw new Error(`Create conversation model failed (${createResp.status}): ${body}`);
		}

		// Step 2: PUT system_prompt separately
		const updateResp = await fetch(`${baseUrl}/${modelId}`, { method: 'PUT', headers, body: JSON.stringify({ system_prompt: systemPrompt }) });
		if (!updateResp.ok) {
			console.warn(`Conversation model ${modelId} created but system_prompt update failed: ${updateResp.status}`);
		}

		await setStoredConversationModelSignature(modelId, desiredSignature);
		syncedConvoModels.add(modelId);
		console.log(`Created conversation model: ${modelId}`);
	} catch (err) {
		console.error(`Error creating conversation model ${modelId}:`, err.message);
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
 * @returns {{ results: object, conversation: { answer: string, conversationId: string, itemIds: string[] }, action: object|null }}
 */
export async function conversationSearch(hostId, userId, query, options = {}) {
	const ts = getTypesenseClient();
	const convoModelId = `convo-${userId}`;
	const { conversationId, projectId, perPage = 10, includeEmails = true } = options;

	// Build per-collection search requests
	const types = includeEmails ? ['notes', 'memory', 'urls', 'emails', 'pages'] : ['notes', 'memory', 'urls', 'pages'];
	const searches = types.map((type) => {
		const search = {
			collection: `${type}_${hostId}`,
			query_by: 'embedding',
			prefix: false,
			per_page: perPage,
			exclude_fields: _ts_exlude_default,
		};
		if (projectId) {
			search.filter_by = `project_id:=${projectId}`;
		}
		if (_chunk_fields[type]) {
			search.group_by = 'source_id';
			search.group_limit = 1;
		}
		return search;
	});

	// Common search params — q must be top-level when conversation is enabled
	const searchParams = {
		q: query,
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
		try {
			return await ts.multiSearch.perform({ searches }, searchParams);
		} catch (err) {
			if (isMissingSourceIdError(err)) {
				const ungrouped = searches.map(withoutGrouping);
				return ts.multiSearch.perform({ searches: ungrouped }, searchParams);
			}
			throw err;
		}
	}

	async function retryWithoutConversationId(reason) {
		const staleConversationId = searchParams.conversation_id;
		if (!staleConversationId) {
			throw reason;
		}

		delete searchParams.conversation_id;
		console.warn(`Conversation ${staleConversationId} is invalid for model ${convoModelId}; starting a new conversation.`);
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
			console.warn(`Conversation model ${convoModelId} needs repair, recreating metadata...`);
			await ensureConversationModel(hostId, userId);
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

	// Merge results by type
	const merged = {};
	types.forEach((type, i) => {
		merged[type] = normalizeGroupedSearchResult(data.results?.[i]) || { found: 0, hits: [] };
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
	const collectionName = `conversation_store_${hostId}`;
	const modelId = `convo-${userId}`;

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
 * Delete a conversation's messages from the store.
 */
export async function deleteConversation(hostId, userId, conversationId) {
	const ts = getTypesenseClient();
	const collectionName = `conversation_store_${hostId}`;
	return withTypesenseResilience(
		`delete conversation ${collectionName}/${conversationId}`,
		() => ts.collections(collectionName).documents().delete({
			filter_by: `conversation_id:=${conversationId} && model_id:=convo-${userId}`,
		}),
		{ fallback: null },
	);
}
