import mongoose from './mongoose.js';

const noteImportChunkSchema = new mongoose.Schema({
	offset: { type: Number, required: true },
	size: { type: Number, required: true },
	checksum: { type: String, required: true },
}, { _id: false });

const noteImportUploadSchema = new mongoose.Schema({
	host_id: { type: String, required: true, index: true },
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
	original_name: { type: String, required: true, trim: true },
	title: { type: String, default: '', trim: true },
	tags: [{ type: String, trim: true }],
	mime_type: { type: String, default: '' },
	total_bytes: { type: Number, required: true, min: 0 },
	received_bytes: { type: Number, default: 0, min: 0 },
	state: { type: String, enum: ['uploading', 'processing', 'complete', 'failed', 'canceled'], default: 'uploading' },
	queue_attempt: { type: Number, default: 0 },
	chunks: { type: [noteImportChunkSchema], default: [] },
	note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
	error: { type: String, default: '' },
	last_activity_at: { type: Date, default: Date.now },
	expires_at: { type: Date, required: true },
}, { timestamps: true, read: 'secondaryPreferred' });

noteImportUploadSchema.index({ host_id: 1, user: 1, state: 1 });
noteImportUploadSchema.index({ host_id: 1, project: 1, updatedAt: -1 });
noteImportUploadSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const NoteImportUpload = mongoose.model('NoteImportUpload', noteImportUploadSchema);
