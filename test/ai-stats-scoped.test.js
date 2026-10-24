import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { SearchFilters } from '../modules/search_filters.js';

const source = await readFile(fileURLToPath(new URL('../services/ai_chat_service.js', import.meta.url)), 'utf8');
const p1 = '507f1f77bcf86cd799439011';
const p2 = '507f1f77bcf86cd799439012';

function extractFunction(name) {
	const start = source.indexOf(`async function ${name}(`);
	assert.ok(start >= 0, name);
	const end = source.indexOf('\n// ─', start);
	return source.slice(start, end === -1 ? source.length : end);
}

function loadStats() {
	const code = [extractFunction('getActiveStats'), extractFunction('handleStats'), extractFunction('handleStatsStream')].join('\n\n');
	const prompts = [];
	const context = vm.createContext({
		SearchFilters,
		getProjectCounts: async () => ({
			[p1]: { notes: 2, memory: 3, urls: 4, emails: 5 },
			[p2]: { notes: 10, memory: 0, urls: 1, emails: 2 },
		}),
		ObsidianFile: { countDocuments: async (filter) => (filter.project === p1 ? 7 : 9) },
		chatModelCompletion: async (opts) => { prompts.push(opts.messages[0].content); return 'stub'; },
		parseStreamChunks: (value) => value,
	});
	vm.runInContext(code + '\nthis.handleStats = handleStats; this.handleStatsStream = handleStatsStream;', context);
	return { context, prompts };
}

test('AI stats count active records scoped to a project, not collection-wide chunks', async () => {
	const { context, prompts } = loadStats();
	await context.handleStats({ hostId: 'host', projectId: p1, query: 'How many notes?' });
	assert.ok(prompts[0].includes('2 notes'), prompts[0]);
	assert.ok(!prompts[0].includes('12 notes'), prompts[0]);
});

test('AI stats sum active records across projects when no project is requested', async () => {
	const { context, prompts } = loadStats();
	await context.handleStats({ hostId: 'host', query: 'How many notes?' });
	assert.ok(prompts[0].includes('12 notes'), prompts[0]);
});

test('AI stats preserve email gating and stream the same scoped counts', async () => {
	const { context, prompts } = loadStats();
	await context.handleStats({ hostId: 'host', projectId: p1, includeEmails: false, query: 'How many emails?' });
	assert.ok(prompts[0].includes('0 emails'), prompts[0]);
	await context.handleStatsStream({ hostId: 'host', projectId: p1, query: 'How many notes?' });
	assert.ok(prompts[1].includes('2 notes'), prompts[1]);
	assert.ok(!prompts[1].includes('12 notes'), prompts[1]);
});

test('AI stats reject a malformed project ID instead of casting it in the vault filter', async () => {
	const { context } = loadStats();
	await assert.rejects(context.handleStats({ hostId: 'host', projectId: 'not-an-object-id', query: 'How many notes?' }), (err) => err.status === 400);
});