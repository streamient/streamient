const ICON_GLYPHS = {
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
	const classes = ['kk-icon', 'material-symbols-outlined', extraClasses].filter(Boolean).join(' ');
	return `<span class="${escapeHtml(classes)}" aria-hidden="true"${attrsToHtml(attrs)}>${escapeHtml(glyph)}</span>`;
}

export function installIconLocals(app) {
	app.locals.icon = icon;
	app.locals.icons = ICON_GLYPHS;
}

export { ICON_GLYPHS };
