import mongoose from './mongoose.js';

const emailIdentitySchema = new mongoose.Schema(
	{
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		name: { type: String, trim: true, default: '' },
		email: { type: String, required: true, trim: true, lowercase: true },
		signature: { type: String, trim: true, default: '' },
		use_system_smtp: { type: Boolean, default: false },
		smtp: {
			host: { type: String, trim: true, default: '' },
			port: { type: Number, required: true, default: 587, min: 1, max: 65535 },
			auth_user: { type: String, trim: true, default: '' },
			auth_password: { type: String, default: '' },
			tls: { type: Boolean, default: false },
			ssl: { type: Boolean, default: false },
		},
		helpmonks: {
			enabled: { type: Boolean, default: false },
			base_url: { type: String, trim: true, default: '' },
			api_key: { type: String, default: '' },
		},
		fastmail: {
			enabled: { type: Boolean, default: false },
			api_token: { type: String, default: '' },
			account_id: { type: String, trim: true, default: '' },
			session_url: { type: String, trim: true, default: 'https://api.fastmail.com/jmap/session' },
		},
	},
	{ timestamps: true },
);

emailIdentitySchema.index({ host_id: 1, project: 1, email: 1 }, { unique: true });

export const EmailIdentity = mongoose.model('EmailIdentity', emailIdentitySchema);
