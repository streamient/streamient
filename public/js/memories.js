// Memories section — mount/unmount for SPA navigation
(function () {
	var listEl, newBtn;
	var windowListeners = [];

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	async function loadMemories() {
		if (!listEl) return;
		var params = currentProjectId ? '?project=' + currentProjectId : '';
		var data = await api('GET', '/memories' + params);
		if (!listEl) return;
		var memories = data.memories;

		listEl.innerHTML = memories.length
			? memories
				.map(function (m) {
					var excerpt = m.content?.slice(0, 200) || '';
					var date = new Date(m.git_commit?.committed_at || m.updatedAt).toLocaleDateString();
					return '<div class="list-group-item list-group-item-action memory-item" data-id="' + m._id + '">'
						+ '<div class="d-flex align-items-start gap-2">'
						+ '<div class="batch-cb-wrap"><input type="checkbox" class="form-check-input batch-cb" value="' + m._id + '"></div>'
						+ '<div class="flex-grow-1 overflow-hidden">'
						+ '<div class="d-flex justify-content-between align-items-center gap-2">'
						+ '<strong class="text-truncate">' + m.title + '</strong>'
						+ '<small class="text-muted text-nowrap flex-shrink-0">' + date + '</small>'
						+ '</div>'
						+ (excerpt ? '<p class="mb-0 text-muted small text-truncate">' + excerpt + '</p>' : '')
						+ '<div class="text-muted small">' + (m.tags?.map(function (t) { return '<span class="badge text-bg-secondary tag-badge rounded-pill me-1">' + t + '</span>'; }).join('') || '') + '</div>'
						+ '</div></div></div>';
				})
				.join('')
			: '<p class="text-muted p-3">No memories yet. Create one!</p>';

		listEl.querySelectorAll('.memory-item').forEach(function (el) {
			el.addEventListener('click', function (e) {
				if (e.target.closest('.batch-cb-wrap')) return;
				window.openItemModal('memory', el.dataset.id);
			});
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

		loadMemories();

		var openId = new URLSearchParams(window.location.search).get('open');
		if (openId) window.openItemModal('memory', openId);
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
	window.__sections.memories = { mount: mount, unmount: unmount };
})();
