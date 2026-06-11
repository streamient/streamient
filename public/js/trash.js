// Trash section — mount/unmount for SPA navigation
(function () {
	var listEl, emptyBtn, selectAllCb, batchActions, batchCount, batchRestoreBtn, batchDeleteBtn, filterBtns;
	var currentFilter = '';

	var ICONS = { notes: 'description', memories: 'lightbulb', urls: 'link', emails: 'mail' };
	var LABELS = { notes: 'Note', memories: 'Memory', urls: 'URL', emails: 'Email' };

	function escapeHtml(value) {
		var div = document.createElement('div');
		div.textContent = value || '';
		return div.innerHTML;
	}

	function itemTitle(item) {
		return item.subject || item.title || item.url || '(No subject)';
	}

	function getSelected() {
		return Array.from(listEl.querySelectorAll('.batch-cb:checked')).map(function (cb) {
			return { type: cb.dataset.type, id: cb.value };
		});
	}

	function updateBatchBar() {
		var selected = getSelected();
		if (selected.length > 0) {
			batchActions.classList.remove('d-none');
			batchCount.textContent = selected.length + ' selected';
		} else {
			batchActions.classList.add('d-none');
		}
		var all = listEl.querySelectorAll('.batch-cb');
		if (all.length && selected.length === all.length) {
			selectAllCb.checked = true;
			selectAllCb.indeterminate = false;
		} else if (selected.length > 0) {
			selectAllCb.checked = false;
			selectAllCb.indeterminate = true;
		} else {
			selectAllCb.checked = false;
			selectAllCb.indeterminate = false;
		}
	}

	async function loadTrash() {
		if (!listEl) return;
		var params = currentFilter ? '?type=' + currentFilter : '';
		var data = await api('GET', '/trash' + params);
		var items = data.items;

		listEl.innerHTML = items.length
			? items
				.map(function (item) {
					return '<div class="list-group-item d-flex justify-content-between align-items-start trash-item" data-id="' + escapeHtml(item._id) + '" data-type="' + escapeHtml(item._type) + '">'
						+ '<div class="batch-cb-wrap me-2 pt-1"><input type="checkbox" class="form-check-input batch-cb" value="' + escapeHtml(item._id) + '" data-type="' + escapeHtml(item._type) + '"></div>'
						+ '<div class="flex-grow-1">'
						+ '<div class="d-flex align-items-center gap-2 mb-1">'
						+ '<span class="badge text-bg-secondary tag-badge rounded-pill">' + kkIcon(ICONS[item._type] || 'file') + ' ' + escapeHtml(LABELS[item._type] || item._type) + '</span>'
						+ '<strong>' + escapeHtml(itemTitle(item)) + '</strong>'
						+ '</div>'
						+ '<small class="text-muted">Trashed ' + new Date(item.trashed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</small>'
						+ '</div>'
						+ '<div class="btn-group btn-group-sm ms-2">'
						+ '<button class="btn btn-link restore-btn" title="Restore">' + kkIcon('restore') + '</button>'
						+ '<button class="btn btn-link permanent-delete-btn" title="Delete forever">' + kkIcon('delete') + '</button>'
						+ '</div></div>';
				})
				.join('')
			: '<p class="text-muted p-3">Trash is empty.</p>';

		listEl.querySelectorAll('.restore-btn').forEach(function (btn) {
			btn.addEventListener('click', async function () {
				var el = btn.closest('.trash-item');
				await api('POST', '/trash/restore', { type: el.dataset.type, id: el.dataset.id });
				showSuccess('Item restored');
				loadTrash();
				refreshTrashCount();
				refreshCounts();
			});
		});

		listEl.querySelectorAll('.permanent-delete-btn').forEach(function (btn) {
			btn.addEventListener('click', async function () {
				var el = btn.closest('.trash-item');
				var confirmed = await confirmAction('Delete Forever', 'This item will be permanently deleted. This cannot be undone.');
				if (!confirmed) return;
				await api('DELETE', '/trash/' + el.dataset.type + '/' + el.dataset.id);
				showSuccess('Item permanently deleted');
				loadTrash();
				refreshTrashCount();
				refreshCounts();
			});
		});

		listEl.querySelectorAll('.batch-cb').forEach(function (cb) {
			cb.addEventListener('change', updateBatchBar);
			cb.addEventListener('click', function (e) { e.stopPropagation(); });
		});

		if (selectAllCb) {
			selectAllCb.checked = false;
			selectAllCb.indeterminate = false;
		}
		if (batchActions) batchActions.classList.add('d-none');
	}

	function mount() {
		listEl = document.getElementById('trash-list');
		emptyBtn = document.getElementById('empty-trash-btn');
		selectAllCb = document.getElementById('trash-select-all-cb');
		batchActions = document.getElementById('trash-batch-actions');
		batchCount = document.getElementById('trash-batch-count');
		batchRestoreBtn = document.getElementById('trash-batch-restore-btn');
		batchDeleteBtn = document.getElementById('trash-batch-delete-btn');
		filterBtns = document.querySelectorAll('.trash-filter-btn');
		currentFilter = '';

		selectAllCb?.addEventListener('change', function () {
			var cbs = listEl.querySelectorAll('.batch-cb');
			cbs.forEach(function (cb) { cb.checked = selectAllCb.checked; });
			updateBatchBar();
		});

		batchRestoreBtn?.addEventListener('click', async function () {
			var items = getSelected();
			if (!items.length) return;
			await api('POST', '/trash/batch/restore', { items: items });
			showSuccess(items.length + ' items restored');
			loadTrash();
			refreshTrashCount();
			refreshCounts();
		});

		batchDeleteBtn?.addEventListener('click', async function () {
			var items = getSelected();
			if (!items.length) return;
			var confirmed = await confirmAction('Delete Forever', items.length + ' items will be permanently deleted. This cannot be undone.');
			if (!confirmed) return;
			await api('POST', '/trash/batch/delete', { items: items });
			showSuccess(items.length + ' items permanently deleted');
			loadTrash();
			refreshTrashCount();
			refreshCounts();
		});

		emptyBtn?.addEventListener('click', async function () {
			var confirmed = await confirmAction('Empty Trash', 'All items in trash will be permanently deleted. This cannot be undone.');
			if (!confirmed) return;
			await api('DELETE', '/trash?confirm=true');
			showSuccess('Trash emptied');
			loadTrash();
			refreshTrashCount();
			refreshCounts();
		});

		filterBtns.forEach(function (btn) {
			btn.addEventListener('click', function () {
				filterBtns.forEach(function (b) { b.classList.remove('active'); });
				btn.classList.add('active');
				currentFilter = btn.dataset.type;
				loadTrash();
			});
		});

		loadTrash();
	}

	function unmount() {
		listEl = null;
		emptyBtn = null;
		selectAllCb = null;
		batchActions = null;
		batchCount = null;
		batchRestoreBtn = null;
		batchDeleteBtn = null;
		filterBtns = null;
		currentFilter = '';
	}

	// Global for sidebar badge updates
	window.refreshTrashCount = function () {
		loadTrashCount();
	};

	window.__sections = window.__sections || {};
	window.__sections.trash = { mount: mount, unmount: unmount };
})();

async function refreshTrashCount() {
	try {
		const { count } = await api('GET', '/trash/count');
		const badge = document.getElementById('trash-count-badge');
		if (badge) {
			badge.textContent = count || '';
			badge.classList.toggle('d-none', !count);
		}
	} catch (e) {
		// ignore
	}
}
