import mongoose from './mongoose.js';

const obsidianBlobChunkSchema = new mongoose.Schema({
	offset: { type: Number, required: true, min: 0 },
	size: { type: Number, required: true, min: 0 },
	checksum: { type: String, required: true },
	iv: { type: String, required: true },
	tag: { type: String, required: true },
	file_name: { type: String, required: true },
}, { _id: false });

const obsidianBlobSchema = new mongoose.Schema({
	host_id: { type: String, required: true, index: true },
	sha256: { type: String, required: true },
	total_bytes: { type: Number, required: true, min: 0 },
	mime_type: { type: String, default: 'application/octet-stream' },
	storage_key: { type: String, required: true },
	key_version: { type: Number, default: 1 },
	chunks: { type: [obsidianBlobChunkSchema], default: [] },
}, { timestamps: true, read: 'secondaryPreferred' });

obsidianBlobSchema.index({ host_id: 1, sha256: 1 }, { unique: true });

export const ObsidianBlob = mongoose.model('ObsidianBlob', obsidianBlobSchema);
