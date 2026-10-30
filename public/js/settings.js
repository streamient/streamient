// Settings profile — IIFE (loaded dynamically via SPA partial)
(function () {
	document.querySelectorAll('#profile-form').forEach(function (profileForm) {
		if (profileForm.dataset.profileSettingsBound) return;
		var avatarSelect = profileForm.querySelector('#profile-avatar-style');
		var preview = profileForm.querySelector('.avatar-settings img.avatar-image');
		var emailInput = profileForm.querySelector('#profile-email');
		var timezoneSelect = profileForm.querySelector('[data-timezone-select]');
		var timeFormatSelect = profileForm.querySelector('#profile-time-format');
		var timezoneHint = profileForm.querySelector('#profile-timezone-hint');
		var timeFormatHint = profileForm.querySelector('#profile-time-format-hint');

		function selectHasValue(select, value) {
			return Boolean(select && Array.prototype.some.call(select.options, function (option) {
				return option.value === value;
			}));
		}

		function applyBrowserSuggestions() {
			var dateFormat = window.StreamientDateFormat;
			if (timezoneSelect && timezoneSelect.value === 'UTC' && timezoneSelect.dataset.timezoneConfigured !== 'true') {
				var detectedTimezone = dateFormat?.detectBrowserTimeZone() || '';
				if (detectedTimezone && selectHasValue(timezoneSelect, detectedTimezone)) {
					timezoneSelect.value = detectedTimezone;
					if (timezoneHint) timezoneHint.textContent = 'Suggested from your browser. Save to apply it.';
				}
			}
			if (timeFormatSelect && !timeFormatSelect.dataset.savedTimeFormat) {
				timeFormatSelect.value = dateFormat?.detectBrowserTimeFormat() || '12-hour';
				if (timeFormatHint) timeFormatHint.textContent = 'Suggested from your browser. Save to apply it.';
			}
		}

		async function initTimezoneSelect() {
			if (!timezoneSelect || timezoneSelect.tomselect) return;
			try {
				var vendor = await import('/static/js/vendor.js');
				new vendor.TomSelect(timezoneSelect, {
					create: false,
					maxItems: 1,
					searchField: ['text', 'value'],
					sortField: [{ field: '$order' }],
				});
			} catch (err) {
				console.error('Timezone picker init error:', err);
			}
		}

		function updatePreview() {
			function updateThumbnail(image) {
				if (image) image.src = image.src.split('?')[0] + '?seed=' + encodeURIComponent(emailInput.value.trim());
			}
			profileForm.querySelectorAll('.avatar-picker-option img').forEach(updateThumbnail);
			Object.values(avatarSelect?.tomselect?.options || {}).forEach(function (option) { updateThumbnail(option.$div?.querySelector('img')); });
			if (preview && avatarSelect) preview.src = 'https://ava.helpmonks.com/9.x/' + avatarSelect.value + '/svg?seed=' + encodeURIComponent(emailInput.value.trim());
		}

		async function initAvatarSelect() {
			if (!avatarSelect || avatarSelect.tomselect) return;
			try {
				var vendor = await import('/static/js/vendor.js');
				if (!avatarSelect.isConnected || avatarSelect.tomselect) return;
				function renderAvatarOption(data) {
					var option = profileForm.querySelector('template[data-avatar-option="' + data.value + '"]').content.firstElementChild.cloneNode(true);
					option.querySelector('img').src = 'https://ava.helpmonks.com/9.x/' + data.value + '/svg?seed=' + encodeURIComponent(emailInput.value.trim());
					return option;
				}
				new vendor.TomSelect(avatarSelect, { plugins: ['dropdown_input'], create: false, maxItems: 1, hideSelected: false, searchField: ['text'], sortField: [{ field: '$order' }], render: { option: renderAvatarOption, item: renderAvatarOption }, onChange: updatePreview });
			} catch (err) {
				console.error('Avatar picker init error:', err);
			}
		}

		applyBrowserSuggestions();
		initTimezoneSelect();
		initAvatarSelect();

		if (profileForm && !profileForm.dataset.profileSettingsBound) {
			profileForm.dataset.profileSettingsBound = 'true';
			avatarSelect?.addEventListener('change', updatePreview);
			emailInput?.addEventListener('input', updatePreview);
			profileForm.addEventListener('submit', async function (e) {
				e.preventDefault();
				var button = profileForm.querySelector('[type=submit]');
				if (button.disabled) return;
				var data = {
					name: profileForm.querySelector('#profile-name').value.trim(),
					email: profileForm.querySelector('#profile-email').value.trim(),
					timezone: profileForm.querySelector('#profile-timezone').value.trim(),
					time_format: profileForm.querySelector('#profile-time-format').value,
					avatar_style: avatarSelect.value,
				};
				button.disabled = true;
				try {
					var result = await api('PUT', '/profile', data);
					__avatar_style = result.user?.avatar_style || data.avatar_style;
					__user_email = result.user?.email || data.email;
					__user_name = result.user?.name || data.name;
					makeAvatar.refresh();
					if (emailInput.value.trim() === data.email) emailInput.value = __user_email;
					updatePreview();
					if (timezoneSelect) timezoneSelect.dataset.timezoneConfigured = 'true';
					if (timeFormatSelect) timeFormatSelect.dataset.savedTimeFormat = result.user?.time_format || data.time_format;
					if (timezoneHint) timezoneHint.textContent = 'Times are displayed in this timezone.';
					if (timeFormatHint) timeFormatHint.textContent = 'Times use this clock format.';
					window.StreamientDateFormat?.setPreferences({
						timeZone: result.user?.timezone || data.timezone,
						timeFormat: result.user?.time_format || data.time_format,
					});
					showSuccess(result.email_change_pending ? 'Profile saved. Check your new email address for a confirmation link. Your current email stays active until you confirm.' : 'Profile updated');
				} catch (err) {
					showError(err.message);
				} finally {
					button.disabled = false;
				}
			});
		}
	});
})();
