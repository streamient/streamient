import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
	getLlmScopeForIntent,
	inferActionIntent,
	normalizeActionItemType,
	normalizeContextMoveResults,
	normalizeIntentForConversationFollowup,
	resultReferenceMoveRequest,
} from '../services/ai_chat_service.js';

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

	it('infers current-result move commands without LLM classification', () => {
		const intent = inferActionIntent('Move the results to streamient project');

		assert.equal(intent.intent, 'action');
		assert.equal(intent.action_type, 'move_to_project');
		assert.equal(intent.params.project_name, 'streamient');
	});

	it('normalizes move action item type aliases', () => {
		assert.equal(normalizeActionItemType('memories'), 'memory');
		assert.equal(normalizeActionItemType('memory'), 'memory');
		assert.equal(normalizeActionItemType('URL'), 'urls');
		assert.equal(normalizeActionItemType('records'), null);
	});

	it('only treats move commands as current-results actions when they reference visible results', () => {
		assert.equal(resultReferenceMoveRequest('Move the results to Streamient project'), true);
		assert.equal(resultReferenceMoveRequest('Move these records to Streamient project'), true);
		assert.equal(resultReferenceMoveRequest('Move all records related to Kumbukum to Streamient project'), false);
	});

	it('normalizes current result refs for mixed-type move actions', () => {
		const results = normalizeContextMoveResults([
			{ id: 'n1', _type: 'notes', project_id: 'old' },
			{ source_id: 'm1', type: 'memory', project_id: 'old' },
			{ id: 'p1', _type: 'pages', project_id: 'old' },
			{ id: 'n1', _type: 'notes', project_id: 'old' },
			{ id: 'u1', _type: 'urls', project_id: 'target' },
		], 'target');

		assert.deepEqual(results, [
			{ id: 'n1', type: 'notes' },
			{ id: 'm1', type: 'memory' },
		]);
	});
});
