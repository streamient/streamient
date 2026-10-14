import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import pug from 'pug';
import { avatarStyles, avatarUrl } from '../modules/avatar.js';
import { toSafeUser, User } from '../model/user.js';

const source = fs.readFileSync(new URL('../public/js/settings.js', import.meta.url), 'utf8');

describe('avatar preferences', () => {
	it('matches all Helpmonks styles, safely encodes email seeds and defaults legacy records', async () => {
		assert.equal(avatarStyles.length, 30);
		assert.equal(avatarStyles[3][1], 'AvAvataaars Neutral');
		assert.equal(avatarStyles[16][1], 'Initials (default)');
		assert.equal(avatarUrl('bottts', 'a+b&x@example.com'), 'https://ava.helpmonks.com/9.x/bottts/svg?seed=a%2Bb%26x%40example.com');
		assert.equal(toSafeUser({ name: 'Legacy' }).avatar_style, 'initials');
		assert.equal(new User({ name: 'New', email: 'new@example.com' }).avatar_style, 'initials');
		assert.ok((await new User({ name: 'New', email: 'new@example.com', password: 'test', avatar_style: 'bad' }).validate().catch(err => err)).errors.avatar_style);
	});

	it('renders Pug thumbnails with the viewer preference and picker templates', () => {
		const render = pug.compileFile(new URL('../views/ajax/section/settings/profile.pug', import.meta.url).pathname);
		const html = render({ user: { _id: 'me', name: 'Me', email: 'a+b@example.com', avatar_style: 'glass' }, avatarStyles, avatarUrl, timezone_options: [], icon: () => '', title: 'Profile' });
		assert.equal((html.match(/data-avatar-option=/g) || []).length, 30);
		assert.match(html, /value="glass" selected/);
		assert.match(html, /glass\/svg\?seed=a%2Bb%40example.com/);
		assert.match(html, /avatar-picker-check/);
		assert.match(html, /class="avatar-fallback"[^>]*>ME<\/span>/);
		assert.match(html, /onerror="this.classList.remove\('avatar-image-loaded'\)"/);
		assert.match(html, /onload="this.classList.add\('avatar-image-loaded'\)"/);
		const teammate = pug.compile('include ../views/includes/avatar.pug\n+avatar("Team", "sm", "team@example.com", "team")', { filename: new URL('./test.pug', import.meta.url).pathname });
		assert.match(teammate({ user: { avatar_style: 'bottts' } }), /bottts\/svg\?seed=team%40example.com/);
	});

	it('previews locally, saves once, refreshes in place and preserves saved display on failure', async () => {
		const listeners = {};
		const button = { disabled: false };
		const form = { dataset: {}, querySelector: selector => selector === '[type=submit]' ? button : selector.includes('avatar-settings') ? preview : elements[selector.slice(1)], querySelectorAll: () => [], addEventListener: (name, fn) => { listeners[name] = fn; } };
		const detachedImage = { src: 'https://ava.helpmonks.com/9.x/bottts/svg?seed=old' };
		const select = { value: 'initials', tomselect: { options: { bottts: { $div: { querySelector: () => detachedImage } } } }, addEventListener: (name, fn) => { listeners['avatar-' + name] = fn; } };
		const email = { value: 'a+b@example.com', addEventListener: () => {} };
		const preview = {};
		const elements = { 'profile-form': form, 'profile-avatar-style': select, 'profile-email': email, 'profile-name': { value: 'Name' }, 'profile-timezone': { value: 'UTC' }, 'profile-time-format': { value: '12-hour', dataset: { savedTimeFormat: '12-hour' } } };
		let refreshes = 0, calls = 0, failed = false;
		const errors = [];
		const forms = [form];
		const context = { document: { querySelectorAll: () => forms }, window: {}, console, __user_id: 'me', __avatar_style: 'initials', __user_email: 'old@example.com', __user_name: 'Old', makeAvatar: { refresh: () => { refreshes++; } }, api: async (_method, _path, data) => { calls++; if (failed) throw Error('Save failed'); return { user: { ...data, email: data.email.toLowerCase() } }; }, showSuccess: () => {}, showError: error => errors.push(error) };
		vm.runInNewContext(source, context);
		vm.runInNewContext(source, context);
		select.value = 'glass';
		email.value = 'A+B@example.com';
		listeners['avatar-change']();
		assert.match(preview.src, /glass\/svg\?seed=A%2BB%40example.com/);
		assert.match(detachedImage.src, /seed=A%2BB%40example.com/);
		assert.equal(context.__avatar_style, 'initials');
		await listeners.submit({ preventDefault() {} });
		assert.equal(calls, 1);
		assert.equal(refreshes, 1);
		assert.equal(context.__avatar_style, 'glass');
		assert.equal(email.value, 'a+b@example.com');
		assert.match(preview.src, /seed=a%2Bb%40example.com/);
		assert.match(detachedImage.src, /seed=a%2Bb%40example.com/);
		failed = true;
		select.value = 'thumbs';
		await listeners.submit({ preventDefault() {} });
		assert.equal(context.__avatar_style, 'glass');
		assert.equal(refreshes, 1);
		assert.equal(button.disabled, false);
		assert.deepEqual(errors, ['Save failed']);
		const modalListeners = {};
		const modalPreview = {};
		const modalSelect = { ...select, value: 'rings', addEventListener: (name, fn) => { modalListeners['avatar-' + name] = fn; } };
		const modalElements = { ...elements, 'profile-avatar-style': modalSelect };
		const modalForm = { ...form, dataset: {}, querySelector: selector => selector === '[type=submit]' ? button : selector.includes('avatar-settings') ? modalPreview : modalElements[selector.slice(1)], addEventListener: (name, fn) => { modalListeners[name] = fn; } };
		forms.push(modalForm);
		vm.runInNewContext(source, context);
		modalListeners['avatar-change']();
		assert.match(modalPreview.src, /rings\/svg/);
		assert.match(preview.src, /glass\/svg/);
		failed = false;
		await modalListeners.submit({ preventDefault() {} });
		assert.equal(context.__avatar_style, 'rings');
		assert.equal(calls, 3);
	});
});
