import {
	shouldDarkenBackground,
	shouldLightenText,
	shouldMuteBorder,
} from './email_dark_mode_rules.js';

const SURFACE = '#1a1f25';
const SURFACE_ALT = '#20262d';
const TEXT = '#e8edf3';
const MUTED = '#b7c0cc';
const BORDER = '#3a424d';

function cssValue(value) {
	return String(value || '').trim();
}

function readableStyle(element) {
	try {
		return window.getComputedStyle(element);
	} catch {
		return null;
	}
}

function styleHasValue(style, property) {
	return Boolean(cssValue(style.getPropertyValue(property)));
}

function adjustElement(element) {
	if (!(element instanceof HTMLElement)) return;
	if (['IMG', 'PICTURE', 'SVG', 'CANVAS', 'VIDEO'].includes(element.tagName)) return;

	var style = element.style;
	var background = cssValue(style.backgroundColor || style.background);
	var color = cssValue(style.color || element.getAttribute('color'));
	var bgcolor = cssValue(element.getAttribute('bgcolor'));
	var computed = readableStyle(element);
	var computedBackground = cssValue(computed?.backgroundColor);
	var computedColor = cssValue(computed?.color);

	if (bgcolor && shouldDarkenBackground(bgcolor)) {
		element.setAttribute('bgcolor', SURFACE);
		style.setProperty('background-color', SURFACE, 'important');
	}

	if (background && shouldDarkenBackground(background)) {
		style.setProperty('background-color', element.closest('table') ? SURFACE_ALT : SURFACE, 'important');
		style.removeProperty('background-image');
	}

	if (!background && computedBackground && shouldDarkenBackground(computedBackground)) {
		style.setProperty('background-color', element.closest('table') ? SURFACE_ALT : SURFACE, 'important');
		style.removeProperty('background-image');
	}

	if (color && shouldLightenText(color)) {
		style.setProperty('color', TEXT, 'important');
		if (element.hasAttribute('color')) element.setAttribute('color', TEXT);
	}

	if (!color && computedColor && shouldLightenText(computedColor)) {
		style.setProperty('color', TEXT, 'important');
	}

	[
		'border-color',
		'border-top-color',
		'border-right-color',
		'border-bottom-color',
		'border-left-color',
	].forEach(function (property) {
		if (styleHasValue(style, property) && shouldMuteBorder(style.getPropertyValue(property))) {
			style.setProperty(property, BORDER, 'important');
		}
	});
}

function styleQuotes() {
	document.querySelectorAll('blockquote,.gmail_quote,.yahoo_quoted,.moz-cite-prefix').forEach(function (element) {
		if (!(element instanceof HTMLElement)) return;
		element.style.setProperty('border-left', '4px solid #4aa3df', 'important');
		element.style.setProperty('padding-left', '16px', 'important');
		element.style.setProperty('margin-left', '0', 'important');
		element.style.setProperty('background-color', 'rgba(255,255,255,0.035)', 'important');
		element.style.setProperty('color', MUTED, 'important');
	});
}

function applyDarkMode() {
	if (document.documentElement.dataset.kkEmailTheme !== 'dark') return;
	document.documentElement.style.setProperty('background-color', '#0f141b', 'important');
	document.body?.style.setProperty('background-color', '#0f141b', 'important');
	document.body?.style.setProperty('color', TEXT, 'important');
	document.querySelectorAll('*').forEach(adjustElement);
	styleQuotes();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', applyDarkMode, { once: true });
} else {
	applyDarkMode();
}

window.addEventListener('load', applyDarkMode, { once: true });
