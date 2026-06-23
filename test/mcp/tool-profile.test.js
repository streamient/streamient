import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { noteTools } from '../../apps/mcp/tools/notes.js';
import { memoryTools } from '../../apps/mcp/tools/memory.js';
import { urlTools } from '../../apps/mcp/tools/urls.js';
import { emailTools } from '../../apps/mcp/tools/emails.js';
import { projectTools } from '../../apps/mcp/tools/projects.js';
import { graphTools } from '../../apps/mcp/tools/graph.js';
import { gitSyncTools } from '../../apps/mcp/tools/git_sync.js';
import { applyPublicAppToolProfile, PUBLIC_APP_ALLOWED_TOOLS } from '../../apps/mcp/tools/profile.js';
import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';

describe('MCP public app tool profile', () => {
	function buildTools() {
		const api = createMockApi();
		const defaultProjectId = FIXTURES.project._id;
		return {
			...noteTools(api, defaultProjectId),
			...memoryTools(api, defaultProjectId),
			...urlTools(api, defaultProjectId),
			...emailTools(api, defaultProjectId),
			...projectTools(api),
			...graphTools(api),
			...gitSyncTools(api, defaultProjectId),
		};
	}

	it('exposes exactly the strict public app allowlist', () => {
		const tools = buildTools();
		const profiledTools = applyPublicAppToolProfile(tools);
		const names = Object.keys(profiledTools).sort();
		const expectedNames = [...PUBLIC_APP_ALLOWED_TOOLS].sort();

		assert.equal(Object.keys(tools).length, 44);
		assert.deepEqual(names, expectedNames);
	});

	it('excludes third-party content and integration tools from the public app profile', () => {
		const profiledTools = applyPublicAppToolProfile(buildTools());
		for (const name of [
			'search_knowledge',
			'save_url',
			'list_urls',
			'search_urls',
			'read_url',
			'ingest_email',
			'read_email',
			'list_emails',
			'search_emails',
			'get_email_thread',
			'create_link',
			'get_links',
			'get_graph',
			'traverse_graph',
			'list_git_repos',
			'add_git_repo',
			'git_sync_status',
			'chat',
		]) {
			assert.equal(profiledTools[name], undefined, `unexpected app tool: ${name}`);
		}
	});

	it('does not expose open-world tools or third-party ingestion inputs', () => {
		const forbiddenInputs = new Set(['url', 'crawl_enabled', 'raw_email', 'parsed_email', 'repo_url', 'auth_token']);
		const profiledTools = applyPublicAppToolProfile(buildTools());

		for (const [name, tool] of Object.entries(profiledTools)) {
			assert.equal(tool.annotations?.openWorldHint, false, `${name} is open-world`);
			for (const field of Object.keys(tool.inputSchema || {})) {
				assert.equal(forbiddenInputs.has(field), false, `${name} exposes forbidden input ${field}`);
			}
		}
	});
});
