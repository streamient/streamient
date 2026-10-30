import mongoose from './mongoose.js';
import { textSanitizerPlugin } from '../modules/text_sanitize.js';

const memorySchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		content: { type: String, default: '' },
		tags: [{ type: String, trim: true }],
		source: { type: String, default: '' },
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		is_indexed: { type: Boolean, default: false },
		index_claim: { type: String, default: null },
		in_trash: { type: Boolean, default: false },
		trashed_at: { type: Date, default: null },
		git_source: {
			repo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GitRepo' },
			file_path: { type: String },
			last_sha: { type: String },
			last_synced_at: { type: Date },
			origin: { type: String, enum: ['import', 'push'] },
		},
		obsidian_source: {
			connection_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianConnection' },
			file_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianFile' },
		},
		git_commit: {
			repo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GitRepo' },
			sha: { type: String },
			short_sha: { type: String },
			branch: { type: String },
			author_name: { type: String },
			author_email: { type: String },
			authored_at: { type: Date },
			committer_name: { type: String },
			committer_email: { type: String },
			committed_at: { type: Date },
			files: [{
				_id: false,
				status: { type: String },
				path: { type: String },
			}],
		},
	},
	{ timestamps: true, read: 'secondaryPreferred' },
);

memorySchema.index({ host_id: 1, in_trash: 1, project: 1 });
memorySchema.index({ host_id: 1, in_trash: 1, project: 1, updatedAt: -1, _id: -1 });
memorySchema.index({ host_id: 1, in_trash: 1, project: 1, tags: 1 });
memorySchema.index({ is_indexed: 1, in_trash: 1 });
memorySchema.index({ host_id: 1, is_indexed: 1, updatedAt: -1 });
memorySchema.index({ 'git_source.repo_id': 1, 'git_source.file_path': 1 }, { sparse: true });
memorySchema.index({ 'obsidian_source.connection_id': 1, 'obsidian_source.file_id': 1 }, { sparse: true });
memorySchema.index({ 'git_commit.repo_id': 1, 'git_commit.sha': 1 }, { sparse: true });

memorySchema.plugin(textSanitizerPlugin);

export const Memory = mongoose.model('Memory', memorySchema);
