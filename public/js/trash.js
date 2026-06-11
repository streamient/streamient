// Trash section - mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl, emptyBtn, selectAllCb, batchActions, batchCount, batchRestoreBtn, batchDeleteBtn, filterBtns, infiniteScroll;
	var currentFilter = '';
	var pageNum = 1;
	var loadingMore = false;
	var hasMore = false;
	var loadSeq = 0;

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

	function trashPath(page) {
		var params = ['page=' + page, 'limit=' + PAGE_SIZE];
		if (currentFilter) params.push('type=' + encodeURIComponent(currentFilter));
		return '/trash?' + params.join('&');
	}

	function trashDate(value) {
		var date = new Date(value);
		if (!Number.isFinite(date.getTime())) return '';
		return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function getSelected() {
		if (!listEl) return [];
		return Array.from(listEl.querySelectorAll('.batch-cb:checked')).map(function (cb) {
			return { type: cb.dataset.type, id: cb.value };
		});
	}

	function updateBatchBar() {
		if (!listEl || !batchActions || !batchCount || !selectAllCb) return;
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

	function resetBatchBar() {
		if (selectAllCb) {
			selectAllCb.checked = false;
			selectAllCb.indeterminate = false;
		}
		if (batchActions) batchActions.classList.add('d-none');
	}

	function renderTrashItemHtml(item) {
		return '<div class="list-group-item d-flex justify-content-between align-items-start trash-item" data-id="' + escapeHtml(item._id) + '" data-type="' + escapeHtml(item._type) + '">'
			+ '<div class="batch-cb-wrap me-2 pt-1"><input type="checkbox" class="form-check-input batch-cb" value="' + escapeHtml(item._id) + '" data-type="' + escapeHtml(item._type) + '"></div>'
			+ '<div class="flex-grow-1">'
			+ '<div class="d-flex align-items-center gap-2 mb-1">'
			+ '<span class="badge text-bg-secondary tag-badge rounded-pill">' + kkIcon(ICONS[item._type] || 'file') + ' ' + escapeHtml(LABELS[item._type] || item._type) + '</span>'
			+ '<strong>' + escapeHtml(itemTitle(item)) + '</strong>'
			+ '</div>'
			+ '<small class="text-muted">Trashed ' + escapeHtml(trashDate(item.trashed_at)) + '</small>'
			+ '</div>'
			+ '<div class="btn-group btn-group-sm ms-2">'
			+ '<button class="btn btn-link restore-btn" title="Restore">' + kkIcon('restore') + '</button>'
			+ '<button class="btn btn-link permanent-delete-btn" title="Delete forever">' + kkIcon('delete') + '</button>'
			+ '</div></div>';
	}

	function bindTrashItem(el) {
		el.querySelector('.restore-btn')?.addEventListener('click', async function () {
			await api('POST', '/trash/restore', { type: el.dataset.type, id: el.dataset.id });
			showSuccess('Item restored');
			loadTrash();
			refreshTrashCount();
			refreshCounts();
		});

		el.querySelector('.permanent-delete-btn')?.addEventListener('click', async function () {
			var confirmed = await confirmAction('Delete Forever', 'This item will be permanently deleted. This cannot be undone.');
			if (!confirmed) return;
			await api('DELETE', '/trash/' + el.dataset.type + '/' + el.dataset.id);
			showSuccess('Item permanently deleted');
			loadTrash();
			refreshTrashCount();
			refreshCounts();
		});

		el.querySelector('.batch-cb')?.addEventListener('change', updateBatchBar);
		el.querySelector('.batch-cb')?.addEventListener('click', function (e) { e.stopPropagation(); });
	}

	function renderTrashItems(items, append) {
		if (!listEl) return;
		if (!append && !items.length) {
			listEl.innerHTML = '<p class="text-muted p-3 trash-empty">Trash is empty.</p>';
			return;
		}
		if (!items.length) return;

		if (!append) {
			listEl.innerHTML = items.map(renderTrashItemHtml).join('');
			listEl.querySelectorAll('.trash-item').forEach(bindTrashItem);
			return;
		}

		listEl.querySelector('.trash-empty')?.remove();
		var wrapper = document.createElement('div');
		wrapper.innerHTML = items.map(renderTrashItemHtml).join('');
		Array.prototype.slice.call(wrapper.children).forEach(function (item) {
			bindTrashItem(item);
			listEl.appendChild(item);
		});
		updateBatchBar();
	}

	async function loadTrash() {
		if (!listEl) return;
		var seq = ++loadSeq;
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		resetBatchBar();
		try {
			var data = await api('GET', trashPath(pageNum));
			if (!listEl || seq !== loadSeq) return;
			var items = data.items || [];
			var total = Number(data.total || 0);
			hasMore = pageNum * PAGE_SIZE < total;
			renderTrashItems(items, false);
			infiniteScroll?.kick();
		} catch (err) {
			showError('Failed to load trash: ' + (err.message || 'Unknown error'));
		}
	}

	async function loadMoreTrash() {
		if (!listEl || loadingMore || !hasMore) return;
		loadingMore = true;
		var seq = loadSeq;
		var page = pageNum + 1;
		var appended = false;
		try {
			var data = await api('GET', trashPath(page));
			if (!listEl || seq !== loadSeq) return;
			var items = data.items || [];
			var total = Number(data.total || 0);
			pageNum = page;
			hasMore = pageNum * PAGE_SIZE < total;
			renderTrashItems(items, true);
			appended = items.length > 0;
		} catch (err) {
			showError('Failed to load more trash: ' + (err.message || 'Unknown error'));
		} finally {
			if (seq === loadSeq) {
				loadingMore = false;
				if (appended) infiniteScroll?.kick();
			}
		}
	}

	function setupInfiniteScroll() {
		var root = document.getElementById('main-content');
		if (infiniteScroll) infiniteScroll.destroy();
		infiniteScroll = window.kkInfiniteScroll?.create({
			root: root,
			insertAfter: listEl,
			sentinelClass: 'trash-scroll-sentinel',
			canLoad: function () {
				return Boolean(listEl) && !loadingMore && hasMore;
			},
			onLoadMore: loadMoreTrash,
		});
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
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		loadSeq++;

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

		setupInfiniteScroll();
		loadTrash();
	}

	function unmount() {
		if (infiniteScroll) infiniteScroll.destroy();
		infiniteScroll = null;
		loadSeq++;
		listEl = null;
		emptyBtn = null;
		selectAllCb = null;
		batchActions = null;
		batchCount = null;
		batchRestoreBtn = null;
		batchDeleteBtn = null;
		filterBtns = null;
		currentFilter = '';
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
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
