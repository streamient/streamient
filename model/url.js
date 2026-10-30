import mongoose from './mongoose.js';
import { textSanitizerPlugin } from '../modules/text_sanitize.js';

const urlSchema = new mongoose.Schema(
	{
		url: { type: String, required: true, trim: true },
		normalized_url: { type: String, default: '', trim: true },
		title: { type: String, default: '' },
		description: { type: String, default: '' },
		tags: [{ type: String, trim: true }],
		og_image: { type: String, default: '' },
		screenshot: { type: String, default: '' },
		text_content: { type: String, default: '' },
		crawl_claim: { type: String, default: null },
		crawl_claim_expires_at: { type: Date, default: null },
		crawl_enabled: { type: Boolean, default: false },
		last_crawled: { type: Date },
		crawl_frontier: { type: [String], default: [] },
		crawl_visited: { type: [String], default: [] },
		crawl_frontier_count: { type: Number, default: 0 },
		crawl_visited_count: { type: Number, default: 0 },
		crawl_failed_count: { type: Number, default: 0 },
		crawl_partial: { type: Boolean, default: false },
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		is_indexed: { type: Boolean, default: false },
		index_claim: { type: String, default: null },
		in_trash: { type: Boolean, default: false },
		trashed_at: { type: Date, default: null },
		obsidian_source: {
			connection_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianConnection' },
			file_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianFile' },
		},
	},
	{ timestamps: true, read: 'secondaryPreferred' },
);

urlSchema.index({ host_id: 1, in_trash: 1, project: 1 });
urlSchema.index({ host_id: 1, in_trash: 1, project: 1, createdAt: -1, _id: -1 });
urlSchema.index({ host_id: 1, project: 1, normalized_url: 1, in_trash: 1 });
urlSchema.index({ is_indexed: 1, in_trash: 1 });
urlSchema.index({ host_id: 1, is_indexed: 1, updatedAt: -1 });
urlSchema.index({ crawl_enabled: 1, crawl_partial: 1, last_crawled: 1 });
urlSchema.index({ 'obsidian_source.connection_id': 1, 'obsidian_source.file_id': 1 }, { sparse: true });

urlSchema.plugin(textSanitizerPlugin);

export const Url = mongoose.model('Url', urlSchema);
