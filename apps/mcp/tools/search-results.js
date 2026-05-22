import { sanitizeDeep } from '../../../modules/text_sanitize.js';

const EXCERPT_MAX_CHARS = 1200;

const READ_TOOLS = {
	notes: 'read_note',
	memory: 'read_memory',
	memories: 'read_memory',
	urls: 'read_url',
	emails: 'read_email',
};

const CONTENT_FIELDS = [
	'content',
	'text_content',
	'attachment_text_content',
];


/**
 * Convert raw Typesense responses into lean MCP search payloads.
 * Search results include a bounded excerpt; read tools return full documents.
 */
export function slimSearchResults(results, options = {}) {
	if (Array.isArray(results)) {
		return results.map((hit) => slimSearchHit(hit, options.type));
	}

	if (!results || typeof results !== 'object') {
		return results;
	}

	if (Array.isArray(results.hits) || Array.isArray(results.grouped_hits)) {
		return slimSearchCollection(results, options.type);
	}

	return Object.fromEntries(
		Object.entries(results).map(([key, value]) => [key, slimSearchResults(value, { type: key })]),
	);
}

function slimSearchCollection(collection, type) {
	const hits = Array.isArray(collection.hits)
		? collection.hits
		: (collection.grouped_hits || []).map((group) => group.hits?.[0]).filter(Boolean);

	return {
		found: collection.found || 0,
		out_of: collection.out_of || 0,
		page: collection.page || 1,
		hits: hits.map((hit) => slimSearchHit(hit, type)),
	};
}

function slimSearchHit(hit, type) {
	if (hit && typeof hit === 'object' && hit.document) {
		const document = hit.document.source_id ? { ...hit.document, id: hit.document.source_id } : { ...hit.document };
		applySearchMetadata(document, type);
		if (hit.text_match_info?.score !== undefined) document.score = hit.text_match_info.score;
		if (hit.vector_distance !== undefined) document.vector_distance = hit.vector_distance;
		return sanitizeDeep(document);
	}
	if (hit && typeof hit === 'object') {
		const document = { ...hit };
		applySearchMetadata(document, type);
		return sanitizeDeep(document);
	}
	return sanitizeDeep(hit);
}

function applySearchMetadata(document, type) {
	const excerpt = buildExcerpt(document);
	for (const field of CONTENT_FIELDS) delete document[field];
	if (excerpt) document.excerpt = excerpt;
	if (READ_TOOLS[type]) document.read_tool = READ_TOOLS[type];
}

function buildExcerpt(document) {
	const field = CONTENT_FIELDS.find((name) => String(document[name] || '').trim());
	if (!field) return '';

	const text = String(document[field]).replace(/\s+/g, ' ').trim();
	if (text.length <= EXCERPT_MAX_CHARS) return text;
	return `${text.slice(0, EXCERPT_MAX_CHARS).trimEnd()}...`;
}
