import mongoose from './mongoose.js';

// Retain abandoned claims: a paused process can resume an external import after its lease expires.
const schema = new mongoose.Schema({
	_id: String,
	host_id: { type: String, required: true },
	parent_url_id: { type: mongoose.Schema.Types.ObjectId, required: true },
	expires_at: { type: Date, required: true },
	finished: { type: Boolean, default: false },
	cleanup: { type: Boolean, default: true },
	displaced_ids: { type: [String], default: [] },
}, { timestamps: true, read: 'secondaryPreferred' });
schema.index({ expires_at: 1 });
export const CrawlPublication = mongoose.model('CrawlPublication', schema);
