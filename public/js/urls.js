// URLs section — mount/unmount for SPA navigation
(function () {
	var listEl, newBtn;
	var windowListeners = [];

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	async function loadUrls() {
		if (!listEl) return;
		var params = currentProjectId ? '?project=' + currentProjectId : '';
		var data = await api('GET', '/urls' + params);
		if (!listEl) return;
		var urls = data.urls;

		listEl.innerHTML = urls.length
			? urls
				.map(function (u) {
					var date = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '';
					return '<div class="list-group-item url-item d-flex align-items-start gap-3" data-id="' + u._id + '" role="button" style="cursor:pointer">'
						+ '<div class="batch-cb-wrap"><input type="checkbox" class="form-check-input batch-cb" value="' + u._id + '"></div>'
						+ (u.screenshot_url || u.og_image ? '<img src="' + (u.screenshot_url || u.og_image) + '" class="og-image-thumb rounded flex-shrink-0" alt="">' : '')
						+ '<div class="flex-grow-1 overflow-hidden">'
						+ '<div class="d-flex justify-content-between align-items-center gap-2">'
						+ '<strong class="text-truncate">' + (u.title || u.url) + '</strong>'
						+ '<span class="text-muted small text-nowrap flex-shrink-0">' + date + '</span>'
						+ '</div>'
						+ '<div class="text-truncate"><a href="' + u.url + '" target="_blank" class="text-muted small url-link">' + u.url + '</a></div>'
						+ '<p class="mb-0 text-muted small text-truncate">' + (u.description?.slice(0, 200) || '') + '</p>'
						+ (u.crawl_enabled ? '<span class="badge bg-success mt-1">' + kkIcon('sync') + ' Crawling</span>' : '')
						+ '</div></div>';
				})
				.join('')
			: '<p class="text-muted p-3">No URLs saved yet. Hint: Add new URLs and notes with the <a href="https://docs.kumbukum.com/guide/browser-extension" target="_blank">Kumbkum browser extension</a></p>';

		listEl.querySelectorAll('.url-item').forEach(function (item) {
			item.addEventListener('click', function (e) {
				if (e.target.closest('.batch-cb-wrap') || e.target.closest('.url-link')) return;
				window.openItemModal('urls', item.dataset.id);
			});
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
		listEl = null;
		newBtn = null;
	}

	window.__sections = window.__sections || {};
	window.__sections.urls = { mount: mount, unmount: unmount };
})();
