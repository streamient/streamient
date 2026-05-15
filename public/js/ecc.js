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
	var viewHeader;
	var viewTitle;
	var viewSubtitle;
	var listWrap;
	var detailEl;
	var detailBackBtn;
	var detailTitle;
	var detailSubtitle;
	var detailDate;
	var detailDraftEl;
	var detailThreadEl;
	var internalNotesEl;
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
	var detailActive = false;
	var pendingEmailId = '';
	var selectedIds = new Set();
	var emailAiMessages = [];
	var emailReplySuggestions = [];
	var currentDraft = null;
	var draftEditor = null;
	var draftEditorHost = null;
	var draftAutosaveTimer = null;
	var draftAutosaveDirty = false;
	var draftAutosaveSaving = false;
	var draftRecipientTagifies = [];
	var noteEditor = null;
	var noteEditorHost = null;
	var currentInternalNotes = [];
	var selectedEmailThreadSourceIds = [];
	var pendingInternalNoteSocketEvents = [];
	var windowListeners = [];
	var triageRunId = '';
	var triageProgress = null;
	var INTERNAL_NOTE_PREVIEW_LIMIT = 150;
	var MAILBOX_ACTIONS = [
		{ slug: 'inbox', name: 'Inbox', icon: 'email' },
		{ slug: 'archived', name: 'Archived', icon: 'archive' },
		{ slug: 'sent', name: 'Sent', icon: 'send' },
		{ slug: 'spam', name: 'Spam', icon: 'warning' },
	];
	var SYSTEM_TRIAGE_LABELS = ['reply-required', 'human-do', 'waiting', 'no-action', 'triaged', 'spam'];
	var DRAFT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	var TRIAGE_ACTION_NAMES = {
		'reply-required': 'Review',
		'human-do': 'Human Do',
		waiting: 'Waiting',
		'no-action': 'No action',
		spam: 'Spam',
	};

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

		function formatDateTime(value) {
			if (!value) return '';
			return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
		}

		function emailId(email) {
			return String(email?._id || email?.id || '');
		}

		function draftSourceEmailId(draft) {
			return String(draft?.source_email?._id || draft?.source_email || '');
		}

		function replaceChildren(node) {
			if (!node) return;
			while (node.firstChild) node.removeChild(node.firstChild);
		}

		function textNode(tagName, className, text) {
			var node = document.createElement(tagName);
			if (className) node.className = className;
			node.textContent = text || '';
			return node;
		}

		function plainTextToHtml(value) {
			var text = String(value || '').trim();
			if (!text) return '';
			return text.split(/\n{2,}/).map(function (paragraph) {
				return '<p>' + escapeHtml(paragraph).replace(/\n/g, '<br>') + '</p>';
			}).join('');
		}

		function listToInputValue(items) {
			return (items || []).filter(Boolean).join(', ');
		}

		function inputValueToList(value) {
			return String(value || '')
				.split(',')
				.map(function (item) { return item.trim(); })
				.filter(Boolean);
		}

		function recipientInputValueToList(input) {
			var tagify = input?._kkTagify;
			if (tagify) {
				return (tagify.value || [])
					.map(function (item) { return normalizeEmailAddress(item.value); })
					.filter(Boolean);
			}
			return inputValueToList(input?.value);
		}

		function normalizeEmailAddress(value) {
			var text = String(value || '').trim();
			if (!text) return '';
			var bracketMatch = text.match(/<([^<>]+)>/);
			var address = bracketMatch ? bracketMatch[1] : text;
			var emailMatch = address.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
			return String(emailMatch ? emailMatch[0] : address).trim().toLowerCase();
		}

		function emailProjectId(email) {
			return String(email?.project?._id || email?.project || selectedProject || '');
		}

		function defaultDraftFrom(draft, email, identities) {
			var identityEmails = (identities || []).map(function (identity) {
				return normalizeEmailAddress(identity.email);
			});
			var draftFrom = normalizeEmailAddress(draft?.from);
			if (draftFrom && identityEmails.includes(draftFrom)) return draftFrom;
			var inboundRecipients = (email?.to || []).map(normalizeEmailAddress).filter(Boolean);
			for (var i = 0; i < inboundRecipients.length; i++) {
				if (identityEmails.includes(inboundRecipients[i])) return inboundRecipients[i];
			}
			return identityEmails[0] || '';
		}

		async function loadComposeEmailIdentities(email) {
			var projectId = emailProjectId(email);
			if (!projectId) return [];
			var res = await api('GET', '/projects/' + encodeURIComponent(projectId) + '/email-identities/compose');
			return res.identities || [];
		}

		function validateDraftRecipientCounts(payload) {
			['to', 'cc', 'bcc'].forEach(function (field) {
				if ((payload[field] || []).length > 10) {
					throw new Error(field + ' cannot contain more than 10 addresses');
				}
			});
		}

		function listSummary(items, fallback) {
			return (items || []).filter(Boolean).join(', ') || fallback || '';
		}

		function emailBody(email) {
			return [email?.text_content, email?.attachment_text_content].filter(Boolean).join('\n\n');
		}

		function cleanEmailText(value) {
			var lines = [];
			var rawLines = String(value || '')
				.split(/\r?\n/g)
				.map(function (line) {
					return line.trim();
				});
			for (var i = 0; i < rawLines.length; i++) {
				var line = rawLines[i];
				if (!line || line === '--') continue;
				if (/^-*\s*hmstopparser\s*-*$/i.test(line)
					|| /^on .{1,300}\b(wrote|replied):$/i.test(line)
					|| /^(from|sent|date|to|cc|subject)\s*:/i.test(line)) break;
				if (/^-+\s*please reply above this line\s*-+$/i.test(line)) continue;
				lines.push(line);
			}
			return lines
				.join('\n')
				.replace(/^--\s*/, '')
				.trim();
		}

		function emailExcerpt(email) {
			return email?.excerpt || cleanEmailText(email?.text_content || email?.attachment_text_content || '').replace(/\s+/g, ' ').slice(0, 180);
		}

		function emailHtmlFrameSrcdoc(html, loadRemoteImages) {
			return window.kkEmailIframeRenderer?.buildSrcdoc({
				html: html,
				loadRemoteImages: loadRemoteImages,
				theme: window.kkEmailIframeRenderer?.defaultTheme() || 'dark',
			}) || '';
		}

		function resizeEmailHtmlFrame(frame) {
			try {
				var doc = frame.contentDocument;
				if (!doc?.body) return;
				var height = Math.max(220, doc.documentElement.scrollHeight, doc.body.scrollHeight);
				frame.style.height = height + 'px';
			} catch {
				frame.style.height = '420px';
			}
		}

		function initEmailHtmlFrameResize(frame) {
			if (window.kkEmailIframeRenderer?.initResize) {
				window.kkEmailIframeRenderer.initResize(frame);
				return;
			}
			resizeEmailHtmlFrame(frame);
		}

		function emailHtmlWithRemoteImages(html, loadRemoteImages) {
			return window.kkEmailIframeRenderer?.htmlWithRemoteImages(html, loadRemoteImages) || html;
		}

		function renderBodyHtml(value, loadRemoteImages, theme, email) {
			var frame = document.createElement('iframe');
			frame.className = 'ecc-detail-html-frame';
			frame.title = 'Email HTML body';
			frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
			frame.setAttribute('referrerpolicy', 'no-referrer');
			initEmailHtmlFrameResize(frame);
			frame.srcdoc = window.kkEmailIframeRenderer?.buildSrcdoc({
				html: String(value || ''),
				loadRemoteImages: loadRemoteImages,
				theme: theme,
				subject: email?.subject || '',
				from: listSummary(email?.from, ''),
			}) || emailHtmlFrameSrcdoc(String(value || ''), loadRemoteImages);
			return frame;
		}

		function renderEmailBody(email) {
			var wrapper = document.createElement('div');
			var header = document.createElement('div');
			header.className = 'd-flex justify-content-end align-items-center gap-3 mb-2';

			var controls = document.createElement('div');
			controls.className = 'd-flex align-items-center gap-2 ecc-email-body-controls';
			var modeGroup = document.createElement('div');
			modeGroup.className = 'btn-group btn-group-sm';
			modeGroup.setAttribute('role', 'group');
			modeGroup.setAttribute('aria-label', 'Email body mode');
			var htmlBtn = textNode('button', 'btn btn-outline-secondary', 'HTML');
			htmlBtn.type = 'button';
			var textBtn = textNode('button', 'btn btn-outline-secondary', 'Text');
			textBtn.type = 'button';
			modeGroup.appendChild(htmlBtn);
			modeGroup.appendChild(textBtn);
			var themeGroup = document.createElement('div');
			themeGroup.className = 'btn-group btn-group-sm mx-2';
			themeGroup.setAttribute('role', 'group');
			themeGroup.setAttribute('aria-label', 'Email HTML theme');
			var darkBtn = textNode('button', 'btn btn-outline-secondary', 'Dark');
			darkBtn.type = 'button';
			var originalBtn = textNode('button', 'btn btn-outline-secondary', 'Original');
			originalBtn.type = 'button';
			themeGroup.appendChild(darkBtn);
			themeGroup.appendChild(originalBtn);
			var loadImagesBtn = textNode('button', 'btn btn-outline-secondary btn-sm', 'Load images');
			loadImagesBtn.type = 'button';
			var replyBtn = textNode('button', 'btn btn-outline-primary btn-sm', 'Reply');
			replyBtn.type = 'button';
			controls.appendChild(modeGroup);
			controls.appendChild(themeGroup);
			controls.appendChild(loadImagesBtn);
			controls.appendChild(replyBtn);
			header.appendChild(controls);
			wrapper.appendChild(header);

			var replyWrap = document.createElement('div');
			replyWrap.className = 'ecc-inline-reply-wrap d-none mb-3';
			wrapper.appendChild(replyWrap);

			var bodyWrap = document.createElement('div');
			wrapper.appendChild(bodyWrap);

			var html = email?.html_content || '';
			var text = emailBody(email);
			var hasHtml = Boolean(html);
			var hasText = Boolean(cleanEmailText(text));
			var hasRemoteImages = hasHtml && Boolean(email?.html_content_has_remote_images);
			var remoteImagesLoaded = false;
			var mode = hasHtml ? 'html' : 'text';
			var theme = window.kkEmailIframeRenderer?.defaultTheme() || 'dark';

			function render() {
				htmlBtn.disabled = !hasHtml;
				textBtn.disabled = !hasText;
				htmlBtn.classList.toggle('active', mode === 'html');
				textBtn.classList.toggle('active', mode === 'text');
				darkBtn.classList.toggle('active', theme === 'dark');
				originalBtn.classList.toggle('active', theme === 'original');
				themeGroup.classList.toggle('d-none', !hasHtml || mode !== 'html');
				loadImagesBtn.classList.toggle('d-none', !hasRemoteImages || remoteImagesLoaded || mode !== 'html');
				replaceChildren(bodyWrap);
				if (mode === 'html' && hasHtml) {
					var htmlValue = emailHtmlWithRemoteImages(html, remoteImagesLoaded);
					bodyWrap.appendChild(renderBodyHtml(htmlValue, remoteImagesLoaded, theme, email));
				} else {
					bodyWrap.appendChild(renderBodyText(text || '(empty)'));
				}
			}

			htmlBtn.addEventListener('click', function () {
				if (!hasHtml) return;
				mode = 'html';
				render();
			});
			textBtn.addEventListener('click', function () {
				if (!hasText) return;
				mode = 'text';
				render();
			});
			darkBtn.addEventListener('click', function () {
				theme = 'dark';
				mode = 'html';
				render();
			});
			originalBtn.addEventListener('click', function () {
				theme = 'original';
				mode = 'html';
				render();
			});
			loadImagesBtn.addEventListener('click', function () {
				remoteImagesLoaded = true;
				mode = 'html';
				render();
			});
			replyBtn.addEventListener('click', function () {
				openReplyEditor(email, replyWrap);
			});

			render();
			return wrapper;
		}

		function normalizeEccMailbox(value) {
			var mailbox = String(value || '').trim();
			return ['inbox', 'archived', 'sent', 'spam', 'drafts', 'trash'].includes(mailbox) ? mailbox : 'inbox';
		}

		function readUrlState() {
			var params = new URLSearchParams(window.location.search);
			var raw = params.get('g');
			if (!raw || !window.JSURL) return {};
			return window.JSURL.tryParse(raw, {}) || {};
		}

		function applyUrlState() {
			var state = readUrlState();
			var ecc = state.ecc || {};
			selectedProject = String(state.project_id || '');
			if (ecc.label) {
				activeLabel = String(ecc.label || '');
				activeMailbox = '';
			} else {
				activeLabel = '';
				activeMailbox = normalizeEccMailbox(ecc.mailbox || 'inbox');
			}
			pendingEmailId = String(ecc.email_id || '');
		}

		function writeUrlState(emailIdOverride) {
			if (!window.JSURL || window.location.pathname !== '/ecc') return;
			var state = readUrlState();
			if (selectedProject) {
				state.project_id = selectedProject;
				window.currentProjectId = selectedProject;
			} else {
				delete state.project_id;
				window.currentProjectId = null;
			}
			state.ecc = {};
			if (activeLabel) {
				state.ecc.label = activeLabel;
			} else {
				state.ecc.mailbox = activeMailbox || 'inbox';
			}
			var emailIdValue = emailIdOverride === undefined ? (detailActive ? emailId(selectedEmail) : '') : emailIdOverride;
			if (emailIdValue) state.ecc.email_id = emailIdValue;
			var qs = '?g=' + window.JSURL.stringify(state);
			history.replaceState({ spaPath: '/ecc' }, '', '/ecc' + qs);
		}

		function renderBodyText(value) {
			var body = document.createElement('div');
			body.className = 'ecc-detail-body';
			var raw = cleanEmailText(value) || '(empty)';
			var lines = raw.split(/\r?\n/);
			lines.forEach(function (line) {
				var row = document.createElement('div');
				var trimmed = line.trim();
				row.className = 'ecc-detail-body-line';
				if (!trimmed) row.classList.add('is-empty');
				if (/^(>|&gt;)/.test(trimmed) || /^on .+wrote:$/i.test(trimmed)) row.classList.add('is-quoted');
				if (/^(\*?(from|de|sent|envoy|envoye|to|a|subject|objet)\s*:)/i.test(trimmed)) row.classList.add('is-meta');
				row.textContent = line || ' ';
				body.appendChild(row);
			});
			return body;
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
		var enabled = !detailActive && activeMailbox !== 'drafts' && checkboxes.length > 0;
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
		triageBtn.classList.toggle('d-none', detailActive || activeLabel || activeMailbox !== 'inbox');
	}

	function updateActionBar() {
		if (!actionBar || !actionCount) return;
		var count = selectedIds.size;
		actionCount.textContent = count + ' selected';
		actionBar.classList.toggle('d-none', detailActive || count === 0 || activeMailbox === 'drafts');
		actionBar.classList.toggle('d-flex', !detailActive && count > 0 && activeMailbox !== 'drafts');
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
		if (!aiPanel) return;
		if (!email) {
			if (aiSubtitle) aiSubtitle.textContent = 'No email active.';
			openEmailBtn?.classList.add('d-none');
			internalNotesEl = null;
			currentInternalNotes = [];
			renderEmailListAi();
			return;
		}
		var subject = email.subject || '(No subject)';
		var labels = renderVisibleLabels(email);
		var summary = String(email.triage_summary || '').trim();
		if (aiSubtitle) aiSubtitle.textContent = subject;
		openEmailBtn?.classList.remove('d-none');
		aiPanel.innerHTML = '<div class="ecc-ai-content">'
			+ '<div class="ecc-ai-section">'
			+ '<h6 class="mb-2">Summary</h6>'
			+ (summary
				? '<p class="mb-3">' + escapeHtml(summary) + '</p>'
				: '<button type="button" class="btn btn-outline-primary btn-sm mb-3" id="ecc-email-summarize">Summarize email</button>')
			+ (labels ? '<div>' + labels + '</div>' : '')
			+ '</div>'
			+ '<div class="ecc-ai-section ecc-internal-notes" data-ecc-internal-notes>'
			+ '<div class="d-flex justify-content-between align-items-center gap-2 mb-3">'
			+ '<div class="d-flex align-items-center gap-2 min-w-0">'
			+ '<h6 class="mb-0">Internal notes</h6>'
			+ '<span class="badge text-bg-light">Private</span>'
			+ '</div>'
			+ '<button type="button" class="btn btn-outline-primary btn-sm ecc-internal-note-open">Add note</button>'
			+ '</div>'
			+ '<div class="ecc-internal-note-editor d-none mb-3"></div>'
			+ '<div class="ecc-internal-notes-list"></div>'
			+ '</div>'
			+ '<div class="ecc-ai-section">'
			+ '<div class="d-flex justify-content-between align-items-center gap-2 mb-3">'
			+ '<h6 class="mb-0">Reply options</h6>'
			+ '<button type="button" class="btn btn-outline-primary btn-sm" id="ecc-email-suggest-reply">Suggest a reply</button>'
			+ '</div>'
			+ '<div class="ecc-email-reply-suggestions" id="ecc-email-reply-suggestions"></div>'
			+ '</div>'
			+ '<div class="ecc-ai-section ecc-email-chat">'
			+ '<h6 class="mb-2">Ask Email AI</h6>'
			+ '<div class="ecc-email-ai-messages" id="ecc-email-ai-messages"></div>'
			+ '<div class="ecc-email-ai-composer">'
			+ '<label class="form-label small mb-1" for="ecc-email-ai-input">Message</label>'
			+ '<div class="input-group input-group-sm">'
			+ '<input type="text" class="form-control form-control-sm" id="ecc-email-ai-input" autocomplete="off">'
			+ '<button type="button" class="btn btn-primary btn-sm" id="ecc-email-ai-send" title="Send">'
			+ kkIcon('send')
			+ '</button>'
			+ '</div>'
			+ '</div>'
			+ '</div>'
			+ '</div>';
		internalNotesEl = aiPanel.querySelector('[data-ecc-internal-notes]');
		aiMessagesEl = document.getElementById('ecc-email-ai-messages');
		aiInputEl = document.getElementById('ecc-email-ai-input');
		aiSendBtn = document.getElementById('ecc-email-ai-send');
		internalNotesEl?.querySelector('.ecc-internal-note-open')?.addEventListener('click', function () {
			openInternalNoteEditor(email, { mode: 'add' });
		});
		loadInternalNotes(email);
		renderEmailAiMessages();
		renderReplySuggestions();
		document.getElementById('ecc-email-summarize')?.addEventListener('click', summarizeSelectedEmail);
		document.getElementById('ecc-email-suggest-reply')?.addEventListener('click', suggestEmailReplies);
		aiSendBtn?.addEventListener('click', sendEmailAiMessage);
		aiInputEl?.addEventListener('keydown', function (event) {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				sendEmailAiMessage();
			}
		});
	}

	function renderReplySuggestions(loadingText) {
		var el = document.getElementById('ecc-email-reply-suggestions');
		if (!el) return;
		if (loadingText) {
			el.innerHTML = '<div class="text-muted small">' + escapeHtml(loadingText) + '</div>';
			return;
		}
		if (!emailReplySuggestions.length) {
			el.innerHTML = '<div class="text-muted small">No reply suggestions yet.</div>';
			return;
		}
		el.innerHTML = emailReplySuggestions.map(function (reply, index) {
			return '<div class="ecc-email-reply-option mb-3">'
				+ '<div class="small fw-semibold mb-2">' + escapeHtml(reply.title || ('Reply ' + (index + 1))) + '</div>'
				+ '<div class="small mb-2 text-break">' + escapeHtml(reply.body_text || '') + '</div>'
				+ '<button type="button" class="btn btn-primary btn-sm ecc-email-use-reply" data-index="' + index + '">Use reply</button>'
				+ '</div>';
		}).join('');
		el.querySelectorAll('.ecc-email-use-reply').forEach(function (button) {
			button.addEventListener('click', useReplySuggestion);
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

	async function summarizeSelectedEmail() {
		if (!selectedEmail) return;
		var button = document.getElementById('ecc-email-summarize');
		if (button) {
			button.disabled = true;
			button.textContent = 'Summarizing...';
		}
		try {
			var res = await api('POST', '/emails/' + encodeURIComponent(selectedEmail._id) + '/summarize', {});
			if (res.email) {
				selectedEmail = res.email;
			} else {
				selectedEmail.triage_summary = res.summary || '';
			}
			renderEmailAi(selectedEmail);
		} catch (err) {
			showError(err.message || 'Failed to summarize email');
			if (button) {
				button.disabled = false;
				button.textContent = 'Summarize email';
			}
		}
	}

	async function suggestEmailReplies() {
		if (!selectedEmail) return;
		var button = document.getElementById('ecc-email-suggest-reply');
		if (button) button.disabled = true;
		renderReplySuggestions('Writing reply options...');
		try {
			var res = await api('POST', '/emails/' + encodeURIComponent(selectedEmail._id) + '/suggest-replies', {});
			emailReplySuggestions = res.replies || [];
			renderReplySuggestions();
		} catch (err) {
			emailReplySuggestions = [];
			renderReplySuggestions();
			showError(err.message || 'Failed to suggest replies');
		} finally {
			if (button) button.disabled = false;
		}
	}

	async function useReplySuggestion(event) {
		if (!selectedEmail) return;
		var button = event.currentTarget;
		var reply = emailReplySuggestions[parseInt(button.dataset.index, 10)];
		if (!reply?.body_text) return;
		button.disabled = true;
		button.textContent = 'Using...';
		try {
			var res = await api('POST', '/emails/' + encodeURIComponent(selectedEmail._id) + '/draft-reply', {
				body_text: reply.body_text,
			});
			renderDraftDetail(res.draft || null);
			showSuccess('Draft reply updated');
		} catch (err) {
			showError(err.message || 'Failed to use reply');
		} finally {
			button.disabled = false;
			button.textContent = 'Use reply';
		}
	}

	async function sendEmailAiMessage() {
		if (!aiInputEl || !aiSendBtn) return;
		var query = aiInputEl.value.trim();
		if (!query) return;
		emailAiMessages.push({ role: 'user', text: query });
		aiInputEl.value = '';
		aiSendBtn.disabled = true;
		renderEmailAiMessages();
		try {
			var res = selectedEmail
				? await api('POST', '/emails/' + selectedEmail._id + '/ai', { query: query })
				: await api('POST', '/emails/ai', { query: query, scope: currentEmailAiScope() });
			emailAiMessages.push({ role: 'assistant', text: res.answer || '' });
			if (!selectedEmail && Array.isArray(res.emails) && res.mode !== 'count') {
				renderEmailAiResultEmails(res.emails, res.answer || '', res.count || 0);
			}
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
				pendingEmailId = '';
				writeUrlState('');
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

		function showListView() {
			detailActive = false;
			destroyDraftEditor();
			destroyNoteEditor();
			internalNotesEl?.classList.add('d-none');
			viewHeader?.classList.remove('d-none');
			listWrap?.classList.remove('d-none');
			detailEl?.classList.add('d-none');
			updateActionBar();
		}

			function backToListView() {
				selectedEmail = null;
				pendingEmailId = '';
				showListView();
				renderEmailAi(null);
				writeUrlState('');
			}

		function showDetailView() {
			detailActive = true;
			viewHeader?.classList.add('d-none');
			listWrap?.classList.add('d-none');
			detailEl?.classList.remove('d-none');
			updateActionBar();
		}

		function showDetailLoading(emailId) {
			showDetailView();
			if (detailTitle) detailTitle.textContent = 'Loading email';
			if (detailSubtitle) detailSubtitle.textContent = emailId || '';
			if (detailDate) detailDate.textContent = '';
			if (detailDraftEl) {
				replaceChildren(detailDraftEl);
				detailDraftEl.appendChild(textNode('div', 'text-muted small', 'Loading draft.'));
			}
			if (detailThreadEl) {
				replaceChildren(detailThreadEl);
				detailThreadEl.appendChild(textNode('div', 'list-group-item text-muted', 'Loading thread.'));
			}
			renderInternalNotesPanel(null);
		}

		function currentEmailAiScope() {
			return {
				project: selectedProject || '',
				mailbox: activeLabel ? '' : (activeMailbox || ''),
				label: activeLabel || '',
				triaged: !activeLabel && activeMailbox === 'inbox' ? false : undefined,
			};
		}

		function renderEmailAiResultEmails(emails, answer, count) {
			if (!listEl) return;
			showListView();
			selectedEmail = null;
			selectedIds.clear();
			updateActionBar();
			renderMoveMenu();
			if (viewTitle) viewTitle.textContent = 'Email AI results';
			if (viewSubtitle) {
				var total = Number.isFinite(count) ? count : emails.length;
				viewSubtitle.textContent = total === 1 ? '1 matching email.' : total + ' matching emails.';
			}
			if (!emails.length) {
				listEl.innerHTML = '<div class="list-group-item text-muted ecc-email-empty">' + escapeHtml(answer || 'No matching emails.') + '</div>';
				updateActionBar();
				return;
			}
			listEl.innerHTML = emails.map(renderEmailItemHtml).join('');
			listEl.querySelectorAll('.ecc-email-item').forEach(function (button) {
				bindEmailItem(button);
			});
			updateActionBar();
		}

		function showDetailError(message) {
			showDetailView();
			if (detailTitle) detailTitle.textContent = 'Email detail';
			if (detailSubtitle) detailSubtitle.textContent = 'Unable to load email.';
			if (detailDate) detailDate.textContent = '';
			if (detailDraftEl) replaceChildren(detailDraftEl);
			if (detailThreadEl) {
				replaceChildren(detailThreadEl);
				detailThreadEl.appendChild(textNode('div', 'list-group-item text-danger', message || 'Failed to load email.'));
			}
			renderInternalNotesPanel(null);
		}

		function destroyDraftEditor() {
			if (draftAutosaveTimer) {
				clearInterval(draftAutosaveTimer);
				draftAutosaveTimer = null;
			}
			draftAutosaveDirty = false;
			draftAutosaveSaving = false;
			draftRecipientTagifies.forEach(function (tagify) {
				try {
					tagify.destroy();
				} catch {
					// Editor teardown should continue even if Tagify already removed itself.
				}
			});
			draftRecipientTagifies = [];
			if (draftEditor) {
				draftEditor.destroy();
				draftEditor = null;
			}
			if (draftEditorHost) {
				draftEditorHost.innerHTML = '';
				draftEditorHost.classList.add('d-none');
				draftEditorHost = null;
			}
		}

		function destroyNoteEditor() {
			if (noteEditor) {
				noteEditor.destroy();
				noteEditor = null;
			}
			if (noteEditorHost) {
				noteEditorHost.innerHTML = '';
				noteEditorHost.classList.add('d-none');
				noteEditorHost = null;
				return;
			}
			var noteEditorEls = internalNotesEl?.querySelectorAll('.ecc-internal-note-editor, .ecc-internal-note-inline-editor') || [];
			noteEditorEls.forEach(function (noteEditorEl) {
				noteEditorEl.innerHTML = '';
				noteEditorEl.classList.add('d-none');
			});
		}

		function resetNoteEditorHosts() {
			var noteEditorEls = internalNotesEl?.querySelectorAll('.ecc-internal-note-editor, .ecc-internal-note-inline-editor') || [];
			noteEditorEls.forEach(function (noteEditorEl) {
				noteEditorEl.innerHTML = '';
				noteEditorEl.classList.add('d-none');
			});
			noteEditorHost = null;
		}

		function objectIdValue(value) {
			return String(value?._id || value || '');
		}

		function internalNoteId(note) {
			return objectIdValue(note?._id || note?.id);
		}

		function internalNoteParentId(note) {
			return objectIdValue(note?.parent_note);
		}

		function internalNoteOwner(note) {
			return note?.owner?.name || note?.owner?.email || 'Team member';
		}

		function internalNoteContent(note) {
			return note?.content || plainTextToHtml(note?.text_content || '');
		}

		function internalNotePreview(note) {
			var text = String(note?.text_content || '').trim();
			if (!text) text = String(note?.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
			return text.length > INTERNAL_NOTE_PREVIEW_LIMIT
				? text.slice(0, INTERNAL_NOTE_PREVIEW_LIMIT).trim() + '...'
				: text;
		}

		function internalNoteIsLong(note) {
			return String(note?.text_content || '').trim().length > INTERNAL_NOTE_PREVIEW_LIMIT;
		}

		function internalNoteTime(note) {
			var time = new Date(note?.createdAt || note?.updatedAt || 0).getTime();
			return Number.isFinite(time) ? time : 0;
		}

		function groupInternalNotes(notes) {
			var byId = new Map();
			var roots = [];
			(notes || []).forEach(function (note) {
				note._children = [];
				byId.set(internalNoteId(note), note);
			});
			(notes || []).forEach(function (note) {
				var parentId = internalNoteParentId(note);
				var parent = parentId ? byId.get(parentId) : null;
				if (parent) {
					parent._children.push(note);
				} else {
					roots.push(note);
				}
			});
			byId.forEach(function (note) {
				note._children.sort(function (a, b) {
					return internalNoteTime(a) - internalNoteTime(b);
				});
			});
			roots.sort(function (a, b) {
				return internalNoteTime(b) - internalNoteTime(a);
			});
			return roots;
		}

		function suppressNextInternalNoteSocket(eventName, detail) {
			pendingInternalNoteSocketEvents.push({
				eventName: eventName,
				client_request_id: String(detail?.client_request_id || ''),
				source_email: String(detail?.source_email || ''),
				parent_note: String(detail?.parent_note || ''),
				expiresAt: Date.now() + 3000,
			});
		}

		function consumeSuppressedInternalNoteSocket(eventName, detail) {
			var now = Date.now();
			pendingInternalNoteSocketEvents = pendingInternalNoteSocketEvents.filter(function (item) {
				return item.expiresAt > now;
			});
			var index = pendingInternalNoteSocketEvents.findIndex(function (item) {
				if (item.client_request_id && item.client_request_id === String(detail?.client_request_id || '')) return item.eventName === eventName;
				return item.eventName === eventName
					&& (!item.source_email || item.source_email === String(detail?.source_email || ''))
					&& (!item.parent_note || item.parent_note === String(detail?.parent_note || ''));
			});
			if (index < 0) return false;
			pendingInternalNoteSocketEvents.splice(index, 1);
			return true;
		}

		function internalNoteClientRequestId() {
			if (window.crypto?.randomUUID) return window.crypto.randomUUID();
			return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
		}

		function eventAffectsSelectedThread(detail) {
			if (!selectedEmail?._id || !detail) return false;
			var sourceIds = Array.isArray(detail.thread_source_ids) ? detail.thread_source_ids.map(String) : [];
			var selectedIds = selectedEmailThreadSourceIds.length ? selectedEmailThreadSourceIds : [emailId(selectedEmail)];
			if (sourceIds.some(function (sourceId) { return selectedIds.includes(sourceId); })) return true;
			return selectedIds.includes(String(detail.source_email || ''));
		}

		function handleInternalNoteSocketEvent(event) {
			var detail = event.detail || {};
			if (consumeSuppressedInternalNoteSocket(event.type, detail)) return;
			if (!detailActive || !eventAffectsSelectedThread(detail)) return;
			loadInternalNotes(selectedEmail);
		}

		function bindInternalNoteActions(email) {
			if (!internalNotesEl || !email?._id) return;
			internalNotesEl.querySelectorAll('.ecc-internal-note-toggle').forEach(function (button) {
				button.addEventListener('click', function () {
					var noteEl = button.closest('.ecc-internal-note');
					var expanded = noteEl?.classList.toggle('is-expanded');
					button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
				});
			});
			internalNotesEl.querySelectorAll('.ecc-internal-note-reply').forEach(function (button) {
				button.addEventListener('click', function () {
					var note = currentInternalNotes.find(function (item) { return internalNoteId(item) === button.dataset.noteId; });
					openInternalNoteEditor(email, { mode: 'reply', parentNoteId: button.dataset.noteId, note: note });
				});
			});
			internalNotesEl.querySelectorAll('.ecc-internal-note-edit').forEach(function (button) {
				button.addEventListener('click', function () {
					var note = currentInternalNotes.find(function (item) { return internalNoteId(item) === button.dataset.noteId; });
					if (note) openInternalNoteEditor(email, { mode: 'edit', note: note });
				});
			});
			internalNotesEl.querySelectorAll('.ecc-internal-note-delete').forEach(function (button) {
				button.addEventListener('click', function () {
					deleteInternalNote(email, button.dataset.noteId);
				});
			});
		}

		function renderInternalNote(note, email, depth) {
			var id = internalNoteId(note);
			var children = note._children || [];
			var hasReplies = children.length > 0;
			var isLong = internalNoteIsLong(note);
			var depthClass = depth > 0 ? ' ecc-internal-note-reply-item' : '';
			return '<div class="ecc-internal-note' + depthClass + '" data-note-id="' + escapeHtml(id) + '">'
				+ '<div class="d-flex justify-content-between gap-2 ecc-internal-note-meta mb-1">'
				+ '<span class="fw-semibold text-truncate">' + escapeHtml(internalNoteOwner(note)) + '</span>'
				+ '<time class="text-muted text-nowrap">' + escapeHtml(formatDateTime(note.createdAt)) + '</time>'
				+ '</div>'
				+ '<div class="ecc-internal-note-preview">' + escapeHtml(internalNotePreview(note)) + '</div>'
				+ '<div class="ecc-internal-note-body">' + internalNoteContent(note) + '</div>'
				+ (isLong
					? '<button type="button" class="btn btn-link btn-sm p-0 ecc-internal-note-toggle" aria-expanded="false">'
						+ kkIcon('arrow_drop_down', 'me-1')
						+ '<span>read more</span>'
						+ '</button>'
					: '')
				+ '<div class="d-flex align-items-center gap-3 mt-2 ecc-internal-note-actions">'
				+ '<button type="button" class="btn btn-link btn-sm p-0 ecc-internal-note-reply" data-note-id="' + escapeHtml(id) + '">Reply</button>'
				+ '<button type="button" class="btn btn-link btn-sm p-0 ecc-internal-note-edit" data-note-id="' + escapeHtml(id) + '">Edit</button>'
				+ (hasReplies ? '' : '<button type="button" class="btn btn-link btn-sm p-0 text-danger ecc-internal-note-delete" data-note-id="' + escapeHtml(id) + '">Delete</button>')
				+ '</div>'
				+ '<div class="ecc-internal-note-inline-editor d-none mt-2" data-note-editor-host="' + escapeHtml(id) + '"></div>'
				+ (children.length
					? '<div class="ecc-internal-note-replies">' + children.map(function (child) {
						return renderInternalNote(child, email, depth + 1);
					}).join('') + '</div>'
					: '')
				+ '</div>';
		}

		async function deleteInternalNote(email, noteId) {
			if (!email?._id || !noteId) return;
			var confirmed = await confirmAction('Delete internal note', 'This internal note will be deleted.');
			if (!confirmed) return;
			var clientRequestId = internalNoteClientRequestId();
			suppressNextInternalNoteSocket('email-internal-note:deleted', { client_request_id: clientRequestId });
			try {
				await api('DELETE', '/emails/' + encodeURIComponent(email._id) + '/internal-notes/' + encodeURIComponent(noteId) + '?client_request_id=' + encodeURIComponent(clientRequestId));
				await loadInternalNotes(email);
				showSuccess('Internal note deleted');
			} catch (err) {
				showError(err.message || 'Failed to delete internal note');
			}
		}

		function initEmailEditor(container, content, placeholder, onUpdate) {
			container.innerHTML = '';
			if (window.KumbukumEditor?.createEmailEditor) {
				return window.KumbukumEditor.createEmailEditor(container, {
					content: content || '',
					placeholder: placeholder || 'Write...',
					onUpdate: onUpdate || null,
				});
			}
			var fallback = document.createElement('div');
			fallback.className = 'form-control form-control-sm';
			fallback.contentEditable = 'true';
			fallback.innerHTML = content || '';
			if (onUpdate) fallback.addEventListener('input', onUpdate);
			container.appendChild(fallback);
			return {
				getHTML: function () { return fallback.innerHTML; },
				getText: function () { return fallback.textContent || ''; },
				commands: {
					setContent: function (nextContent) { fallback.innerHTML = nextContent || ''; },
				},
				destroy: function () {},
			};
		}

		function draftEditorContent(draft) {
			return draft?.body_html || plainTextToHtml(draft?.body_text || '');
		}

		function recipientSuggestionPath(email, query) {
			var projectId = emailProjectId(email);
			var path = '/emails/from-addresses?q=' + encodeURIComponent(query || '') + '&limit=10';
			if (projectId) path += '&project=' + encodeURIComponent(projectId);
			return path;
		}

		function setupDraftRecipientTagify(input, email, initialItems, markDirty) {
			var initial = (initialItems || []).map(normalizeEmailAddress).filter(Boolean);
			input.value = '';
			if (!window.Tagify) {
				input.value = listToInputValue(initial);
				input.addEventListener('input', markDirty);
				return null;
			}

			var tagify = new window.Tagify(input, {
				delimiters: ',|\n',
				enforceWhitelist: false,
				maxTags: 10,
				trim: true,
				dropdown: {
					enabled: 1,
					maxItems: 10,
					closeOnSelect: true,
					highlightFirst: true,
				},
				validate: function (tagData) {
					return DRAFT_EMAIL_RE.test(normalizeEmailAddress(tagData.value));
				},
				transformTag: function (tagData) {
					tagData.value = normalizeEmailAddress(tagData.value);
				},
			});

			input._kkTagify = tagify;
			draftRecipientTagifies.push(tagify);
			if (initial.length) tagify.addTags(initial, true);

			tagify.on('input', function (event) {
				var query = String(event.detail.value || '').trim();
				if (query.length < 2) return;
				tagify.loading(true);
				api('GET', recipientSuggestionPath(email, query))
					.then(function (res) {
						tagify.settings.whitelist = (res.addresses || []).map(function (address) {
							return { value: address };
						});
						tagify.loading(false);
						tagify.dropdown.show(query);
					})
					.catch(function () {
						tagify.settings.whitelist = [];
						tagify.loading(false);
						tagify.dropdown.hide();
					});
			});
			tagify.on('add', markDirty);
			tagify.on('remove', markDirty);
			tagify.on('edit:updated', markDirty);
			tagify.on('invalid', function (event) {
				if (event.detail?.message) setDraftSaveStatus(input.closest('.ecc-detail-draft'), event.detail.message, 'error');
			});
			return tagify;
		}

		function draftPayloadFromForm(card) {
			var payload = {
				from: card.querySelector('.ecc-draft-from')?.value || '',
				to: recipientInputValueToList(card.querySelector('.ecc-draft-to')),
				cc: recipientInputValueToList(card.querySelector('.ecc-draft-cc')),
				bcc: recipientInputValueToList(card.querySelector('.ecc-draft-bcc')),
				subject: card.querySelector('.ecc-draft-subject')?.value || '',
				body_html: draftEditor?.getHTML?.() || '',
				body_text: draftEditor?.getText?.() || '',
				status: 'draft',
			};
			validateDraftRecipientCounts(payload);
			return payload;
		}

		function setDraftSaveStatus(card, text, tone) {
			var status = card?.querySelector('.ecc-draft-save-status');
			if (!status) return;
			status.textContent = text || '';
			status.classList.toggle('text-danger', tone === 'error');
			status.classList.toggle('text-muted', tone !== 'error');
		}

		async function saveDraftFromCard(card, draft, sourceEmail, options) {
			var silent = Boolean(options?.silent);
			var replyEmail = sourceEmail || selectedEmail;
			if (!replyEmail || !card) return;
			var button = card.querySelector('.ecc-draft-save');
			if (button && !silent) button.disabled = true;
			if (silent) setDraftSaveStatus(card, 'Saving...', '');
			try {
				var payload = draftPayloadFromForm(card);
				var res = draft?._id
					? await api('PUT', '/email-drafts/' + encodeURIComponent(draft._id), payload)
					: await api('POST', '/emails/' + encodeURIComponent(replyEmail._id) + '/draft-reply', payload);
				currentDraft = res.draft || null;
				draftAutosaveDirty = false;
				setDraftSaveStatus(card, 'Saved', '');
				if (!silent) {
					destroyDraftEditor();
					showSuccess('Draft saved');
				}
				if (activeMailbox === 'drafts') loadLabels().catch(() => {});
			} catch (err) {
				if (silent) {
					setDraftSaveStatus(card, err.message || 'Autosave failed', 'error');
				} else {
					showError(err.message || 'Failed to save draft');
					if (button) button.disabled = false;
				}
			}
		}

		function startDraftAutosave(card, email) {
			draftAutosaveDirty = false;
			draftAutosaveSaving = false;
			draftAutosaveTimer = setInterval(async function () {
				if (!draftAutosaveDirty || draftAutosaveSaving) return;
				draftAutosaveSaving = true;
				try {
					await saveDraftFromCard(card, currentDraft, email, { silent: true });
				} catch {
					// Status is already shown inline.
				} finally {
					draftAutosaveSaving = false;
				}
			}, 15000);
		}

		function renderDraftDetail(draft) {
			if (!detailDraftEl) return;
			destroyDraftEditor();
			currentDraft = draft || null;
			replaceChildren(detailDraftEl);
		}

		async function openReplyEditor(email, host) {
			if (!email?._id || !host) return;
			destroyDraftEditor();
			draftEditorHost = host;
			host.classList.remove('d-none');
			host.innerHTML = '<div class="text-muted small mb-3">Loading draft editor...</div>';

			var draft = currentDraft || null;
			var identities = [];
			try {
				identities = await loadComposeEmailIdentities(email);
			} catch {
				identities = [];
			}
			host.innerHTML = '';

			var card = document.createElement('div');
			card.className = 'ecc-detail-card ecc-detail-draft ecc-inline-reply';
			var markDirty = function () {
				draftAutosaveDirty = true;
				setDraftSaveStatus(card, '', '');
			};

			var header = document.createElement('div');
			header.className = 'd-flex justify-content-between align-items-start gap-3 mb-3';
			var titleWrap = document.createElement('div');
			titleWrap.className = 'min-w-0';
			titleWrap.appendChild(textNode('h6', 'mb-1 text-truncate', draft ? 'Draft reply' : 'New draft reply'));
			titleWrap.appendChild(textNode('div', 'small text-muted', 'Autosaves every 15 seconds.'));
			header.appendChild(titleWrap);
			if (draft?.updatedAt) header.appendChild(textNode('small', 'text-muted text-nowrap', formatDateTime(draft.updatedAt)));
			card.appendChild(header);

			var fields = document.createElement('div');
			fields.className = 'ecc-draft-fields';
			fields.innerHTML = ''
				+ '<div class="ecc-draft-row mb-2"><label class="form-label small mb-0">From:</label><select class="form-select form-select-sm ecc-draft-from"></select></div>'
				+ '<div class="small text-danger mb-2 d-none ecc-draft-identity-warning">No outbound email addresses configured for this project.</div>'
				+ '<div class="ecc-draft-row mb-2"><label class="form-label small mb-0">To:</label><div class="d-flex align-items-center gap-1 min-w-0"><div class="ecc-recipient-control flex-grow-1"><input type="text" class="form-control form-control-sm ecc-draft-to" autocomplete="off"></div><button class="btn btn-outline-secondary btn-sm ecc-draft-show-cc" type="button">Cc</button><button class="btn btn-outline-secondary btn-sm ecc-draft-show-bcc" type="button">Bcc</button></div></div>'
				+ '<div class="ecc-draft-row mb-2 d-none ecc-draft-cc-row"><label class="form-label small mb-0">Cc:</label><div class="ecc-recipient-control"><input type="text" class="form-control form-control-sm ecc-draft-cc" autocomplete="off"></div></div>'
				+ '<div class="ecc-draft-row mb-2 d-none ecc-draft-bcc-row"><label class="form-label small mb-0">Bcc:</label><div class="ecc-recipient-control"><input type="text" class="form-control form-control-sm ecc-draft-bcc" autocomplete="off"></div></div>'
				+ '<div class="ecc-draft-row mb-2"><label class="form-label small mb-0">Subject:</label><input type="text" class="form-control form-control-sm ecc-draft-subject"></div>'
				+ '<div class="mb-3">'
				+ '<label class="form-label small mb-1">Message</label>'
				+ '<div class="ecc-draft-editor"></div>'
				+ '</div>'
			card.appendChild(fields);

			var fromSelect = fields.querySelector('.ecc-draft-from');
			fromSelect.innerHTML = identities.map(function (identity) {
				var label = (identity.name ? identity.name + ' <' + identity.email + '>' : identity.email);
				return '<option value="' + escapeHtml(normalizeEmailAddress(identity.email)) + '">' + escapeHtml(label) + '</option>';
			}).join('');
			fromSelect.value = defaultDraftFrom(draft, email, identities);
			fromSelect.disabled = identities.length === 0;
			fields.querySelector('.ecc-draft-identity-warning')?.classList.toggle('d-none', identities.length > 0);
			fields.querySelector('.ecc-draft-subject').value = draft?.subject || (email?.subject ? 'Re: ' + email.subject : '');
			fields.querySelector('.ecc-draft-cc-row')?.classList.toggle('d-none', !(draft?.cc || []).length);
			fields.querySelector('.ecc-draft-bcc-row')?.classList.toggle('d-none', !(draft?.bcc || []).length);
			fields.querySelector('.ecc-draft-show-cc')?.classList.toggle('d-none', Boolean((draft?.cc || []).length));
			fields.querySelector('.ecc-draft-show-bcc')?.classList.toggle('d-none', Boolean((draft?.bcc || []).length));
			draftEditor = initEmailEditor(fields.querySelector('.ecc-draft-editor'), draftEditorContent(draft), 'Write a reply...', markDirty);
			fields.querySelectorAll('input, select').forEach(function (input) {
				if (!input.classList.contains('ecc-draft-to') && !input.classList.contains('ecc-draft-cc') && !input.classList.contains('ecc-draft-bcc')) input.addEventListener('input', markDirty);
				input.addEventListener('change', markDirty);
			});
			setupDraftRecipientTagify(fields.querySelector('.ecc-draft-to'), email, draft?.to?.length ? draft.to : (email?.from || []), markDirty);
			setupDraftRecipientTagify(fields.querySelector('.ecc-draft-cc'), email, draft?.cc || [], markDirty);
			setupDraftRecipientTagify(fields.querySelector('.ecc-draft-bcc'), email, draft?.bcc || [], markDirty);
			fields.querySelector('.ecc-draft-show-cc')?.addEventListener('click', function () {
				fields.querySelector('.ecc-draft-cc-row')?.classList.remove('d-none');
				fields.querySelector('.ecc-draft-show-cc')?.classList.add('d-none');
				fields.querySelector('.ecc-draft-cc')?.focus();
			});
			fields.querySelector('.ecc-draft-show-bcc')?.addEventListener('click', function () {
				fields.querySelector('.ecc-draft-bcc-row')?.classList.remove('d-none');
				fields.querySelector('.ecc-draft-show-bcc')?.classList.add('d-none');
				fields.querySelector('.ecc-draft-bcc')?.focus();
			});

			var footer = document.createElement('div');
			footer.className = 'd-flex justify-content-between align-items-center gap-3';
			var statusWrap = document.createElement('div');
			statusWrap.className = 'd-flex align-items-center gap-2 min-w-0';
			statusWrap.appendChild(textNode('span', 'badge ecc-detail-draft-badge', draft?.status || 'draft'));
			statusWrap.appendChild(textNode('small', 'text-muted ecc-draft-save-status', ''));
			footer.appendChild(statusWrap);
			var actions = document.createElement('div');
			actions.className = 'd-flex gap-2';
			var cancelButton = textNode('button', 'btn btn-outline-secondary btn-sm', 'Cancel');
			cancelButton.type = 'button';
			var saveButton = textNode('button', 'btn btn-primary btn-sm ecc-draft-save', 'Save draft');
			saveButton.type = 'button';
			saveButton.disabled = identities.length === 0;
			actions.appendChild(cancelButton);
			actions.appendChild(saveButton);
			footer.appendChild(actions);
			card.appendChild(footer);
			host.appendChild(card);
			cancelButton.addEventListener('click', destroyDraftEditor);
			saveButton.addEventListener('click', function () {
				saveDraftFromCard(card, currentDraft, email);
			});
			if (identities.length > 0) startDraftAutosave(card, email);
		}

		function renderThreadMessage(email, options) {
			var item = document.createElement('div');
			item.className = 'list-group-item ecc-detail-message';
			var dateText = formatDateTime(email.createdAt || email.updatedAt);
			if (!options?.hideRepeatedHeader) {
				var header = document.createElement('div');
				header.className = 'd-flex align-items-start gap-3 mb-3';
				header.classList.add('justify-content-between');
				var titleWrap = document.createElement('div');
				titleWrap.className = 'min-w-0';
				titleWrap.appendChild(textNode('h6', 'mb-1 text-truncate', email.subject || '(No subject)'));
				titleWrap.appendChild(textNode('div', 'small text-muted text-break', listSummary(email.from, '(unknown sender)')));
				header.appendChild(titleWrap);
				header.appendChild(textNode('small', 'text-muted text-nowrap', dateText));
				item.appendChild(header);
			}

			item.appendChild(renderEmailBody(email));
			return item;
		}

		function renderEmailDetail(email, thread, draft) {
			var messages = Array.isArray(thread) ? thread : [];
			var selected = email || messages[0] || null;
			if (detailTitle) detailTitle.textContent = selected?.subject || '(No subject)';
			if (detailSubtitle) {
				detailSubtitle.textContent = selected
					? listSummary(selected.from, '(unknown sender)')
					: 'No email found.';
			}
			if (detailDate) detailDate.textContent = selected ? formatDateTime(selected.createdAt || selected.updatedAt) : '';
			renderDraftDetail(draft || null);
			if (!detailThreadEl) return;
			replaceChildren(detailThreadEl);
			if (!messages.length) {
				detailThreadEl.appendChild(textNode('div', 'list-group-item text-muted', 'No thread messages found.'));
				return;
			}
			var group = document.createElement('div');
			group.className = 'list-group';
			var selectedId = emailId(selected);
			messages.forEach(function (message) {
				var messageId = emailId(message);
				group.appendChild(renderThreadMessage(message, {
					hideRepeatedHeader: Boolean(selectedId && messageId && selectedId === messageId),
				}));
			});
			detailThreadEl.appendChild(group);
		}

		function renderInternalNoteList(notes) {
			var list = internalNotesEl?.querySelector('.ecc-internal-notes-list');
			if (!list) return;
			currentInternalNotes = notes || [];
			destroyNoteEditor();
			if (!notes.length) {
				list.innerHTML = '<div class="text-muted small">No internal notes yet.</div>';
				return;
			}
			list.innerHTML = groupInternalNotes(notes).map(function (note) {
				return renderInternalNote(note, selectedEmail, 0);
			}).join('');
			bindInternalNoteActions(selectedEmail);
		}

		async function loadInternalNotes(email) {
			if (!internalNotesEl || !email?._id) return;
			var list = internalNotesEl.querySelector('.ecc-internal-notes-list');
			if (list) list.innerHTML = '<div class="text-muted small">Loading notes...</div>';
			try {
				var res = await api('GET', '/emails/' + encodeURIComponent(email._id) + '/internal-notes');
				renderInternalNoteList(res.notes || []);
			} catch (err) {
				if (list) list.innerHTML = '<div class="text-danger small">' + escapeHtml(err.message || 'Failed to load notes') + '</div>';
			}
		}

		function openInternalNoteEditor(email, options) {
			if (!internalNotesEl || !email?._id) return;
			var mode = options?.mode || 'add';
			var note = options?.note || null;
			var noteId = internalNoteId(note);
			destroyNoteEditor();
			resetNoteEditorHosts();
			var noteEditorEl = mode === 'add'
				? internalNotesEl.querySelector('.ecc-internal-note-editor')
				: internalNotesEl.querySelector('[data-note-editor-host="' + CSS.escape(mode === 'edit' ? noteId : options?.parentNoteId) + '"]');
			if (!noteEditorEl) return;
			noteEditorHost = noteEditorEl;
			noteEditorEl.classList.remove('d-none');
			var saveText = mode === 'reply' ? 'Save reply' : (mode === 'edit' ? 'Save changes' : 'Save note');
			var placeholder = mode === 'reply' ? 'Write a reply...' : (mode === 'edit' ? 'Edit internal note...' : 'Add an internal note...');
			noteEditorEl.innerHTML = ''
				+ '<div class="ecc-internal-note-editor-body mb-2"></div>'
				+ '<div class="d-flex justify-content-end gap-2">'
				+ '<button type="button" class="btn btn-outline-secondary btn-sm ecc-internal-note-cancel">Cancel</button>'
				+ '<button type="button" class="btn btn-primary btn-sm ecc-internal-note-save">' + saveText + '</button>'
				+ '</div>';
			noteEditor = initEmailEditor(noteEditorEl.querySelector('.ecc-internal-note-editor-body'), mode === 'edit' ? internalNoteContent(note) : '', placeholder);
			noteEditorEl.querySelector('.ecc-internal-note-cancel')?.addEventListener('click', destroyNoteEditor);
			noteEditorEl.querySelector('.ecc-internal-note-save')?.addEventListener('click', async function (event) {
				var button = event.currentTarget;
				var payload = {
					content: noteEditor?.getHTML?.() || '',
					text_content: noteEditor?.getText?.() || '',
				};
				var clientRequestId = internalNoteClientRequestId();
				payload.client_request_id = clientRequestId;
				if (mode === 'reply') payload.parent_note = options?.parentNoteId || '';
				if (!payload.text_content.trim()) return;
				button.disabled = true;
				try {
					if (mode === 'edit') {
						suppressNextInternalNoteSocket('email-internal-note:updated', { client_request_id: clientRequestId });
						await api('PUT', '/emails/' + encodeURIComponent(email._id) + '/internal-notes/' + encodeURIComponent(noteId), payload);
					} else {
						suppressNextInternalNoteSocket('email-internal-note:created', { client_request_id: clientRequestId });
						await api('POST', '/emails/' + encodeURIComponent(email._id) + '/internal-notes', payload);
					}
					destroyNoteEditor();
					await loadInternalNotes(email);
					showSuccess(mode === 'edit' ? 'Internal note updated' : 'Internal note added');
				} catch (err) {
					showError(err.message || 'Failed to save internal note');
					button.disabled = false;
				}
			});
		}

		function renderInternalNotesPanel(email) {
			if (!internalNotesEl) return;
			destroyNoteEditor();
			if (!email?._id) {
				internalNotesEl.classList.add('d-none');
				internalNotesEl.innerHTML = '';
				return;
			}
			internalNotesEl.classList.remove('d-none');
			internalNotesEl.innerHTML = ''
				+ '<div class="d-flex justify-content-between align-items-center gap-2 mb-3">'
				+ '<div class="d-flex align-items-center gap-2 min-w-0">'
				+ '<h6 class="mb-0">Internal notes</h6>'
				+ '<span class="badge text-bg-light">Private</span>'
				+ '</div>'
				+ '<button type="button" class="btn btn-outline-primary btn-sm ecc-internal-note-open">Add note</button>'
				+ '</div>'
				+ '<div class="ecc-internal-note-editor d-none mb-3"></div>'
				+ '<div class="ecc-internal-notes-list"></div>';
			internalNotesEl.querySelector('.ecc-internal-note-open')?.addEventListener('click', function () {
				openInternalNoteEditor(email, { mode: 'add' });
			});
			loadInternalNotes(email);
		}

		function renderEmailItemHtml(email) {
			var subject = email.subject || '(No subject)';
			var senders = (email.from || []).slice(0, 2).join(', ') || '(unknown sender)';
			var body = (email.triage_summary || emailExcerpt(email) || '').slice(0, 180);
			var actionPoints = (email.triage_action_points || []).slice(0, 2).map(function (item) {
				return item.text;
			}).filter(Boolean).join(' - ');
			var labels = renderVisibleLabels(email);
			var triageMeta = [
				email.triage_primary_action ? '<span class="badge text-bg-light me-1">' + escapeHtml(TRIAGE_ACTION_NAMES[email.triage_primary_action] || email.triage_primary_action) + '</span>' : '',
				email.triage_status === 'failed' ? '<span class="badge text-bg-danger me-1">Failed</span>' : '',
				email.triage_draft_id ? '<span class="badge text-bg-info me-1">Draft</span>' : '',
			].filter(Boolean).join('');
			return '<div class="list-group-item list-group-item-action ecc-email-item" role="button" tabindex="0" data-id="' + escapeHtml(emailId(email)) + '">'
				+ '<div class="d-flex justify-content-between align-items-start gap-3 min-w-0">'
				+ '<div class="form-check ecc-email-select-wrap">'
				+ '<input class="form-check-input ecc-email-select" type="checkbox" value="' + escapeHtml(emailId(email)) + '" aria-label="Select email">'
				+ '</div>'
				+ '<div class="min-w-0 flex-grow-1">'
				+ '<div class="d-flex justify-content-between align-items-center gap-2 min-w-0">'
				+ '<span class="ecc-email-sender text-muted text-truncate">' + escapeHtml(senders) + '</span>'
				+ '<time class="ecc-email-date text-muted text-nowrap flex-shrink-0">' + escapeHtml(formatDate(email.updatedAt)) + '</time>'
				+ '</div>'
				+ '<div class="fw-semibold text-truncate ecc-email-subject">' + escapeHtml(subject) + '</div>'
				+ (body ? '<div class="ecc-email-excerpt text-muted text-truncate">' + escapeHtml(body) + '</div>' : '')
				+ (actionPoints ? '<div class="small text-body text-truncate mt-1">' + escapeHtml(actionPoints) + '</div>' : '')
				+ (triageMeta ? '<div class="mt-2">' + triageMeta + '</div>' : '')
				+ (labels ? '<div class="mt-2">' + labels + '</div>' : '')
				+ '</div>'
				+ '</div>'
				+ '</div>';
		}

		function bindEmailItem(item) {
			item.addEventListener('click', function (event) {
				if (event.target.closest('.ecc-email-select-wrap')) return;
				selectEmail(item.dataset.id || '');
			});
			item.addEventListener('keydown', function (event) {
				if (event.target.closest('.ecc-email-select-wrap')) return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					selectEmail(item.dataset.id || '');
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

		function renderEmailListAi() {
			if (!aiPanel) return;
			aiPanel.innerHTML = '<div class="ecc-ai-content">'
				+ '<div class="ecc-ai-section ecc-email-chat">'
				+ '<h6 class="mb-2">Ask Email AI</h6>'
				+ '<div class="text-muted small mb-3">Search and count emails in the current view.</div>'
				+ '<div class="ecc-email-ai-examples mb-3">'
				+ '<button type="button" class="chat-example-btn ecc-email-ai-example mb-1">Show reply-required emails in this view</button>'
				+ '<button type="button" class="chat-example-btn ecc-email-ai-example mb-1">How many reply-required emails are in this view?</button>'
				+ '<button type="button" class="chat-example-btn ecc-email-ai-example mb-1">Find emails about invoices</button>'
				+ '<button type="button" class="chat-example-btn ecc-email-ai-example mb-1">Summarize this mailbox</button>'
				+ '</div>'
				+ '<div class="ecc-email-ai-messages" id="ecc-email-ai-messages"></div>'
				+ '<div class="ecc-email-ai-composer">'
				+ '<label class="form-label small mb-1" for="ecc-email-ai-input">Message</label>'
				+ '<div class="input-group input-group-sm">'
				+ '<input type="text" class="form-control form-control-sm" id="ecc-email-ai-input" autocomplete="off">'
				+ '<button type="button" class="btn btn-primary btn-sm" id="ecc-email-ai-send" title="Send">'
				+ kkIcon('send')
				+ '</button>'
				+ '</div>'
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
			aiPanel.querySelectorAll('.ecc-email-ai-example').forEach(function (button) {
				button.addEventListener('click', function () {
					if (!aiInputEl) return;
					aiInputEl.value = button.textContent || '';
					sendEmailAiMessage();
				});
			});
		}

		function bindDraftItem(item) {
			item.addEventListener('click', function () {
				selectEmail(item.dataset.sourceEmail || '');
			});
			item.addEventListener('keydown', function (event) {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					selectEmail(item.dataset.sourceEmail || '');
				}
			});
		}

		function showEmptyEmailsIfNeeded() {
			if (!listEl || listEl.querySelector('.ecc-email-item')) return;
			listEl.innerHTML = '<div class="list-group-item text-muted ecc-email-empty">No emails for this view.</div>';
			selectedEmail = null;
			emailAiMessages = [];
			emailReplySuggestions = [];
			renderEmailAi(null);
			updateActionBar();
		}

	function renderEmails(emails) {
		if (!listEl) return;
		showListView();
		selectedIds.clear();
		updateActionBar();
		renderMoveMenu();
		if (!emails.length) {
			listEl.innerHTML = '<div class="list-group-item text-muted ecc-email-empty">No emails for this view.</div>';
			selectedEmail = null;
			emailAiMessages = [];
			emailReplySuggestions = [];
			renderEmailAi(null);
			updateActionBar();
			return;
		}
		selectedEmail = null;
		emailAiMessages = [];
		emailReplySuggestions = [];
		renderEmailAi(null);
		listEl.innerHTML = emails.map(renderEmailItemHtml).join('');
		listEl.querySelectorAll('.ecc-email-item').forEach(function (button) {
			bindEmailItem(button);
		});
		updateActionBar();
	}

	function renderDrafts(drafts) {
		if (!listEl) return;
		showListView();
		selectedIds.clear();
		updateActionBar();
		renderMoveMenu();
		selectedEmail = null;
		emailAiMessages = [];
		emailReplySuggestions = [];
		renderEmailAi(null);
		if (!drafts.length) {
			listEl.innerHTML = '<div class="list-group-item text-muted">No drafts for this view.</div>';
			updateActionBar();
			return;
		}
		listEl.innerHTML = drafts.map(function (draft) {
			var recipients = (draft.to || []).slice(0, 2).join(', ') || '(no recipients)';
			var body = (draft.body_text || '').slice(0, 180);
			var sourceEmailId = draftSourceEmailId(draft);
			return '<div class="list-group-item list-group-item-action ecc-email-item" role="button" tabindex="0" data-source-email="' + escapeHtml(sourceEmailId) + '">'
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
		listEl.querySelectorAll('.ecc-email-item').forEach(function (button) {
			bindDraftItem(button);
		});
		updateActionBar();
	}

	async function selectEmail(id) {
		if (!id) return;
		pendingEmailId = id;
		writeUrlState(id);
		showDetailLoading(id);
		try {
			var res = await api('GET', '/emails/' + encodeURIComponent(id) + '/thread?order=desc&include=draft');
			var thread = res.thread || [];
			selectedEmailThreadSourceIds = thread.map(function (item) {
				return emailId(item);
			}).filter(Boolean);
			var email = thread.find(function (item) {
				return emailId(item) === id;
			}) || thread[0] || null;
			if (!email) throw new Error('Email not found');
			selectedEmail = email;
			pendingEmailId = '';
			emailAiMessages = [];
			emailReplySuggestions = [];
			listEl?.querySelectorAll('.ecc-email-item').forEach(function (item) {
				var active = item.dataset.id === id || item.dataset.sourceEmail === id;
				item.classList.toggle('is-active', active);
			});
			renderEmailDetail(email, thread, res.draft || null);
			renderEmailAi(email);
		} catch (err) {
			selectedEmail = null;
			selectedEmailThreadSourceIds = [];
			pendingEmailId = '';
			emailAiMessages = [];
			emailReplySuggestions = [];
			renderEmailAi(null);
			showDetailError(err.message || 'Failed to load email.');
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
			html_content: email.html_content || '',
			html_content_has_remote_images: Boolean(email.html_content_has_remote_images),
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
			showListView();
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
				pendingEmailId = '';
				writeUrlState('');
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
		viewHeader = document.getElementById('ecc-view-header');
		viewTitle = document.getElementById('ecc-view-title');
		viewSubtitle = document.getElementById('ecc-view-subtitle');
		listWrap = document.getElementById('ecc-list-wrap');
		detailEl = document.getElementById('ecc-detail');
		detailBackBtn = document.getElementById('ecc-detail-back-btn');
		detailTitle = document.getElementById('ecc-detail-title');
		detailSubtitle = document.getElementById('ecc-detail-subtitle');
		detailDate = document.getElementById('ecc-detail-date');
		detailDraftEl = document.getElementById('ecc-detail-draft');
		detailThreadEl = document.getElementById('ecc-detail-thread');
		internalNotesEl = document.getElementById('ecc-internal-notes');
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
		detailActive = false;
		pendingEmailId = '';
		triageRunId = '';
		triageProgress = null;
		applyUrlState();
		if (projectSelect) projectSelect.value = selectedProject;
		selectedIds.clear();
		emailAiMessages = [];
		renderEmailAi(null);
		renderMoveMenu();
		updateActionBar();

		mailboxesEl?.querySelectorAll('[data-mailbox]').forEach(function (button) {
			button.addEventListener('click', function () {
				activeMailbox = button.dataset.mailbox || 'inbox';
				activeLabel = '';
				pendingEmailId = '';
				writeUrlState('');
				loadAll();
			});
		});
		projectSelect?.addEventListener('change', function () {
			selectedProject = projectSelect.value || '';
			pendingEmailId = '';
			writeUrlState('');
			loadAll();
		});
		triageBtn?.addEventListener('click', triageInbox);
		refreshBtn?.addEventListener('click', function () {
			var emailIdToRestore = detailActive ? emailId(selectedEmail) : '';
			loadAll().then(function () {
				if (emailIdToRestore) selectEmail(emailIdToRestore);
			});
		});
		selectAllBtn?.addEventListener('click', toggleSelectAll);
		trashBtn?.addEventListener('click', trashSelected);
		resetTriageBtn?.addEventListener('click', resetSelectedTriage);
		openEmailBtn?.addEventListener('click', openSelectedEmail);
		detailBackBtn?.addEventListener('click', backToListView);
		addWindowListener('item-modal-deleted', onModalDeleted);
		addWindowListener('email:created', handleEmailSocketEvent);
		addWindowListener('email:updated', handleEmailSocketEvent);
		addWindowListener('email:deleted', handleEmailDeleted);
		addWindowListener('email-internal-note:created', handleInternalNoteSocketEvent);
		addWindowListener('email-internal-note:updated', handleInternalNoteSocketEvent);
		addWindowListener('email-internal-note:deleted', handleInternalNoteSocketEvent);
		loadAll().then(function () {
			if (pendingEmailId) selectEmail(pendingEmailId);
		});
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
		listWrap = null;
		detailEl = null;
		detailBackBtn = null;
		detailTitle = null;
		detailSubtitle = null;
		detailDate = null;
		detailDraftEl = null;
		detailThreadEl = null;
		internalNotesEl = null;
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
		detailActive = false;
		currentDraft = null;
		destroyDraftEditor();
		destroyNoteEditor();
		triageRunId = '';
		triageProgress = null;
		selectedIds.clear();
		emailAiMessages = [];
	}

	window.__sections = window.__sections || {};
	window.__sections.ecc = { mount: mount, unmount: unmount };
})();
