import mongoose from './mongoose.js';

const obsidianFileSchema = new mongoose.Schema({
	connection: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianConnection', required: true, index: true },
	project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
	host_id: { type: String, required: true, index: true },
	path: { type: String, required: true },
	kind: { type: String, enum: ['markdown', 'canvas', 'base', 'document', 'image', 'audio', 'video', 'other'], required: true },
	mime_type: { type: String, default: 'application/octet-stream' },
	size: { type: Number, default: 0, min: 0 },
	sha256: { type: String, default: '' },
	blob: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianBlob', default: null },
	revision: { type: Number, default: 0, min: 0 },
	modified_at: { type: Date, required: true },
	last_source: { type: String, enum: ['obsidian', 'streamient'], default: 'obsidian' },
	last_device_id: { type: String, default: '' },
	note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
	memory: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', default: null },
	url: { type: mongoose.Schema.Types.ObjectId, ref: 'Url', default: null },
	projection_detached: { type: Boolean, default: false },
	text_content: { type: String, default: '' },
	is_indexed: { type: Boolean, default: false },
	extraction_status: { type: String, enum: ['not_needed', 'pending', 'processing', 'complete', 'failed'], default: 'not_needed' },
	extraction_error: { type: String, default: '' },
	in_trash: { type: Boolean, default: false },
	trashed_at: { type: Date, default: null },
}, { timestamps: true });

obsidianFileSchema.index({ host_id: 1, connection: 1, path: 1 }, { unique: true });
obsidianFileSchema.index({ host_id: 1, project: 1, in_trash: 1, updatedAt: -1 });

export const ObsidianFile = mongoose.model('ObsidianFile', obsidianFileSchema);
