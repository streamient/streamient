import mongoose from './mongoose.js';

const ITEM_TYPES = ['notes', 'memory', 'urls', 'emails'];

const graphLinkSchema = new mongoose.Schema(
	{
		source_id: { type: mongoose.Schema.Types.ObjectId, required: true },
		source_type: { type: String, required: true, enum: ITEM_TYPES },
		target_id: { type: mongoose.Schema.Types.ObjectId, required: true },
		target_type: { type: String, required: true, enum: ITEM_TYPES },
		label: { type: String, default: '', trim: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
	},
	{ timestamps: true },
);

graphLinkSchema.index({ host_id: 1, source_id: 1, target_id: 1 }, { unique: true });
graphLinkSchema.index({ host_id: 1, source_id: 1 });
graphLinkSchema.index({ host_id: 1, target_id: 1 });

export const GraphLink = mongoose.model('GraphLink', graphLinkSchema);
