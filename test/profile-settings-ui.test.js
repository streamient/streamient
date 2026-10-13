import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import pug from 'pug';
import { fileURLToPath } from 'node:url';

import { avatarStyles, avatarUrl } from '../modules/avatar.js';
import { getTimezoneOptions } from '../modules/timezones.js';

const settingsSource = fs.readFileSync(new URL('../public/js/settings.js', import.meta.url), 'utf8');
const dateFormatSource = fs.readFileSync(new URL('../public/js/date_format.js', import.meta.url), 'utf8');

function localPath(url) {
	return fileURLToPath(url);
}

function profileLocals(overrides = {}) {
	return {
		avatarStyles, avatarUrl,
		title: 'Profile',
		v: 'test',
		user: {
			_id: 'user-1',
			name: 'Nitai',
			email: 'nitai@fastmail.com',
			timezone: 'UTC',
			timezone_configured: false,
			time_format: '',
		},
		timezone_options: getTimezoneOptions(),
		can_manage_team: false,
		can_manage_restricted_settings: false,
		byo_ai_enabled: false,
		is_hosted: false,
		icon(name, classes = '') {
			return `<span class="st-icon ${classes}">${name}</span>`;
		},
		...overrides,
	};
}

function browserDateFormatContext() {
	const NativeDateTimeFormat = Intl.DateTimeFormat;
	function MockDateTimeFormat(locale, options) {
		if (!(this instanceof MockDateTimeFormat)) return new MockDateTimeFormat(locale, options);
		this.options = options || {};
		this.delegate = new NativeDateTimeFormat(locale, options);
	}
	MockDateTimeFormat.prototype.format = function (value) {
		return this.delegate.format(value);
	};
	MockDateTimeFormat.prototype.formatToParts = function (value) {
		return this.delegate.formatToParts(value);
	};
	MockDateTimeFormat.prototype.resolvedOptions = function () {
		const resolved = this.delegate.resolvedOptions();
		if (this.options.hour) return { ...resolved, hour12: false, hourCycle: 'h23' };
		return { ...resolved, timeZone: 'America/New_York' };
	};

	const dateElement = {
		dataset: {
			dateValue: '2026-05-05T19:10:00.000Z',
			dateFormat: 'date-time',
			datePrefix: 'Updated ',
		},
		textContent: '',
	};
	const events = [];
	class CustomEvent {
		constructor(type, init) {
			this.type = type;
			this.detail = init?.detail;
		}
	}
	const document = {
		querySelectorAll() {
			return [dateElement];
		},
	};
	const window = {
		STREAMIENTDateSettings: { timeZone: 'UTC', timeFormat: null },
		CustomEvent,
		dispatchEvent(event) {
			events.push(event);
		},
	};
	const context = {
		window,
		document,
		CustomEvent,
		Intl: { DateTimeFormat: MockDateTimeFormat },
		Date,
		Number,
		Object,
		Array,
		JSON,
		console,
	};
	vm.runInNewContext(dateFormatSource, context);
	return { dateElement, events, helper: window.StreamientDateFormat, window };
}

describe('profile timezone and clock UI', () => {
	it('uses the same shared searchable controls for full and AJAX views', () => {
		const fullSource = fs.readFileSync(new URL('../views/settings/profile.pug', import.meta.url), 'utf8');
		const ajaxSource = fs.readFileSync(new URL('../views/ajax/section/settings/profile.pug', import.meta.url), 'utf8');
		const render = pug.compileFile(localPath(new URL('../views/ajax/section/settings/profile.pug', import.meta.url)));
		const html = render(profileLocals());

		assert.match(fullSource, /include \.\.\/includes\/settings_profile_content/);
		assert.match(ajaxSource, /include \.\.\/\.\.\/\.\.\/includes\/settings_profile_content/);
		assert.match(html, /<select[^>]+id="profile-timezone"[^>]+data-timezone-select/);
		assert.match(html, /data-timezone-configured="false"/);
		assert.match(html, /<option value="UTC" selected(?:="selected")?>UTC<\/option>/);
		assert.match(html, /id="profile-time-format"/);
		assert.match(html, /form-select-sm/);
		assert.match(html, /btn btn-sm btn-primary/);
		assert.doesNotMatch(html, /<datalist/);
		assert.doesNotMatch(html, /supportedValuesOf/);
	});

	it('suggests browser preferences locally and updates formatters only after submit', () => {
		assert.match(settingsSource, /timezoneSelect\.dataset\.timezoneConfigured !== 'true'/);
		assert.match(settingsSource, /detectBrowserTimeZone/);
		assert.match(settingsSource, /detectBrowserTimeFormat/);
		assert.match(settingsSource, /addEventListener\('submit'/);
		assert.match(settingsSource, /api\('PUT', '\/profile', data\)/);
		assert.match(settingsSource, /StreamientDateFormat\?\.setPreferences/);
		assert.doesNotMatch(settingsSource, /location\.(?:reload|href)/);
	});

	it('detects browser defaults and refreshes marked timestamps in place', () => {
		const { dateElement, events, helper, window } = browserDateFormatContext();

		assert.equal(helper.detectBrowserTimeZone(), 'America/New_York');
		assert.equal(helper.detectBrowserTimeFormat(), '24-hour');
		helper.setPreferences({ timeZone: 'UTC', timeFormat: '12-hour' });
		const twelveHour = dateElement.textContent;
		helper.setPreferences({ timeZone: 'UTC', timeFormat: '24-hour' });

		assert.match(twelveHour, /^Updated .*7:10 PM$/);
		assert.match(dateElement.textContent, /^Updated .*19:10$/);
		assert.equal(window.STREAMIENTDateSettings.timeZone, 'UTC');
		assert.equal(window.STREAMIENTDateSettings.timeFormat, '24-hour');
		assert.equal(events.length, 2);
	});
});
