document.addEventListener('DOMContentLoaded', () => {
	async function getSwal() {
		const vendor = await import('/static/js/vendor.js');
		return vendor.Swal;
	}

	async function parseResponse(response) {
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.error || 'Request failed');
		return data;
	}

	async function showToast(message) {
		const Swal = await getSwal();
		await Swal.fire({
			icon: 'success',
			title: message,
			showConfirmButton: false,
			timer: 1800,
			toast: true,
			position: 'top-end',
		});
	}

	async function showError(message) {
		const Swal = await getSwal();
		await Swal.fire({ icon: 'error', title: 'Account request failed', text: message });
	}

	const newForm = document.getElementById('new-account-form');
	const newPlan = document.getElementById('new-plan');
	if (newPlan) {
		newPlan.addEventListener('change', () => {
			const selected = newPlan.selectedOptions[0];
			document.getElementById('new-limit-projects').value = selected.dataset.limitProjects;
			document.getElementById('new-limit-users').value = selected.dataset.limitUsers;
			document.getElementById('new-limit-ai-workflows').value = selected.dataset.limitAiWorkflows;
		});
	}

	if (newForm) {
		newForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			const submit = newForm.querySelector('[type="submit"]');
			submit.disabled = true;
			try {
				const response = await fetch('/admin/api/accounts', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: document.getElementById('new-name').value.trim(),
						owner_name: document.getElementById('new-owner-name').value.trim(),
						owner_email: document.getElementById('new-owner-email').value.trim(),
						plan: newPlan.value,
						limit_projects: Number(document.getElementById('new-limit-projects').value),
						limit_users: Number(document.getElementById('new-limit-users').value),
						limit_ai_workflows_per_day: Number(document.getElementById('new-limit-ai-workflows').value),
					}),
				});
				const data = await parseResponse(response);
				const Swal = await getSwal();
				await Swal.fire({
					icon: data.warnings?.length ? 'warning' : 'success',
					title: 'Account created',
					text: data.warnings?.length ? data.warnings.join('. ') : 'Magic link sent to the owner.',
				});
				window.location.href = `/admin/accounts/${data.account._id}/edit`;
			} catch (err) {
				console.error('Create account error:', err);
				await showError(err.message);
			} finally {
				submit.disabled = false;
			}
		});
	}

	const editForm = document.getElementById('edit-account-form');
	if (editForm) {
		editForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			const id = document.getElementById('account-id').value;
			const submit = editForm.querySelector('[type="submit"]');
			submit.disabled = true;
			try {
				const response = await fetch(`/admin/api/accounts/${id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: document.getElementById('name').value.trim(),
						owner_name: document.getElementById('owner-name').value.trim(),
						owner_email: document.getElementById('owner-email').value.trim(),
						is_active: document.getElementById('is-active').checked,
						plan: document.getElementById('plan').value,
						limit_projects: Number(document.getElementById('limit-projects').value),
						limit_users: Number(document.getElementById('limit-users').value),
						limit_ai_workflows_per_day: Number(document.getElementById('limit-ai-workflows').value),
					}),
				});
				await parseResponse(response);
				await showToast('Account updated');
			} catch (err) {
				console.error('Update account error:', err);
				await showError(err.message);
			} finally {
				submit.disabled = false;
			}
		});
	}

	async function deleteAccount(id, name) {
		const Swal = await getSwal();
		const confirmation = await Swal.fire({
			icon: 'warning',
			titleText: `Delete account "${name}"?`,
			text: 'This permanently removes the account and all team data. Type DELETE to confirm.',
			input: 'text',
			inputLabel: 'Confirmation',
			customClass: { input: 'form-control form-control-sm' },
			reverseButtons: true,
			inputValidator: (value) => value === 'DELETE' ? undefined : 'Type DELETE to confirm',
			showCancelButton: true,
			confirmButtonText: 'Delete Account',
			confirmButtonColor: '#d63939',
		});
		if (!confirmation.isConfirmed) return;
		try {
			const response = await fetch(`/admin/api/accounts/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: confirmation.value }) });
			const result = await parseResponse(response);
			if (response.status !== 202 || !result.deletion?.requested_at) throw new Error('Deletion was not accepted');
			const row = document.querySelector(`[data-account-id="${id}"]`);
			if (row) row.remove();
			if (editForm) {
				editForm.querySelectorAll('input, select, button').forEach((control) => { control.disabled = true; });
				document.getElementById('admin-deletion-status').dataset.stage = result.deletion.stage;
				pollDeletion();
			}
			await showToast('Account deletion requested');

		} catch (err) {
			console.error('Delete error:', err);
			await showError(err.message);
		}
	}

	const deletionStatus = document.getElementById('admin-deletion-status');
	const retryDeletion = document.getElementById('retry-account-deletion');
	async function pollDeletion() {
		if (!deletionStatus) return;
		try {
			const data = await parseResponse(await fetch(`/admin/api/accounts/${deletionStatus.dataset.id}/deletion`, { headers: { Accept: 'application/json' } }));
			const state = data.deletion;
			if (!state) return;
			deletionStatus.textContent = `Deletion: ${state.stage}${state.error ? ' — ' + state.error : ''}`;
			retryDeletion.hidden = state.stage !== 'failed';
			editForm.querySelectorAll('input, select, button').forEach((control) => { control.disabled = true; });
			if (!['failed', 'complete'].includes(state.stage)) setTimeout(pollDeletion, 3000);
		} catch (error) { await showError(error.message); }
	}
	if (deletionStatus?.dataset.stage) pollDeletion();
	retryDeletion?.addEventListener('click', async () => {
		retryDeletion.disabled = true;
		try { await parseResponse(await fetch(`/admin/api/accounts/${deletionStatus.dataset.id}/deletion/retry`, { method: 'POST' })); await pollDeletion(); } catch (error) { await showError(error.message); } finally { retryDeletion.disabled = false; }
	});

	document.getElementById('delete-account')?.addEventListener('click', () => {
		deleteAccount(document.getElementById('account-id').value, document.getElementById('name').value);
	});
	document.querySelectorAll('.btn-delete').forEach((button) => {
		button.addEventListener('click', () => deleteAccount(button.dataset.id, button.dataset.name));
	});
});
