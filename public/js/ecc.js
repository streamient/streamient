// Email Command Center section
(function () {
	var listEl;
	var mailboxesEl;
	var labelsEl;
	var projectSelect;
	var triageBtn;
	var refreshBtn;
	var viewTitle;
	var viewSubtitle;
	var aiPanel;
	var aiSubtitle;
	var openEmailBtn;
	var activeMailbox = 'inbox';
	var activeLabel = '';
	var selectedProject = '';
	var selectedEmail = null;
	var windowListeners = [];

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str || '';
		return div.innerHTML;
	}

	function formatDate(value) {
		if (!value) return '';
		return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function projectQuery() {
		return selectedProject ? '&project=' + encodeURIComponent(selectedProject) : '';
	}

	function emailsPath() {
		var params = [];
		if (activeLabel) {
			params.push('label=' + encodeURIComponent(activeLabel));
		} else if (activeMailbox) {
			params.push('mailbox=' + encodeURIComponent(activeMailbox));
			if (activeMailbox === 'inbox') params.push('triaged=false');
		}
		if (selectedProject) params.push('project=' + encodeURIComponent(selectedProject));
		return '/emails' + (params.length ? '?' + params.join('&') : '');
	}

	function labelsPath() {
		var params = [];
		if (selectedProject) params.push('project=' + encodeURIComponent(selectedProject));
		return '/email-labels' + (params.length ? '?' + params.join('&') : '');
	}

	function renderEmailAi(email) {
		if (!aiPanel || !aiSubtitle || !openEmailBtn) return;
		if (!email) {
			aiSubtitle.textContent = 'Select an email to work with AI.';
			openEmailBtn.classList.add('d-none');
			aiPanel.innerHTML = '<div class="ecc-ai-empty">'
				+ kkIcon('sparkle', 'mb-2')
				+ '<h6 class="mb-2">No email selected</h6>'
				+ '<p class="text-muted small mb-0">Select an email from the inbox to show the AI context and triage result.</p>'
				+ '</div>';
			return;
		}
		var subject = email.subject || '(No subject)';
		var sender = (email.from || []).join(', ') || '(unknown sender)';
		var labels = (email.labels || []).map(function (label) {
			return '<span class="badge ecc-email-label me-1">' + escapeHtml(label) + '</span>';
		}).join('');
		aiSubtitle.textContent = subject;
		openEmailBtn.classList.remove('d-none');
		aiPanel.innerHTML = '<div class="ecc-ai-section">'
			+ '<h6 class="mb-2">Email context</h6>'
			+ '<div class="small text-muted mb-1">From</div>'
			+ '<div class="mb-2 text-break">' + escapeHtml(sender) + '</div>'
			+ '<div class="small text-muted mb-1">Subject</div>'
			+ '<div class="mb-0 text-break">' + escapeHtml(subject) + '</div>'
			+ '</div>'
			+ '<div class="ecc-ai-section">'
			+ '<h6 class="mb-2">AI triage</h6>'
			+ (labels ? '<div class="mb-2">' + labels + '</div>' : '<div class="text-muted small mb-2">No labels yet.</div>')
			+ '<div class="small text-muted mb-1">Summary</div>'
			+ '<p class="mb-2">' + escapeHtml(email.triage_summary || 'Not triaged yet.') + '</p>'
			+ '<div class="small text-muted mb-1">Reason</div>'
			+ '<p class="mb-0">' + escapeHtml(email.triage_reason || 'No AI reason saved yet.') + '</p>'
			+ '</div>'
			+ '<div class="ecc-ai-section">'
			+ '<h6 class="mb-2">Next action</h6>'
			+ '<button type="button" class="btn btn-primary btn-sm w-100" id="ecc-triage-selected-btn">'
			+ kkIcon('sparkle', 'me-1') + 'Triage selected email'
			+ '</button>'
			+ '<div class="text-muted small mt-2">Single-email triage will use the same email AI instructions once that workflow is added.</div>'
			+ '</div>';
		var triageSelectedBtn = document.getElementById('ecc-triage-selected-btn');
		triageSelectedBtn?.setAttribute('disabled', 'disabled');
	}

	function updateViewText() {
		if (!viewTitle || !viewSubtitle) return;
		var projectName = selectedProject
			? projectSelect?.options[projectSelect.selectedIndex]?.text || 'selected project'
			: 'all projects';
		if (activeLabel) {
			var labelBtn = labelsEl?.querySelector('[data-label="' + activeLabel + '"]');
			viewTitle.textContent = labelBtn?.querySelector('.ecc-label-name')?.textContent || activeLabel;
			viewSubtitle.textContent = 'Emails labeled ' + viewTitle.textContent + ' in ' + projectName + '.';
			return;
		}
		var names = { inbox: 'Inbox', archived: 'Archived', sent: 'Sent', trash: 'Trash' };
		viewTitle.textContent = names[activeMailbox] || 'Inbox';
		viewSubtitle.textContent = activeMailbox === 'inbox'
			? 'All untriaged emails in ' + projectName + '.'
			: (names[activeMailbox] || 'Emails') + ' in ' + projectName + '.';
	}

	function renderLabels(labels) {
		if (!labelsEl) return;
		if (!labels.length) {
			labelsEl.innerHTML = '<div class="list-group-item text-muted small">No labels configured.</div>';
			return;
		}
		labelsEl.innerHTML = labels.map(function (label) {
			var active = activeLabel === label.slug ? ' active' : '';
			return '<button type="button" class="list-group-item list-group-item-action d-flex align-items-center' + active + '" data-label="' + escapeHtml(label.slug) + '">'
				+ '<span class="ecc-label-dot me-2" style="background:' + escapeHtml(label.color || '#6c757d') + '"></span>'
				+ '<span class="ecc-label-name text-truncate">' + escapeHtml(label.name) + '</span>'
				+ '<span class="badge text-bg-secondary ms-auto">' + (label.count || 0) + '</span>'
				+ '</button>';
		}).join('');
		labelsEl.querySelectorAll('[data-label]').forEach(function (button) {
			button.addEventListener('click', function () {
				activeLabel = button.dataset.label || '';
				activeMailbox = '';
				loadAll();
			});
		});
	}

	function renderMailboxes(mailboxes) {
		if (!mailboxesEl) return;
		(mailboxes || []).forEach(function (mailbox) {
			var button = mailboxesEl.querySelector('[data-mailbox="' + mailbox.slug + '"]');
			if (!button) return;
			button.classList.toggle('active', !activeLabel && activeMailbox === mailbox.slug);
			var badge = button.querySelector('.badge');
			if (badge) badge.textContent = mailbox.count || 0;
		});
	}

	function renderEmails(emails) {
		if (!listEl) return;
		if (!emails.length) {
			listEl.innerHTML = '<div class="list-group-item text-muted">No emails for this view.</div>';
			selectedEmail = null;
			renderEmailAi(null);
			return;
		}
		selectedEmail = null;
		renderEmailAi(null);
		listEl.innerHTML = emails.map(function (email) {
			var subject = email.subject || '(No subject)';
			var senders = (email.from || []).slice(0, 2).join(', ') || '(unknown sender)';
			var recipients = (email.to || []).slice(0, 2).join(', ') || '(no recipients)';
			var body = (email.triage_summary || email.text_content || email.attachment_text_content || '').slice(0, 180);
			var labels = (email.labels || []).map(function (label) {
				return '<span class="badge ecc-email-label me-1">' + escapeHtml(label) + '</span>';
			}).join('');
			return '<button type="button" class="list-group-item list-group-item-action ecc-email-item" data-id="' + escapeHtml(email._id) + '">'
				+ '<div class="d-flex justify-content-between align-items-start gap-3">'
				+ '<div class="min-w-0 flex-grow-1">'
				+ '<div class="fw-semibold text-truncate">' + escapeHtml(subject) + '</div>'
				+ '<div class="small text-muted text-truncate">' + kkIcon('user', 'me-1') + escapeHtml(senders) + '</div>'
				+ '<div class="small text-muted text-truncate">' + kkIcon('email', 'me-1') + escapeHtml(recipients) + '</div>'
				+ (body ? '<div class="small text-muted text-truncate mt-1">' + escapeHtml(body) + '</div>' : '')
				+ (labels ? '<div class="mt-2">' + labels + '</div>' : '')
				+ '</div>'
				+ '<small class="text-muted text-nowrap">' + escapeHtml(formatDate(email.updatedAt)) + '</small>'
				+ '</div>'
				+ '</button>';
		}).join('');
		listEl.querySelectorAll('.ecc-email-item').forEach(function (button) {
			button.addEventListener('click', function () {
				selectEmail(button.dataset.id);
			});
		});
	}

	async function selectEmail(emailId) {
		try {
			var res = await api('GET', '/emails/' + emailId);
			var email = res.email || res;
			selectedEmail = email;
			listEl?.querySelectorAll('.ecc-email-item').forEach(function (item) {
				item.classList.toggle('is-active', item.dataset.id === emailId);
			});
			renderEmailAi(email);
		} catch (err) {
			showError('Failed to load email: ' + (err.message || 'Unknown error'));
		}
	}

	function openSelectedEmail() {
		var email = selectedEmail;
		if (!email) return;
		window.openResultModal({
			_type: 'emails',
			id: email._id,
			title: email.subject || '(No subject)',
			from: email.from || [],
			text_content: [email.text_content, email.attachment_text_content].filter(Boolean).join('\n\n'),
		});
	}

	async function loadLabels() {
		var data = await api('GET', labelsPath());
		renderMailboxes(data.mailboxes || []);
		renderLabels(data.labels || []);
	}

	async function loadEmails() {
		if (!listEl) return;
		listEl.innerHTML = '<div class="list-group-item text-muted">Loading emails...</div>';
			var data = await api('GET', emailsPath());
			renderEmails(data.emails || []);
		}

	async function loadAll() {
		updateViewText();
		try {
			await Promise.all([loadLabels(), loadEmails()]);
		} catch (err) {
			if (listEl) listEl.innerHTML = '<div class="list-group-item text-danger">' + escapeHtml(err.message) + '</div>';
		}
	}

	async function triageInbox() {
		if (!triageBtn) return;
		triageBtn.disabled = true;
		var original = triageBtn.innerHTML;
		triageBtn.innerHTML = kkIcon('sync', 'me-1') + 'Triaging...';
		try {
			var payload = {};
			if (selectedProject) payload.project = selectedProject;
			var result = await api('POST', '/emails/triage-inbox', payload);
			showSuccess('Triaged ' + (result.triaged || 0) + ' email' + (result.triaged === 1 ? '' : 's'));
			activeMailbox = 'inbox';
			activeLabel = '';
			await loadAll();
		} catch (err) {
			showError(err.message);
		} finally {
			triageBtn.disabled = false;
			triageBtn.innerHTML = original;
		}
	}

	function onModalDeleted(e) {
		if (e.detail?.type === 'emails') loadAll();
	}

	function mount() {
		listEl = document.getElementById('ecc-list');
		if (!listEl) return;
		mailboxesEl = document.getElementById('ecc-mailboxes');
		labelsEl = document.getElementById('ecc-labels');
		projectSelect = document.getElementById('ecc-project-select');
		triageBtn = document.getElementById('ecc-triage-btn');
			refreshBtn = document.getElementById('ecc-refresh-btn');
			viewTitle = document.getElementById('ecc-view-title');
			viewSubtitle = document.getElementById('ecc-view-subtitle');
			aiPanel = document.getElementById('ecc-ai-panel');
			aiSubtitle = document.getElementById('ecc-ai-subtitle');
			openEmailBtn = document.getElementById('ecc-open-email-btn');
			activeMailbox = 'inbox';
			activeLabel = '';
			selectedProject = '';
			selectedEmail = null;
			renderEmailAi(null);

		mailboxesEl?.querySelectorAll('[data-mailbox]').forEach(function (button) {
			button.addEventListener('click', function () {
				activeMailbox = button.dataset.mailbox || 'inbox';
				activeLabel = '';
				loadAll();
			});
		});
		projectSelect?.addEventListener('change', function () {
			selectedProject = projectSelect.value || '';
			loadAll();
			});
			triageBtn?.addEventListener('click', triageInbox);
			refreshBtn?.addEventListener('click', loadAll);
			openEmailBtn?.addEventListener('click', openSelectedEmail);
			addWindowListener('item-modal-deleted', onModalDeleted);
		addWindowListener('email:created', loadAll);
		addWindowListener('email:updated', loadAll);
		addWindowListener('email:deleted', loadAll);
		loadAll();
	}

	function unmount() {
		for (var i = 0; i < windowListeners.length; i++) {
			window.removeEventListener(windowListeners[i][0], windowListeners[i][1]);
		}
		windowListeners.length = 0;
		listEl = null;
		mailboxesEl = null;
		labelsEl = null;
		projectSelect = null;
		triageBtn = null;
			refreshBtn = null;
			viewTitle = null;
			viewSubtitle = null;
			aiPanel = null;
			aiSubtitle = null;
			openEmailBtn = null;
			selectedEmail = null;
		}

	window.__sections = window.__sections || {};
	window.__sections.ecc = { mount: mount, unmount: unmount };
})();
