// Shared record-list infinite scroll helper.
(function () {
	function create(options) {
		var root = options?.root || document.getElementById('main-content');
		var insertAfter = options?.insertAfter || null;
		var sentinelClass = options?.sentinelClass || '';
		var rootMarginPx = Number.isFinite(options?.rootMarginPx) ? options.rootMarginPx : 400;
		var destroyed = false;
		var scheduled = false;
		var loading = false;
		var observer = null;
		var sentinel = null;

		function noop() {}

		if (!root || !insertAfter?.parentNode || typeof options?.onLoadMore !== 'function') {
			return { kick: noop, destroy: noop };
		}

		sentinel = document.createElement('div');
		sentinel.className = ('st-scroll-sentinel ' + sentinelClass).trim();
		sentinel.setAttribute('aria-hidden', 'true');
		insertAfter.parentNode.insertBefore(sentinel, insertAfter.nextSibling);

		function canLoad() {
			return !destroyed && (!options.canLoad || options.canLoad());
		}

		function rootRect() {
			if (root === window || root === document || root === document.documentElement || root === document.body) {
				return { top: 0, bottom: window.innerHeight };
			}
			return root.getBoundingClientRect();
		}

		function sentinelNearRoot() {
			if (!sentinel?.isConnected) return false;
			var bounds = rootRect();
			var target = sentinel.getBoundingClientRect();
			return target.top <= bounds.bottom + rootMarginPx && target.bottom >= bounds.top - rootMarginPx;
		}

		function requestLoad() {
			if (destroyed || scheduled || loading) return;
			scheduled = true;
			window.requestAnimationFrame(function () {
				scheduled = false;
				if (!canLoad() || !sentinelNearRoot()) return;
				loading = true;
				var loadResult;
				try {
					loadResult = options.onLoadMore();
				} catch (err) {
					loading = false;
					console.error(err);
					return;
				}
				Promise.resolve(loadResult).catch(function (err) {
					console.error(err);
				}).then(function () {
					loading = false;
					if (!destroyed && canLoad() && sentinelNearRoot()) requestLoad();
				});
			});
		}

		function onScroll() {
			requestLoad();
		}

		if (typeof IntersectionObserver !== 'undefined') {
			observer = new IntersectionObserver(function (entries) {
				if (entries.some(function (entry) { return entry.isIntersecting; })) requestLoad();
			}, { root: root === window ? null : root, rootMargin: rootMarginPx + 'px' });
			observer.observe(sentinel);
		}

		root.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });

		function destroy() {
			destroyed = true;
			if (observer) observer.disconnect();
			observer = null;
			root.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
			if (sentinel) sentinel.remove();
			sentinel = null;
		}

		return { kick: requestLoad, destroy: destroy };
	}

	window.kkInfiniteScroll = { create: create };
})();
