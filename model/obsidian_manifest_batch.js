import mongoose from './mongoose.js';

const manifestEntrySchema = new mongoose.Schema({
	file_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianFile', default: null },
	path: { type: String, required: true },
	kind: { type: String, required: true },
	size: { type: Number, required: true, min: 0 },
	sha256: { type: String, required: true },
	modified_at: { type: Date, required: true },
	base_revision: { type: Number, default: 0, min: 0 },
	in_trash: { type: Boolean, default: false },
}, { _id: false });

const obsidianManifestBatchSchema = new mongoose.Schema({
	host_id: { type: String, required: true, index: true },
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	connection: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianConnection', required: true },
	manifest_id: { type: String, required: true },
	batch_index: { type: Number, required: true, min: 0 },
	files: { type: [manifestEntrySchema], default: [] },
	expires_at: { type: Date, required: true },
}, { timestamps: true, read: 'secondaryPreferred' });

obsidianManifestBatchSchema.index({ host_id: 1, user: 1, connection: 1, manifest_id: 1, batch_index: 1 }, { unique: true });
obsidianManifestBatchSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const ObsidianManifestBatch = mongoose.model('ObsidianManifestBatch', obsidianManifestBatchSchema);
