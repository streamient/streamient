import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

function safeAccessTokens(access_tokens = []) {
	return access_tokens.map((access_token) => ({
		_id: access_token._id,
		name: access_token.name,
		created_at: access_token.created_at,
	}));
}

const userSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, unique: true, lowercase: true, trim: true },
		password: { type: String, required: true, select: false },
		name: { type: String, required: true, trim: true },
		timezone: { type: String, default: 'UTC' },
		tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
		host_id: { type: String, index: true },
		is_active: { type: Boolean, default: false },
		is_verified: { type: Boolean, default: false },
		verification_token: { type: String, select: false },
		// Password reset
		password_reset_token: { type: String, select: false },
		password_reset_expires: { type: Date, select: false },
		// 2FA
		totp_secret: { type: String, select: false },
		totp_enabled: { type: Boolean, default: false },
		// Billing (hosted edition only)
		stripe_customer_id: { type: String, select: false },
		stripe_subscription_id: { type: String, select: false },
		subscription_status: {
			type: String,
			enum: ['incomplete', 'trialing', 'trial_expired', 'active', 'past_due', 'canceled', 'unpaid'],
			default: 'incomplete',
		},
		trial_source: { type: String, enum: ['no_card', 'stripe', null], default: null },
		trial_ends_at: { type: Date },
		trial_reminder_3d_sent_at: { type: Date },
		trial_reminder_24h_sent_at: { type: Date },
		trial_locked_at: { type: Date },
		// Access tokens for API
		access_tokens: [
			{
				token: { type: String },
				name: { type: String },
				created_at: { type: Date, default: Date.now },
			},
		],
		last_login: { type: Date },
	},
	{ timestamps: true },
);

userSchema.pre('save', async function () {
	if (!this.isModified('password')) return;
	this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate) {
	return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafe = function () {
	const obj = this.toObject();
	delete obj.password;
	delete obj.totp_secret;
	delete obj.verification_token;
	delete obj.password_reset_token;
	delete obj.password_reset_expires;
	delete obj.stripe_customer_id;
	delete obj.stripe_subscription_id;
	if (Array.isArray(obj.access_tokens)) obj.access_tokens = safeAccessTokens(obj.access_tokens);
	return obj;
};

export const User = mongoose.model('User', userSchema);
