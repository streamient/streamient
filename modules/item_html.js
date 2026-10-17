import { renderFile } from 'pug';
import { fileURLToPath } from 'node:url';
import { buildEmailExcerpt } from './email_display.js';
import { load } from 'cheerio';

export function attachItemHtml(type, item) {
	if (!item) return item;
	const value = typeof item.toObject === 'function' ? item.toObject() : item;
	const template = type === 'email' ? 'email_item' : 'record_item';
	let excerpt = type === 'email' ? buildEmailExcerpt(value) : String(value.text_content || '').slice(0, 200);
	if (type === 'memory') {
		const $ = load(value.content || '', {}, false);
		$('script,style').remove();
		$('br').replaceWith(' ');
		$('p,div,li,blockquote,pre,h1,h2,h3,h4,h5,h6').append(' ');
		excerpt = $.root().text().replace(/\s+/g, ' ').trim().slice(0, 200);
	}
	value.html = renderFile(fileURLToPath(new URL(`../views/ajax/${template}.pug`, import.meta.url)), { item: value, type, excerpt, cache: true });
	return value;
}
