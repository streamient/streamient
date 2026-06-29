// Search index settings - IIFE loaded dynamically via SPA partial.
(function () {
	'use strict';

	if (window.__settingsReindexController?.destroy) {
		window.__settingsReindexController.destroy();
		delete window.__settingsReindexController;
	}

	var scriptEl = document.currentScript;
	var root = scriptEl?.closest('.modal') || document;
	window.__settingsReindexControllers = (window.__settingsReindexControllers || []).filter(function(controller) {
		if (controller.root === root || !controller.isMounted()) {
			controller.destroy();
			return false;
		}
		return true;
	});

	function findElement(id) {
		return root.querySelector('#' + id);
	}

	var reindexBtn = findElement('reindex-btn');
	var reindexBtnSpinner = findElement('reindex-btn-spinner');
	var reindexBtnText = findElement('reindex-btn-text');
	var resultEl = findElement('reindex-result');
	var alertEl = findElement('reindex-alert');
	var statusSpinner = findElement('reindex-status-spinner');
	var statusMessage = findElement('reindex-status-message');
	var countsEl = findElement('reindex-counts');
	var pollTimer = null;
	var destroyed = false;
	var renderedCachedComplete = false;

	if (!reindexBtn || !resultEl || !alertEl || !statusMessage) return;

	function isRunningStatus(status) {
		return status === 'queued' || status === 'progress';
	}

	function isMounted() {
		return document.body.contains(reindexBtn) && document.body.contains(resultEl);
	}

	function stopPoll() {
		if (!pollTimer) return;
		clearInterval(pollTimer);
		pollTimer = null;
	}

	function destroy() {
		if (destroyed) return;
		destroyed = true;
		stopPoll();
		window.removeEventListener('reindex-status', onReindexStatus);
		if (root !== document) root.removeEventListener('hidden.bs.modal', destroy);
	}

	function shouldStop() {
		if (!destroyed && isMounted()) return false;
		destroy();
		return true;
	}

	function startPoll() {
		if (pollTimer) return;
		pollTimer = setInterval(loadStatus, 3000);
	}

	function setButtonRunning(running) {
		reindexBtn.disabled = Boolean(running);
		if (reindexBtnSpinner) reindexBtnSpinner.classList.add('d-none');
		if (reindexBtnText) reindexBtnText.textContent = 'Reindex All My Data';
	}

	function setAlertClass(status) {
		alertEl.classList.remove('alert-info', 'alert-success', 'alert-danger');
		if (status === 'complete') {
			alertEl.classList.add('alert-success');
		} else if (status === 'error') {
			alertEl.classList.add('alert-danger');
		} else {
			alertEl.classList.add('alert-info');
		}
	}

	function defaultMessage(data) {
		var status = data?.status || 'idle';
		if (status === 'complete') return 'Reindex complete.';
		if (status === 'queued') return 'Reindexing is queued.';
		if (status === 'progress') return 'Reindexing...';
		if (status === 'error') return 'Reindex failed.';
		return 'Search index is idle.';
	}

	function countText(value) {
		var count = Number(value || 0);
		if (!Number.isFinite(count)) count = 0;
		return count.toLocaleString();
	}

	function updateCountRow(row, counts) {
		if (!row || !counts) return;
		var db = row.querySelector('[data-index-count-db]');
		var indexed = row.querySelector('[data-index-count-indexed]');
		var notIndexed = row.querySelector('[data-index-count-not-indexed]');
		if (db) db.textContent = countText(counts.db_records);
		if (indexed) indexed.textContent = countText(counts.indexed_records);
		if (notIndexed) notIndexed.textContent = countText(counts.not_indexed_records);
	}

	function renderCounts(counts) {
		if (!countsEl || !counts) return;
		updateCountRow(countsEl.querySelector('[data-index-count-total]'), counts);
		countsEl.querySelectorAll('[data-index-count-type]').forEach(function(row) {
			updateCountRow(row, counts.by_type?.[row.dataset.indexCountType]);
		});
	}

	function renderReindexStatus(data, options) {
		if (shouldStop() || !data) return;
		options = options || {};
		renderCounts(data.counts);

		var status = data.status || 'queued';
		if (status === 'idle' && !options.force) {
			resultEl.classList.add('d-none');
			setButtonRunning(false);
			stopPoll();
			return;
		}

		var running = isRunningStatus(status);
		setAlertClass(status);
		setButtonRunning(running);
		if (statusSpinner) statusSpinner.classList.toggle('d-none', !running);
		statusMessage.textContent = data.message || defaultMessage(data);
		resultEl.classList.remove('d-none');

		if (running) {
			startPoll();
		} else {
			stopPoll();
		}
	}

	function renderReindexError(message) {
		renderReindexStatus({
			status: 'error',
			message: message || 'Reindex failed.',
		}, { force: true });
		setButtonRunning(false);
	}

	async function loadStatus() {
		if (shouldStop()) return;
		try {
			var data = await api('GET', '/reindex/status');
			if (data?.status === 'idle' && renderedCachedComplete) return;
			renderedCachedComplete = false;
			renderReindexStatus(data || {});
		} catch (err) {
			if (pollTimer) renderReindexError(err.message || 'Failed to load reindex status.');
		}
	}

	function onReindexStatus(event) {
		renderReindexStatus(event.detail || {}, { force: true });
	}

	window.addEventListener('reindex-status', onReindexStatus);
	if (root !== document) root.addEventListener('hidden.bs.modal', destroy, { once: true });

	reindexBtn.addEventListener('click', async function() {
		var confirmed = await confirmAction('Reindex All Data', 'This will rebuild all search indexes.');
		if (!confirmed) return;

		renderedCachedComplete = false;
		setButtonRunning(true);
		renderReindexStatus({
			status: 'queued',
			message: 'Starting reindex...',
		}, { force: true });

		try {
			var data = await api('POST', '/reindex');
			renderReindexStatus({
				status: data.status || (data.total_queued > 0 ? 'queued' : 'complete'),
				total_queued: data.total_queued || 0,
				remaining: data.remaining || data.total_queued || 0,
				counts: data.counts,
				message: data.message,
			}, { force: true });
		} catch (err) {
			renderReindexError(err.message);
		}
	});

	window.__settingsReindexControllers.push({
		root,
		destroy,
		isMounted,
	});

	if (window.__lastReindexStatus?.status) {
		renderedCachedComplete = window.__lastReindexStatus.status === 'complete';
		renderReindexStatus(window.__lastReindexStatus, { force: window.__lastReindexStatus.status !== 'idle' });
	}

	loadStatus();
})();
