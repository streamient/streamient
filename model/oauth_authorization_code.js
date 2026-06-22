import mongoose from './mongoose.js';

const oauthAuthorizationCodeSchema = new mongoose.Schema(
	{
		code_hash: { type: String, required: true, unique: true, index: true },
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
		host_id: { type: String, required: true, index: true },
		client_id: { type: String, required: true, index: true },
		client_name: { type: String, required: true },
		redirect_uri: { type: String, required: true },
		registration_source: { type: String, enum: ['manual', 'dynamic', 'metadata'], required: true },
		scope: { type: String, required: true },
		resource: { type: String, required: true },
		code_challenge: { type: String, required: true },
		code_challenge_method: { type: String, enum: ['S256'], required: true },
		expires_at: { type: Date, required: true },
		used_at: { type: Date },
	},
	{ timestamps: true },
);

oauthAuthorizationCodeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const OAuthAuthorizationCode = mongoose.model('OAuthAuthorizationCode', oauthAuthorizationCodeSchema);
