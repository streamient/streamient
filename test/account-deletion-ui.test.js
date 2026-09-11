import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import pug from 'pug';

it('renders deletion only for owners, without impersonation', () => {
	for (const role of ['owner', 'admin', 'member']) {
		for (const impersonating of [true, false]) {
			const html = pug.renderFile('views/ajax/section/settings/_account_deletion.pug', { member_role: role, impersonating, host_id: 'aaaaaaaaaaaaaaaaaaaaaaaa', v: 'test', account_url: (url) => url });
			assert.equal(html.includes('id="request-account-deletion"'), role === 'owner' && !impersonating);
		}
	}
});

it('accepts only HTTP 202, updates its status, and leaves via sign-out without reloading a section', async () => {
	const original = await fs.readFile('public/js/account_deletion.js', 'utf8');
	const source = original.replace("await import('/static/js/vendor.js')", 'await vendor()');
	for (const accepted of [true, false]) {
		let click;
		let location;
		const messages = [];
		const requests = [];
		const button = { dataset: { previewUrl: '/api/v1/account/deletion?g=account' }, hidden: true, disabled: false, addEventListener: (name, callback) => { click = callback; } };
		const status = { textContent: '' };
		const context = {
			document: { getElementById: (id) => id === 'request-account-deletion' ? button : status },
			vendor: async () => ({ Swal: { fire: async (options) => { messages.push(options); return options.input ? { isConfirmed: true, value: 'DELETE' } : {}; } } }),
			fetch: async (url, options = {}) => {
				requests.push({ url, options });
				return { status: options.method ? (accepted ? 202 : 200) : 200, ok: true, headers: { get: () => 'application/json' }, json: async () => options.method ? { host_id: 'host', deletion: { requested_at: 'now' }, message: 'Cleanup continues in the background.', redirect_to: '/login' } : { host_id: 'host', name: 'Fixture account', eligible: true, confirmation_token: 'fixture-token' } };
			},
			window: { location: { assign: (url) => { location = url; }, reload: () => assert.fail('Page reload') } },
			loadSection: () => assert.fail('Section reload'),
			loadSettingsSection: () => assert.fail('Settings reload'),
		};
		await vm.runInNewContext(source, context);
		assert.equal(button.hidden, false);
		await click();
		assert.equal(requests.length, 2);
		assert.equal(JSON.parse(requests[1].options.body).confirmation, 'DELETE');
		assert.equal(messages[0].inputValidator('wrong'), 'Type DELETE to confirm');
		assert.equal(location, accepted ? '/login' : undefined);
		assert.equal(messages.at(-1).icon, accepted ? 'success' : 'error');
		assert.equal(button.disabled, accepted);
	}
});
