// Batch selection & actions for notes, memories, urls — mount/unmount for SPA navigation
(function () {
	var toolbar, batchType, batchActions, selectAllCb, batchCount;
	var batchDeleteBtn, batchMoveBtn, batchCopyBtn, selectAllBanner, batchDismissBtn;
	var selectAllRecords = false;
	var totalRecordCount = 0;
	var lastChecked = null;
	var docListeners = [];

	function addDocListener(event, handler, capture) {
		document.addEventListener(event, handler, !!capture);
		docListeners.push([event, handler, !!capture]);
	}

	function getSelected() {
		return Array.from(document.querySelectorAll('.batch-cb:checked')).map(function (cb) { return cb.value; });
	}

	function getAllCheckboxes() {
		return document.querySelectorAll('.batch-cb');
	}

	function clearSelectAllRecords() {
		selectAllRecords = false;
		totalRecordCount = 0;
		if (selectAllBanner) selectAllBanner.classList.add('d-none');
	}

	function updateBatchBar() {
		if (!batchActions) return;
		var selected = getSelected();
		var count = selectAllRecords ? totalRecordCount : selected.length;

		if (selectAllRecords) {
			batchCount.textContent = 'All ' + totalRecordCount + ' selected';
		} else {
			batchCount.textContent = count + ' selected';
		}

		if (count > 0) {
			batchActions.classList.remove('d-none');
		} else {
			batchActions.classList.add('d-none');
		}

		var all = getAllCheckboxes();
		selectAllCb.checked = all.length > 0 && selected.length === all.length;
		selectAllCb.indeterminate = selected.length > 0 && selected.length < all.length;
	}

	function resetBatch() {
		if (!selectAllCb) return;
		selectAllCb.checked = false;
		selectAllCb.indeterminate = false;
		batchActions.classList.add('d-none');
		clearSelectAllRecords();
	}

	function buildBatchBody(extra) {
		var body = Object.assign({ type: batchType }, extra || {});
		if (selectAllRecords) {
			body.all = true;
			if (currentProjectId) body.filterProject = currentProjectId;
		} else {
			body.ids = getSelected();
		}
		return body;
	}

	function getActionCount() {
		return selectAllRecords ? totalRecordCount : getSelected().length;
	}

	async function onSelectAllChange() {
		var checked = selectAllCb.checked;
		getAllCheckboxes().forEach(function (cb) { cb.checked = checked; });

		if (!checked) clearSelectAllRecords();
		updateBatchBar();

		if (checked && selectAllBanner) {
			var params = new URLSearchParams({ type: batchType });
			if (currentProjectId) params.set('project', currentProjectId);
			try {
				var data = await api('GET', '/batch/count?' + params);
				totalRecordCount = data.count;
				var visibleCount = getAllCheckboxes().length;

				if (data.count > visibleCount) {
					selectAllBanner.innerHTML = 'All ' + visibleCount + ' items on this page are selected. <a href="#" id="select-all-records-link">Select all ' + data.count + ' items</a>';
					selectAllBanner.classList.remove('d-none');
				}
			} catch (e) {
				// Silently fail
			}
		}
	}

	function onBannerClick(e) {
		if (e.target.id === 'select-all-records-link') {
			e.preventDefault();
			selectAllRecords = true;
			batchCount.textContent = 'All ' + totalRecordCount + ' selected';
			selectAllBanner.innerHTML = 'All ' + totalRecordCount + ' items are selected. <a href="#" id="clear-all-records-link">Clear selection</a>';
		} else if (e.target.id === 'clear-all-records-link') {
			e.preventDefault();
			selectAllCb.checked = false;
			getAllCheckboxes().forEach(function (cb) { cb.checked = false; });
			clearSelectAllRecords();
			updateBatchBar();
		}
	}

	function onDocChange(e) {
		if (e.target.classList.contains('batch-cb')) {
			if (selectAllRecords && !e.target.checked) clearSelectAllRecords();
			updateBatchBar();
		}
	}

	function onDocClick(e) {
		var cb = e.target.classList.contains('batch-cb')
			? e.target
			: e.target.closest('.batch-cb-wrap')?.querySelector('.batch-cb');

		if (!cb) return;
		if (e.target.closest('.batch-cb-wrap')) e.stopPropagation();

		if (e.shiftKey && lastChecked && lastChecked !== cb) {
			var all = Array.from(getAllCheckboxes());
			var start = all.indexOf(lastChecked);
			var end = all.indexOf(cb);
			if (start !== -1 && end !== -1) {
				var low = Math.min(start, end);
				var high = Math.max(start, end);
				var checked = cb.checked;
				for (var i = low; i <= high; i++) all[i].checked = checked;
				updateBatchBar();
			}
		}

		lastChecked = cb;
	}

	async function onDelete() {
		var count = getActionCount();
		if (!count) return;
		await api('POST', '/batch/delete', buildBatchBody());
		showSuccess(count + ' moved to trash');
		resetBatch();
		window.dispatchEvent(new CustomEvent('batch-done'));
	}

	async function pickProject(action) {
		var count = getActionCount();
		if (!count) return;
		var data = await api('GET', '/projects');
		var others = data.projects.filter(function (p) { return p._id !== currentProjectId; });
		if (!others.length) { showError('No other projects available'); return; }

		var Swal = (await import('/static/js/vendor.js')).Swal;
		var options = others.map(function (p) { return '<option value="' + p._id + '">' + p.name + '</option>'; }).join('');
		var result = await Swal.fire({
			title: (action === 'move' ? 'Move' : 'Copy') + ' to project',
			html: '<select id="batch-project-select" class="form-select">' + options + '</select>',
			showCancelButton: true,
			confirmButtonText: action === 'move' ? 'Move' : 'Copy',
			preConfirm: function () { return document.getElementById('batch-project-select').value; },
		});
		if (!result.value) return;

		await api('POST', '/batch/' + action, buildBatchBody({ project: result.value }));
		showSuccess(count + ' ' + (action === 'move' ? 'moved' : 'copied'));
		resetBatch();
		window.dispatchEvent(new CustomEvent('batch-done'));
	}

	function mount() {
		toolbar = document.getElementById('batch-toolbar');
		if (!toolbar) return;

		batchType = toolbar.dataset.type;
		batchActions = document.getElementById('batch-actions');
		selectAllCb = document.getElementById('select-all-cb');
		batchCount = document.getElementById('batch-count');
		batchDeleteBtn = document.getElementById('batch-delete-btn');
		batchMoveBtn = document.getElementById('batch-move-btn');
		batchCopyBtn = document.getElementById('batch-copy-btn');
		selectAllBanner = document.getElementById('select-all-records-banner');
		batchDismissBtn = document.getElementById('batch-dismiss-btn');

		selectAllRecords = false;
		totalRecordCount = 0;
		lastChecked = null;

		selectAllCb?.addEventListener('change', onSelectAllChange);
		selectAllBanner?.addEventListener('click', onBannerClick);
		batchDeleteBtn?.addEventListener('click', onDelete);
		batchMoveBtn?.addEventListener('click', function () { pickProject('move'); });
		batchCopyBtn?.addEventListener('click', function () { pickProject('copy'); });
		batchDismissBtn?.addEventListener('click', function () { resetBatch(); getAllCheckboxes().forEach(function (cb) { cb.checked = false; }); });

		addDocListener('change', onDocChange);
		addDocListener('click', onDocClick, true);

		window.updateBatchBar = updateBatchBar;
	}

	function unmount() {
		for (var i = 0; i < docListeners.length; i++) {
			document.removeEventListener(docListeners[i][0], docListeners[i][1], docListeners[i][2]);
		}
		docListeners.length = 0;
		lastChecked = null;
		selectAllRecords = false;
		totalRecordCount = 0;
		toolbar = null;
		batchActions = null;
		selectAllCb = null;
		batchCount = null;
		batchDeleteBtn = null;
		batchMoveBtn = null;
		batchCopyBtn = null;
		selectAllBanner = null;
		batchDismissBtn = null;
		window.updateBatchBar = null;
	}

	window.__sections = window.__sections || {};
	window.__sections.batch = { mount: mount, unmount: unmount };
})();
