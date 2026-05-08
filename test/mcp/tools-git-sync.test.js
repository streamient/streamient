import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';
import { gitSyncTools } from '../../apps/mcp/tools/git_sync.js';

describe('MCP Tools — Git Sync', () => {
	let api, tools;
	const repo = {
		_id: 'repo-1',
		repo_url: 'https://github.com/example/repo.git',
		branch: 'main',
		commit_sync_enabled: true,
		commit_history_days: 90,
	};

	beforeEach(() => {
		api = createMockApi({
			get: async (path) => {
				if (path.endsWith('/status')) {
					return {
						status: 'success',
						last_synced_at: '2026-05-08T00:00:00.000Z',
						last_commit_synced_at: '2026-05-08T00:00:00.000Z',
						last_commit_sha: 'abc123',
						summary: { imported_files: 1, exported_files: 2, imported_commits: 3, conflicts: 0, skipped: 1 },
						runs: [],
					};
				}
				return { repos: [repo], repo };
			},
			post: async (_path, body) => ({ repo: { ...repo, ...body }, message: 'Sync complete', summary: { imported_commits: 1 } }),
			put: async (_path, body) => ({ repo: { ...repo, ...body } }),
			delete: async () => ({}),
		});
		tools = gitSyncTools(api, FIXTURES.project._id);
	});

	it('add_git_repo passes commit sync options', async () => {
		await tools.add_git_repo.handler({
			repo_url: repo.repo_url,
			commit_sync_enabled: false,
			commit_history_days: 30,
		});

		assert.equal(api.lastCall.method, 'POST');
		assert.equal(api.lastCall.path, `/projects/${FIXTURES.project._id}/git-repos`);
		assert.equal(api.lastCall.body.commit_sync_enabled, false);
		assert.equal(api.lastCall.body.commit_history_days, 30);
	});

	it('update_git_repo passes commit sync options', async () => {
		await tools.update_git_repo.handler({
			id: repo._id,
			commit_sync_enabled: true,
			commit_history_days: 120,
		});

		assert.equal(api.lastCall.method, 'PUT');
		assert.equal(api.lastCall.path, `/git-repos/${repo._id}`);
		assert.equal(api.lastCall.body.commit_sync_enabled, true);
		assert.equal(api.lastCall.body.commit_history_days, 120);
	});

	it('git_sync_status returns rich status fields', async () => {
		const result = await tools.git_sync_status.handler({ id: repo._id });
		const parsed = JSON.parse(result.content[0].text);

		assert.equal(api.lastCall.path, `/git-repos/${repo._id}/status`);
		assert.equal(parsed.summary.imported_commits, 3);
		assert.equal(parsed.last_commit_sha, 'abc123');
	});
});
