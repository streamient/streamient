(function () {
	'use strict';

	var glyphs = {
		add: 'plus',
		apartment: 'building-skyscraper',
		archive: 'archive',
		arrowBack: 'arrow-left',
		arrowCircleRight: 'circle-arrow-right',
		arrow_drop_down: 'chevron-down',
		barChart: 'chart-bar',
		cancel: 'circle-x',
		check: 'check',
		checkCircle: 'circle-check',
		checkSquare: 'checkbox',
		clear: 'clear-formatting',
		clipboard: 'clipboard',
		clock: 'clock',
		codeBlock: 'code',
		copy: 'copy',
		creditCard: 'credit-card',
		cursor: 'hand-click',
		darkMode: 'moon',
		delete: 'trash',
		description: 'file-description',
		drive_file_move: 'folder-symlink',
		draft: 'file-pencil',
		edit: 'edit',
		email: 'mail',
		file: 'file',
		fingerprint: 'fingerprint',
		folder: 'folder',
		folderOpen: 'folder-open',
		format_bold: 'bold',
		format_clear: 'clear-formatting',
		format_italic: 'italic',
		format_list_bulleted: 'list',
		format_list_numbered: 'list-numbers',
		format_quote: 'blockquote',
		format_underlined: 'underline',
		gear: 'settings',
		gitBranch: 'git-branch',
		history: 'history',
		info: 'info-circle',
		key: 'key',
		lightbulb: 'lightbulb',
		lightMode: 'sun',
		link: 'link',
		listBullets: 'list',
		listNumbers: 'list-numbers',
		lock: 'lock',
		mail: 'mail',
		moreHoriz: 'dots',
		notebook: 'notebook',
		openInNew: 'external-link',
		palette: 'palette',
		question: 'help-circle',
		quote: 'blockquote',
		redo: 'arrow-forward-up',
		remove: 'minus',
		restore: 'restore',
		search: 'search',
		send: 'send',
		settings: 'settings',
		shieldCheck: 'shield-check',
		shieldWarning: 'shield-exclamation',
		signIn: 'login-2',
		signOut: 'logout',
		sparkle: 'sparkles',
		sync: 'refresh',
		tag: 'tag',
		textH1: 'h-1',
		textH2: 'h-2',
		textH3: 'h-3',
		undo: 'arrow-back-up',
		upload: 'upload',
		uploadCloud: 'cloud-upload',
		user: 'user',
		userAdd: 'user-plus',
		users: 'users',
		warning: 'alert-triangle',
		close: 'x',
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
		var classes = ['kk-icon', 'ti', 'ti-' + glyph, extraClasses || ''].filter(Boolean).join(' ');
		return '<span class="' + escapeHtml(classes) + '" aria-hidden="true"></span>';
	}

	window.KumbukumIcons = { glyphs: glyphs, icon: icon };
	window.kkIcon = icon;
}());
