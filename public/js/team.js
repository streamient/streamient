// Team settings — IIFE (loaded dynamically via SPA partial)
(function () {
	var page = document.getElementById('team-page');
	if (!page) return;
	if (page.dataset.canManageTeam !== 'true') return;

	var currentUserId = page.dataset.userId;
	var memberForm = document.getElementById('team-member-form');
	var membersList = document.getElementById('team-members-list');

	loadMembers();

	memberForm?.addEventListener('submit', async function (e) {
		e.preventDefault();
		var name = document.getElementById('team-member-name').value.trim();
		var email = document.getElementById('team-member-email').value.trim();
		var password = document.getElementById('team-member-password').value;
		var sendWelcomeEmail = document.getElementById('team-member-send-welcome').checked;

		if (!email) return showError('Email is required');
		if (password && password.length < 8) return showError('Password must be at least 8 characters');

		try {
			await api('POST', '/team/members', {
				name: name,
				email: email,
				password: password,
				send_welcome_email: sendWelcomeEmail,
			});
			memberForm.reset();
			document.getElementById('team-member-send-welcome').checked = true;
			showSuccess('User added');
			loadMembers();
		} catch (err) {
			showError(err.message);
		}
	});

	async function loadMembers() {
		try {
			var data = await api('GET', '/team/members');
			var members = Array.isArray(data.members) ? data.members : [];
			if (!members.length) {
				membersList.innerHTML = '<p class="text-muted mb-0">No team members yet.</p>';
				return;
			}

			membersList.innerHTML = members.map(function (member) {
				var user = member.user || {};
				var isCurrentUser = user._id === currentUserId;
				var isOwner = member.role === 'owner';
				var roleControl = isOwner
					? '<span class="badge text-bg-dark text-uppercase">owner</span>'
					: '';
				var removeButton = (!isOwner && !isCurrentUser)
					? '<button class="btn btn-sm btn-outline-danger team-remove-member" data-id="' + member._id + '">' + kkIcon('delete') + '</button>'
					: '';
				var lastLogin = user.last_login ? '<small class="text-muted">Last login ' + escapeHtml(new Date(user.last_login).toLocaleDateString()) + '</small>' : '<small class="text-muted">No recent login recorded</small>';

				return '<div class="list-group-item d-flex justify-content-between align-items-start gap-3 mb-3">'
					+ '<div class="flex-grow-1">'
						+ '<div class="fw-semibold">' + escapeHtml(user.name || 'Unknown user') + (isCurrentUser ? ' <span class="badge text-bg-light ms-2">You</span>' : '') + '</div>'
						+ '<div class="text-muted small">' + escapeHtml(user.email || '') + '</div>'
						+ lastLogin
					+ '</div>'
					+ '<div class="d-flex align-items-center gap-2">'
						+ roleControl
						+ removeButton
					+ '</div>'
				+ '</div>';
			}).join('');

			membersList.querySelectorAll('.team-remove-member').forEach(function (button) {
				button.addEventListener('click', async function () {
					var confirmed = await confirmAction('Remove teammate', 'This user will lose access to this account.');
					if (!confirmed) return;
					try {
						await api('DELETE', '/team/members/' + button.dataset.id);
						showSuccess('Member removed');
						loadMembers();
					} catch (err) {
						showError(err.message);
					}
				});
			});
		} catch (err) {
			membersList.innerHTML = '<p class="text-danger mb-0">Failed to load team members.</p>';
		}
	}

	function escapeHtml(str) {
		var div = document.createElement('div');
		div.textContent = str || '';
		return div.innerHTML;
	}
})();
