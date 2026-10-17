import { renderFile } from 'pug';
import { fileURLToPath } from 'node:url';
import { buildEmailExcerpt } from './email_display.js';

export function attachItemHtml(type, item) {
	if (!item) return item;
	const value = typeof item.toObject === 'function' ? item.toObject() : item;
	const template = type === 'email' ? 'email_item' : 'record_item';
	value.html = renderFile(fileURLToPath(new URL(`../views/ajax/${template}.pug`, import.meta.url)), { item: value, type, excerpt: type === 'email' ? buildEmailExcerpt(value) : '', cache: true });
	return value;
}
