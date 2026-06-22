import mongoose from './mongoose.js';

const emailTriageRunSchema = new mongoose.Schema(
	{
		run_id: { type: String, required: true, trim: true },
		host_id: { type: String, required: true, index: true },
		user_id: { type: String, default: '' },
		tenant_id: { type: String, default: '' },
		member_role: { type: String, default: '' },
		project: { type: String, default: '' },
		limit: { type: Number, default: 0 },
		status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
		total: { type: Number, default: 0 },
		processed: { type: Number, default: 0 },
		triaged: { type: Number, default: 0 },
		drafted: { type: Number, default: 0 },
		linked: { type: Number, default: 0 },
		moved: { type: Number, default: 0 },
		errors: [{
			_id: false,
			email_id: { type: String, default: '' },
			error: { type: String, default: '' },
		}],
		last_error: { type: String, default: '' },
		started_at: { type: Date, default: null },
		completed_at: { type: Date, default: null },
	},
	{ timestamps: true, suppressReservedKeysWarning: true },
);

emailTriageRunSchema.index({ host_id: 1, run_id: 1 }, { unique: true });
emailTriageRunSchema.index({ host_id: 1, status: 1, updatedAt: -1 });

export const EmailTriageRun = mongoose.model('EmailTriageRun', emailTriageRunSchema);
