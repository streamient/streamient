import mongoose from 'mongoose';

const emailLabelSchema = new mongoose.Schema(
	{
		slug: { type: String, required: true, trim: true },
		name: { type: String, required: true, trim: true },
		color: { type: String, default: '#6c757d', trim: true },
		is_system: { type: Boolean, default: false },
		is_active: { type: Boolean, default: true },
		host_id: { type: String, required: true, index: true },
	},
	{ timestamps: true },
);

emailLabelSchema.index({ host_id: 1, slug: 1 }, { unique: true });
emailLabelSchema.index({ host_id: 1, is_active: 1 });

export const EmailLabel = mongoose.model('EmailLabel', emailLabelSchema);
