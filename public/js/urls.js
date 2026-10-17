// URLs section - mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl, newBtn, infiniteScroll;
	var windowListeners = [];
	var pageNum = 1;
	var loadingMore = false;
	var hasMore = false;
	var loadSeq = 0;
	var itemUpdater;

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	function urlsPath(page) {
		var params = ['page=' + page, 'limit=' + PAGE_SIZE];
		if (currentProjectId) params.push('project=' + encodeURIComponent(currentProjectId));
		return '/urls?' + params.join('&');
	}

	function bindUrlItem(item) {
		item.addEventListener('click', function (e) {
			if (e.target.closest('.batch-cb-wrap') || e.target.closest('.url-link')) return;
			window.openItemModal('urls', item.dataset.id);
		});
	}

	function updateEmptyState() { itemUpdater.empty(); }
	function applyUrlItem(url) { itemUpdater.apply(url); }
	function onUrlUpdated(event) { return itemUpdater.update(event); }
	function onUrlDeleted(event) { itemUpdater.remove(event); }

	async function loadUrls() {
		if (!listEl) return;
		var seq = ++loadSeq;
		itemUpdater.reset();
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		var data = await api('GET', urlsPath(pageNum));
		if (!listEl || seq !== loadSeq) return;
		var urls = data.urls || [];
		hasMore = urls.length === PAGE_SIZE;
		urls.forEach(applyUrlItem);
		updateEmptyState();
		infiniteScroll?.kick();
	}

	async function loadMoreUrls() {
		if (!listEl || loadingMore || !hasMore) return;
		loadingMore = true;
		var seq = loadSeq;
		var page = pageNum + 1;
		var appended = false;
		try {
			var data = await api('GET', urlsPath(page));
			if (!listEl || seq !== loadSeq) return;
			var urls = data.urls || [];
			pageNum = page;
			hasMore = urls.length === PAGE_SIZE;
			urls.forEach(applyUrlItem);
			appended = urls.length > 0;
		} catch (err) {
			showError('Failed to load more URLs: ' + (err.message || 'Unknown error'));
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
			sentinelClass: 'urls-scroll-sentinel',
			canLoad: function () { return Boolean(listEl) && !loadingMore && hasMore; },
			onLoadMore: loadMoreUrls,
		});
	}

	function onModalSaved(e) { if (e.detail?.type === 'urls') onUrlUpdated(e); }
	function onModalDeleted(e) { if (e.detail?.type === 'urls') onUrlDeleted(e); }

	function mount() {
		listEl = document.getElementById('urls-list');
		itemUpdater = window.StreamientListItems.create({ list: listEl, type: 'url', endpoint: 'urls', bind: bindUrlItem, sortField: 'createdAt' });
		newBtn = document.getElementById('new-url-btn');
		newBtn?.addEventListener('click', function () { window.openItemModal('urls'); });

		addWindowListener('project-changed', loadUrls);
		addWindowListener('item-modal-saved', onModalSaved);
		addWindowListener('item-modal-deleted', onModalDeleted);
		addWindowListener('url:created', onUrlUpdated);
		addWindowListener('url:updated', onUrlUpdated);
		addWindowListener('url:deleted', onUrlDeleted);

		setupInfiniteScroll();
		loadUrls().then(function () {
			if (!listEl) return;
			var openId = new URLSearchParams(window.location.search).get('open');
			if (openId) window.openItemModal('urls', openId);
		}).catch(function (err) { if (listEl) showError('Failed to load URLs: ' + (err.message || 'Unknown error')); });
	}

	function unmount() {
		itemUpdater?.destroy();
		loadSeq++;
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
	window.__sections.urls = { mount: mount, unmount: unmount };
})();
