import { z } from 'zod';

/**
 * MCP tool definitions: Git Sync
 */
export function gitSyncTools(api, defaultProjectId) {
	return {
		list_git_repos: {
			description: 'List git repos configured for a project',
			inputSchema: {
				project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
			},
			handler: async (args) => {
				const pid = args.project_id || defaultProjectId;
				const { repos } = await api.get(`/projects/${pid}/git-repos`);
				return { content: [{ type: 'text', text: JSON.stringify(repos, null, 2), cache_control: { type: 'ephemeral' } }] };
			},
		},

		add_git_repo: {
			description: 'Add a git repository to sync with a project. Syncs markdown files as notes/memories.',
			inputSchema: {
				repo_url: z.string().describe('HTTPS git repo URL'),
				name: z.string().optional().describe('Friendly label for this repo'),
				branch: z.string().optional().describe('Branch to sync (default: main)'),
				auth_token: z.string().optional().describe('Personal access token for private repos'),
				notes_path: z.string().optional().describe('Directory in repo mapped to notes (default: notes)'),
				memories_path: z.string().optional().describe('Directory in repo mapped to memories (default: memories)'),
				sync_path: z.string().optional().describe('Subfolder within repo to sync (default: /)'),
				sync_interval: z.number().optional().describe('Sync interval in minutes (default: 10)'),
				commit_sync_enabled: z.boolean().optional().describe('Import git commits as memories (default: true)'),
				commit_history_days: z.number().optional().describe('Days of commit history to backfill on first sync (default: 90)'),
				project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
			},
			handler: async (args) => {
				const { project_id, ...rest } = args;
				const pid = project_id || defaultProjectId;
				const { repo } = await api.post(`/projects/${pid}/git-repos`, rest);
				return { content: [{ type: 'text', text: JSON.stringify(repo, null, 2) }] };
			},
		},

		update_git_repo: {
			description: 'Update settings of a configured git repo',
			inputSchema: {
				id: z.string().describe('Git repo ID'),
				name: z.string().optional(),
				repo_url: z.string().optional(),
				branch: z.string().optional(),
				auth_token: z.string().optional(),
				enabled: z.boolean().optional(),
				notes_path: z.string().optional(),
				memories_path: z.string().optional(),
				sync_path: z.string().optional(),
				sync_interval: z.number().optional(),
				trash_on_delete: z.boolean().optional(),
				commit_sync_enabled: z.boolean().optional(),
				commit_history_days: z.number().optional(),
			},
			handler: async (args) => {
				const { id, ...rest } = args;
				const { repo } = await api.put(`/git-repos/${id}`, rest);
				return { content: [{ type: 'text', text: JSON.stringify(repo, null, 2) }] };
			},
		},

		remove_git_repo: {
			description: 'Remove a git repo configuration and its local working copy',
			inputSchema: {
				id: z.string().describe('Git repo ID'),
			},
			handler: async (args) => {
				await api.delete(`/git-repos/${args.id}`);
				return { content: [{ type: 'text', text: 'Git repo removed' }] };
			},
		},

		trigger_git_sync: {
			description: 'Manually trigger a sync for a git repo (pull from git + push to git)',
			inputSchema: {
				id: z.string().describe('Git repo ID'),
			},
			handler: async (args) => {
				const result = await api.post(`/git-repos/${args.id}/sync`, {});
				return { content: [{ type: 'text', text: result.message || 'Sync complete' }] };
			},
		},

		git_sync_status: {
			description: 'Get the current sync status of a git repo',
			inputSchema: {
				id: z.string().describe('Git repo ID'),
			},
			handler: async (args) => {
				const status = await api.get(`/git-repos/${args.id}/status`);
				return { content: [{ type: 'text', text: JSON.stringify(status, null, 2), cache_control: { type: 'ephemeral' } }] };
			},
		},
	};
}
