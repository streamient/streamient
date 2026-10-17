// Memories section - mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl, newBtn, infiniteScroll;
	var windowListeners = [];
	var loadingMore = false;
	var hasMore = false;
	var itemUpdater;
	var loadSeq = 0;

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	function memoriesPath(offset) {
		var params = ['offset=' + offset, 'limit=' + PAGE_SIZE];
		if (currentProjectId) params.push('project=' + encodeURIComponent(currentProjectId));
		return '/memories?' + params.join('&');
	}

	function bindMemoryItem(el) {
		el.addEventListener('keydown', function (event) { if (event.target === el && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); el.click(); } });
		el.addEventListener('click', function (e) {
			if (e.target.closest('.batch-cb-wrap')) return;
			window.openItemModal('memory', el.dataset.id);
		});
	}

	function renderMemories(items, append) {
		if (!listEl) return;
		items.forEach(itemUpdater.apply);
		itemUpdater.empty();
	}

	async function loadMemories() {
		if (!listEl) return;
		var seq = ++loadSeq;
		itemUpdater.reset();
		loadingMore = false;
		hasMore = false;
		var data = await api('GET', memoriesPath(0));
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
		var appended = false;
		try {
			var data = await api('GET', memoriesPath(listEl.querySelectorAll('.memory-item').length));
			if (!listEl || seq !== loadSeq) return;
			var memories = data.memories || [];
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

	function onModalSaved(e) { if (e.detail?.type === 'memory') itemUpdater.update(e); }
	function onModalDeleted(e) { if (e.detail?.type === 'memory') itemUpdater.remove(e); }

	function mount() {
		listEl = document.getElementById('memories-list');
		itemUpdater = window.StreamientListItems.create({ list: listEl, type: 'memory', endpoint: 'memories', bind: bindMemoryItem });
		newBtn = document.getElementById('new-memory-btn');
		newBtn?.addEventListener('click', function () { window.openItemModal('memory'); });

		addWindowListener('project-changed', loadMemories);
		addWindowListener('memory:created', itemUpdater.update);
		addWindowListener('memory:updated', itemUpdater.update);
		addWindowListener('memory:deleted', itemUpdater.remove);
		addWindowListener('item-modal-saved', onModalSaved);
		addWindowListener('item-modal-deleted', onModalDeleted);

		setupInfiniteScroll();
		loadMemories();

		var openId = new URLSearchParams(window.location.search).get('open');
		if (openId) window.openItemModal('memory', openId);
	}

	function unmount() {
		loadSeq++;
		itemUpdater?.destroy();
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
