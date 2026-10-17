// Batch selection & actions for notes, memories, urls — mount/unmount for SPA navigation
(function () {
	var toolbar, batchType, batchActions, selectAllCb, batchCount;
	var batchDeleteBtn, batchMoveBtn, batchCopyBtn, selectAllBanner, batchDismissBtn;
	var selectAllRecords = false;
	var failedSelection = new Set();
	var totalRecordCount = 0;
	var lastChecked = null;
	var docListeners = [];
	var projectPickerOpening = false;

	function addDocListener(event, handler, capture) {
		document.addEventListener(event, handler, !!capture);
		docListeners.push([event, handler, !!capture]);
	}

	function getSelected() {
		return Array.from(new Set([...failedSelection, ...Array.from(document.querySelectorAll('.batch-cb:checked')).map(function (cb) { return cb.value; })]));
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
		failedSelection.clear();
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

	async function getProjectPickerHtml(action) {
		var params = new URLSearchParams({ action: action });
		if (currentProjectId) params.set('current', currentProjectId);
		var res = await fetch('/ajax/batch-project-picker?' + params);
		if (isLoginRedirect(res)) {
			redirectToLogin();
			return '';
		}
		if (!res.ok) throw new Error('Failed to load projects');
		return res.text();
	}

	function setProjectPickerBusy(form, busy) {
		form.dataset.busy = busy ? 'true' : 'false';
		form.querySelector('[data-batch-project-submit]').disabled = busy;
		var submit = form.querySelector('[data-batch-project-submit]');
		if (busy) submit?.setAttribute('aria-busy', 'true');
		else submit?.removeAttribute('aria-busy');
		form.querySelector('[data-batch-project-spinner]')?.classList.toggle('d-none', !busy);
	}

	async function onSelectAllChange() {
		var checked = selectAllCb.checked;
		getAllCheckboxes().forEach(function (cb) { cb.checked = checked; });

		if (!checked) { clearSelectAllRecords(); failedSelection.clear(); }
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
			failedSelection.clear();
			selectAllCb.checked = false;
			getAllCheckboxes().forEach(function (cb) { cb.checked = false; });
			clearSelectAllRecords();
			updateBatchBar();
		}
	}

	function onDocChange(e) {
		if (e.target.classList.contains('batch-cb')) {
			if (!e.target.checked) failedSelection.delete(e.target.value);
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
		if (e.target !== cb) {
			e.preventDefault();
			cb.checked = !cb.checked;
			cb.dispatchEvent(new Event('change', { bubbles: true }));
		}

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

	function applyBatchResult(result, action) {
		(result.outcomes || []).forEach(function (outcome) { window.dispatchEvent(new CustomEvent(outcome.event, { detail: outcome.item })); });
		var successful = new Set((result.success_ids || []).map(String));
		successful.forEach(function (id) { failedSelection.delete(id); });
		(result.failed || []).forEach(function (failure) { failedSelection.add(String(failure.id)); });
		getAllCheckboxes().forEach(function (cb) { if (successful.has(cb.value)) cb.checked = false; });
		clearSelectAllRecords();
		updateBatchBar();
		window.dispatchEvent(new CustomEvent('batch-done'));
		var processed = result[action === 'delete' ? 'deleted' : action === 'move' ? 'moved' : 'copied'] || 0;
		if (processed) showSuccess(processed + ' ' + (action === 'delete' ? 'moved to trash' : action === 'move' ? 'moved' : 'copied'));
		if (result.failed?.length) showError(result.failed.length + ' item(s) failed: ' + result.failed[0].error);
		return !result.failed?.length;
	}

	async function onDelete() {
		if (!getActionCount() || batchDeleteBtn.disabled) return;
		batchDeleteBtn.disabled = true;
		batchDeleteBtn.setAttribute('aria-busy', 'true');
		try {
			var result = await api('POST', '/batch/delete', buildBatchBody());
			applyBatchResult(result, 'delete');
		} catch (err) { showError(err.message || 'Batch deletion failed'); }
		finally { batchDeleteBtn.disabled = false; batchDeleteBtn.removeAttribute('aria-busy'); }
	}

	async function pickProject(action) {
		var count = getActionCount();
		if (!count || projectPickerOpening) return;

		var root = document.getElementById('batch-project-modal-root');
		if (!root) return showError('Project picker is unavailable.');
		projectPickerOpening = true;
		try {
			var html = await getProjectPickerHtml(action);
			if (!html) return;
			root.innerHTML = html;
			var modalEl = root.querySelector('#batchProjectModal');
			var form = root.querySelector('#batch-project-form');
			var select = root.querySelector('#batch-project-select');
			if (!modalEl || !form || !select) throw new Error('Project picker is unavailable');

			var Modal = await ensureBootstrapModal();
			var modal = Modal.getOrCreateInstance(modalEl);
			modalEl.addEventListener('hide.bs.modal', function (event) {
				if (form.dataset.busy === 'true') event.preventDefault();
			});
			modalEl.addEventListener('hidden.bs.modal', function () {
				modal.dispose();
				root.replaceChildren();
			}, { once: true });
			select.addEventListener('change', function () { select.classList.remove('is-invalid'); });
			form.addEventListener('submit', async function (event) {
				event.preventDefault();
				if (form.dataset.busy === 'true') return;
				var project = select.value;
				if (!project) {
					select.classList.add('is-invalid');
					select.focus();
					return;
				}

				select.classList.remove('is-invalid');
				setProjectPickerBusy(form, true);
				try {
					var result = await api('POST', '/batch/' + action, buildBatchBody({ project: project }));
					setProjectPickerBusy(form, false);
					if (applyBatchResult(result, action)) modal.hide();
					else select.focus();
				} catch (err) {
					setProjectPickerBusy(form, false);
					showError(err.message || 'Batch action failed');
				}
			});
			modal.show();
		} catch (err) {
			root.replaceChildren();
			showError(err.message || 'Failed to load projects');
		} finally {
			projectPickerOpening = false;
		}
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
		failedSelection.clear();
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
