(function () {
	'use strict';

	var glyphs = {
	add: 'add',
	apartment: 'apartment',
	arrowBack: 'arrow_back',
	arrowCircleRight: 'arrow_circle_right',
		barChart: 'bar_chart',
		cancel: 'cancel',
		check: 'check',
		checkCircle: 'check_circle',
		checkSquare: 'check_box',
		clipboard: 'content_paste',
		clock: 'schedule',
		codeBlock: 'code',
		copy: 'content_copy',
		creditCard: 'credit_card',
		cursor: 'touch_app',
		delete: 'delete',
		description: 'description',
		edit: 'edit',
		email: 'mail',
		file: 'draft',
		fingerprint: 'fingerprint',
		folder: 'folder',
		folderOpen: 'folder_open',
		gear: 'settings',
		gitBranch: 'account_tree',
		history: 'history',
		info: 'info',
		key: 'key',
		lightbulb: 'lightbulb',
		link: 'link',
		listBullets: 'format_list_bulleted',
		listNumbers: 'format_list_numbered',
		lock: 'lock',
		notebook: 'menu_book',
		openInNew: 'open_in_new',
		palette: 'palette',
		question: 'help',
		quote: 'format_quote',
		remove: 'remove',
		restore: 'restore',
		search: 'search',
		send: 'send',
		shieldCheck: 'verified_user',
		shieldWarning: 'gpp_maybe',
		signIn: 'login',
		signOut: 'logout',
		sparkle: 'auto_awesome',
		sync: 'sync',
		tag: 'sell',
		textH1: 'format_h1',
		textH2: 'format_h2',
		textH3: 'format_h3',
		upload: 'upload',
		uploadCloud: 'cloud_upload',
		user: 'person',
		userAdd: 'person_add',
		users: 'group',
		warning: 'warning',
		close: 'close',
		darkMode: 'dark_mode',
		lightMode: 'light_mode',
	};

	function escapeHtml(value) {
		return String(value).replace(/[&<>"']/g, function (ch) {
			return {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			}[ch];
		});
	}

	function icon(name, extraClasses) {
		var glyph = glyphs[name] || name;
		var classes = ['kk-icon', 'material-symbols-outlined', extraClasses || ''].filter(Boolean).join(' ');
		return '<span class="' + escapeHtml(classes) + '" aria-hidden="true">' + escapeHtml(glyph) + '</span>';
	}

	window.KumbukumIcons = { glyphs: glyphs, icon: icon };
	window.kkIcon = icon;
}());
