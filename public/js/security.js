// Security — IIFE (loaded dynamically via SPA partial)
(function () {

	// ---- 2FA ----

	var setup2faBtn = document.getElementById('setup-2fa');
	var disable2faBtn = document.getElementById('disable-2fa');
	var twoFaSetupArea = document.getElementById('2fa-setup-area');

	setup2faBtn?.addEventListener('click', async () => {
		try {
			const res = await fetch('/2fa/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});
			const data = await res.json();
			if (!res.ok) return showError(data.error || '2FA setup failed');

			twoFaSetupArea.classList.remove('d-none');
			document.getElementById('2fa-secret').textContent = data.secret;

			const qrImg = document.getElementById('2fa-qr');
			const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.otpauth)}`;
			qrImg.src = qrUrl;
			qrImg.classList.remove('d-none');

			setup2faBtn.classList.add('d-none');
		} catch (err) {
			showError(err.message);
		}
	});

	document.getElementById('cancel-2fa-btn')?.addEventListener('click', () => {
		twoFaSetupArea.classList.add('d-none');
		setup2faBtn.classList.remove('d-none');
		document.getElementById('2fa-code').value = '';
		const qrImg = document.getElementById('2fa-qr');
		qrImg.src = '';
		qrImg.classList.add('d-none');
		document.getElementById('2fa-secret').textContent = '';
	});

	document.getElementById('confirm-2fa-btn')?.addEventListener('click', async () => {
		const code = document.getElementById('2fa-code').value.trim();
		if (!code) return showError('Enter the 6-digit code');

		try {
			const res = await fetch('/2fa/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			});
			const data = await res.json();
			if (!res.ok) return showError(data.error || 'Invalid code');

			showSuccess('2FA enabled');
			setTimeout(function () { window.navigateTo ? window.navigateTo('/settings/security') : location.reload(); }, 1200);
		} catch (err) {
			showError(err.message);
		}
	});

	disable2faBtn?.addEventListener('click', async () => {
		const confirmed = await confirmAction('Disable 2FA', 'This will remove two-factor authentication from your account.');
		if (!confirmed) return;

		try {
			await api('POST', '/2fa/disable');
			showSuccess('2FA disabled');
			setTimeout(function () { window.navigateTo ? window.navigateTo('/settings/security') : location.reload(); }, 1200);
		} catch (err) {
			showError(err.message);
		}
	});

	// ---- Passkeys ----

	loadPasskeys();
	loadOauthSection();

	document.getElementById('add-passkey')?.addEventListener('click', async () => {
		try {
			const optionsRes = await fetch('/passkey/register/options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});
			const options = await optionsRes.json();
			if (!optionsRes.ok) return showError(options.error || 'Failed to get passkey options');

			const attestation = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });

			const { Swal } = await import('/static/js/vendor.js');
			const { value: name } = await Swal.fire({
				title: 'Name this passkey',
				input: 'text',
				inputPlaceholder: 'e.g. 1Password, MacBook Touch ID',
				showCancelButton: true,
				inputValidator: (v) => !v?.trim() ? 'Please enter a name' : null,
			});
			if (!name) return;
			const browser_info = detectBrowserInfo();

			const verifyRes = await fetch('/passkey/register/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ attestation, name: name.trim(), browser_info }),
			});
			const verifyData = await verifyRes.json();
			if (!verifyRes.ok) return showError(verifyData.error || 'Passkey registration failed');

			showSuccess('Passkey added');
			loadPasskeys();
		} catch (err) {
			if (err.name === 'NotAllowedError') return;
			showError(err.message);
		}
	});

	async function loadPasskeys() {
		const list = document.getElementById('passkey-list');
		if (!list) return;

		try {
			const data = await api('GET', '/passkeys');
			if (!data.passkeys?.length) {
				list.innerHTML = '<p class="text-muted">No passkeys registered</p>';
				return;
			}
			list.innerHTML = data.passkeys.map((pk) => {
				const details = [];
				if (pk.browser_info) details.push(escapeHtml(pk.browser_info));
				if (pk.device_type === 'multiDevice') details.push('Synced');
				if (pk.backed_up) details.push('Backed up');
				const detailStr = details.length ? `<small class="text-muted d-block fs-7 ms-4 ps-1">${details.join(' · ')}</small>` : '';
				const lastUsed = pk.last_used_at ? `<small class="text-muted">Last used ${new Date(pk.last_used_at).toLocaleDateString()}</small>` : '';

				return `
				<div class="d-flex justify-content-between align-items-center border rounded p-2 mb-2">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center">
							${kkIcon('fingerprint', 'me-2')}
							<strong class="passkey-name">${escapeHtml(pk.name || 'Passkey')}</strong>
							<button class="btn btn-sm btn-link p-0 ms-2 rename-passkey" data-id="${pk._id}" data-name="${escapeHtml(pk.name || 'Passkey')}" title="Rename">
								${kkIcon('edit')}
							</button>
						</div>
						<div class="ms-4 ps-1">
							<small class="text-muted fs-7">Added ${new Date(pk.createdAt).toLocaleDateString()}</small>
							${lastUsed ? `<small class="text-muted ms-2">Last used ${new Date(pk.last_used_at).toLocaleDateString()}</small>` : ''}
						</div>
						${detailStr}
					</div>
					<button class="btn btn-sm btn-outline-danger delete-passkey ms-2" data-id="${pk._id}">
						${kkIcon('delete')}
					</button>
				</div>
			`}).join('');

			list.querySelectorAll('.rename-passkey').forEach((btn) => {
				btn.addEventListener('click', async () => {
					const currentName = btn.dataset.name;
					const { Swal } = await import('/static/js/vendor.js');
					const { value: newName } = await Swal.fire({
						title: 'Rename passkey',
						input: 'text',
						inputValue: currentName,
						showCancelButton: true,
						inputValidator: (v) => !v?.trim() ? 'Please enter a name' : null,
					});
					if (!newName || newName.trim() === currentName) return;
					try {
						await api('PATCH', `/passkeys/${btn.dataset.id}`, { name: newName.trim() });
						showSuccess('Passkey renamed');
						loadPasskeys();
					} catch (err) {
						showError(err.message);
					}
				});
			});

			list.querySelectorAll('.delete-passkey').forEach((btn) => {
				btn.addEventListener('click', async () => {
					const confirmed = await confirmAction('Delete Passkey', 'This passkey will be removed.');
					if (!confirmed) return;
					try {
						await api('DELETE', `/passkeys/${btn.dataset.id}`);
						showSuccess('Passkey deleted');
						loadPasskeys();
					} catch (err) {
						showError(err.message);
					}
				});
			});
		} catch (err) {
			list.innerHTML = '<p class="text-danger">Failed to load passkeys</p>';
		}
	}

	// ---- Reset Password ----

	document.getElementById('create-oauth-client')?.addEventListener('click', async () => {
		const clientName = document.getElementById('oauth-client-name')?.value.trim() || '';
		const clientUri = document.getElementById('oauth-client-uri')?.value.trim() || '';
		const authMethod = document.getElementById('oauth-client-auth-method')?.value || 'none';
		const redirectUris = (document.getElementById('oauth-client-redirect-uris')?.value || '')
			.split(/\n|,/)
			.map(function (item) { return item.trim(); })
			.filter(Boolean);

		if (!clientName) return showError('Client name is required');
		if (!redirectUris.length) return showError('At least one redirect URI is required');

		try {
			const data = await api('POST', '/oauth/clients', {
				client_name: clientName,
				client_uri: clientUri || undefined,
				redirect_uris: redirectUris,
				token_endpoint_auth_method: authMethod,
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code'],
			});

			document.getElementById('oauth-client-name').value = '';
			document.getElementById('oauth-client-uri').value = '';
			document.getElementById('oauth-client-redirect-uris').value = '';
			document.getElementById('oauth-client-auth-method').value = 'none';

			const secretEl = document.getElementById('oauth-client-secret-result');
			if (secretEl) {
				if (data.client_secret) {
					secretEl.classList.remove('d-none');
					secretEl.innerHTML = '<strong>Client secret created.</strong> Copy it now — it will not be shown again.<div class="input-group mt-2"><input class="form-control" type="text" readonly value="' + escapeHtml(data.client_secret) + '"><button class="btn btn-outline-secondary oauth-copy-secret" type="button">Copy</button></div>';
					secretEl.querySelector('.oauth-copy-secret')?.addEventListener('click', function () {
						navigator.clipboard.writeText(data.client_secret);
						showSuccess('Client secret copied');
					});
				} else {
					secretEl.classList.add('d-none');
					secretEl.innerHTML = '';
				}
			}

			showSuccess('OAuth client created');
			loadOauthClients();
		} catch (err) {
			showError(err.message);
		}
	});

	document.getElementById('reset-password-btn')?.addEventListener('click', async () => {
		const confirmed = await confirmAction('Reset Password', 'A new random password will be generated.');
		if (!confirmed) return;

		try {
			const res = await fetch('/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});
			const data = await res.json();
			if (data.password) {
				document.getElementById('new-password-value').value = data.password;
				document.getElementById('password-result').classList.remove('d-none');
			} else {
				showError(data.error || 'Failed to reset password');
			}
		} catch (err) {
			showError(err.message);
		}
	});

	document.getElementById('copy-password-btn')?.addEventListener('click', () => {
		const val = document.getElementById('new-password-value').value;
		navigator.clipboard.writeText(val);
		showSuccess('Password copied');
	});

	document.getElementById('password-copied-btn')?.addEventListener('click', () => {
		document.getElementById('password-result').classList.add('d-none');
	});

	async function loadOauthSection() {
		if (!document.getElementById('oauth-issuer')) return;

		try {
			const configResp = await api('GET', '/oauth/config');
			renderOauthConfig(configResp.oauth || {});
		} catch (err) {
			console.error('Failed to load OAuth config:', err);
		}

		loadOauthConsents();
		loadOauthClients();
	}

	async function loadOauthConsents() {
		const list = document.getElementById('oauth-consents-list');
		if (!list) return;

		try {
			const data = await api('GET', '/oauth/consents');
			const consents = data.consents || [];
			if (!consents.length) {
				list.innerHTML = '<p class="text-muted">No apps have been authorized for this account yet.</p>';
				return;
			}

			list.innerHTML = '<div class="list-group">' + consents.map(function (consent) {
				return '<div class="list-group-item">'
					+ '<div class="d-flex justify-content-between align-items-start gap-3">'
						+ '<div class="flex-grow-1">'
							+ '<div class="fw-semibold">' + escapeHtml(consent.client_name) + '</div>'
							+ (consent.client_uri ? '<div><a class="small" href="' + escapeHtml(consent.client_uri) + '" target="_blank" rel="noopener">' + escapeHtml(consent.client_uri) + '</a></div>' : '')
							+ '<div class="small text-muted mt-1">Granted ' + formatDate(consent.granted_at) + (consent.last_used_at ? ' · Last used ' + formatDate(consent.last_used_at) : '') + '</div>'
							+ '<div class="d-flex flex-wrap gap-1 mt-2">' + (consent.scopes || []).map(function (scope) { return '<span class="badge text-bg-secondary">' + escapeHtml(scope) + '</span>'; }).join('') + '</div>'
						+ '</div>'
						+ '<button class="btn btn-sm btn-outline-danger oauth-revoke-consent" data-id="' + consent._id + '">' + kkIcon('cancel') + '</button>'
					+ '</div>'
				+ '</div>';
			}).join('') + '</div>';

			list.querySelectorAll('.oauth-revoke-consent').forEach(function (button) {
				button.addEventListener('click', async function () {
					var confirmed = await confirmAction('Revoke app access', 'This app will need a new OAuth approval before it can connect again.');
					if (!confirmed) return;
					try {
						await api('DELETE', '/oauth/consents/' + button.dataset.id);
						showSuccess('Authorized app revoked');
						loadOauthConsents();
					} catch (err) {
						showError(err.message);
					}
				});
			});
		} catch (err) {
			list.innerHTML = '<p class="text-danger">Failed to load authorized apps</p>';
		}
	}

	async function loadOauthClients() {
		const list = document.getElementById('oauth-clients-list');
		if (!list) return;

		try {
			const data = await api('GET', '/oauth/clients');
			const clients = data.clients || [];
			if (!clients.length) {
				return;
			}

			list.innerHTML = '<div class="list-group">' + clients.map(function (client) {
				return '<div class="list-group-item">'
					+ '<div class="d-flex justify-content-between align-items-start gap-3">'
						+ '<div class="flex-grow-1">'
							+ '<div class="fw-semibold">' + escapeHtml(client.client_name) + ' <span class="badge text-bg-light">' + escapeHtml(client.token_endpoint_auth_method) + '</span></div>'
							+ '<div class="small text-muted mt-1">Client ID</div>'
							+ '<code class="small d-block mb-2">' + escapeHtml(client.client_id) + '</code>'
							+ '<div class="small text-muted">Redirect URIs</div>'
							+ '<ul class="small mb-0">' + (client.redirect_uris || []).map(function (uri) { return '<li><code>' + escapeHtml(uri) + '</code></li>'; }).join('') + '</ul>'
						+ '</div>'
						+ '<button class="btn btn-sm btn-outline-danger oauth-delete-client" data-id="' + client._id + '">' + kkIcon('delete') + '</button>'
					+ '</div>'
				+ '</div>';
			}).join('') + '</div>';

			list.querySelectorAll('.oauth-delete-client').forEach(function (button) {
				button.addEventListener('click', async function () {
					var confirmed = await confirmAction('Delete OAuth client', 'This client will stop working immediately and existing refresh tokens will be revoked.');
					if (!confirmed) return;
					try {
						await api('DELETE', '/oauth/clients/' + button.dataset.id);
						showSuccess('OAuth client deleted');
						loadOauthClients();
						loadOauthConsents();
					} catch (err) {
						showError(err.message);
					}
				});
			});
		} catch (err) {
			if (err.message && /Team admin access/i.test(err.message)) {
				list.innerHTML = '';
				return;
			}
			list.innerHTML = '<p class="text-danger">Failed to load OAuth clients</p>';
		}
	}

	function renderOauthConfig(oauth) {
		setText('oauth-issuer', oauth.issuer);
		setText('oauth-mcp-endpoint', oauth.mcp_endpoint);
		setText('oauth-resource-metadata', oauth.resource_metadata_url);
		setText('oauth-auth-metadata', oauth.authorization_server_metadata_url);
		renderOauthRegistrationMethods(oauth.client_registration || {});
	}

	function renderOauthRegistrationMethods(clientRegistration) {
		var badges = document.getElementById('oauth-registration-badges');
		if (!badges) return;

		var items = [];
		if (clientRegistration.pre_registration_supported) {
			items.push('Pre-registration');
		}
		if (clientRegistration.client_id_metadata_document_supported) {
			items.push('Client ID Metadata Document');
		}
		if (clientRegistration.dynamic_registration_supported) {
			items.push('Dynamic Client Registration');
		}

		if (!items.length) {
			badges.innerHTML = '<div class="text-muted">No client registration methods advertised.</div>';
			return;
		}

		badges.innerHTML = '<div class="d-flex flex-wrap gap-2">' + items.map(function (item) {
			return '<span class="badge text-bg-secondary">' + escapeHtml(item) + '</span>';
		}).join('') + '</div>';
	}

	function setText(id, value) {
		var el = document.getElementById(id);
		if (!el) return;
		el.textContent = value || '—';
	}

	function formatDate(value) {
		if (!value) return 'never';
		return new Date(value).toLocaleString();
	}

	function escapeHtml(str) {
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	function detectBrowserInfo() {
		var ua = navigator.userAgent;
		var browser = 'Unknown';
		if (ua.includes('Firefox/')) browser = 'Firefox';
		else if (ua.includes('Edg/')) browser = 'Edge';
		else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
		else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

		var os = 'Unknown';
		if (ua.includes('Mac OS')) os = 'macOS';
		else if (ua.includes('Windows')) os = 'Windows';
		else if (ua.includes('Linux')) os = 'Linux';
		else if (ua.includes('Android')) os = 'Android';
		else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

		return browser + ' on ' + os;
	}
})();
