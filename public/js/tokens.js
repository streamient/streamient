// Tokens — IIFE (loaded dynamically via SPA partial)
(function () {
	var createBtn = document.getElementById('create-token');
	var nameInput = document.getElementById('token-name');
	var tokensList = document.getElementById('tokens-list');
	var newTokenTemplate = document.getElementById('new-token-alert-template');
	var tokenRowTemplate = document.getElementById('token-row-template');

	if (!createBtn || !nameInput || !tokensList || !newTokenTemplate || !tokenRowTemplate) return;

	loadTokens();

	createBtn?.addEventListener('click', async () => {
		const name = nameInput.value.trim();
		if (!name) return showError('Enter a token name');

		try {
			const data = await api('POST', '/tokens', { name });
			nameInput.value = '';

			tokensList.insertBefore(renderNewTokenAlert(data), tokensList.firstChild);

			loadTokens();
		} catch (err) {
			showError(err.message);
		}
	});

	async function loadTokens() {
		try {
			const data = await api('GET', '/tokens');
			const tableEl = ensureTokensTable();
			tableEl.innerHTML = '';

			if (!data.tokens?.length) {
				return;
			}

			const group = document.createElement('div');
			group.className = 'list-group mt-3';
			data.tokens.forEach((token) => group.appendChild(renderTokenRow(token)));
			tableEl.appendChild(group);

			tableEl.querySelectorAll('.delete-token').forEach((btn) => {
				btn.addEventListener('click', async () => {
					const confirmed = await confirmAction('Delete Token', 'This token will stop working immediately.');
					if (!confirmed) return;
					try {
						await api('DELETE', `/tokens/${btn.dataset.id}`);
						removeNewTokenAlert(btn.dataset.id);
						showSuccess('Token deleted');
						loadTokens();
					} catch (err) {
						showError(err.message);
					}
				});
			});
		} catch (err) {
			console.error('Failed to load tokens:', err);
		}
	}

	function ensureTokensTable() {
		var tableEl = document.getElementById('tokens-table');
		if (tableEl) return tableEl;

		tableEl = document.createElement('div');
		tableEl.id = 'tokens-table';
		tokensList.appendChild(tableEl);
		return tableEl;
	}

	function renderNewTokenAlert(tokenData) {
		var alertEl = newTokenTemplate.content.firstElementChild.cloneNode(true);
		var tokenInput = alertEl.querySelector('.new-token-value');
		var copyBtn = alertEl.querySelector('.copy-new-token');
		var copyStatus = alertEl.querySelector('.copy-token-status');
		var token = tokenData.token;

		alertEl.dataset.tokenId = tokenData._id;

		tokenInput.value = token;
		copyBtn.addEventListener('click', async () => {
			try {
				const result = await copyText(token, tokenInput);
				if (result.copied) {
					copyStatus.textContent = '';
					showSuccess('Token copied');
					return;
				}

				if (result.selected) {
					copyStatus.textContent = `Token selected. Press ${copyShortcut()} to copy.`;
					return;
				}

				showError('Could not copy token');
			} catch (err) {
				showError('Could not copy token');
			}
		});

		return alertEl;
	}

	function removeNewTokenAlert(tokenId) {
		tokensList.querySelectorAll('.new-token-alert').forEach((alertEl) => {
			if (alertEl.dataset.tokenId === tokenId) alertEl.remove();
		});
	}

	function renderTokenRow(token) {
		var rowEl = tokenRowTemplate.content.firstElementChild.cloneNode(true);
		var nameEl = rowEl.querySelector('.token-row-name');
		var createdEl = rowEl.querySelector('.token-row-created');
		var deleteBtn = rowEl.querySelector('.delete-token');

		nameEl.textContent = token.name;
		createdEl.textContent = `Created ${new Date(token.created_at).toLocaleDateString()}`;
		deleteBtn.dataset.id = token._id;

		return rowEl;
	}

	async function copyText(text, inputEl) {
		if (navigator.clipboard?.writeText && window.isSecureContext) {
			try {
				await navigator.clipboard.writeText(text);
				return { copied: true, selected: false };
			} catch (err) {
				// Fall back to selection-based copy below.
			}
		}

		const selectedInput = selectElement(inputEl);
		if (selectedInput && copySelection()) return { copied: true, selected: true };
		if (selectedInput) return { copied: false, selected: true };

		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'fixed';
		textarea.style.top = '-1000px';
		textarea.style.left = '-1000px';
		document.body.appendChild(textarea);

		try {
			const selectedTextarea = selectElement(textarea);
			if (selectedTextarea && copySelection()) return { copied: true, selected: true };
			if (selectedTextarea) return { copied: false, selected: true };
		} finally {
			textarea.remove();
		}

		throw new Error('Copy failed');
	}

	function selectElement(element) {
		if (!element) return false;

		element.focus({ preventScroll: true });
		element.select();
		if (typeof element.setSelectionRange === 'function') element.setSelectionRange(0, element.value.length);

		return true;
	}

	function copySelection() {
		if (typeof document.execCommand !== 'function') return false;

		try {
			return document.execCommand('copy');
		} catch (err) {
			return false;
		}
	}

	function copyShortcut() {
		return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'Cmd+C' : 'Ctrl+C';
	}
})();
