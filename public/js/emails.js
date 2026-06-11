// Emails section — mount/unmount for SPA navigation
(function () {
	var PAGE_SIZE = 50;
	var listEl;
	var windowListeners = [];
	var pageNum = 1;
	var loadingMore = false;
	var hasMore = false;
	var loadSeq = 0;
	var infiniteScroll = null;

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
	}

	function formatDateTime(value) {
		if (!value) return '';
		return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	function cleanEmailExcerpt(value) {
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
			.join(' ')
			.replace(/\s+/g, ' ')
			.replace(/^--\s*/, '')
			.trim();
	}

	function emailId(email) {
		return String(email?._id || email?.id || '');
	}

	function emailProjectId(email) {
		return String(email?.project?._id || email?.project || '');
	}

	function emailMatchesCurrentList(email) {
		if (!email || email.in_trash === true) return false;
		if (!currentProjectId) return true;
		return emailProjectId(email) === String(currentProjectId);
	}

	function emptyEmailHtml() {
		return '<p class="text-muted p-3 email-empty">No emails indexed yet. Send parsed/raw emails to the ingestion API to populate this project.</p>';
	}

	function renderEmailItemHtml(e) {
		var id = emailId(e);
		var subject = e.subject || '(No subject)';
		var senders = (e.from || []).slice(0, 3).join(', ');
		var senderSummary = senders || '';
		var hasMoreSenders = (e.from || []).length > 3 ? ' +' + ((e.from || []).length - 3) : '';
		var date = formatDateTime(e.updatedAt);
		var excerpt = e.excerpt || cleanEmailExcerpt(e.text_content || e.attachment_text_content || '').slice(0, 220);
		return '<div class="list-group-item list-group-item-action email-item" data-id="' + escapeHtml(id) + '">'
			+ '<div class="d-flex align-items-start gap-2">'
			+ '<div class="batch-cb-wrap"><input type="checkbox" class="form-check-input batch-cb" value="' + escapeHtml(id) + '"></div>'
			+ '<div class="flex-grow-1 overflow-hidden">'
			+ '<div class="d-flex justify-content-between align-items-center gap-2">'
			+ (senderSummary ? '<span class="email-item-sender text-muted text-truncate">' + escapeHtml(senderSummary + hasMoreSenders) + '</span>' : '<span class="email-item-sender text-muted text-truncate"></span>')
			+ '<time class="email-item-date text-muted text-nowrap flex-shrink-0">' + escapeHtml(date) + '</time>'
			+ '</div>'
			+ '<strong class="email-item-subject text-truncate d-block">' + escapeHtml(subject) + '</strong>'
			+ (excerpt ? '<p class="email-item-excerpt mb-0 text-muted text-truncate">' + escapeHtml(excerpt) + '</p>' : '')
			+ '</div></div></div>';
	}

	function bindEmailItem(el) {
		el.addEventListener('click', function (ev) {
			if (ev.target.closest('.batch-cb-wrap')) return;
			api('GET', '/emails/' + el.dataset.id)
				.then(function (res) {
					var email = res.email || res;
					window.openResultModal({
						_type: 'emails',
						id: email._id,
						title: email.subject || '(No subject)',
						from: email.from || [],
						html_content: email.html_content || '',
						html_content_has_remote_images: Boolean(email.html_content_has_remote_images),
						text_content: [email.text_content, email.attachment_text_content].filter(Boolean).join('\n\n'),
					});
				})
				.catch(function (err) {
					showError('Failed to load email: ' + (err.message || 'Unknown error'));
				});
		});
	}

	function renderEmails(emails) {
		listEl.innerHTML = emails.length
			? emails.map(renderEmailItemHtml).join('')
			: emptyEmailHtml();

		listEl.querySelectorAll('.email-item').forEach(bindEmailItem);
	}

	function showEmptyEmailsIfNeeded() {
		if (!listEl || listEl.querySelector('.email-item')) return;
		listEl.innerHTML = emptyEmailHtml();
	}

	function removeEmailFromList(id) {
		if (!listEl || !id) return;
		listEl.querySelector('.email-item[data-id="' + CSS.escape(id) + '"]')?.remove();
		showEmptyEmailsIfNeeded();
	}

	function applyEmailSocketUpdate(email) {
		if (!listEl || !email) return;
		var id = emailId(email);
		if (!id) return;
		var existing = listEl.querySelector('.email-item[data-id="' + CSS.escape(id) + '"]');
		if (!emailMatchesCurrentList(email)) {
			removeEmailFromList(id);
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
			listEl.querySelector('.email-empty')?.remove();
			listEl.prepend(item);
		}
	}

	function emailsPath(page) {
		var params = ['page=' + page, 'limit=' + PAGE_SIZE];
		if (currentProjectId) params.push('project=' + currentProjectId);
		return '/emails?' + params.join('&');
	}

	async function loadEmails() {
		if (!listEl) return;
		var seq = ++loadSeq;
		pageNum = 1;
		loadingMore = false;
		hasMore = false;
		var data = await api('GET', emailsPath(pageNum));
		if (!listEl || seq !== loadSeq) return;
		var emails = data.emails || [];
		hasMore = emails.length === PAGE_SIZE;

		renderEmails(emails);
		infiniteScroll?.kick();
	}

	function appendEmailItems(emails) {
		if (!listEl || !emails.length) return;
		listEl.querySelector('.email-empty')?.remove();
		var wrapper = document.createElement('div');
		wrapper.innerHTML = emails.map(renderEmailItemHtml).join('');
		var items = Array.prototype.slice.call(wrapper.children);
		items.forEach(function (item) {
			bindEmailItem(item);
			listEl.appendChild(item);
		});
	}

	async function loadMore() {
		if (!listEl || loadingMore || !hasMore) return;
		loadingMore = true;
		var seq = loadSeq;
		var page = pageNum + 1;
		var appended = false;
		try {
			var data = await api('GET', emailsPath(page));
			if (!listEl || seq !== loadSeq) return;
			var emails = data.emails || [];
			pageNum = page;
			hasMore = emails.length === PAGE_SIZE;
			appendEmailItems(emails);
			appended = emails.length > 0;
		} catch (err) {
			showError('Failed to load more emails: ' + (err.message || 'Unknown error'));
		} finally {
			if (seq === loadSeq) {
				loadingMore = false;
				if (appended) infiniteScroll?.kick();
			}
		}
	}

	function onModalDeleted(e) { if (e.detail?.type === 'emails') loadEmails(); }
	function onEmailSocketEvent(e) { applyEmailSocketUpdate(e.detail || {}); }
	function onEmailDeleted(e) { removeEmailFromList(emailId(e.detail || {})); }

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str || '';
		return div.innerHTML;
	}

	function setupInfiniteScroll() {
		var root = document.getElementById('main-content');
		if (infiniteScroll) infiniteScroll.destroy();
		infiniteScroll = window.kkInfiniteScroll?.create({
			root: root,
			insertAfter: listEl,
			sentinelClass: 'emails-scroll-sentinel',
			canLoad: function () { return Boolean(listEl) && !loadingMore && hasMore; },
			onLoadMore: loadMore,
		});
	}

	function mount() {
		listEl = document.getElementById('emails-list');
		if (!listEl) return;

		addWindowListener('project-changed', loadEmails);
		addWindowListener('batch-done', loadEmails);
		addWindowListener('item-modal-deleted', onModalDeleted);
		addWindowListener('email:created', onEmailSocketEvent);
		addWindowListener('email:updated', onEmailSocketEvent);
		addWindowListener('email:deleted', onEmailDeleted);

		setupInfiniteScroll();
		loadEmails();
	}

	function unmount() {
		for (var i = 0; i < windowListeners.length; i++) {
			window.removeEventListener(windowListeners[i][0], windowListeners[i][1]);
		}
		windowListeners.length = 0;
		if (infiniteScroll) infiniteScroll.destroy();
		infiniteScroll = null;
		listEl = null;
	}

	window.__sections = window.__sections || {};
	window.__sections.emails = { mount: mount, unmount: unmount };
})();
