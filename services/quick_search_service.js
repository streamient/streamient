import { quickSearch } from '../modules/typesense.js';

const HIGHLIGHT_START = '__kk_hl_start__';
const HIGHLIGHT_END = '__kk_hl_end__';
const TYPE_LABELS = {
	notes: 'Note',
	memory: 'Memory',
	urls: 'URL',
	emails: 'Email',
	pages: 'Page',
};
const CONTENT_FIELDS = {
	notes: ['text_content'],
	memory: ['content'],
	urls: ['description', 'text_content', 'url'],
	emails: ['text_content', 'attachment_text_content'],
	pages: ['text_content', 'url'],
};
const TITLE_FIELDS = {
	notes: ['title'],
	memory: ['title'],
	urls: ['title', 'url'],
	emails: ['subject'],
	pages: ['title', 'url'],
};

function compactText(value, limit = 240) {
	const text = Array.isArray(value) ? value.join(', ') : String(value || '');
	const cleaned = text.replace(/\s+/g, ' ').trim();
	if (cleaned.length <= limit) return cleaned;
	return cleaned.slice(0, limit).trimEnd() + '...';
}

function splitHighlightSnippet(snippet = '') {
	const text = String(snippet || '');
	if (!text) return [];

	const segments = [];
	let index = 0;
	while (index < text.length) {
		const start = text.indexOf(HIGHLIGHT_START, index);
		if (start === -1) {
			if (index < text.length) segments.push({ text: text.slice(index), highlighted: false });
			break;
		}
		if (start > index) segments.push({ text: text.slice(index, start), highlighted: false });

		const valueStart = start + HIGHLIGHT_START.length;
		const end = text.indexOf(HIGHLIGHT_END, valueStart);
		if (end === -1) {
			segments.push({ text: text.slice(valueStart), highlighted: true });
			break;
		}

		segments.push({ text: text.slice(valueStart, end), highlighted: true });
		index = end + HIGHLIGHT_END.length;
	}

	return segments.filter((segment) => segment.text);
}

function plainFromSegments(segments = []) {
	return segments.map((segment) => segment.text).join('');
}

function normalizeHighlightEntry(entry) {
	if (!entry) return null;
	const snippet = entry.snippet || entry.value || entry.snippets?.[0] || '';
	if (!snippet) return null;
	const segments = splitHighlightSnippet(snippet);
	if (!segments.length) return null;
	return {
		field: entry.field || '',
		segments,
		text: plainFromSegments(segments),
	};
}

function collectHighlights(hit = {}) {
	const items = [];
	if (Array.isArray(hit.highlights)) {
		for (const entry of hit.highlights) {
			const normalized = normalizeHighlightEntry(entry);
			if (normalized) items.push(normalized);
		}
	}
	for (const [field, entry] of Object.entries(hit.highlight || {})) {
		const normalized = normalizeHighlightEntry({ ...entry, field });
		if (normalized) items.push(normalized);
	}
	return items;
}

function pickHighlight(hit, type) {
	const highlights = collectHighlights(hit);
	if (!highlights.length) return null;
	const preferred = [...TITLE_FIELDS[type], ...CONTENT_FIELDS[type]];
	for (const field of preferred) {
		const found = highlights.find((highlight) => highlight.field === field);
		if (found) return found;
	}
	return highlights[0];
}

function pickFirst(doc, fields) {
	for (const field of fields) {
		const value = doc[field];
		if (Array.isArray(value) && value.length) return value.join(', ');
		if (String(value || '').trim()) return value;
	}
	return '';
}

function resultTitle(type, doc) {
	if (type === 'emails') return doc.subject || '(No subject)';
	return pickFirst(doc, TITLE_FIELDS[type]) || 'Untitled';
}

function resultSubtitle(type, doc) {
	if (type === 'emails') return compactText(doc.from || [], 120);
	if (type === 'urls' || type === 'pages') return compactText(doc.url || '', 160);
	if (type === 'memory') return compactText(doc.source || '', 120);
	return compactText(doc.tags || [], 120);
}

function resultExcerpt(type, doc, highlight) {
	if (highlight?.text) return compactText(highlight.text, 260);
	return compactText(pickFirst(doc, CONTENT_FIELDS[type]), 260);
}

function scoreValue(hit = {}) {
	const raw = hit.text_match_info?.score ?? hit.text_match ?? 0;
	const score = Number(raw);
	return Number.isFinite(score) ? score : 0;
}

function openTarget(type, doc) {
	const id = doc.source_id || doc.id || '';
	const projectId = doc.project_id || '';
	return { kind: 'modal', type, id, project_id: projectId };
}

export function normalizeQuickSearchHit(type, hit, options = {}) {
	const doc = hit?.document || {};
	const id = doc.source_id || doc.id || '';
	if (!id) return null;

	const highlight = pickHighlight(hit, type);
	return {
		id,
		type,
		label: TYPE_LABELS[type] || type,
		title: resultTitle(type, doc),
		subtitle: resultSubtitle(type, doc),
		excerpt: resultExcerpt(type, doc, highlight),
		url: doc.url || '',
		highlight_field: highlight?.field || '',
		highlight_segments: highlight?.segments || [],
		project_id: doc.project_id || '',
		updated_at: doc.updated_at || doc.crawled_at || doc.created_at || null,
		open_target: openTarget(type, doc),
		_score: scoreValue(hit),
	};
}

export function normalizeQuickSearchResults(rawResults = {}, options = {}) {
	const results = [];
	for (const [type, data] of Object.entries(rawResults || {})) {
		for (const hit of data?.hits || []) {
			const normalized = normalizeQuickSearchHit(type, hit, options);
			if (normalized) results.push(normalized);
		}
	}
	results.sort((a, b) => {
		if (b._score !== a._score) return b._score - a._score;
		return (b.updated_at || 0) - (a.updated_at || 0);
	});
	const limit = Math.min(Math.max(parseInt(options.limit, 10) || 12, 1), 50);
	return results.slice(0, limit).map(({ _score, ...result }) => result);
}

export async function quickSearchKnowledge(hostId, query, options = {}) {
	const q = String(query || '').trim();
	if (!q) return { results: [], found: 0 };

	const searchFn = options.searchFn || quickSearch;
	const raw = await searchFn(hostId, q, {
		projectId: options.projectId,
		includeEmails: options.includeEmails !== false,
		perPage: options.perPage,
	});
	const results = normalizeQuickSearchResults(raw, {
		limit: options.limit,
	});
	return { results, found: results.length };
}
