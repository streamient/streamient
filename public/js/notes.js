// Notes section - mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl, newBtn, pond, infiniteScroll;
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

	function notesPath(page) {
		var params = ['page=' + page, 'limit=' + PAGE_SIZE];
		if (currentProjectId) params.push('project=' + encodeURIComponent(currentProjectId));
		return '/notes?' + params.join('&');
	}

	function renderNoteItemHtml(n) {
		var excerpt = n.text_content?.slice(0, 200) || '';
		var date = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : '';
		var tags = (n.tags || []).map(function (t) {
			return '<span class="badge text-bg-secondary tag-badge rounded-pill me-1">' + escapeHtml(t) + '</span>';
		}).join('');

		return '<div class="list-group-item list-group-item-action note-item" data-id="' + escapeHtml(n._id) + '">'
			+ '<div class="d-flex align-items-start gap-2">'
			+ '<div class="batch-cb-wrap"><input type="checkbox" class="form-check-input batch-cb" value="' + escapeHtml(n._id) + '"></div>'
			+ '<div class="flex-grow-1 overflow-hidden">'
			+ '<div class="d-flex justify-content-between align-items-center gap-2">'
			+ '<strong class="text-truncate">' + escapeHtml(n.title) + '</strong>'
			+ '<small class="text-muted text-nowrap flex-shrink-0">' + escapeHtml(date) + '</small>'
			+ '</div>'
			+ (excerpt ? '<p class="mb-0 text-muted small text-truncate">' + escapeHtml(excerpt) + '</p>' : '')
			+ '<div class="text-muted small">' + tags + '</div>'
			+ '</div></div></div>';
	}

	function bindNoteItem(el) {
		el.addEventListener('click', function (e) {
			if (e.target.closest('.batch-cb-wrap')) return;
			window.openItemModal('notes', el.dataset.id);
		});
	}

	function renderNotes(notes, append) {
		if (!listEl) return;
		if (!append && !notes.length) {
			listEl.innerHTML = '<p class="text-muted p-3 note-empty">No notes yet. Create one!</p>';
			return;
		}
		if (!notes.length) return;

		if (!append) {
			listEl.innerHTML = notes.map(renderNoteItemHtml).join('');
			listEl.querySelectorAll('.note-item').forEach(bindNoteItem);
			return;
		}

		listEl.querySelector('.note-empty')?.remove();
		var wrapper = document.createElement('div');
		wrapper.innerHTML = notes.map(renderNoteItemHtml).join('');
		Array.prototype.slice.call(wrapper.children).forEach(function (item) {
			bindNoteItem(item);
			listEl.appendChild(item);
		});
	}

	async function loadNotes() {
		if (!listEl) return;
		var seq = ++loadSeq;
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		var data = await api('GET', notesPath(pageNum));
		if (!listEl || seq !== loadSeq) return;
		var notes = data.notes || [];
		hasMore = notes.length === PAGE_SIZE;
		renderNotes(notes, false);
		infiniteScroll?.kick();
	}

	async function loadMoreNotes() {
		if (!listEl || loadingMore || !hasMore) return;
		loadingMore = true;
		var seq = loadSeq;
		var page = pageNum + 1;
		var appended = false;
		try {
			var data = await api('GET', notesPath(page));
			if (!listEl || seq !== loadSeq) return;
			var notes = data.notes || [];
			pageNum = page;
			hasMore = notes.length === PAGE_SIZE;
			renderNotes(notes, true);
			appended = notes.length > 0;
		} catch (err) {
			showError('Failed to load more notes: ' + (err.message || 'Unknown error'));
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
			sentinelClass: 'notes-scroll-sentinel',
			canLoad: function () { return Boolean(listEl) && !loadingMore && hasMore; },
			onLoadMore: loadMoreNotes,
		});
	}

	function setupFilePond() {
		var dropZone = document.getElementById('notes-drop-zone');
		var dropOverlay = document.getElementById('drop-overlay');
		var filepondInput = document.getElementById('import-filepond');

		if (!dropZone || !dropOverlay || !filepondInput || !window.FilePond) return;

		pond = FilePond.create(filepondInput, {
			name: 'file',
			allowMultiple: true,
			credits: false,
			server: {
				process: {
					url: '/api/v1/notes/import',
					method: 'POST',
					headers: {},
					ondata: function (formData) {
						if (currentProjectId) formData.append('project', currentProjectId);
						return formData;
					},
					onload: function (response) { return response; },
					onerror: function (response) { return response; },
				},
			},
		});

		var pondRoot = dropZone.querySelector('.filepond--root');
		if (pondRoot) pondRoot.classList.add('d-none');
		var successCount = 0;
		var errorCount = 0;

		function updatePondVisibility() {
			if (!pondRoot || !pond) return;
			if (pond.getFiles().length > 0) pondRoot.classList.add('filepond--active');
			else pondRoot.classList.remove('filepond--active');
		}

		function removePondItem(fileItem) {
			if (!pond || !fileItem) return;
			pond.removeFile(fileItem.id);
			updatePondVisibility();
		}

		pond.on('addfile', function (error, fileItem) {
			if (error) return;
			if (fileItem && fileItem.fileSize === 0) {
				removePondItem(fileItem);
				return;
			}
			updatePondVisibility();
		});

		pond.on('processfile', function (error, fileItem) {
			if (error) errorCount++;
			else successCount++;
			removePondItem(fileItem);
		});

		pond.on('processfiles', function () {
			if (successCount > 0) {
				showSuccess(successCount + ' file' + (successCount > 1 ? 's' : '') + ' imported as notes');
				loadNotes();
			}
			if (errorCount > 0) {
				showError(errorCount + ' file' + (errorCount > 1 ? 's' : '') + ' could not be imported');
			}
			successCount = 0;
			errorCount = 0;
			updatePondVisibility();
		});

		pond.on('warning', function (error) {
			if (error?.body) showError(error.body);
		});

		var dragCounter = 0;
		dropZone.addEventListener('dragenter', function (e) {
			e.preventDefault();
			dragCounter++;
			if (dragCounter === 1) dropOverlay.classList.remove('d-none');
		});
		dropZone.addEventListener('dragover', function (e) { e.preventDefault(); });
		dropZone.addEventListener('dragleave', function (e) {
			e.preventDefault();
			dragCounter--;
			if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.add('d-none'); }
		});
		dropZone.addEventListener('drop', function (e) {
			e.preventDefault();
			dragCounter = 0;
			dropOverlay.classList.add('d-none');
			if (e.dataTransfer?.files?.length) pond.addFiles(Array.from(e.dataTransfer.files));
		});
	}

	function onModalSaved(e) { if (e.detail?.type === 'notes') loadNotes(); }
	function onModalDeleted(e) { if (e.detail?.type === 'notes') loadNotes(); }

	function mount() {
		listEl = document.getElementById('notes-list');
		newBtn = document.getElementById('new-note-btn');
		newBtn?.addEventListener('click', function () { window.openItemModal('notes'); });

		addWindowListener('project-changed', loadNotes);
		addWindowListener('batch-done', loadNotes);
		addWindowListener('item-modal-saved', onModalSaved);
		addWindowListener('item-modal-deleted', onModalDeleted);

		setupInfiniteScroll();
		loadNotes();
		setupFilePond();

		var openId = new URLSearchParams(window.location.search).get('open');
		if (openId) window.openItemModal('notes', openId);
	}

	function unmount() {
		for (var i = 0; i < windowListeners.length; i++) {
			window.removeEventListener(windowListeners[i][0], windowListeners[i][1]);
		}
		windowListeners.length = 0;
		if (infiniteScroll) infiniteScroll.destroy();
		infiniteScroll = null;
		if (pond) { pond.destroy(); pond = null; }
		listEl = null;
		newBtn = null;
	}

	window.__sections = window.__sections || {};
	window.__sections.notes = { mount: mount, unmount: unmount };
})();
