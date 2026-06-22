import mongoose from './mongoose.js';

const gitSyncLogSchema = new mongoose.Schema(
	{
		repo: { type: mongoose.Schema.Types.ObjectId, ref: 'GitRepo', required: true, index: true },
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
		host_id: { type: String, required: true, index: true },
		level: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
		message: { type: String, required: true },
		details: { type: mongoose.Schema.Types.Mixed, default: {} },
	},
	{ timestamps: true },
);

gitSyncLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });
gitSyncLogSchema.index({ host_id: 1, repo: 1, createdAt: -1 });

export const GitSyncLog = mongoose.model('GitSyncLog', gitSyncLogSchema);
