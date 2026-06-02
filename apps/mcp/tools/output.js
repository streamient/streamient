import { sanitizeDeep } from '../../../modules/text_sanitize.js';

const INTERNAL_OUTPUT_FIELDS = new Set([
	'__v',
	'host_id',
	'owner',
	'is_active',
	'is_indexed',
	'email_filter',
	'embedding',
	'raw_hash',
	'html_content',
	'html_content_has_remote_images',
	'attachment_text_content',
	'message_id',
	'in_reply_to',
	'parent_url_id',
	'chunk_count',
	'chunk_index',
	'vector_distance',
	'createdAt',
	'updatedAt',
	'created_at',
	'updated_at',
	'trashed_at',
	'triaged_at',
	'crawled_at',
	'triage_run_id',
	'triage_draft_id',
	'triage_error',
	'triage_confidence',
	'triage_related_context',
]);

function isPlainObject(value) {
	if (value === null || typeof value !== 'object') return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function normalizeId(value) {
	if (value === null || value === undefined) return value;
	if (typeof value === 'object' && typeof value.toString === 'function') return value.toString();
	return value;
}

export function sanitizeMcpOutput(value) {
	if (Array.isArray(value)) return value.map(sanitizeMcpOutput);
	if (!isPlainObject(value)) return sanitizeDeep(value);

	const out = {};
	for (const [key, val] of Object.entries(value)) {
		if (key === '_id') {
			if (out.id === undefined) out.id = normalizeId(val);
			continue;
		}
		if (key === 'project') {
			out.project_id = normalizeId(val?._id || val);
			continue;
		}
		if (INTERNAL_OUTPUT_FIELDS.has(key)) continue;
		out[key] = sanitizeMcpOutput(val);
	}
	return sanitizeDeep(out);
}

export function mcpJson(value, { ephemeral = false } = {}) {
	const item = {
		type: 'text',
		text: JSON.stringify(sanitizeMcpOutput(value), null, 2),
	};
	if (ephemeral) item.cache_control = { type: 'ephemeral' };
	return { content: [item] };
}
