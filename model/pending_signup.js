import mongoose from './mongoose.js';

const pendingSignupSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, lowercase: true, trim: true, index: true },
		name: { type: String, required: true, trim: true },
		password: { type: String, required: true },
		token: { type: String, required: true, unique: true, index: true },
		expires_at: { type: Date, required: true },
	},
	{ timestamps: true },
);

// Auto-expire documents after they pass expires_at
pendingSignupSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const PendingSignup = mongoose.model('PendingSignup', pendingSignupSchema);
