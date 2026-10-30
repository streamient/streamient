import mongoose from './mongoose.js';
import { textSanitizerPlugin } from '../modules/text_sanitize.js';

const noteSchema = new mongoose.Schema(
	{
		title: { type: String, default: 'Untitled', trim: true },
		content: { type: String, default: '' }, // HTML from TipTap
		text_content: { type: String, default: '' }, // Plain text for indexing
		tags: [{ type: String, trim: true }],
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
	},
	{ timestamps: true, read: 'secondaryPreferred' },
);

noteSchema.index({ host_id: 1, in_trash: 1, project: 1 });
noteSchema.index({ host_id: 1, in_trash: 1, project: 1, updatedAt: -1, _id: -1 });
noteSchema.index({ is_indexed: 1, in_trash: 1 });
noteSchema.index({ host_id: 1, is_indexed: 1, updatedAt: -1 });
noteSchema.index({ 'git_source.repo_id': 1, 'git_source.file_path': 1 }, { sparse: true });
noteSchema.index({ 'obsidian_source.connection_id': 1, 'obsidian_source.file_id': 1 }, { sparse: true });

noteSchema.plugin(textSanitizerPlugin);

export const Note = mongoose.model('Note', noteSchema);
