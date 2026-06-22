import mongoose from './mongoose.js';

const oauthRefreshTokenSchema = new mongoose.Schema(
	{
		token_hash: { type: String, required: true, unique: true, index: true },
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
		host_id: { type: String, required: true, index: true },
		client_id: { type: String, required: true, index: true },
		client_name: { type: String, required: true },
		registration_source: { type: String, enum: ['manual', 'dynamic', 'metadata'], required: true },
		scope: { type: String, required: true },
		resource: { type: String, required: true },
		expires_at: { type: Date, required: true },
		rotated_at: { type: Date },
		revoked_at: { type: Date },
		replaced_by_token_hash: { type: String },
	},
	{ timestamps: true },
);

oauthRefreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

oauthRefreshTokenSchema.index({ user: 1, host_id: 1, client_id: 1 });

export const OAuthRefreshToken = mongoose.model('OAuthRefreshToken', oauthRefreshTokenSchema);
