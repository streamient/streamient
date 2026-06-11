import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { noteTools } from '../../apps/mcp/tools/notes.js';
import { memoryTools } from '../../apps/mcp/tools/memory.js';
import { urlTools } from '../../apps/mcp/tools/urls.js';
import { emailTools } from '../../apps/mcp/tools/emails.js';
import { projectTools } from '../../apps/mcp/tools/projects.js';
import { graphTools } from '../../apps/mcp/tools/graph.js';
import { gitSyncTools } from '../../apps/mcp/tools/git_sync.js';
import { applyPublicAppToolProfile } from '../../apps/mcp/tools/profile.js';
import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';

describe('MCP public app tool profile', () => {
	it('excludes broad, destructive, and admin tools while keeping user workflow tools', () => {
		const api = createMockApi();
		const defaultProjectId = FIXTURES.project._id;
		const tools = {
			...noteTools(api, defaultProjectId),
			...memoryTools(api, defaultProjectId),
			...urlTools(api, defaultProjectId),
			...emailTools(api, defaultProjectId),
			...projectTools(api),
			...graphTools(api),
			...gitSyncTools(api, defaultProjectId),
		};

		const profiledTools = applyPublicAppToolProfile(tools);
		const names = Object.keys(profiledTools);

		assert.equal(Object.keys(tools).length, 44);
		assert.equal(names.length, 29);
		for (const name of [
			'chat',
			'create_project',
			'delete_email',
			'delete_link',
			'delete_memory',
			'delete_note',
			'delete_project',
			'delete_url',
			'remove_git_repo',
			'trigger_git_sync',
			'update_git_repo',
			'update_memory',
			'update_note',
			'update_project',
			'update_url',
		]) {
			assert.equal(profiledTools[name], undefined, `unexpected app tool: ${name}`);
		}
		for (const name of [
			'search_knowledge',
			'search_notes',
			'recall_memory',
			'read_note',
			'read_memory',
			'read_url',
			'read_email',
			'store_memory',
			'create_note',
			'save_url',
			'create_link',
			'suggest_memory_tags',
			'add_git_repo',
			'git_sync_status',
		]) {
			assert.ok(names.includes(name), `missing app tool: ${name}`);
		}
	});
});
