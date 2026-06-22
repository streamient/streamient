import mongoose from './mongoose.js';

const exportSchema = new mongoose.Schema(
	{
		token: { type: String, required: true, unique: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		file_path: { type: String, default: '' },
		status: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
		expires_at: { type: Date, default: null },
		error: { type: String, default: '' },
	},
	{ timestamps: true },
);

exportSchema.index({ host_id: 1, status: 1 });
exportSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expires_at: { $type: 'date' } } });

export const Export = mongoose.model('Export', exportSchema);
