import mongoose from './mongoose.js';

const systemSettingSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true, trim: true, index: true },
		category: { type: String, default: 'general', trim: true, index: true },
		value: { type: mongoose.Schema.Types.Mixed, required: true },
		description: { type: String, default: '' },
	},
	{ timestamps: true },
);

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
