// URLs section - mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl, newBtn, infiniteScroll;
	var windowListeners = [];
	var pageNum = 1;
	var loadingMore = false;
	var hasMore = false;
	var loadSeq = 0;
	var records = new Map();
	var deletedIds = new Set();
	var itemRequests = new Map();

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

	function updateEmptyState() {
		if (!listEl) return;
		if (listEl.querySelector('.url-item')) listEl.querySelector('.url-empty')?.remove();
		else if (!listEl.querySelector('.url-empty')) listEl.appendChild(document.getElementById('urls-empty-template').content.cloneNode(true));
	}

	function applyUrlItem(url) {
		if (!listEl || !url?._id) return;
		var id = String(url._id);
		if (deletedIds.has(id)) return;
		var previous = records.get(id);
		if (previous && new Date(previous.updatedAt || 0) > new Date(url.updatedAt || 0)) return;
		var existing = listEl.querySelector('.url-item[data-id="' + CSS.escape(id) + '"]');
		var projectId = String(url.project?._id || url.project || '');
		if (url.in_trash || (currentProjectId && projectId !== String(currentProjectId))) {
			records.set(id, url);
			existing?.remove();
			updateEmptyState();
			window.updateBatchBar?.();
			return;
		}
		if (!url.html) return;
		if (existing && previous?.html === url.html) {
			records.set(id, url);
			return;
		}
		var template = document.createElement('template');
		template.innerHTML = url.html;
		var item = template.content.firstElementChild;
		if (!item || item.dataset.id !== id) return;
		var root = document.getElementById('main-content');
		var scrollTop = root?.scrollTop;
		var focused = existing?.contains(document.activeElement) ? document.activeElement : null;
		var checked = existing?.querySelector('.batch-cb')?.checked;
		item.querySelector('.batch-cb').checked = !!checked;
		bindUrlItem(item);
		records.set(id, url);
		if (existing) existing.replaceWith(item);
		else {
			var next = Array.from(listEl.querySelectorAll('.url-item')).find(function (row) {
				var other = records.get(row.dataset.id);
				var date = new Date(other?.createdAt || 0).getTime();
				var created = new Date(url.createdAt || 0).getTime();
				return date < created || (date === created && row.dataset.id < id);
			});
			listEl.insertBefore(item, next || null);
		}
		window.StreamientDateFormat?.refresh(item);
		if (focused) item.querySelector(focused.matches('.batch-cb') ? '.batch-cb' : '.url-link')?.focus({ preventScroll: true });
		if (root) root.scrollTop = scrollTop;
		updateEmptyState();
		window.updateBatchBar?.();
	}

	async function onUrlUpdated(e) {
		var url = typeof e.detail?.url === 'object' ? e.detail.url : e.detail;
		var id = String(url?._id || url?.id || '');
		if (!id || !listEl || deletedIds.has(id)) return;
		if (url.html) return applyUrlItem(url);
		var seq = loadSeq;
		var request = (itemRequests.get(id) || 0) + 1;
		itemRequests.set(id, request);
		try {
			var data = await api('GET', '/urls/' + encodeURIComponent(id));
			if (seq === loadSeq && request === itemRequests.get(id)) applyUrlItem(data.url);
		} catch (err) {
			if (listEl && seq === loadSeq && !deletedIds.has(id)) showError('Failed to update URL: ' + (err.message || 'Unknown error'));
		}
	}

	function onUrlDeleted(e) {
		var id = String(e.detail?._id || e.detail?.id || '');
		if (!id || !listEl) return;
		deletedIds.add(id);
		records.delete(id);
		listEl.querySelector('.url-item[data-id="' + CSS.escape(id) + '"]')?.remove();
		updateEmptyState();
		window.updateBatchBar?.();
	}

	async function loadUrls() {
		if (!listEl) return;
		var seq = ++loadSeq;
		records.clear();
		deletedIds.clear();
		itemRequests.clear();
		listEl.replaceChildren();
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
