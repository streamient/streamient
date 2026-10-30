import mongoose from './mongoose.js';

const obsidianDeviceSchema = new mongoose.Schema({
	device_id: { type: String, required: true },
	name: { type: String, default: '' },
	platform: { type: String, default: '' },
	last_seen_at: { type: Date, default: Date.now },
	last_cursor: { type: Number, default: 0, min: 0 },
}, { _id: false });

const obsidianConnectionSchema = new mongoose.Schema({
	project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
	owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	host_id: { type: String, required: true, index: true },
	name: { type: String, default: 'Obsidian vault', trim: true },
	streamient_folder: { type: String, default: 'Streamient', trim: true },
	folder_relocation: {
		from: { type: String, default: '' },
		to: { type: String, default: '' },
		started_at: { type: Date, default: null },
	},
	enabled: { type: Boolean, default: true },
	sequence: { type: Number, default: 0, min: 0 },
	devices: { type: [obsidianDeviceSchema], default: [] },
	last_synced_at: { type: Date, default: null },
	last_sync_status: { type: String, enum: ['idle', 'syncing', 'success', 'failed'], default: 'idle' },
	last_sync_error: { type: String, default: '' },
	sync_requested_at: { type: Date, default: null },
	storage_bytes: { type: Number, default: 0, min: 0 },
	conflict_count: { type: Number, default: 0, min: 0 },
}, { timestamps: true, read: 'secondaryPreferred' });

obsidianConnectionSchema.index({ host_id: 1, project: 1 }, { unique: true });

export const ObsidianConnection = mongoose.model('ObsidianConnection', obsidianConnectionSchema);
