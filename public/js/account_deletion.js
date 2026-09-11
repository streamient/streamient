(async function () {
	const button = document.getElementById('request-account-deletion');
	const status = document.getElementById('account-deletion-status');
	if (!button || button.dataset.bound) return;
	button.dataset.bound = 'true';
	let preview;
	async function read(response) {
		if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Session expired. Sign in again.');
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'Account deletion is unavailable');
		return data;
	}
	try {
		preview = await read(await fetch(button.dataset.previewUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' }));
		button.hidden = false;
		status.textContent = 'Deletion is permanent and signs this account out on all devices.';
	} catch (error) { status.textContent = error.message; return; }
	button.addEventListener('click', async () => {
		const { Swal } = await import('/static/js/vendor.js');
		const target = document.getElementById('settingsModal') || document.body;
		const confirmation = await Swal.fire({ target, icon: 'warning', titleText: `Delete “${preview.name}”?`, text: 'All data for this account and its team will be permanently deleted. Type DELETE to confirm.', input: 'text', inputLabel: 'Confirmation', customClass: { input: 'form-control form-control-sm' }, inputAttributes: { autocomplete: 'off' }, showCancelButton: true, reverseButtons: true, confirmButtonText: 'Delete account', inputValidator: (value) => value === 'DELETE' ? undefined : 'Type DELETE to confirm' });
		if (!confirmation.isConfirmed) return;
		button.disabled = true;
		try {
			const response = await fetch(button.dataset.previewUrl, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: confirmation.value, confirmation_token: preview.confirmation_token }) });
			const result = await read(response);
			if (response.status !== 202 || result.host_id !== preview.host_id || !result.deletion?.requested_at) throw new Error('Account deletion was not accepted');
			status.textContent = result.message;
			await Swal.fire({ target, icon: 'success', title: 'Account deletion requested', text: 'Cleanup continues in the background.' });
			window.location.assign(result.redirect_to);
		} catch (error) {
			button.disabled = false;
			await Swal.fire({ target, icon: 'error', title: 'Account deletion unavailable', text: error.message });
		}
	});
}());
