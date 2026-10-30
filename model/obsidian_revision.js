import mongoose from './mongoose.js';

const obsidianRevisionSchema = new mongoose.Schema({
	connection: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianConnection', required: true, index: true },
	file: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianFile', required: true, index: true },
	host_id: { type: String, required: true, index: true },
	path: { type: String, required: true },
	revision: { type: Number, required: true, min: 0 },
	sha256: { type: String, default: '' },
	blob: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianBlob', default: null },
	modified_at: { type: Date, required: true },
	source: { type: String, enum: ['obsidian', 'streamient'], required: true },
	reason: { type: String, default: '' },
	expires_at: { type: Date, required: true },
}, { timestamps: true, read: 'secondaryPreferred' });

obsidianRevisionSchema.index({ host_id: 1, file: 1, revision: -1 });
obsidianRevisionSchema.index({ expires_at: 1 });

export const ObsidianRevision = mongoose.model('ObsidianRevision', obsidianRevisionSchema);
