import mongoose from './mongoose.js';

const projectSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		color: { type: String, default: '#7C6AF7' },
		email_filter: { type: String, default: '' },
		is_default: { type: Boolean, default: false },
		is_active: { type: Boolean, default: true },
	},
	{ timestamps: true },
);

projectSchema.index({ host_id: 1, is_active: 1 });

export const Project = mongoose.model('Project', projectSchema);
