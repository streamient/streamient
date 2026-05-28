(function () {
	'use strict';

	const CONTROL_SELECTOR = 'input, textarea, select';
	const TARGET_SELECTOR = 'form, input, textarea, select';
	const SKIP_SELECTOR = '[data-autofill-guard="allow"]';
	const FORM_ATTRIBUTES = {
		autocomplete: 'off',
	};
	const CONTROL_ATTRIBUTES = {
		autocomplete: 'off',
		'data-1p-ignore': '',
		'data-op-ignore': '',
		'data-lpignore': 'true',
		'data-bwignore': 'true',
		'data-form-type': 'other',
	};

	function applyAttributes(element, attributes) {
		for (const [name, value] of Object.entries(attributes)) {
			if (element.getAttribute(name) !== value) {
				element.setAttribute(name, value);
			}
		}
	}

	function shouldSkip(element) {
		return Boolean(element.closest(SKIP_SELECTOR));
	}

	function guardElement(element) {
		if (!element || element.nodeType !== Node.ELEMENT_NODE || shouldSkip(element)) return;

		if (element.matches('form')) {
			applyAttributes(element, FORM_ATTRIBUTES);
		}

		if (element.matches(CONTROL_SELECTOR)) {
			applyAttributes(element, CONTROL_ATTRIBUTES);
		}
	}

	function guardTree(root) {
		if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

		guardElement(root);
		root.querySelectorAll(TARGET_SELECTOR).forEach(guardElement);
	}

	guardTree(document.documentElement);

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				guardTree(node);
			}
		}
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});

	window.KumbukumAutofillGuard = {
		apply: () => guardTree(document.documentElement),
	};
}());
