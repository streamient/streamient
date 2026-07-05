const ICON_GLYPHS = {
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

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
}[ch]));

const attrsToHtml = (attrs = {}) => Object.entries(attrs)
	.filter(([, value]) => value !== undefined && value !== null && value !== false)
	.map(([key, value]) => value === true ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`)
	.join('');

export function icon(name, extraClasses = '', attrs = {}) {
	const glyph = ICON_GLYPHS[name] || name;
	const classes = ['st-icon', 'ti', `ti-${glyph}`, extraClasses].filter(Boolean).join(' ');
	return `<span class="${escapeHtml(classes)}" aria-hidden="true"${attrsToHtml(attrs)}></span>`;
}

export function installIconLocals(app) {
	app.locals.icon = icon;
	app.locals.icons = ICON_GLYPHS;
}

export { ICON_GLYPHS };
