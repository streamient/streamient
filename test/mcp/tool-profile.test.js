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
	it('excludes broad chat while keeping email tools', () => {
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
		assert.equal(names.length, 43);
		assert.equal(profiledTools.chat, undefined);
		for (const name of ['ingest_email', 'read_email', 'list_emails', 'search_emails', 'get_email_thread', 'delete_email']) {
			assert.ok(names.includes(name), `missing email tool: ${name}`);
		}
	});
});
