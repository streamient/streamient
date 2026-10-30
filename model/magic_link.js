import mongoose from './mongoose.js';
import crypto from 'node:crypto';

const magicLinkSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		token: { type: String, required: true, unique: true, index: true },
		expires_at: { type: Date, required: true },
		purpose: { type: String, enum: ['login', 'email_change'], default: 'login' },
		email: String,
		previous_email: String,
		used: { type: Boolean, default: false },
	},
	{ timestamps: true, read: 'secondaryPreferred' },
);

magicLinkSchema.statics.generate = async function (userId, details = {}) {
	const token = crypto.randomBytes(32).toString('hex');
	const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 min
	return this.create({ ...details, user: userId, token, expires_at });
};

// Atomic claim: a string-only token can be consumed exactly once.
magicLinkSchema.statics.verify = async function (token, purpose = 'login', userId = null) {
	if (typeof token !== 'string' || !token) return null;
	return this.findOneAndUpdate({ token, ...(purpose === 'login' ? { $or: [{ purpose: 'login' }, { purpose: { $exists: false } }] } : { purpose, user: userId }), used: false, expires_at: { $gt: new Date() } }, { $set: { used: true } }, { new: true }).lean();
};

export const MagicLink = mongoose.model('MagicLink', magicLinkSchema);
