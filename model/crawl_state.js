import mongoose from 'mongoose';

const crawlStateSchema = new mongoose.Schema(
	{
		parent_url_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Url', required: true },
		normalized_url: { type: String, required: true },
		url: { type: String, required: true },
		status: { type: String, enum: ['queued', 'visited', 'failed'], default: 'queued', index: true },
		title: { type: String, default: '' },
		error: { type: String, default: '' },
		http_status: { type: Number, default: null },
		failure_type: { type: String, default: '' },
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		last_seen: { type: Date, default: Date.now },
		visited_at: { type: Date, default: null },
		failed_at: { type: Date, default: null },
	},
	{ timestamps: true },
);

crawlStateSchema.index({ host_id: 1, parent_url_id: 1, normalized_url: 1 }, { unique: true });
crawlStateSchema.index({ host_id: 1, parent_url_id: 1, status: 1, updatedAt: 1 });

export const CrawlState = mongoose.model('CrawlState', crawlStateSchema);
