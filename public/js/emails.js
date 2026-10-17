// Emails section — mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl;
	var windowListeners = [];
	var pageNum = 1;
	var loadingMore = false;
	var hasMore = false;
	var itemUpdater;
	var loadSeq = 0;
	var infiniteScroll = null;

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	function bindEmailItem(el) {
		el.addEventListener('keydown', function (event) { if (event.target === el && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); el.click(); } });
		el.addEventListener('click', function (ev) {
			if (ev.target.closest('.batch-cb-wrap')) return;
			api('GET', '/emails/' + el.dataset.id)
				.then(function (res) {
					var email = res.email || res;
					window.openResultModal({
						_type: 'emails',
						id: email._id,
						title: email.subject || '(No subject)',
						from: email.from || [],
						html_content: email.html_content || '',
						html_content_has_remote_images: Boolean(email.html_content_has_remote_images),
						text_content: [email.text_content, email.attachment_text_content].filter(Boolean).join('\n\n'),
					});
				})
				.catch(function (err) {
					showError('Failed to load email: ' + (err.message || 'Unknown error'));
				});
		});
	}

	function renderEmails(emails) {
		emails.forEach(itemUpdater.apply);
		itemUpdater.empty();
	}

	function emailsPath(page) {
		var params = ['page=' + page, 'limit=' + PAGE_SIZE];
		if (currentProjectId) params.push('project=' + currentProjectId);
		return '/emails?' + params.join('&');
	}

	async function loadEmails() {
		if (!listEl) return;
		var seq = ++loadSeq;
		itemUpdater.reset();
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		var data = await api('GET', emailsPath(pageNum));
		if (!listEl || seq !== loadSeq) return;
		var emails = data.emails || [];
		hasMore = emails.length === PAGE_SIZE;

		renderEmails(emails);
		infiniteScroll?.kick();
	}

	async function loadMore() {
		if (!listEl || loadingMore || !hasMore) return;
		loadingMore = true;
		var seq = loadSeq;
		var page = pageNum + 1;
		var appended = false;
		try {
			var data = await api('GET', emailsPath(page));
			if (!listEl || seq !== loadSeq) return;
			var emails = data.emails || [];
			pageNum = page;
			hasMore = emails.length === PAGE_SIZE;
			renderEmails(emails);
			appended = emails.length > 0;
		} catch (err) {
			showError('Failed to load more emails: ' + (err.message || 'Unknown error'));
		} finally {
			if (seq === loadSeq) {
				loadingMore = false;
				if (appended) infiniteScroll?.kick();
			}
		}
	}

	function onModalDeleted(e) { if (e.detail?.type === 'emails') itemUpdater.remove(e); }

	function setupInfiniteScroll() {
		var root = document.getElementById('main-content');
		if (infiniteScroll) infiniteScroll.destroy();
		infiniteScroll = window.kkInfiniteScroll?.create({
			root: root,
			insertAfter: listEl,
			sentinelClass: 'emails-scroll-sentinel',
			canLoad: function () { return Boolean(listEl) && !loadingMore && hasMore; },
			onLoadMore: loadMore,
		});
	}

	function mount() {
		listEl = document.getElementById('emails-list');
		if (!listEl) return;
		itemUpdater = window.StreamientListItems.create({ list: listEl, type: 'email', endpoint: 'emails', bind: bindEmailItem, sortField: 'createdAt' });

		addWindowListener('project-changed', loadEmails);
		addWindowListener('item-modal-deleted', onModalDeleted);
		addWindowListener('email:created', itemUpdater.update);
		addWindowListener('email:updated', itemUpdater.update);
		addWindowListener('email:deleted', itemUpdater.remove);

		setupInfiniteScroll();
		loadEmails();
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
	}

	window.__sections = window.__sections || {};
	window.__sections.emails = { mount: mount, unmount: unmount };
})();
