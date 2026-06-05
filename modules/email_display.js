import * as cheerio from 'cheerio';
import striptags from 'striptags';

const EXCERPT_HIDDEN_LINE_PATTERNS = [
	/^-+\s*please reply above this line\s*-+$/i,
	/^\s*<!--.*?-->\s*$/,
];
const EXCERPT_STOP_LINE_PATTERNS = [
	/^-*\s*hmstopparser\s*-*$/i,
	/^on .{1,300}\b(wrote|replied):$/i,
	/^(from|sent|date|to|cc|subject)\s*:/i,
];

const HIDDEN_SELECTOR = [
	'head',
	'style',
	'script',
	'noscript',
	'template',
	'meta',
	'link',
	'title',
	'[hidden]',
	'[aria-hidden="true"]',
	'[style*="display:none" i]',
	'[style*="display: none" i]',
	'[style*="visibility:hidden" i]',
	'[style*="visibility: hidden" i]',
	'[style*="opacity:0" i]',
	'[style*="opacity: 0" i]',
	'[style*="font-size:0" i]',
	'[style*="font-size: 0" i]',
].join(',');

function normalizeWhitespace(value) {
	return String(value || '')
		.replace(/\u00a0/g, ' ')
		.replace(/[\u200b-\u200f\ufeff]/g, '')
		.replace(/(-*\s*hmstopparser\s*-*)/ig, '\n$1\n')
		.replace(/[ \t]+/g, ' ')
		.replace(/\s*\n\s*/g, '\n')
		.trim();
}

export function cleanEmailExcerptText(value) {
	const text = normalizeWhitespace(value);
	if (!text) return '';

	const lines = [];
	for (const line of text.split(/\r?\n/g).map((item) => item.trim())) {
		if (!line || line === '--') continue;
		if (EXCERPT_STOP_LINE_PATTERNS.some((pattern) => pattern.test(line))) break;
		if (EXCERPT_HIDDEN_LINE_PATTERNS.some((pattern) => pattern.test(line))) continue;
		lines.push(line);
	}

	return lines
		.join(' ')
		.replace(/\s+/g, ' ')
		.replace(/^--\s*/, '')
		.trim();
}

export function visibleTextFromEmailHtml(value) {
	const html = String(value || '').trim();
	if (!html) return '';

	const $ = cheerio.load(html, { decodeEntities: true });
	$(HIDDEN_SELECTOR).remove();
	$('br').replaceWith('\n');
	$('p,div,table,tr,td,th,li,blockquote,h1,h2,h3,h4,h5,h6,section,article').each((_, element) => {
		$(element).append('\n');
	});
	return cleanEmailExcerptText($.root().text() || striptags(html, [], ' '));
}

function removeLeadingSubject(value, subject) {
	const text = String(value || '').trim();
	const cleanSubject = String(subject || '').trim();
	if (!text || !cleanSubject || !text.toLowerCase().startsWith(cleanSubject.toLowerCase())) return text;
	return text.slice(cleanSubject.length).replace(/^[-:\s]+/, '').trim();
}

function truncateExcerpt(value, limit) {
	const text = cleanEmailExcerptText(value);
	if (!text) return '';
	if (text.length <= limit) return text;
	return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function buildEmailExcerpt(email = {}, limit = 220) {
	const htmlText = removeLeadingSubject(visibleTextFromEmailHtml(email.html_content || ''), email.subject);
	const text = removeLeadingSubject(cleanEmailExcerptText(email.text_content || ''), email.subject);
	const attachmentText = cleanEmailExcerptText(email.attachment_text_content || '');
	return truncateExcerpt(htmlText || text || attachmentText, limit);
}

export function emailDisplayDate(email = {}) {
	return email.createdAt || email.updatedAt || null;
}

export function decorateEmailForClient(email = {}) {
	const doc = email?.toObject ? email.toObject() : { ...email };
	doc.excerpt = buildEmailExcerpt(doc);
	doc.display_date = emailDisplayDate(doc);
	if (doc.thread_latest) {
		const latest = doc.thread_latest?.toObject ? doc.thread_latest.toObject() : { ...doc.thread_latest };
		latest.excerpt = buildEmailExcerpt(latest);
		latest.display_date = emailDisplayDate(latest);
		doc.thread_latest = latest;
	}
	return doc;
}
