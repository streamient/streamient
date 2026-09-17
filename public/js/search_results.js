(function () {
	let root;
	let filters = {};
	let pending;
	let page = 1;
	let pages = 1;
	let total = 0;
	let generation = 0;
	let busy = false;
	let selectingAll = false;
	let selectionRequest = 0;
	let selectionAnchor = null;
	let tagPicker;
	let typePicker;
	let listeners = [];
	const rows = new Map();
	const selected = new Map();
	const revisions = new Map();
	const refreshes = new Map();
	const tombstones = new Set();
	const queuedEvents = new Map();
	const keyOf = (item) => item.type + ':' + item.id;
	const setButtonLoading = (button, loading) => {
		if (!button) return;
		button.disabled = loading;
		button.setAttribute('aria-busy', String(loading));
	};
	const element = (key) => root?.querySelector('[data-search-key="' + CSS.escape(key) + '"]');
	const on = (target, event, handler) => {
		target?.addEventListener(event, handler);
		listeners.push([target, event, handler]);
	};
	const persist = () => {
		if (!root || location.pathname !== '/search') return;
		const url = new URL(location.href);
		url.searchParams.set('search', JSON.stringify({ ...filters, page }));
		history.replaceState({ ...history.state, spaPath: '/search' }, '', url);
	};
	const updateSelection = () => {
		if (!root) return;
		root.querySelector('#search-selected').textContent = selected.size + ' selected';
		root.querySelector('#search-actions').classList.toggle('d-none', !selected.size);
		root.querySelector('#search-total').textContent = total + ' matching records';
		const selectAll = root.querySelector('#search-select-all');
		selectAll.checked = selectingAll || (selected.size > 0 && selected.size >= total);
		selectAll.indeterminate = !selectingAll && selected.size > 0 && selected.size < total;
		selectAll.disabled = busy || !total;
		selectAll.setAttribute('aria-busy', String(selectingAll));
		root.querySelector('#search-page-number').textContent = 'Page ' + page + ' of ' + pages;
		root.querySelector('#search-prev').disabled = page <= 1;
		root.querySelector('#search-next').disabled = page >= pages;
		root.querySelector('#search-empty').classList.toggle('d-none', rows.size > 0);
		root.querySelectorAll('[data-search-action]').forEach((button) => { button.disabled = busy || selectingAll || !selected.size; });
		root.querySelectorAll('.search-result').forEach((row) => { row.querySelector('.search-select').checked = selected.has(row.dataset.searchKey); });
	};
	const applyItem = (outcome, { sequence, epoch = generation, mutation = false } = {}) => {
		if (!root || epoch !== generation) return;
		const key = keyOf(outcome);
		if (sequence && refreshes.get(key) !== sequence) return;
		if (mutation) refreshes.set(key, (refreshes.get(key) || 0) + 1);
		const existing = element(key);
		if (!outcome.success) {
			if (existing) existing.querySelector('.search-item-error').textContent = outcome.error;
			return;
		}
		const revision = outcome.item?.version || '';
		if (!outcome.removed && (tombstones.has(key) || (revisions.has(key) && revision < revisions.get(key)))) return;
		if (mutation) selected.delete(key);
		if (outcome.removed) {
			if (!tombstones.has(key) && (rows.has(key) || selected.has(key) || existing || mutation)) total = Math.max(0, total - 1);
			tombstones.add(key);
			existing?.remove();
			rows.delete(key);
		} else {
			revisions.set(key, revision);
			if (existing || page === 1) {
				const template = document.createElement('template');
				template.innerHTML = outcome.html;
				const next = template.content.firstElementChild;
				if (!next) return;
				const active = existing?.contains(document.activeElement) ? document.activeElement.className : '';
				if (existing) existing.replaceWith(next);
				else root.querySelector('#search-list').appendChild(next);
				rows.set(key, outcome.item);
				if (active) next.querySelector(active.includes('search-select') ? '.search-select' : '.search-open')?.focus({ preventScroll: true });
			}
		}
		updateSelection();
	};
	const refreshItem = async (type, id, created = false) => {
		const key = keyOf({ type, id });
		if (!root || tombstones.has(key)) return;
		if (busy) { queuedEvents.set(key, { type, id, created }); return; }
		if (!rows.has(key) && !selected.has(key) && (!created || page !== 1)) return;
		const sequence = (refreshes.get(key) || 0) + 1;
		refreshes.set(key, sequence);
		const epoch = generation;
		try {
			const data = await api('POST', '/search/item', { type, id, filters });
			if (created && epoch === generation && !rows.has(key) && !data.outcomes[0].removed) total++;
			applyItem(data.outcomes[0], { sequence, epoch });
		} catch (error) {
			if (epoch === generation) showError(error.message);
		}
	};
	const loadTags = async () => {
		const epoch = generation;
		const project = root.querySelector('#search-project').value;
		const data = await api('GET', '/search/tags?' + new URLSearchParams({ project_id: project }));
		if (!root || epoch !== generation || root.querySelector('#search-project').value !== project) return;
		const select = root.querySelector('#search-tags');
		const picked = new Set(filters.tags || []);
		const options = [...new Set([...data.tags, ...picked])].sort().map((tag) => ({ value: tag, text: tag }));
		const { TomSelect } = await import('/static/js/vendor.js');
		if (!root || epoch !== generation) return;
		if (!typePicker) typePicker = new TomSelect(root.querySelector('#search-types'), { plugins: ['remove_button'], create: false, closeAfterSelect: true });
		if (!tagPicker) tagPicker = new TomSelect(select, { plugins: ['remove_button'], create: false, options, closeAfterSelect: true });
		else {
			tagPicker.clear(true);
			tagPicker.clearOptions();
			tagPicker.addOptions(options);
		}
		tagPicker.setValue([...picked], true);
	};
	const load = async (button) => {
		if (!root || busy) return;
		selectionAnchor = null;
		selectionRequest++;
		selectingAll = false;
		updateSelection();
		const epoch = ++generation;
		setButtonLoading(button, true);
		try {
			const data = await api('POST', '/search/results', { ...filters, page });
			if (!root || epoch !== generation) return;
			filters = { ...data.filters, per_page: data.per_page };
			if ((window.currentProjectId || '') !== filters.project_id) setActiveProject(filters.project_id || null);
			pages = data.pages;
			total = data.total;
			rows.clear();
			data.items.forEach((item) => { rows.set(keyOf(item), item); revisions.set(keyOf(item), item.version); });
			root.querySelector('#search-list').innerHTML = data.html;
			root.querySelector('#search-query').value = filters.query;
			await loadTags();
			if (!root || epoch !== generation) return;
			typePicker.setValue(filters.types || [], true);
			updateSelection();
			persist();
		} catch (error) {
			if (epoch === generation) showError(error.message);
		} finally {
			setButtonLoading(button, false);
		}
	};
	const runAction = async (action, extra, button, chosen) => {
		if (busy || !chosen.length) return;
		busy = true;
		const epoch = generation;
		const snapshot = filters;
		let done = 0;
		const failures = [];
		setButtonLoading(button, true);
		updateSelection();
		try {
			for (let offset = 0; offset < chosen.length; offset += 25) {
				const data = await api('POST', '/search/actions', { filters: snapshot, items: chosen.slice(offset, offset + 25), action, ...extra });
				if (data.outcomes.some((outcome) => outcome.success)) window.dispatchEvent(new CustomEvent('counts:refresh'));
				for (const outcome of data.outcomes) {
					applyItem(outcome, { epoch, mutation: true });
					if (outcome.success) done++;
					else failures.push(outcome.type + ' ' + outcome.id + ': ' + outcome.error);
				}
				if (root && epoch === generation) root.querySelector('#search-action-status').textContent = done + ' updated; ' + failures.length + ' failed.';
			}
			if (failures.length) showError(failures.slice(0, 5).join('\n') + (failures.length > 5 ? '\nRemaining failed records stay selected.' : ''));
			else showSuccess(done + ' records updated');
		} catch (error) {
			showError(error.message);
		} finally {
			busy = false;
			setButtonLoading(button, false);
			updateSelection();
			for (const event of queuedEvents.values()) refreshItem(event.type, event.id, event.created);
			queuedEvents.clear();
		}
	};
	const actionDialog = async (action, button) => {
		const chosen = [...selected.values()];
		if (!chosen.length || busy) return;
		if (action === 'trash') {
			if (await confirmAction('Move to trash?', chosen.length + ' selected records will be moved to trash. Unsupported records stay selected.')) await runAction(action, {}, button, chosen);
			return;
		}
		const Modal = await ensureBootstrapModal();
		if (action === 'move') {
			const response = await fetch('/ajax/batch-project-picker?action=move');
			if (!response.ok) throw new Error('Unable to load destination projects');
			const container = document.getElementById('batch-project-modal-root');
			container.innerHTML = await response.text();
			const modalEl = container.querySelector('.modal');
			const form = container.querySelector('form');
			const modal = new Modal(modalEl);
			container.querySelector('h6').textContent = 'Move ' + chosen.length + ' selected records';
			modalEl.addEventListener('hide.bs.modal', (event) => { if (busy) event.preventDefault(); });
			modalEl.addEventListener('hidden.bs.modal', () => { modal.dispose(); container.replaceChildren(); }, { once: true });
			form.addEventListener('submit', async (event) => {
				event.preventDefault();
				const project_id = form.querySelector('select').value;
				if (!project_id) return;
				await runAction(action, { project_id }, form.querySelector('[type="submit"]'), chosen);
				modal.hide();
			});
			modal.show();
		} else {
			const modalEl = root.querySelector('#search-tags-modal');
			const form = root.querySelector('#search-tags-form');
			const modal = Modal.getOrCreateInstance(modalEl);
			root.querySelector('#search-tags-title').textContent = action === 'add_tags' ? 'Add tags' : 'Remove tags';
			root.querySelector('#search-tags-count').textContent = chosen.length + ' selected records. Emails and files retain their existing fields.';
			form.onsubmit = async (event) => {
				event.preventDefault();
				const tags = root.querySelector('#search-action-tags').value.split('\n').map((tag) => tag.trim()).filter(Boolean);
				if (!tags.length) return;
				await runAction(action, { tags }, form.querySelector('[type="submit"]'), chosen);
				modal.hide();
			};
			modal.show();
		}
	};
	window.__sections = window.__sections || {};
	window.__sections.search = {
		async open(input) {
			if (busy) return;
			pending = input;
			await navigateTo('/search');
			persist();
		},
		mount() {
			root = document.getElementById('search-page');
			if (!root) return;
			let saved = {};
			try { saved = JSON.parse(new URLSearchParams(location.search).get('search') || '{}'); } catch (_) { /* Ignore invalid URL state. */ }
			filters = pending || saved;
			pending = null;
			if (!Object.hasOwn(filters, 'project_id')) filters.project_id = window.currentProjectId || '';
			page = Number(filters.page) || 1;
			root.querySelector('#search-query').value = filters.query || '';
			root.querySelector('#search-project').value = filters.project_id || '';
			on(root.querySelector('#search-form'), 'submit', (event) => {
				event.preventDefault();
				if (busy) return;
				filters = { query: root.querySelector('#search-query').value, project_id: root.querySelector('#search-project').value, tags: [...root.querySelector('#search-tags').selectedOptions].map((option) => option.value), types: [...root.querySelector('#search-types').selectedOptions].map((option) => option.value) };
				selected.clear(); tombstones.clear(); revisions.clear();
				page = 1;
				load(root.querySelector('#search-submit'));
			});
			on(root.querySelector('#search-project'), 'change', () => { loadTags().catch((error) => showError(error.message)); });
			on(root.querySelector('#search-list'), 'click', (event) => {
				if (busy || !event.target.matches('.search-select')) return;
				selectionRequest++;
				selectingAll = false;
				const key = event.target.closest('.search-result').dataset.searchKey;
				const keys = Array.from(root.querySelectorAll('.search-result'), (row) => row.dataset.searchKey);
				const start = keys.indexOf(selectionAnchor);
				const end = keys.indexOf(key);
				const range = event.shiftKey && start !== -1 ? keys.slice(Math.min(start, end), Math.max(start, end) + 1) : [key];
				for (const recordKey of range) {
					if (event.target.checked) selected.set(recordKey, rows.get(recordKey));
					else selected.delete(recordKey);
				}
				selectionAnchor = key;
				updateSelection();
			});
			on(root.querySelector('#search-list'), 'click', (event) => {
				if (!event.target.closest('.search-open')) return;
				const item = rows.get(event.target.closest('.search-result').dataset.searchKey);
				if (item.type === 'vault_files') window.open('/api/v1/obsidian/files/' + encodeURIComponent(item.id) + '/content', '_blank', 'noopener');
				else openResultModal(item);
			});
			on(root.querySelector('#search-clear'), 'click', () => {
				if (busy) return;
				selectionAnchor = null;
				selectionRequest++;
				selectingAll = false;
				selected.clear();
				updateSelection();
			});
			on(root.querySelector('#search-select-all'), 'change', async (event) => {
				if (busy) return;
				selectionAnchor = null;
				const request = ++selectionRequest;
				if (!event.currentTarget.checked) {
					selectingAll = false;
					selected.clear();
					updateSelection();
					return;
				}
				const epoch = generation;
				selectingAll = true;
				rows.forEach((item, key) => selected.set(key, item));
				updateSelection();
				try {
					const data = await api('POST', '/search/selection', filters);
					if (epoch !== generation || request !== selectionRequest) return;
					selected.clear();
					data.items.forEach((item) => selected.set(keyOf(item), item));
					updateSelection();
				} catch (error) {
					if (epoch === generation && request === selectionRequest) showError(error.message);
				}
				finally {
					if (request === selectionRequest) selectingAll = false;
					updateSelection();
				}
			});
			for (const [id, delta] of [['search-prev', -1], ['search-next', 1]]) on(root.querySelector('#' + id), 'click', (event) => { if (!busy) { page += delta; load(event.currentTarget); } });
			root.querySelectorAll('[data-search-action]').forEach((button) => on(button, 'click', () => actionDialog(button.dataset.searchAction, button).catch((error) => showError(error.message))));
			on(root.querySelector('#search-tags-modal'), 'hide.bs.modal', (event) => { if (busy) event.preventDefault(); });
			for (const [eventType, type] of [['note', 'notes'], ['memory', 'memory'], ['url', 'urls'], ['email', 'emails']]) for (const action of ['created', 'updated', 'deleted']) on(window, eventType + ':' + action, (event) => { refreshItem(type, String(event.detail._id || event.detail.id), action === 'created'); });
			for (const event of ['item-modal-saved', 'item-modal-deleted']) on(window, event, (event) => { refreshItem(event.detail.type === 'memories' ? 'memory' : event.detail.type, event.detail.id); });
			load(root.querySelector('#search-submit'));
		},
		unmount() {
			generation++;
			selectionAnchor = null;
			selectionRequest++;
			selectingAll = false;
			tagPicker?.destroy();
			tagPicker = null;
			typePicker?.destroy();
			typePicker = null;
			listeners.forEach(([target, event, handler]) => target?.removeEventListener(event, handler));
			listeners = [];
			root = null;
			rows.clear(); selected.clear(); revisions.clear(); refreshes.clear(); tombstones.clear(); queuedEvents.clear();
		},
	};
})();
