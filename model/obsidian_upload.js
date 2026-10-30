import mongoose from './mongoose.js';

const obsidianUploadChunkSchema = new mongoose.Schema({
	offset: { type: Number, required: true, min: 0 },
	size: { type: Number, required: true, min: 0 },
	checksum: { type: String, required: true },
	iv: { type: String, required: true },
	tag: { type: String, required: true },
	file_name: { type: String, required: true },
}, { _id: false });

const obsidianUploadSchema = new mongoose.Schema({
	host_id: { type: String, required: true, index: true },
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	connection: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianConnection', required: true, index: true },
	path: { type: String, required: true },
	mime_type: { type: String, default: 'application/octet-stream' },
	total_bytes: { type: Number, required: true, min: 0 },
	received_bytes: { type: Number, default: 0, min: 0 },
	sha256: { type: String, required: true },
	state: { type: String, enum: ['uploading', 'complete', 'failed', 'canceled'], default: 'uploading' },
	chunks: { type: [obsidianUploadChunkSchema], default: [] },
	blob: { type: mongoose.Schema.Types.ObjectId, ref: 'ObsidianBlob', default: null },
	error: { type: String, default: '' },
	expires_at: { type: Date, required: true },
}, { timestamps: true, read: 'secondaryPreferred' });

obsidianUploadSchema.index({ host_id: 1, user: 1, state: 1 });
obsidianUploadSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const ObsidianUpload = mongoose.model('ObsidianUpload', obsidianUploadSchema);
