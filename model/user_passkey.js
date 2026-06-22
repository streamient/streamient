import mongoose from './mongoose.js';

const passkeySchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		credential_id: { type: String, required: true, unique: true },
		public_key: { type: String, required: true },
		counter: { type: Number, required: true, default: 0 },
		device_type: { type: String, enum: ['singleDevice', 'multiDevice'], default: 'singleDevice' },
		backed_up: { type: Boolean, default: false },
		transports: [{ type: String, enum: ['usb', 'ble', 'nfc', 'internal', 'hybrid', 'smart-card'] }],
		name: { type: String, default: 'Passkey' },
		browser_info: { type: String },
		last_used_at: { type: Date },
	},
	{ timestamps: true },
);

export const UserPasskey = mongoose.model('UserPasskey', passkeySchema);
