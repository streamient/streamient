// Memories section - mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl, newBtn, infiniteScroll;
	var windowListeners = [];
	var pageNum = 1;
	var loadingMore = false;
	var hasMore = false;
	var loadSeq = 0;

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str || '';
		return div.innerHTML;
	}

	function memoriesPath(page) {
		var params = ['page=' + page, 'limit=' + PAGE_SIZE];
		if (currentProjectId) params.push('project=' + encodeURIComponent(currentProjectId));
		return '/memories?' + params.join('&');
	}

	function renderMemoryItemHtml(m) {
		var excerpt = m.content?.slice(0, 200) || '';
		var dateValue = m.git_commit?.committed_at || m.updatedAt;
		var date = dateValue ? new Date(dateValue).toLocaleDateString() : '';
		var tags = (m.tags || []).map(function (t) {
			return '<span class="badge text-bg-secondary tag-badge rounded-pill me-1">' + escapeHtml(t) + '</span>';
		}).join('');

		return '<div class="list-group-item list-group-item-action memory-item" data-id="' + escapeHtml(m._id) + '">'
			+ '<div class="d-flex align-items-start gap-2">'
			+ '<div class="batch-cb-wrap"><input type="checkbox" class="form-check-input batch-cb" value="' + escapeHtml(m._id) + '"></div>'
			+ '<div class="flex-grow-1 overflow-hidden">'
			+ '<div class="d-flex justify-content-between align-items-center gap-2">'
			+ '<strong class="text-truncate">' + escapeHtml(m.title) + '</strong>'
			+ '<small class="text-muted text-nowrap flex-shrink-0">' + escapeHtml(date) + '</small>'
			+ '</div>'
			+ (excerpt ? '<p class="mb-0 text-muted small text-truncate">' + escapeHtml(excerpt) + '</p>' : '')
			+ '<div class="text-muted small">' + tags + '</div>'
			+ '</div></div></div>';
	}

	function bindMemoryItem(el) {
		el.addEventListener('click', function (e) {
			if (e.target.closest('.batch-cb-wrap')) return;
			window.openItemModal('memory', el.dataset.id);
		});
	}

	function renderMemories(memories, append) {
		if (!listEl) return;
		if (!append && !memories.length) {
			listEl.innerHTML = '<p class="text-muted p-3 memory-empty">No memories yet. Create one!</p>';
			return;
		}
		if (!memories.length) return;

		if (!append) {
			listEl.innerHTML = memories.map(renderMemoryItemHtml).join('');
			listEl.querySelectorAll('.memory-item').forEach(bindMemoryItem);
			return;
		}

		listEl.querySelector('.memory-empty')?.remove();
		var wrapper = document.createElement('div');
		wrapper.innerHTML = memories.map(renderMemoryItemHtml).join('');
		Array.prototype.slice.call(wrapper.children).forEach(function (item) {
			bindMemoryItem(item);
			listEl.appendChild(item);
		});
	}

	async function loadMemories() {
		if (!listEl) return;
		var seq = ++loadSeq;
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		var data = await api('GET', memoriesPath(pageNum));
		if (!listEl || seq !== loadSeq) return;
		var memories = data.memories || [];
		hasMore = memories.length === PAGE_SIZE;
		renderMemories(memories, false);
		infiniteScroll?.kick();
	}

	async function loadMoreMemories() {
		if (!listEl || loadingMore || !hasMore) return;
		loadingMore = true;
		var seq = loadSeq;
		var page = pageNum + 1;
		var appended = false;
		try {
			var data = await api('GET', memoriesPath(page));
			if (!listEl || seq !== loadSeq) return;
			var memories = data.memories || [];
			pageNum = page;
			hasMore = memories.length === PAGE_SIZE;
			renderMemories(memories, true);
			appended = memories.length > 0;
		} catch (err) {
			showError('Failed to load more memories: ' + (err.message || 'Unknown error'));
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
			sentinelClass: 'memories-scroll-sentinel',
			canLoad: function () { return Boolean(listEl) && !loadingMore && hasMore; },
			onLoadMore: loadMoreMemories,
		});
	}

	function onModalSaved(e) { if (e.detail?.type === 'memory') loadMemories(); }
	function onModalDeleted(e) { if (e.detail?.type === 'memory') loadMemories(); }

	function mount() {
		listEl = document.getElementById('memories-list');
		newBtn = document.getElementById('new-memory-btn');
		newBtn?.addEventListener('click', function () { window.openItemModal('memory'); });

		addWindowListener('project-changed', loadMemories);
		addWindowListener('batch-done', loadMemories);
		addWindowListener('item-modal-saved', onModalSaved);
		addWindowListener('item-modal-deleted', onModalDeleted);

		setupInfiniteScroll();
		loadMemories();

		var openId = new URLSearchParams(window.location.search).get('open');
		if (openId) window.openItemModal('memory', openId);
	}

	function unmount() {
		for (var i = 0; i < windowListeners.length; i++) {
			window.removeEventListener(windowListeners[i][0], windowListeners[i][1]);
		}
		windowListeners.length = 0;
		if (infiniteScroll) infiniteScroll.destroy();
		infiniteScroll = null;
		listEl = null;
		newBtn = null;
	}

	window.__sections = window.__sections || {};
	window.__sections.memories = { mount: mount, unmount: unmount };
})();
