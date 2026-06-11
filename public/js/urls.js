// URLs section - mount/unmount for SPA navigation
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

	function urlsPath(page) {
		var params = ['page=' + page, 'limit=' + PAGE_SIZE];
		if (currentProjectId) params.push('project=' + encodeURIComponent(currentProjectId));
		return '/urls?' + params.join('&');
	}

	function renderUrlItemHtml(u) {
		var date = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '';
		var image = u.screenshot_url || u.og_image || '';
		return '<div class="list-group-item url-item d-flex align-items-start gap-3" data-id="' + escapeHtml(u._id) + '" role="button" style="cursor:pointer">'
			+ '<div class="batch-cb-wrap"><input type="checkbox" class="form-check-input batch-cb" value="' + escapeHtml(u._id) + '"></div>'
			+ (image ? '<img src="' + escapeHtml(image) + '" class="og-image-thumb rounded flex-shrink-0" alt="">' : '')
			+ '<div class="flex-grow-1 overflow-hidden">'
			+ '<div class="d-flex justify-content-between align-items-center gap-2">'
			+ '<strong class="text-truncate">' + escapeHtml(u.title || u.url) + '</strong>'
			+ '<span class="text-muted small text-nowrap flex-shrink-0">' + escapeHtml(date) + '</span>'
			+ '</div>'
			+ '<div class="text-truncate"><a href="' + escapeHtml(u.url) + '" target="_blank" class="text-muted small url-link">' + escapeHtml(u.url) + '</a></div>'
			+ '<p class="mb-0 text-muted small text-truncate">' + escapeHtml(u.description?.slice(0, 200) || '') + '</p>'
			+ (u.crawl_enabled ? '<span class="badge bg-success mt-1">' + kkIcon('sync') + ' Crawling</span>' : '')
			+ '</div></div>';
	}

	function bindUrlItem(item) {
		item.addEventListener('click', function (e) {
			if (e.target.closest('.batch-cb-wrap') || e.target.closest('.url-link')) return;
			window.openItemModal('urls', item.dataset.id);
		});
	}

	function renderUrls(urls, append) {
		if (!listEl) return;
		if (!append && !urls.length) {
			listEl.innerHTML = '<p class="text-muted p-3 url-empty">No URLs saved yet. Hint: Add new URLs and notes with the <a href="https://docs.kumbukum.com/guide/browser-extension" target="_blank">Kumbkum browser extension</a></p>';
			return;
		}
		if (!urls.length) return;

		if (!append) {
			listEl.innerHTML = urls.map(renderUrlItemHtml).join('');
			listEl.querySelectorAll('.url-item').forEach(bindUrlItem);
			return;
		}

		listEl.querySelector('.url-empty')?.remove();
		var wrapper = document.createElement('div');
		wrapper.innerHTML = urls.map(renderUrlItemHtml).join('');
		Array.prototype.slice.call(wrapper.children).forEach(function (item) {
			bindUrlItem(item);
			listEl.appendChild(item);
		});
	}

	async function loadUrls() {
		if (!listEl) return;
		var seq = ++loadSeq;
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		var data = await api('GET', urlsPath(pageNum));
		if (!listEl || seq !== loadSeq) return;
		var urls = data.urls || [];
		hasMore = urls.length === PAGE_SIZE;
		renderUrls(urls, false);
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
			renderUrls(urls, true);
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

	function onModalSaved(e) { if (e.detail?.type === 'urls') loadUrls(); }
	function onModalDeleted(e) { if (e.detail?.type === 'urls') loadUrls(); }

	function mount() {
		listEl = document.getElementById('urls-list');
		newBtn = document.getElementById('new-url-btn');
		newBtn?.addEventListener('click', function () { window.openItemModal('urls'); });

		addWindowListener('project-changed', loadUrls);
		addWindowListener('batch-done', loadUrls);
		addWindowListener('item-modal-saved', onModalSaved);
		addWindowListener('item-modal-deleted', onModalDeleted);

		setupInfiniteScroll();
		loadUrls().then(function () {
			var openId = new URLSearchParams(window.location.search).get('open');
			if (openId) window.openItemModal('urls', openId);
		});
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
	window.__sections.urls = { mount: mount, unmount: unmount };
})();
