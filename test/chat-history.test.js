import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('chat history fetches conversations and new chat restores page content', async () => {
	const source = fs.readFileSync(new URL('../public/js/chat.js', import.meta.url), 'utf8');
	const node = () => ({ style: {}, listeners: {}, children: [], classList: { add() {}, remove() {} }, addEventListener(event, listener) { this.listeners[event] = listener; }, appendChild(child) { this.children.push(child); } });
	const elements = Object.fromEntries(['chat-input', 'chat-send', 'chat-messages', 'clear-chat', 'chat-history-btn', 'page-content'].map((id) => [id, node()]));
	elements['chat-assistant-avatar-template'] = { content: { cloneNode: node } };
	const calls = [];
	const context = vm.createContext({
		document: { getElementById: (id) => elements[id] || null, createElement: node },
		window: { addEventListener() {} }, loadProjectFilter: async () => {},
		currentConversationId: 'existing', currentChatResults: [],
		api: async (_method, path) => { calls.push(path); return { conversations: [{ conversation_id: 'qa-conversation', title: 'QA conversation' }] }; },
	});
	vm.runInContext(source.slice(source.indexOf('function initChat()'), source.indexOf('async function loadProjectFilter()')), context);
	vm.runInContext('initChat()', context);
	await elements['chat-history-btn'].listeners.click();
	assert.deepEqual(calls, ['/chat/conversations?limit=10']);
	assert.equal(elements['chat-messages'].children[1].textContent, 'QA conversation');
	assert.doesNotThrow(() => elements['clear-chat'].listeners.click());
	assert.equal(context.currentConversationId, null);
});
