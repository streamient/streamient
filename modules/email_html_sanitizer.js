import sanitizeHtml from 'sanitize-html';

const REMOTE_IMAGE_RE = /^https?:\/\//i;
const UNSAFE_STYLE_RE = /(?:url\s*\(|@import|expression\s*\(|behavior\s*:|-moz-binding)/i;

const ALLOWED_TAGS = [
	'a',
	'abbr',
	'acronym',
	'address',
	'area',
	'article',
	'aside',
	'b',
	'blockquote',
	'br',
	'caption',
	'center',
	'cite',
	'code',
	'col',
	'colgroup',
	'dd',
	'del',
	'div',
	'dl',
	'dt',
	'em',
	'font',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'i',
	'img',
	'li',
	'ol',
	'p',
	'pre',
	's',
	'section',
	'small',
	'span',
	'strong',
	'sub',
	'sup',
	'table',
	'tbody',
	'td',
	'tfoot',
	'th',
	'thead',
	'tr',
	'u',
	'ul',
];

const GLOBAL_ATTRIBUTES = [
	'align',
	'bgcolor',
	'class',
	'dir',
	'height',
	'id',
	'lang',
	'style',
	'title',
	'valign',
	'width',
];

function cleanStyle(value) {
	const style = String(value || '').trim();
	if (!style || UNSAFE_STYLE_RE.test(style)) return '';
	return style;
}

function normalizeAttributes(tagName, attribs, state) {
	const clean = { ...attribs };
	for (const key of Object.keys(clean)) {
		if (/^on/i.test(key)) delete clean[key];
	}

	if (clean.style !== undefined) {
		const style = cleanStyle(clean.style);
		if (style) {
			clean.style = style;
		} else {
			delete clean.style;
		}
	}

	if (tagName === 'a') {
		clean.target = '_blank';
		clean.rel = 'noopener noreferrer';
	}

	if (tagName === 'img') {
		delete clean['data-st-remote-src'];
		delete clean['data-kk-remote-src'];
		const src = String(clean.src || '').trim();
		if (REMOTE_IMAGE_RE.test(src)) {
			state.hasRemoteImages = true;
			clean['data-st-remote-src'] = src;
			delete clean.src;
		}
	}

	return clean;
}

export function sanitizeEmailHtml(value) {
	const input = String(value || '').trim();
	const state = { hasRemoteImages: false };
	if (!input) return { html: '', hasRemoteImages: false };

	const html = sanitizeHtml(input, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			'*': GLOBAL_ATTRIBUTES,
			a: [...GLOBAL_ATTRIBUTES, 'href', 'name', 'target', 'rel'],
			area: [...GLOBAL_ATTRIBUTES, 'href', 'alt', 'shape', 'coords', 'target', 'rel'],
			col: [...GLOBAL_ATTRIBUTES, 'span'],
			img: [...GLOBAL_ATTRIBUTES, 'src', 'alt', 'border', 'data-st-remote-src'],
			table: [...GLOBAL_ATTRIBUTES, 'border', 'cellpadding', 'cellspacing', 'role'],
			td: [...GLOBAL_ATTRIBUTES, 'colspan', 'rowspan', 'scope'],
			th: [...GLOBAL_ATTRIBUTES, 'colspan', 'rowspan', 'scope'],
		},
		allowedSchemes: ['http', 'https', 'mailto', 'tel', 'cid', 'data'],
		allowedSchemesByTag: {
			img: ['http', 'https', 'cid', 'data'],
		},
		allowedSchemesAppliedToAttributes: ['href', 'src', 'data-st-remote-src'],
		allowProtocolRelative: false,
		parseStyleAttributes: false,
		transformTags: {
			'*': (tagName, attribs) => ({
				tagName,
				attribs: normalizeAttributes(tagName, attribs, state),
			}),
		},
		exclusiveFilter(frame) {
			return frame.tag === 'img' && !frame.attribs?.src && !frame.attribs?.['data-st-remote-src'];
		},
	});

	return {
		html: html.trim(),
		hasRemoteImages: state.hasRemoteImages,
	};
}
