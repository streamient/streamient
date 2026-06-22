import mongoose from './mongoose.js';

const gitRepoSchema = new mongoose.Schema(
	{
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		name: { type: String, default: '' }, // friendly label
		repo_url: { type: String, required: true },
		branch: { type: String, default: 'main' },
		auth_token: { type: String, default: '' }, // encrypted PAT
		sync_interval: { type: Number, default: 10, min: 5 }, // minutes
		enabled: { type: Boolean, default: true },
		// read_only: import-only (never writes back to git). read_write: also export notes/memories to git.
		sync_mode: { type: String, enum: ['read_only', 'read_write'], default: 'read_only' },
		notes_path: { type: String, default: 'notes' },
		memories_path: { type: String, default: 'memories' },
		sync_path: { type: String, default: '/' }, // subfolder within repo
		trash_on_delete: { type: Boolean, default: true },
		commit_sync_enabled: { type: Boolean, default: true },
		commit_history_days: { type: Number, default: 90, min: 1 },
		last_commit_synced_at: { type: Date, default: null },
		last_commit_sha: { type: String, default: '' },
		last_synced_at: { type: Date, default: null },
		last_sync_status: { type: String, enum: ['success', 'failed', 'in_progress', null], default: null },
		last_sync_error: { type: String, default: '' },
		last_sync_summary: {
			imported_files: { type: Number, default: 0 },
			exported_files: { type: Number, default: 0 },
			trashed_items: { type: Number, default: 0 },
			imported_commits: { type: Number, default: 0 },
			conflicts: { type: Number, default: 0 },
			skipped: { type: Number, default: 0 },
			started_at: { type: Date, default: null },
			finished_at: { type: Date, default: null },
			duration_ms: { type: Number, default: 0 },
			message: { type: String, default: '' },
		},
		sync_runs: [{
			_id: false,
			status: { type: String, enum: ['success', 'failed'], required: true },
			started_at: { type: Date, required: true },
			finished_at: { type: Date, required: true },
			duration_ms: { type: Number, default: 0 },
			imported_files: { type: Number, default: 0 },
			exported_files: { type: Number, default: 0 },
			trashed_items: { type: Number, default: 0 },
			imported_commits: { type: Number, default: 0 },
			conflicts: { type: Number, default: 0 },
			skipped: { type: Number, default: 0 },
			message: { type: String, default: '' },
		}],
	},
	{ timestamps: true },
);

gitRepoSchema.index({ host_id: 1, project: 1 });

export const GitRepo = mongoose.model('GitRepo', gitRepoSchema);
