// Global Typesense-backed search palette
(function () {
	var trigger;
	var backdrop;
	var palette;
	var input;
	var resultsEl;
	var helpEl;
	var debounceTimer = null;
	var activeIndex = -1;
	var results = [];
	var requestSeq = 0;

	function isTypingTarget(target) {
		if (!target) return false;
		var tag = String(target.tagName || '').toLowerCase();
		return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
	}

	function setOpen(open) {
		if (!palette || !backdrop || !input) return;
		palette.classList.toggle('d-none', !open);
		backdrop.classList.toggle('d-none', !open);
		document.body.classList.toggle('kk-search-open', open);
		if (open) {
			input.value = '';
			results = [];
			activeIndex = -1;
			renderEmpty('Type to search everything.');
			window.setTimeout(function () { input.focus(); }, 0);
		}
	}

	function openPalette() {
		setOpen(true);
	}

	function closePalette() {
		setOpen(false);
		if (trigger) trigger.focus();
	}

	function escapeText(value) {
		return String(value || '');
	}

	function resultTypeClass(type) {
		return 'kk-search-type-' + String(type || '').replace(/[^a-z0-9_-]/gi, '');
	}

	function formatResultDate(value) {
		if (!value) return '';
		return new Date(Number(value) * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function createHighlightedText(item) {
		var wrap = document.createElement('span');
		var segments = item.highlight_segments || [];
		if (!segments.length) {
			wrap.textContent = item.excerpt || '';
			return wrap;
		}
		segments.forEach(function (segment) {
			var node = segment.highlighted ? document.createElement('mark') : document.createElement('span');
			node.textContent = segment.text || '';
			wrap.appendChild(node);
		});
		return wrap;
	}

	function renderEmpty(message) {
		if (!resultsEl) return;
		resultsEl.innerHTML = '';
		var empty = document.createElement('div');
		empty.className = 'kk-search-empty';
		empty.textContent = message;
		resultsEl.appendChild(empty);
		if (helpEl) helpEl.textContent = 'Search everything';
	}

	function updateActive() {
		resultsEl?.querySelectorAll('.kk-search-result').forEach(function (el, index) {
			var active = index === activeIndex;
			el.classList.toggle('is-active', active);
			el.setAttribute('aria-selected', active ? 'true' : 'false');
			if (active) el.scrollIntoView({ block: 'nearest' });
		});
	}

	function renderResults(items) {
		results = items || [];
		activeIndex = results.length ? 0 : -1;
		resultsEl.innerHTML = '';
		if (!results.length) {
			renderEmpty('No results.');
			return;
		}
		if (helpEl) helpEl.textContent = results.length + ' result' + (results.length === 1 ? '' : 's');

		results.forEach(function (item, index) {
			var row = document.createElement('button');
			row.type = 'button';
			row.className = 'kk-search-result';
			row.setAttribute('role', 'option');
			row.setAttribute('aria-selected', 'false');

			var badge = document.createElement('span');
			badge.className = 'kk-search-result-badge ' + resultTypeClass(item.type);
			badge.textContent = item.label || item.type || 'Item';

			var body = document.createElement('span');
			body.className = 'kk-search-result-body';

			var titleRow = document.createElement('span');
			titleRow.className = 'kk-search-result-title-row';

			var title = document.createElement('span');
			title.className = 'kk-search-result-title';
			title.textContent = escapeText(item.title || 'Untitled');
			titleRow.appendChild(title);

			var date = formatResultDate(item.updated_at);
			if (date) {
				var dateEl = document.createElement('span');
				dateEl.className = 'kk-search-result-date';
				dateEl.textContent = date;
				titleRow.appendChild(dateEl);
			}

			body.appendChild(titleRow);

			if (item.subtitle) {
				var subtitle = document.createElement('span');
				subtitle.className = 'kk-search-result-subtitle';
				subtitle.textContent = item.subtitle;
				body.appendChild(subtitle);
			}

			if (item.excerpt || item.highlight_segments?.length) {
				var excerpt = document.createElement('span');
				excerpt.className = 'kk-search-result-excerpt';
				excerpt.appendChild(createHighlightedText(item));
				body.appendChild(excerpt);
			}

			row.appendChild(badge);
			row.appendChild(body);
			row.addEventListener('click', function () {
				activeIndex = index;
				openActiveResult();
			});
			resultsEl.appendChild(row);
		});
		updateActive();
	}

	async function runSearch() {
		var query = input.value.trim();
		var seq = ++requestSeq;
		if (!query) {
			renderEmpty('Type to search everything.');
			return;
		}
		renderEmpty('Searching...');
		try {
			var res = await api('POST', '/search/quick', { query: query, limit: 12, per_page: 6 });
			if (seq !== requestSeq) return;
			renderResults(res.results || []);
		} catch (err) {
			if (seq !== requestSeq) return;
			renderEmpty(err.message || 'Search failed.');
		}
	}

	function scheduleSearch() {
		window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(runSearch, 180);
	}

	function openTarget(item) {
		if (typeof window.openResultModal === 'function') {
			window.openResultModal({
				_type: item.type,
				id: item.id,
				title: item.title,
				url: item.url,
				description: item.excerpt,
				text_content: item.excerpt,
			});
			return;
		}
		var fallbackPath = { notes: '/notes', memory: '/memories', urls: '/urls', emails: '/emails', pages: '/urls' }[item.type] || '/dashboard';
		if (typeof window.navigateTo === 'function') {
			window.navigateTo(fallbackPath);
		} else {
			window.location.href = fallbackPath;
		}
	}

	function openActiveResult() {
		if (activeIndex < 0 || activeIndex >= results.length) return;
		var item = results[activeIndex];
		closePalette();
		openTarget(item);
	}

	function moveActive(delta) {
		if (!results.length) return;
		activeIndex = (activeIndex + delta + results.length) % results.length;
		updateActive();
	}

	function bindEvents() {
		trigger?.addEventListener('click', openPalette);
		backdrop?.addEventListener('click', closePalette);
		input?.addEventListener('input', scheduleSearch);
		input?.addEventListener('keydown', function (event) {
			if (event.key === 'Escape') {
				event.preventDefault();
				closePalette();
			} else if (event.key === 'ArrowDown') {
				event.preventDefault();
				moveActive(1);
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				moveActive(-1);
			} else if (event.key === 'Enter') {
				event.preventDefault();
				openActiveResult();
			}
		});
		document.addEventListener('keydown', function (event) {
			if (event.key === '/' && !isTypingTarget(event.target) && palette?.classList.contains('d-none')) {
				event.preventDefault();
				openPalette();
			}
			if (event.key === 'Escape' && palette && !palette.classList.contains('d-none')) {
				event.preventDefault();
				closePalette();
			}
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		trigger = document.getElementById('kk-global-search-trigger');
		backdrop = document.getElementById('kk-search-backdrop');
		palette = document.getElementById('kk-search-palette');
		input = document.getElementById('kk-search-input');
		resultsEl = document.getElementById('kk-search-results');
		helpEl = document.getElementById('kk-search-help');
		if (!trigger || !palette || !input || !resultsEl) return;
		bindEvents();
	});
})();
