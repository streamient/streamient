(function () {
	const CHECK_INTERVAL = 45 * 60 * 1000;
	const MIN_CHECK_GAP = 60 * 1000;
	let checkTimer = null;
	let checkInFlight = false;
	let lastCheckAt = 0;
	let modalLoadInFlight = false;
	let modalQueued = false;
	let dismissInFlight = false;
	let statusVersion = 0;
	let archiveLoadInFlight = false;
	let archiveStale = false;
	let newsActive = window.location.pathname === '/news';
	let workspaceFocus = null;
	let workspaceTitle = newsActive ? 'Dashboard — Streamient' : '';

	function enabled() {
		return window.__product_updates_enabled === true && Boolean(document.getElementById('product-updates-modal-root')) && Boolean(document.getElementById('product-updates-drawer'));
	}

	function productFetch(path, options) {
		return typeof window.accountFetch === 'function' ? window.accountFetch(path, options) : fetch(path, options);
	}

	function setBadge(count) {
		const badge = document.getElementById('product-updates-badge');
		if (!badge) return;
		const value = Math.max(Number(count) || 0, 0);
		archiveStale = value > 0;
		badge.textContent = value > 99 ? '99+' : String(value);
		badge.classList.toggle('d-none', value === 0);
		badge.setAttribute('aria-label', value === 1 ? '1 unseen product update' : `${value} unseen product updates`);
	}

	async function showFailure(message) {
		if (typeof window.showError === 'function') return window.showError(message);
		const vendor = await import('/static/js/vendor.js');
		return vendor.Swal.fire({ title: 'Error', text: message, icon: 'error' });
	}

	async function modalClass() {
		if (window.BsModal) return window.BsModal;
		const vendor = await import('/static/js/vendor.js');
		window.BsModal = vendor.Modal;
		return window.BsModal;
	}

	async function offcanvasClass() {
		if (window.BsOffcanvas) return window.BsOffcanvas;
		const vendor = await import('/static/js/vendor.js');
		window.BsOffcanvas = vendor.Offcanvas;
		return window.BsOffcanvas;
	}

	function anotherModalIsOpen() {
		return Boolean(document.querySelector('.modal.show:not(#productUpdatesModal)'));
	}

	async function showQueuedModal() {
		if (!modalQueued || newsActive || anotherModalIsOpen()) return;
		const modal = document.getElementById('productUpdatesModal');
		if (!modal) {
			modalQueued = false;
			return;
		}
		modalQueued = false;
		const Modal = await modalClass();
		Modal.getOrCreateInstance(modal, { backdrop: 'static', keyboard: false }).show();
	}

	async function markSeen(updateId) {
		const version = ++statusVersion;
		const response = await productFetch('/ajax/product-updates/seen', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ update_id: updateId }),
		});
		if (!response.ok) {
			const payload = await response.json().catch(function () { return {}; });
			throw new Error(payload.error || 'Could not save the product update status');
		}
		if (version === statusVersion) setBadge(0);
		const result = await response.json();
		if (version === statusVersion) statusVersion++;
		return result;
	}

	function setActionBusy(button, busy) {
		if (!button) return;
		button.disabled = busy;
		button.setAttribute('aria-busy', busy ? 'true' : 'false');
		button.querySelector('[data-product-updates-spinner]')?.classList.toggle('d-none', !busy);
	}

	async function dismissModal(button, openLink) {
		if (dismissInFlight) return;
		const modal = document.getElementById('productUpdatesModal');
		const updateId = modal?.dataset.throughUpdateId || '';
		if (!modal || !updateId) return;
		dismissInFlight = true;
		setActionBusy(button, true);
		modal.querySelectorAll('[data-product-updates-dismiss], [data-product-updates-read-more]').forEach(function (action) {
			if (action !== button) action.disabled = true;
		});
		let popup = null;
		if (openLink) {
			popup = window.open('about:blank', '_blank');
			if (popup) popup.opener = null;
		}
		try {
			await markSeen(updateId);
			const Modal = await modalClass();
			Modal.getOrCreateInstance(modal).hide();
			if (popup) popup.location.href = modal.dataset.readMoreLink;
		} catch (error) {
			if (popup) popup.close();
			await showFailure(error.message);
		} finally {
			dismissInFlight = false;
			setActionBusy(button, false);
			modal.querySelectorAll('[data-product-updates-dismiss], [data-product-updates-read-more]').forEach(function (action) { action.disabled = false; });
		}
	}

	function bindModal(modal) {
		modal.querySelectorAll('[data-product-updates-dismiss]').forEach(function (button) {
			button.addEventListener('click', function () { void dismissModal(button, false); });
		});
		modal.querySelector('[data-product-updates-read-more]')?.addEventListener('click', function (event) {
			void dismissModal(event.currentTarget, true);
		});
		modal.addEventListener('hidden.bs.modal', function () {
			document.getElementById('product-updates-modal-root')?.replaceChildren();
		}, { once: true });
	}

	async function loadModal() {
		if (modalLoadInFlight || document.getElementById('productUpdatesModal')) return;
		modalLoadInFlight = true;
		try {
			const response = await productFetch('/ajax/product-updates/modal');
			if (response.status === 204) return;
			if (!response.ok) throw new Error('Could not load product update details');
			const root = document.getElementById('product-updates-modal-root');
			if (!root) return;
			root.innerHTML = await response.text();
			const modal = document.getElementById('productUpdatesModal');
			if (!modal) return;
			bindModal(modal);
			modalQueued = true;
			await showQueuedModal();
		} catch (error) {
			console.error('Product update modal failed:', error);
		} finally {
			modalLoadInFlight = false;
		}
	}

	function scheduleCheck() {
		window.clearTimeout(checkTimer);
		checkTimer = window.setTimeout(checkStatus, CHECK_INTERVAL);
	}

	async function checkStatus() {
		if (!enabled()) return;
		if (document.hidden || checkInFlight || Date.now() - lastCheckAt < MIN_CHECK_GAP) {
			scheduleCheck();
			return;
		}
		checkInFlight = true;
		lastCheckAt = Date.now();
		const version = statusVersion;
		try {
			const response = await productFetch('/ajax/product-updates/status');
			if (!response.ok) throw new Error(`Status ${response.status}`);
			const status = await response.json();
			if (version !== statusVersion) return;
			setBadge(status.new_count);
			if (status.has_modal) await loadModal();
		} catch (error) {
			console.error('Product update status failed:', error);
		} finally {
			checkInFlight = false;
			scheduleCheck();
		}
	}

	async function appendNextPage(root, button) {
		const cursor = root.dataset.nextCursor || '';
		if (!cursor || button.disabled) return;
		setActionBusy(button, true);
		try {
			const response = await productFetch(`/ajax/product-updates/items?cursor=${encodeURIComponent(cursor)}`);
			if (!response.ok) throw new Error('Could not load more product updates');
			const template = document.createElement('template');
			template.innerHTML = await response.text();
			const fragmentRoot = template.content.querySelector('[data-product-update-items-fragment]');
			const list = root.querySelector('#product-updates-list');
			if (!fragmentRoot || !list) throw new Error('Product update response was invalid');
			const ids = new Set(Array.from(list.querySelectorAll('[data-product-update-id]'), function (item) { return item.dataset.productUpdateId; }));
			Array.from(fragmentRoot.children).forEach(function (item) {
				if (ids.has(item.dataset.productUpdateId)) return;
				list.appendChild(item);
				ids.add(item.dataset.productUpdateId);
			});
			root.dataset.nextCursor = fragmentRoot.dataset.nextCursor || '';
			button.classList.toggle('d-none', !root.dataset.nextCursor);
		} catch (error) {
			await showFailure(error.message);
		} finally {
			setActionBusy(button, false);
		}
	}

	function mountNews() {
		const root = document.getElementById('product-updates-news');
		if (!root || root.dataset.mounted === 'true') return;
		root.dataset.mounted = 'true';
		const button = root.querySelector('[data-product-updates-load-more]');
		button?.addEventListener('click', function () { void appendNextPage(root, button); });
		const updateId = root.dataset.latestUpdateId || '';
		if (updateId) markSeen(updateId).catch(function (error) { void showFailure(error.message); });
		modalQueued = false;
		document.getElementById('productUpdatesModal')?.remove();
	}

	function projectSearch() {
		if (!window.currentProjectId || typeof window.JSURL === 'undefined') return '';
		return `?g=${window.JSURL.stringify({ project_id: window.currentProjectId })}`;
	}

	function setNewsActive(active) {
		const wasActive = newsActive;
		if (active && !wasActive) workspaceTitle = document.title;
		newsActive = active;
		document.querySelector('[data-product-updates-nav]')?.classList.toggle('active', active);
		document.querySelector('[data-streamient-projects-nav]')?.classList.toggle('active', !active && window.location.pathname !== '/graph');
		if (active) document.title = "What's new — Streamient";
		else if (workspaceTitle) {
			document.title = workspaceTitle;
		}
	}

	async function loadArchive() {
		if ((document.getElementById('product-updates-news') && !archiveStale) || archiveLoadInFlight) return;
		archiveLoadInFlight = true;
		try {
			const response = await productFetch('/ajax/section/news');
			if (!response.ok) throw new Error('Could not load product updates');
			const template = document.createElement('template');
			template.innerHTML = await response.text();
			const archive = template.content.querySelector('#product-updates-news');
			const view = document.getElementById('product-updates-news-view');
			if (!archive || !view) throw new Error('Product update response was invalid');
			view.replaceChildren(archive);
			archiveStale = false;
			mountNews();
		} finally {
			archiveLoadInFlight = false;
		}
	}

	function workspaceUrl() {
		return `/dashboard${projectSearch()}`;
	}

	function restoreWorkspaceUrl() {
		if (window.history.state?.productNews) {
			window.history.back();
			return;
		}
		window.history.replaceState({ spaPath: '/dashboard' }, '', workspaceUrl());
	}

	async function navigateNews(active, push) {
		const drawer = document.getElementById('product-updates-drawer');
		if (!drawer) return;
		const Offcanvas = await offcanvasClass();
		if (active) {
			workspaceFocus = document.activeElement;
			await loadArchive();
			if (push && window.location.pathname !== '/news') {
				window.history.replaceState({ ...(window.history.state || {}), productNewsReturn: true }, '');
				window.history.pushState({ productNews: true }, '', `/news${projectSearch()}`);
			}
			setNewsActive(true);
			Offcanvas.getOrCreateInstance(drawer).show();
			mountNews();
			return;
		}
		setNewsActive(false);
		Offcanvas.getOrCreateInstance(drawer).hide();
		workspaceFocus?.focus?.({ preventScroll: true });
	}

	function closeNews() {
		if (newsActive) {
			setNewsActive(false);
			workspaceFocus?.focus?.({ preventScroll: true });
			if (window.location.pathname === '/news') restoreWorkspaceUrl();
		}
		void showQueuedModal();
	}

	function bindNewsDrawer() {
		const drawer = document.getElementById('product-updates-drawer');
		if (!drawer || drawer.dataset.mounted === 'true') return;
		drawer.dataset.mounted = 'true';
		drawer.addEventListener('hidden.bs.offcanvas', closeNews);
		if (window.location.pathname === '/news') void navigateNews(true, false).catch(function (error) { void showFailure(error.message); });
	}

	document.addEventListener('click', function (event) {
		if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
		const newsLink = event.target.closest('[data-product-updates-nav]');
		const brandLink = newsActive ? event.target.closest('.navbar-brand a[href="/dashboard"]') : null;
		if (!newsLink && !brandLink) return;
		event.preventDefault();
		if (newsLink) void navigateNews(true, true).catch(function (error) { void showFailure(error.message); });
		else void navigateNews(false, false).then(restoreWorkspaceUrl).catch(function (error) { void showFailure(error.message); });
	}, true);
	window.addEventListener('popstate', function () {
		void navigateNews(window.location.pathname === '/news', false).catch(function (error) { void showFailure(error.message); });
	});

	document.addEventListener('hidden.bs.modal', function () { void showQueuedModal(); });
	document.addEventListener('visibilitychange', function () {
		if (!document.hidden && enabled()) {
			lastCheckAt = 0;
			void checkStatus();
		}
	});
	document.addEventListener('DOMContentLoaded', function () {
		bindNewsDrawer();
		mountNews();
		if (enabled()) void checkStatus();
	});
})();
