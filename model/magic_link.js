import mongoose, { hydratedQuery } from './mongoose.js';
import crypto from 'node:crypto';

const magicLinkSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		token: { type: String, required: true, unique: true, index: true },
		expires_at: { type: Date, required: true },
		used: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

magicLinkSchema.statics.generate = async function (userId) {
	const token = crypto.randomBytes(32).toString('hex');
	const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 min
	return this.create({ user: userId, token, expires_at });
};

magicLinkSchema.statics.verify = async function (token) {
	const link = await hydratedQuery(this.findOne({
		token,
		used: false,
		expires_at: { $gt: new Date() },
	}));
	if (!link) return null;
	link.used = true;
	await link.save();
	return link;
};

export const MagicLink = mongoose.model('MagicLink', magicLinkSchema);
