// Emails section — mount/unmount for SPA navigation
(function () {
	var listEl;
	var windowListeners = [];

	function addWindowListener(event, handler) {
		window.addEventListener(event, handler);
		windowListeners.push([event, handler]);
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

	async function loadEmails() {
		if (!listEl) return;
		var params = currentProjectId ? '?project=' + currentProjectId : '';
		var data = await api('GET', '/emails' + params);
		if (!listEl) return;
		var emails = data.emails || [];

		listEl.innerHTML = emails.length
			? emails.map(function (e) {
				var subject = e.subject || '(No subject)';
				var senders = (e.from || []).slice(0, 3).join(', ');
				var senderSummary = senders || '';
				var hasMoreSenders = (e.from || []).length > 3 ? ' +' + ((e.from || []).length - 3) : '';
				var recipients = (e.to || []).slice(0, 3).join(', ');
				var recipientSummary = recipients || '(no recipients)';
				var hasMoreRecipients = (e.to || []).length > 3 ? ' +' + ((e.to || []).length - 3) : '';
				var date = e.updatedAt ? new Date(e.updatedAt).toLocaleDateString() : '';
				var excerpt = e.excerpt || cleanEmailExcerpt(e.text_content || e.attachment_text_content || '').slice(0, 220);
				return '<div class="list-group-item list-group-item-action email-item" data-id="' + e._id + '">'
					+ '<div class="d-flex align-items-start gap-2">'
					+ '<div class="batch-cb-wrap"><input type="checkbox" class="form-check-input batch-cb" value="' + e._id + '"></div>'
					+ '<div class="flex-grow-1 overflow-hidden">'
					+ '<div class="d-flex justify-content-between align-items-center gap-2">'
					+ '<strong class="text-truncate">' + escapeHtml(subject) + '</strong>'
					+ '<small class="text-muted text-nowrap flex-shrink-0">' + date + '</small>'
					+ '</div>'
					+ (senderSummary ? '<p class="mb-1 text-muted small text-truncate">' + kkIcon('user', 'me-1') + escapeHtml(senderSummary + hasMoreSenders) + '</p>' : '')
					+ '<p class="mb-1 text-muted small text-truncate">' + kkIcon('email', 'me-1') + escapeHtml(recipientSummary + hasMoreRecipients) + '</p>'
					+ (excerpt ? '<p class="mb-0 text-muted small text-truncate">' + escapeHtml(excerpt) + '</p>' : '')
					+ '</div></div></div>';
			}).join('')
			: '<p class="text-muted p-3">No emails indexed yet. Send parsed/raw emails to the ingestion API to populate this project.</p>';

		listEl.querySelectorAll('.email-item').forEach(function (el) {
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
		});
	}

	function onModalDeleted(e) { if (e.detail?.type === 'emails') loadEmails(); }

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str || '';
		return div.innerHTML;
	}

	function mount() {
		listEl = document.getElementById('emails-list');
		if (!listEl) return;

		addWindowListener('project-changed', loadEmails);
		addWindowListener('batch-done', loadEmails);
		addWindowListener('item-modal-deleted', onModalDeleted);

		loadEmails();
	}

	function unmount() {
		for (var i = 0; i < windowListeners.length; i++) {
			window.removeEventListener(windowListeners[i][0], windowListeners[i][1]);
		}
		windowListeners.length = 0;
		listEl = null;
	}

	window.__sections = window.__sections || {};
	window.__sections.emails = { mount: mount, unmount: unmount };
})();
