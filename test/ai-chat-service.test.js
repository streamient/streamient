import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getLlmScopeForIntent, inferActionIntent, normalizeActionItemType, normalizeIntentForConversationFollowup } from '../services/ai_chat_service.js';

describe('AI Chat follow-up intent normalization', () => {
	it('downgrades non-explicit action intents to conversation for existing threads', () => {
		const intent = {
			intent: 'action',
			action_type: 'create_note',
			params: { title: 'Test Note', content: 'This is a simple test note.' },
		};

		const normalized = normalizeIntentForConversationFollowup(
			intent,
			'which result is the simple test note?',
			'conv-123',
		);

		assert.equal(normalized.intent, 'conversation');
		assert.equal(normalized.action_type, null);
		assert.deepEqual(normalized.params, {});
	});

	it('keeps explicit action intents for existing threads', () => {
		const intent = {
			intent: 'action',
			action_type: 'create_note',
			params: { title: 'Test Note' },
		};

		const normalized = normalizeIntentForConversationFollowup(
			intent,
			'create a note called Test Note',
			'conv-123',
		);

		assert.equal(normalized.intent, 'action');
		assert.equal(normalized.action_type, 'create_note');
	});

	it('treats follow-up references as conversation even when classifier says search', () => {
		const intent = {
			intent: 'search',
			query: 'release notes',
		};

		const normalized = normalizeIntentForConversationFollowup(
			intent,
			'which one mentions passkey verification?',
			'conv-123',
		);

		assert.equal(normalized.intent, 'conversation');
	});

	it('leaves standalone requests unchanged without a conversation id', () => {
		const intent = {
			intent: 'action',
			action_type: 'create_note',
			params: { title: 'Standalone' },
		};

		const normalized = normalizeIntentForConversationFollowup(
			intent,
			'create a note called Standalone',
			null,
		);

		assert.equal(normalized.intent, 'action');
		assert.equal(normalized.action_type, 'create_note');
	});

	it('uses the email LLM scope only for email-only intents', () => {
		assert.equal(getLlmScopeForIntent({ types: ['emails'] }), 'email');
		assert.equal(getLlmScopeForIntent({ types: ['emails', 'notes'] }), 'global');
		assert.equal(getLlmScopeForIntent({ types: null }), 'global');
	});

	it('infers explicit move-to-project commands without LLM classification', () => {
		const intent = inferActionIntent('Move all records related to Kumbukum into the Streamient project');

		assert.equal(intent.intent, 'action');
		assert.equal(intent.action_type, 'move_to_project');
		assert.equal(intent.params.project_name, 'Streamient');
		assert.equal(intent.params.item_type, 'records');
	});

	it('normalizes move action item type aliases', () => {
		assert.equal(normalizeActionItemType('memories'), 'memory');
		assert.equal(normalizeActionItemType('memory'), 'memory');
		assert.equal(normalizeActionItemType('URL'), 'urls');
		assert.equal(normalizeActionItemType('records'), null);
	});
});
