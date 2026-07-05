import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlock from '@tiptap/extension-code-block';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// ---- Slash Command Menu ----

const SLASH_COMMANDS = [
	{ label: 'Heading 1', icon: 'textH1', command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
	{ label: 'Heading 2', icon: 'textH2', command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
	{ label: 'Heading 3', icon: 'textH3', command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
	{ label: 'Bullet List', icon: 'listBullets', command: (editor) => editor.chain().focus().toggleBulletList().run() },
	{ label: 'Ordered List', icon: 'listNumbers', command: (editor) => editor.chain().focus().toggleOrderedList().run() },
	{ label: 'Task List', icon: 'checkSquare', command: (editor) => editor.chain().focus().toggleTaskList().run() },
	{ label: 'Code Block', icon: 'codeBlock', command: (editor) => editor.chain().focus().toggleCodeBlock().run() },
	{ label: 'Blockquote', icon: 'quote', command: (editor) => editor.chain().focus().toggleBlockquote().run() },
	{ label: 'Horizontal Rule', icon: 'remove', command: (editor) => editor.chain().focus().setHorizontalRule().run() },
];

const editorIcon = (name, extraClasses = '') => window.StreamientIcons?.icon(name, extraClasses) || `<span class="st-icon material-symbols-outlined ${extraClasses}" aria-hidden="true">${name}</span>`;

function createSlashMenu() {
	const menu = document.createElement('div');
	menu.className = 'slash-menu';
	menu.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #dee2e6;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);padding:4px;display:none;max-height:300px;overflow-y:auto;min-width:200px;';
	document.body.appendChild(menu);
	return menu;
}

function renderSlashMenu(menu, commands, selectedIndex, onSelect) {
	menu.innerHTML = '';
	commands.forEach((cmd, i) => {
		const item = document.createElement('div');
		item.className = 'slash-menu-item' + (i === selectedIndex ? ' active' : '');
		item.style.cssText = 'padding:6px 10px;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:4px;font-size:14px;' +
			(i === selectedIndex ? 'background:#e9ecef;' : '');
		item.innerHTML = `${editorIcon(cmd.icon, 'slash-menu-icon')}<span>${cmd.label}</span>`;
		item.addEventListener('mousedown', (e) => {
			e.preventDefault();
			onSelect(i);
		});
		item.addEventListener('mouseenter', () => {
			menu.querySelectorAll('.slash-menu-item').forEach((el, j) => {
				el.style.background = j === i ? '#e9ecef' : '';
				el.className = 'slash-menu-item' + (j === i ? ' active' : '');
			});
		});
		menu.appendChild(item);
	});
}

const SlashCommands = Extension.create({
	name: 'slashCommands',

	addProseMirrorPlugins() {
		const editor = this.editor;
		const menu = createSlashMenu();
		let active = false;
		let filterText = '';
		let selectedIndex = 0;
		let filtered = SLASH_COMMANDS;

		function hide() {
			menu.style.display = 'none';
			active = false;
			filterText = '';
			selectedIndex = 0;
		}

		function show(coords) {
			menu.style.display = 'block';
			menu.style.left = coords.left + 'px';
			menu.style.top = (coords.bottom + 4) + 'px';
			active = true;
			filterText = '';
			selectedIndex = 0;
			filtered = SLASH_COMMANDS;
			renderSlashMenu(menu, filtered, selectedIndex, executeCommand);
		}

		function executeCommand(index) {
			const cmd = filtered[index];
			if (!cmd) return;
			// Delete the slash and filter text
			const { from } = editor.state.selection;
			const textBefore = editor.state.doc.textBetween(Math.max(0, from - filterText.length - 1), from, '');
			const slashPos = from - filterText.length - 1;
			editor.chain().focus().deleteRange({ from: Math.max(0, slashPos), to: from }).run();
			cmd.command(editor);
			hide();
		}

		return [
			new Plugin({
				key: new PluginKey('slashCommands'),
				props: {
					handleKeyDown(view, event) {
						if (!active) {
							if (event.key === '/' && view.state.selection.empty) {
								const { from } = view.state.selection;
								const textBefore = view.state.doc.textBetween(Math.max(0, from - 1), from, '');
								// Only show on empty line or after space
								if (from === 1 || textBefore === '' || textBefore === ' ' || textBefore === '\n') {
									setTimeout(() => {
										const coords = view.coordsAtPos(from);
										show(coords);
									}, 10);
								}
							}
							return false;
						}

						if (event.key === 'Escape') {
							hide();
							return true;
						}
						if (event.key === 'ArrowDown') {
							selectedIndex = (selectedIndex + 1) % filtered.length;
							renderSlashMenu(menu, filtered, selectedIndex, executeCommand);
							return true;
						}
						if (event.key === 'ArrowUp') {
							selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
							renderSlashMenu(menu, filtered, selectedIndex, executeCommand);
							return true;
						}
						if (event.key === 'Enter') {
							event.preventDefault();
							executeCommand(selectedIndex);
							return true;
						}
						if (event.key === 'Backspace') {
							if (filterText.length === 0) {
								hide();
								return false;
							}
							filterText = filterText.slice(0, -1);
							filtered = SLASH_COMMANDS.filter((c) =>
								c.label.toLowerCase().includes(filterText.toLowerCase()),
							);
							selectedIndex = 0;
							renderSlashMenu(menu, filtered, selectedIndex, executeCommand);
							return false;
						}
						if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
							filterText += event.key;
							filtered = SLASH_COMMANDS.filter((c) =>
								c.label.toLowerCase().includes(filterText.toLowerCase()),
							);
							selectedIndex = 0;
							if (filtered.length === 0) {
								hide();
								return false;
							}
							renderSlashMenu(menu, filtered, selectedIndex, executeCommand);
							return false;
						}
						return false;
					},
					handleClick() {
						if (active) hide();
						return false;
					},
				},
			}),
		];
	},
});

// ---- Editor Factory ----

export function createEditor(element, { content = '', onUpdate = null } = {}) {
	const editorOptions = {
		element,
		extensions: [
			StarterKit.configure({
				codeBlock: false,
				horizontalRule: false,
			}),
			Placeholder.configure({
				placeholder: 'Type "/" for commands, or start typing...',
			}),
			CodeBlock,
			HorizontalRule,
			TaskList,
			TaskItem.configure({
				nested: true,
			}),
			Image,
			SlashCommands,
		],
		content,
	};

	if (onUpdate) {
		editorOptions.onUpdate = ({ editor: ed }) => onUpdate(ed);
	}

	const editor = new Editor(editorOptions);

	return editor;
}

const EMAIL_TOOLBAR_BUTTONS = [
	{
		name: 'bold',
		label: 'Bold',
		icon: 'format_bold',
		isActive: (editor) => editor.isActive('bold'),
		run: (editor) => editor.chain().focus().toggleBold().run(),
	},
	{
		name: 'italic',
		label: 'Italic',
		icon: 'format_italic',
		isActive: (editor) => editor.isActive('italic'),
		run: (editor) => editor.chain().focus().toggleItalic().run(),
	},
	{
		name: 'underline',
		label: 'Underline',
		icon: 'format_underlined',
		isActive: (editor) => editor.isActive('underline'),
		run: (editor) => editor.chain().focus().toggleUnderline().run(),
	},
	{
		name: 'link',
		label: 'Link',
		icon: 'link',
		isActive: (editor) => editor.isActive('link'),
		run: (editor) => {
			const previous = editor.getAttributes('link').href || '';
			const href = window.prompt('Link URL', previous);
			if (href === null) return;
			const trimmed = href.trim();
			if (!trimmed) {
				editor.chain().focus().extendMarkRange('link').unsetLink().run();
				return;
			}
			editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
		},
	},
	{
		name: 'bulletList',
		label: 'Bullet list',
		icon: 'format_list_bulleted',
		isActive: (editor) => editor.isActive('bulletList'),
		run: (editor) => editor.chain().focus().toggleBulletList().run(),
	},
	{
		name: 'orderedList',
		label: 'Numbered list',
		icon: 'format_list_numbered',
		isActive: (editor) => editor.isActive('orderedList'),
		run: (editor) => editor.chain().focus().toggleOrderedList().run(),
	},
	{
		name: 'blockquote',
		label: 'Quote',
		icon: 'format_quote',
		isActive: (editor) => editor.isActive('blockquote'),
		run: (editor) => editor.chain().focus().toggleBlockquote().run(),
	},
	{
		name: 'undo',
		label: 'Undo',
		icon: 'undo',
		isActive: () => false,
		run: (editor) => editor.chain().focus().undo().run(),
	},
	{
		name: 'redo',
		label: 'Redo',
		icon: 'redo',
		isActive: () => false,
		run: (editor) => editor.chain().focus().redo().run(),
	},
	{
		name: 'clear',
		label: 'Clear formatting',
		icon: 'format_clear',
		isActive: () => false,
		run: (editor) => editor.chain().focus().unsetAllMarks().clearNodes().run(),
	},
];

function createEmailToolbar(editor) {
	const toolbar = document.createElement('div');
	toolbar.className = 'st-email-editor-toolbar';
	toolbar.setAttribute('role', 'toolbar');
	toolbar.setAttribute('aria-label', 'Email formatting');

	function refresh() {
		toolbar.querySelectorAll('button[data-command]').forEach((button) => {
			const command = EMAIL_TOOLBAR_BUTTONS.find((item) => item.name === button.dataset.command);
			if (!command) return;
			button.classList.toggle('active', Boolean(command.isActive(editor)));
		});
	}

	EMAIL_TOOLBAR_BUTTONS.forEach((command) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'btn btn-sm btn-outline-secondary st-email-editor-button';
		button.dataset.command = command.name;
		button.title = command.label;
		button.setAttribute('aria-label', command.label);
		button.innerHTML = editorIcon(command.icon);
		button.addEventListener('click', (event) => {
			event.preventDefault();
			command.run(editor);
			refresh();
		});
		toolbar.appendChild(button);
	});

	editor.on('selectionUpdate', refresh);
	editor.on('transaction', refresh);
	setTimeout(refresh, 0);
	return toolbar;
}

export function createEmailEditor(element, { content = '', onUpdate = null, placeholder = 'Write a reply...' } = {}) {
	element.innerHTML = '';
	const toolbarMount = document.createElement('div');
	const editorMount = document.createElement('div');
	editorMount.className = 'st-email-editor-body';
	element.appendChild(toolbarMount);
	element.appendChild(editorMount);

	const editorOptions = {
		element: editorMount,
		extensions: [
			StarterKit.configure({
				codeBlock: false,
				heading: false,
				horizontalRule: false,
			}),
			Placeholder.configure({ placeholder }),
		],
		content,
		editorProps: {
			attributes: {
				class: 'st-email-editor-prosemirror',
			},
		},
	};

	if (onUpdate) {
		editorOptions.onUpdate = ({ editor: ed }) => onUpdate(ed);
	}

	const editor = new Editor(editorOptions);
	toolbarMount.replaceWith(createEmailToolbar(editor));
	return editor;
}

// Export for global use
window.StreamientEditor = { createEditor, createEmailEditor };
