// Email Command Center section
(function () {
	var listEl;
	var mailboxesEl;
	var labelsEl;
	var projectSelect;
	var triageBtn;
	var refreshBtn;
	var selectAllBtn;
	var selectAllText;
	var actionBar;
	var actionCount;
	var moveMenu;
	var trashBtn;
	var resetTriageBtn;
	var viewTitle;
	var viewSubtitle;
	var aiPanel;
	var aiSubtitle;
	var openEmailBtn;
	var aiMessagesEl;
	var aiInputEl;
	var aiSendBtn;
	var triageModalEl;
	var triageModalStatus;
	var triageModalDetail;
	var triageModalProgress;
	var triageModalProcessed;
	var triageModalTotal;
	var triageModalTriaged;
	var triageModalErrors;
	var triageModalClose;
	var triageSpinner;
	var activeMailbox = 'inbox';
	var activeLabel = '';
	var selectedProject = '';
	var selectedEmail = null;
	var selectedIds = new Set();
	var emailAiMessages = [];
	var windowListeners = [];
	var triageRunId = '';
	var triageProgress = null;
	var MAILBOX_ACTIONS = [
		{ slug: 'inbox', name: 'Inbox', icon: 'email' },
		{ slug: 'archived', name: 'Archived', icon: 'archive' },
		{ slug: 'sent', name: 'Sent', icon: 'send' },
		{ slug: 'spam', name: 'Spam', icon: 'warning' },
	];
	var SYSTEM_TRIAGE_LABELS = ['waiting', 'triaged', 'human-do', 'reply-required', 'no-action', 'spam'];

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

		function emailId(email) {
			return String(email?._id || email?.id || '');
		}

		function newRunId() {
			if (window.crypto?.randomUUID) return window.crypto.randomUUID();
			return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
		}

		function getMailboxCount(mailbox) {
			var button = mailboxesEl?.querySelector('[data-mailbox="' + mailbox + '"]');
			var value = parseInt(button?.querySelector('.badge')?.textContent || '0', 10);
			return Number.isFinite(value) ? value : 0;
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

		function draftsPath() {
			var params = [];
			if (selectedProject) params.push('project=' + encodeURIComponent(selectedProject));
			return '/email-drafts' + (params.length ? '?' + params.join('&') : '');
		}

	function labelsPath() {
		var params = [];
		if (selectedProject) params.push('project=' + encodeURIComponent(selectedProject));
		return '/email-labels' + (params.length ? '?' + params.join('&') : '');
	}

	function getSelectedIds() {
		return Array.from(selectedIds);
	}

	function clearSelection() {
		selectedIds.clear();
		listEl?.querySelectorAll('.ecc-email-select').forEach(function (checkbox) {
			checkbox.checked = false;
		});
		listEl?.querySelectorAll('.ecc-email-item').forEach(function (item) {
			item.classList.remove('is-selected');
		});
		updateActionBar();
	}

	function getEmailCheckboxes() {
		return Array.from(listEl?.querySelectorAll('.ecc-email-select') || []);
	}

	function updateSelectAllButton() {
		if (!selectAllBtn) return;
		var checkboxes = getEmailCheckboxes();
		var enabled = activeMailbox !== 'drafts' && checkboxes.length > 0;
		var selectedCount = checkboxes.filter(function (checkbox) {
			return selectedIds.has(checkbox.value);
		}).length;
		var allSelected = enabled && selectedCount === checkboxes.length;
		selectAllBtn.classList.toggle('d-none', !enabled);
		selectAllBtn.disabled = !enabled;
		selectAllBtn.classList.toggle('active', allSelected);
		selectAllBtn.setAttribute('aria-pressed', allSelected ? 'true' : 'false');
		if (selectAllText) selectAllText.textContent = allSelected ? 'Clear selection' : 'Select all';
	}

	function updateTriageButton() {
		if (!triageBtn) return;
		triageBtn.classList.toggle('d-none', activeLabel || activeMailbox !== 'inbox');
	}

	function updateActionBar() {
		if (!actionBar || !actionCount) return;
		var count = selectedIds.size;
		actionCount.textContent = count + ' selected';
		actionBar.classList.toggle('d-none', count === 0 || activeMailbox === 'drafts');
		actionBar.classList.toggle('d-flex', count > 0 && activeMailbox !== 'drafts');
		if (trashBtn) trashBtn.classList.toggle('d-none', activeMailbox === 'trash');
		updateSelectAllButton();
		updateTriageButton();
	}

	function renderMoveMenu() {
		if (!moveMenu) return;
		var targets = MAILBOX_ACTIONS.filter(function (mailbox) {
			return activeLabel || activeMailbox === 'trash' || activeMailbox !== mailbox.slug;
		});
		moveMenu.innerHTML = targets.map(function (mailbox) {
			return '<li><button class="dropdown-item ecc-move-target" type="button" data-mailbox="' + escapeHtml(mailbox.slug) + '">'
				+ kkIcon(mailbox.icon, 'me-2')
				+ escapeHtml(mailbox.name)
				+ '</button></li>';
		}).join('');
		moveMenu.querySelectorAll('.ecc-move-target').forEach(function (button) {
			button.addEventListener('click', function () {
				moveSelected(button.dataset.mailbox || 'inbox');
			});
		});
	}

	function renderVisibleLabels(email) {
		var labels = (email.labels || []).filter(function (label) {
			return !SYSTEM_TRIAGE_LABELS.includes(label);
		});
		return labels.map(function (label) {
			return '<span class="badge ecc-email-label me-1">' + escapeHtml(label) + '</span>';
		}).join('');
	}

	function setEmailSelected(checkbox, selected) {
		var item = checkbox.closest('.ecc-email-item');
		checkbox.checked = selected;
		if (selected) {
			selectedIds.add(checkbox.value);
		} else {
			selectedIds.delete(checkbox.value);
		}
		item?.classList.toggle('is-selected', selected);
		updateActionBar();
	}

	function toggleEmailSelection(item) {
		var checkbox = item?.querySelector('.ecc-email-select');
		if (!checkbox) return;
		setEmailSelected(checkbox, !checkbox.checked);
	}

	function toggleSelectAll() {
		var checkboxes = getEmailCheckboxes();
		if (activeMailbox === 'drafts' || !checkboxes.length) return;
		var allSelected = checkboxes.every(function (checkbox) {
			return selectedIds.has(checkbox.value);
		});
		checkboxes.forEach(function (checkbox) {
			setEmailSelected(checkbox, !allSelected);
		});
		updateActionBar();
	}

	function renderEmailAi(email) {
		if (!aiPanel || !aiSubtitle || !openEmailBtn) return;
		if (!email) {
			aiSubtitle.textContent = 'No email active.';
			openEmailBtn.classList.add('d-none');
			aiMessagesEl = null;
			aiInputEl = null;
			aiSendBtn = null;
			emailAiMessages = [];
			aiPanel.innerHTML = '<div class="ecc-ai-empty">'
				+ kkIcon('sparkle', 'mb-2')
				+ '<h6 class="mb-2">AI idle</h6>'
				+ '<p class="text-muted small mb-0">Email selection will not start AI.</p>'
				+ '</div>';
			return;
		}
		var subject = email.subject || '(No subject)';
		var sender = (email.from || []).join(', ') || '(unknown sender)';
		var labels = renderVisibleLabels(email);
		aiSubtitle.textContent = subject;
		openEmailBtn.classList.remove('d-none');
		aiPanel.innerHTML = '<div class="ecc-ai-content">'
			+ '<div class="ecc-ai-section">'
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
			+ '<div class="ecc-ai-section ecc-email-chat">'
			+ '<h6 class="mb-2">Ask Email AI</h6>'
			+ '<div class="ecc-email-ai-messages" id="ecc-email-ai-messages"></div>'
			+ '<label class="form-label small mb-1" for="ecc-email-ai-input">Message</label>'
			+ '<div class="input-group input-group-sm">'
			+ '<input type="text" class="form-control form-control-sm" id="ecc-email-ai-input" autocomplete="off">'
			+ '<button type="button" class="btn btn-primary btn-sm" id="ecc-email-ai-send" title="Send">'
			+ kkIcon('send')
			+ '</button>'
			+ '</div>'
			+ '</div>'
			+ '</div>';
		aiMessagesEl = document.getElementById('ecc-email-ai-messages');
		aiInputEl = document.getElementById('ecc-email-ai-input');
		aiSendBtn = document.getElementById('ecc-email-ai-send');
		renderEmailAiMessages();
		aiSendBtn?.addEventListener('click', sendEmailAiMessage);
		aiInputEl?.addEventListener('keydown', function (event) {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				sendEmailAiMessage();
			}
		});
	}

	function renderEmailAiMessages() {
		if (!aiMessagesEl) return;
		if (!emailAiMessages.length) {
			aiMessagesEl.innerHTML = '<div class="text-muted small">No messages yet.</div>';
			return;
		}
		aiMessagesEl.innerHTML = emailAiMessages.map(function (message) {
			return '<div class="ecc-email-ai-message ' + escapeHtml(message.role) + '">'
				+ escapeHtml(message.text)
				+ '</div>';
		}).join('');
		aiMessagesEl.scrollTop = aiMessagesEl.scrollHeight;
	}

	async function sendEmailAiMessage() {
		if (!selectedEmail || !aiInputEl || !aiSendBtn) return;
		var query = aiInputEl.value.trim();
		if (!query) return;
		emailAiMessages.push({ role: 'user', text: query });
		aiInputEl.value = '';
		aiSendBtn.disabled = true;
		renderEmailAiMessages();
		try {
			var res = await api('POST', '/emails/' + selectedEmail._id + '/ai', { query: query });
			emailAiMessages.push({ role: 'assistant', text: res.answer || '' });
		} catch (err) {
			emailAiMessages.push({ role: 'assistant', text: 'Error: ' + (err.message || 'Email AI failed') });
		} finally {
			aiSendBtn.disabled = false;
			renderEmailAiMessages();
			aiInputEl.focus();
		}
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
			var names = { inbox: 'Inbox', archived: 'Archived', sent: 'Sent', spam: 'Spam', drafts: 'Drafts', trash: 'Trash' };
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

		function emailMatchesCurrentView(email) {
			if (!email) return false;
			if (activeMailbox === 'drafts') return false;
			if (activeLabel) return (email.labels || []).includes(activeLabel) && email.in_trash !== true;
			if (activeMailbox === 'trash') return email.in_trash === true;
			var mailbox = email.mailbox || 'inbox';
			if (activeMailbox === 'inbox') return email.in_trash !== true && mailbox === 'inbox' && email.triaged !== true;
			return email.in_trash !== true && mailbox === activeMailbox;
		}

		function renderEmailItemHtml(email) {
			var subject = email.subject || '(No subject)';
			var senders = (email.from || []).slice(0, 2).join(', ') || '(unknown sender)';
			var recipients = (email.to || []).slice(0, 2).join(', ') || '(no recipients)';
			var body = (email.triage_summary || email.text_content || email.attachment_text_content || '').slice(0, 180);
			var actionPoints = (email.triage_action_points || []).slice(0, 2).map(function (item) {
				return item.text;
			}).filter(Boolean).join(' - ');
			var labels = renderVisibleLabels(email);
			var triageMeta = [
				email.triage_primary_action ? '<span class="badge text-bg-light me-1">' + escapeHtml(email.triage_primary_action) + '</span>' : '',
				email.triage_status === 'failed' ? '<span class="badge text-bg-danger me-1">Failed</span>' : '',
				email.triage_draft_id ? '<span class="badge text-bg-info me-1">Draft</span>' : '',
			].filter(Boolean).join('');
			return '<div class="list-group-item list-group-item-action ecc-email-item" role="button" tabindex="0" data-id="' + escapeHtml(emailId(email)) + '">'
				+ '<div class="d-flex justify-content-between align-items-start gap-3 min-w-0">'
				+ '<div class="form-check ecc-email-select-wrap">'
				+ '<input class="form-check-input ecc-email-select" type="checkbox" value="' + escapeHtml(emailId(email)) + '" aria-label="Select email">'
				+ '</div>'
				+ '<div class="min-w-0 flex-grow-1">'
				+ '<div class="fw-semibold text-truncate">' + escapeHtml(subject) + '</div>'
				+ '<div class="small text-muted text-truncate">' + kkIcon('user', 'me-1') + escapeHtml(senders) + '</div>'
				+ '<div class="small text-muted text-truncate">' + kkIcon('email', 'me-1') + escapeHtml(recipients) + '</div>'
				+ (body ? '<div class="small text-muted text-truncate mt-1">' + escapeHtml(body) + '</div>' : '')
				+ (actionPoints ? '<div class="small text-body text-truncate mt-1">' + escapeHtml(actionPoints) + '</div>' : '')
				+ (triageMeta ? '<div class="mt-2">' + triageMeta + '</div>' : '')
				+ (labels ? '<div class="mt-2">' + labels + '</div>' : '')
				+ '</div>'
				+ '<small class="text-muted text-nowrap">' + escapeHtml(formatDate(email.updatedAt)) + '</small>'
				+ '</div>'
				+ '</div>';
		}

		function bindEmailItem(item) {
			item.addEventListener('click', function (event) {
				if (event.target.closest('.ecc-email-select-wrap')) return;
				toggleEmailSelection(item);
			});
			item.addEventListener('keydown', function (event) {
				if (event.target.closest('.ecc-email-select-wrap')) return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					toggleEmailSelection(item);
				}
			});
			var checkbox = item.querySelector('.ecc-email-select');
			checkbox?.addEventListener('click', function (event) {
				event.stopPropagation();
			});
			checkbox?.addEventListener('change', function () {
				setEmailSelected(checkbox, checkbox.checked);
			});
		}

		function showEmptyEmailsIfNeeded() {
			if (!listEl || listEl.querySelector('.ecc-email-item')) return;
			listEl.innerHTML = '<div class="list-group-item text-muted ecc-email-empty">No emails for this view.</div>';
			selectedEmail = null;
			emailAiMessages = [];
			renderEmailAi(null);
			updateActionBar();
		}

	function renderEmails(emails) {
		if (!listEl) return;
		selectedIds.clear();
		updateActionBar();
		renderMoveMenu();
		if (!emails.length) {
			listEl.innerHTML = '<div class="list-group-item text-muted ecc-email-empty">No emails for this view.</div>';
			selectedEmail = null;
			emailAiMessages = [];
			renderEmailAi(null);
			updateActionBar();
			return;
		}
		selectedEmail = null;
		emailAiMessages = [];
		renderEmailAi(null);
		listEl.innerHTML = emails.map(renderEmailItemHtml).join('');
		listEl.querySelectorAll('.ecc-email-item').forEach(function (button) {
			bindEmailItem(button);
		});
		updateActionBar();
	}

	function renderDrafts(drafts) {
		if (!listEl) return;
		selectedIds.clear();
		updateActionBar();
		renderMoveMenu();
		selectedEmail = null;
		emailAiMessages = [];
		renderEmailAi(null);
		if (!drafts.length) {
			listEl.innerHTML = '<div class="list-group-item text-muted">No drafts for this view.</div>';
			updateActionBar();
			return;
		}
		listEl.innerHTML = drafts.map(function (draft) {
			var recipients = (draft.to || []).slice(0, 2).join(', ') || '(no recipients)';
			var body = (draft.body_text || '').slice(0, 180);
			return '<div class="list-group-item">'
				+ '<div class="d-flex justify-content-between align-items-start gap-3 min-w-0">'
				+ '<div class="min-w-0 flex-grow-1">'
				+ '<div class="fw-semibold text-truncate">' + escapeHtml(draft.subject || '(No subject)') + '</div>'
				+ '<div class="small text-muted text-truncate">' + kkIcon('email', 'me-1') + escapeHtml(recipients) + '</div>'
				+ (body ? '<div class="small text-muted text-truncate mt-1">' + escapeHtml(body) + '</div>' : '')
				+ '<div class="mt-2"><span class="badge text-bg-light me-1">' + escapeHtml(draft.status || 'draft') + '</span></div>'
				+ '</div>'
				+ '<small class="text-muted text-nowrap">' + escapeHtml(formatDate(draft.updatedAt)) + '</small>'
				+ '</div>'
				+ '</div>';
		}).join('');
		updateActionBar();
	}

	async function selectEmail(emailId) {
		try {
			var res = await api('GET', '/emails/' + emailId);
			var email = res.email || res;
			selectedEmail = email;
			emailAiMessages = [];
			listEl?.querySelectorAll('.ecc-email-item').forEach(function (item) {
				var active = item.dataset.id === emailId;
				item.classList.toggle('is-active', active);
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

	async function moveSelected(mailbox) {
		var ids = getSelectedIds();
		if (!ids.length) return;
		var target = MAILBOX_ACTIONS.find(function (item) { return item.slug === mailbox; });
		if (!target) return;
		try {
			if (activeMailbox === 'trash') {
				await api('POST', '/trash/batch/restore', {
					items: ids.map(function (id) { return { type: 'emails', id: id }; }),
				});
			}
			await Promise.all(ids.map(function (id) {
				return api('PUT', '/emails/' + id, { mailbox: mailbox });
			}));
			showSuccess(ids.length + ' moved to ' + target.name);
			clearSelection();
			await loadAll();
		} catch (err) {
			showError(err.message || 'Failed to move emails');
		}
	}

	async function trashSelected() {
		var ids = getSelectedIds();
		if (!ids.length) return;
		var confirmed = await confirmAction('Move to Trash', ids.length + ' email(s) will be moved to trash.');
		if (!confirmed) return;
		try {
			await api('POST', '/batch/delete', { type: 'emails', ids: ids });
			showSuccess(ids.length + ' moved to trash');
			clearSelection();
			await loadAll();
		} catch (err) {
			showError(err.message || 'Failed to move emails to trash');
		}
	}

	async function resetSelectedTriage() {
		var ids = getSelectedIds();
		if (!ids.length) return;
		var confirmed = await confirmAction('Reset Triage', ids.length + ' email(s) will move to inbox and lose all triage labels.');
		if (!confirmed) return;
		try {
			await Promise.all(ids.map(function (id) {
				return api('POST', '/emails/' + id + '/reset-triage', {});
			}));
			showSuccess(ids.length + ' reset to inbox');
			clearSelection();
			activeMailbox = 'inbox';
			activeLabel = '';
			await loadAll();
		} catch (err) {
			showError(err.message || 'Failed to reset triage');
		}
	}

	async function loadLabels() {
		var data = await api('GET', labelsPath());
		renderMailboxes(data.mailboxes || []);
		renderLabels(data.labels || []);
	}

		async function loadEmails() {
			if (!listEl) return;
			listEl.innerHTML = '<div class="list-group-item text-muted">Loading emails...</div>';
			selectedIds.clear();
			updateActionBar();
			if (activeMailbox === 'drafts') {
				var draftData = await api('GET', draftsPath());
				renderDrafts(draftData.drafts || []);
				return;
			}
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

		function applyEmailSocketUpdate(email) {
			if (!listEl || !email) return;
			if (activeMailbox === 'drafts') {
				loadEmails();
				return;
			}
			var id = emailId(email);
			if (!id) return;
			var existing = listEl.querySelector('.ecc-email-item[data-id="' + CSS.escape(id) + '"]');
			var matches = emailMatchesCurrentView(email);
			if (!matches) {
				if (existing) {
					existing.remove();
					selectedIds.delete(id);
					updateActionBar();
					showEmptyEmailsIfNeeded();
				}
				if (emailId(selectedEmail) === id) renderEmailAi(null);
				return;
			}
			var wrapper = document.createElement('div');
			wrapper.innerHTML = renderEmailItemHtml(email);
			var item = wrapper.firstElementChild;
			if (!item) return;
			bindEmailItem(item);
			if (existing) {
				existing.replaceWith(item);
			} else {
				listEl.querySelector('.ecc-email-empty')?.remove();
				listEl.prepend(item);
			}
			if (selectedIds.has(id)) {
				var checkbox = item.querySelector('.ecc-email-select');
				if (checkbox) setEmailSelected(checkbox, true);
			}
			if (emailId(selectedEmail) === id) {
				selectedEmail = email;
				renderEmailAi(email);
			}
			updateActionBar();
		}

		function removeEmailFromList(id) {
			if (!listEl || !id) return;
			listEl.querySelector('.ecc-email-item[data-id="' + CSS.escape(id) + '"]')?.remove();
			selectedIds.delete(id);
			updateActionBar();
			if (emailId(selectedEmail) === id) renderEmailAi(null);
			showEmptyEmailsIfNeeded();
		}

		function handleEmailSocketEvent(event) {
			var email = event.detail || {};
			applyEmailSocketUpdate(email);
			loadLabels().catch(() => {});
			updateTriageProgressFromEmail(email);
		}

		function handleEmailDeleted(event) {
			removeEmailFromList(emailId(event.detail || {}));
			loadLabels().catch(() => {});
		}

		function renderTriageProgress() {
			if (!triageProgress) return;
			var total = Math.max(triageProgress.total || 0, triageProgress.processed || 0);
			var pct = total > 0 ? Math.min(100, Math.round((triageProgress.processed / total) * 100)) : 0;
			if (triageModalProcessed) triageModalProcessed.textContent = triageProgress.processed;
			if (triageModalTotal) triageModalTotal.textContent = total;
			if (triageModalTriaged) triageModalTriaged.textContent = triageProgress.triaged;
			if (triageModalErrors) triageModalErrors.textContent = triageProgress.errors;
			if (triageModalProgress) {
				triageModalProgress.style.width = pct + '%';
				triageModalProgress.setAttribute('aria-valuenow', String(pct));
			}
			if (triageModalStatus) {
				triageModalStatus.textContent = triageProgress.running ? 'Processing inbox' : 'Triage complete';
			}
			if (triageModalDetail) {
				triageModalDetail.textContent = triageProgress.running
					? triageProgress.processed + ' of ' + total + ' processed.'
					: triageProgress.triaged + ' triaged, ' + triageProgress.errors + ' errors.';
			}
			if (triageSpinner) triageSpinner.classList.toggle('d-none', !triageProgress.running);
			if (triageModalClose) triageModalClose.disabled = triageProgress.running;
		}

		async function showTriageModal(total, runId) {
			triageRunId = runId;
			triageProgress = {
				total: total || 0,
				processed: 0,
				triaged: 0,
				errors: 0,
				seen: new Set(),
				running: true,
			};
			renderTriageProgress();
			if (!triageModalEl) return;
			const { Modal } = await import('/static/js/vendor.js');
			Modal.getOrCreateInstance(triageModalEl).show();
		}

		function completeTriageProgress(result) {
			if (!triageProgress) return;
			triageProgress.total = result?.processed || triageProgress.total || 0;
			triageProgress.processed = Math.max(triageProgress.processed, result?.processed || 0);
			triageProgress.triaged = Math.max(triageProgress.triaged, result?.triaged || 0);
			triageProgress.errors = Math.max(triageProgress.errors, (result?.errors || []).length);
			triageProgress.running = false;
			renderTriageProgress();
		}

		async function hideTriageModal() {
			if (!triageModalEl) return;
			const { Modal } = await import('/static/js/vendor.js');
			Modal.getOrCreateInstance(triageModalEl).hide();
		}

		function updateTriageProgressFromEmail(email) {
			if (!triageProgress || !triageRunId || !email || email.triage_run_id !== triageRunId) return;
			if (!['complete', 'failed'].includes(email.triage_status)) return;
			var id = emailId(email);
			if (!id || triageProgress.seen.has(id)) return;
			triageProgress.seen.add(id);
			triageProgress.processed += 1;
			if (email.triage_status === 'complete') triageProgress.triaged += 1;
			if (email.triage_status === 'failed') triageProgress.errors += 1;
			if (triageProgress.processed > triageProgress.total) triageProgress.total = triageProgress.processed;
			renderTriageProgress();
		}

		async function triageInbox() {
			if (!triageBtn) return;
			triageBtn.disabled = true;
			var original = triageBtn.innerHTML;
			triageBtn.innerHTML = kkIcon('sync', 'me-1') + 'Triaging...';
			var runId = newRunId();
			try {
				await showTriageModal(getMailboxCount('inbox'), runId);
				var payload = { run_id: runId };
				if (selectedProject) payload.project = selectedProject;
				var result = await api('POST', '/emails/triage-inbox', payload);
				completeTriageProgress(result);
				activeMailbox = 'inbox';
				activeLabel = '';
				await loadAll();
				if ((result.processed || 0) > 0 && !(result.triaged || 0) && (result.errors || []).length) {
					showError((result.errors[0] || {}).error || 'Inbox triage failed');
				} else {
					showSuccess('Triaged ' + (result.triaged || 0) + ' email' + (result.triaged === 1 ? '' : 's'));
					setTimeout(hideTriageModal, 900);
				}
			} catch (err) {
				if (triageProgress) {
					triageProgress.running = false;
					renderTriageProgress();
				}
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
		selectAllBtn = document.getElementById('ecc-select-all-btn');
		selectAllText = document.getElementById('ecc-select-all-text');
		actionBar = document.getElementById('ecc-action-bar');
		actionCount = document.getElementById('ecc-action-count');
		moveMenu = document.getElementById('ecc-move-menu');
		trashBtn = document.getElementById('ecc-trash-btn');
		resetTriageBtn = document.getElementById('ecc-reset-triage-btn');
		viewTitle = document.getElementById('ecc-view-title');
		viewSubtitle = document.getElementById('ecc-view-subtitle');
		aiPanel = document.getElementById('ecc-ai-panel');
		aiSubtitle = document.getElementById('ecc-ai-subtitle');
		openEmailBtn = document.getElementById('ecc-open-email-btn');
		triageModalEl = document.getElementById('ecc-triage-modal');
		triageModalStatus = document.getElementById('ecc-triage-modal-status');
		triageModalDetail = document.getElementById('ecc-triage-modal-detail');
		triageModalProgress = document.getElementById('ecc-triage-modal-progress');
		triageModalProcessed = document.getElementById('ecc-triage-modal-processed');
		triageModalTotal = document.getElementById('ecc-triage-modal-total');
		triageModalTriaged = document.getElementById('ecc-triage-modal-triaged');
		triageModalErrors = document.getElementById('ecc-triage-modal-errors');
		triageModalClose = document.getElementById('ecc-triage-modal-close');
		triageSpinner = document.getElementById('ecc-triage-spinner');
		activeMailbox = 'inbox';
		activeLabel = '';
		selectedProject = '';
		selectedEmail = null;
		triageRunId = '';
		triageProgress = null;
		selectedIds.clear();
		emailAiMessages = [];
		renderEmailAi(null);
		renderMoveMenu();
		updateActionBar();

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
		selectAllBtn?.addEventListener('click', toggleSelectAll);
		trashBtn?.addEventListener('click', trashSelected);
		resetTriageBtn?.addEventListener('click', resetSelectedTriage);
		openEmailBtn?.addEventListener('click', openSelectedEmail);
		addWindowListener('item-modal-deleted', onModalDeleted);
		addWindowListener('email:created', handleEmailSocketEvent);
		addWindowListener('email:updated', handleEmailSocketEvent);
		addWindowListener('email:deleted', handleEmailDeleted);
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
		selectAllBtn = null;
		selectAllText = null;
		actionBar = null;
		actionCount = null;
		moveMenu = null;
		trashBtn = null;
		resetTriageBtn = null;
		viewTitle = null;
		viewSubtitle = null;
		aiPanel = null;
		aiSubtitle = null;
		openEmailBtn = null;
		triageModalEl = null;
		triageModalStatus = null;
		triageModalDetail = null;
		triageModalProgress = null;
		triageModalProcessed = null;
		triageModalTotal = null;
		triageModalTriaged = null;
		triageModalErrors = null;
		triageModalClose = null;
		triageSpinner = null;
		aiMessagesEl = null;
		aiInputEl = null;
		aiSendBtn = null;
		selectedEmail = null;
		triageRunId = '';
		triageProgress = null;
		selectedIds.clear();
		emailAiMessages = [];
	}

	window.__sections = window.__sections || {};
	window.__sections.ecc = { mount: mount, unmount: unmount };
})();
