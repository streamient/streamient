import mongoose from './mongoose.js';

const obsidianChangeSchema = new mongoose.Schema({
	connection: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianConnection', required: true, index: true },
	file: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianFile', required: true },
	host_id: { type: String, required: true, index: true },
	sequence: { type: Number, required: true, min: 1 },
	operation: { type: String, enum: ['create', 'update', 'rename', 'trash', 'restore'], required: true },
	path: { type: String, required: true },
	previous_path: { type: String, default: '' },
	revision: { type: Number, required: true, min: 1 },
	sha256: { type: String, default: '' },
	modified_at: { type: Date, required: true },
	source: { type: String, enum: ['obsidian', 'streamient'], required: true },
	device_id: { type: String, default: '' },
	operation_id: { type: String, required: true },
	conflict: { type: Boolean, default: false },
	conflict_reason: { type: String, default: '' },
	losing_revision: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianRevision', default: null },
}, { timestamps: true, read: 'secondaryPreferred' });

obsidianChangeSchema.index({ host_id: 1, connection: 1, sequence: 1 }, { unique: true });
obsidianChangeSchema.index({ host_id: 1, connection: 1, operation_id: 1 }, { unique: true });

export const ObsidianChange = mongoose.model('ObsidianChange', obsidianChangeSchema);
