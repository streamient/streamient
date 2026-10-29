import mongoose from './mongoose.js';
import { EXPORT_ADMISSION_OPTIONS } from '../services/export_ttl_migration_service.js';

const exportSchema = new mongoose.Schema(
	{
		token: { type: String, required: true, unique: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		file_path: { type: String, default: '' },
		user_email: { type: String, default: '' },
		user_name: { type: String, default: '' },
		email_sent_at: { type: Date, default: null },
		status: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
		expires_at: { type: Date, default: null },
		error: { type: String, default: '' },
	},
	{ timestamps: true, read: 'secondaryPreferred' },
);

exportSchema.index({ host_id: 1, status: 1 });
exportSchema.index({ host_id: 1 }, EXPORT_ADMISSION_OPTIONS);

export const Export = mongoose.model('Export', exportSchema);
