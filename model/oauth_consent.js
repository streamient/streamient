import mongoose from './mongoose.js';

const oauthConsentSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
		host_id: { type: String, required: true, index: true },
		client_id: { type: String, required: true, index: true },
		client_name: { type: String, required: true },
		client_uri: { type: String },
		logo_uri: { type: String },
		redirect_uris: [{ type: String }],
		registration_source: { type: String, enum: ['manual', 'dynamic', 'metadata'], required: true },
		scopes: [{ type: String, required: true }],
		resource: { type: String, required: true },
		granted_at: { type: Date, default: Date.now },
		last_used_at: { type: Date },
		revoked_at: { type: Date },
	},
	{ timestamps: true },
);

oauthConsentSchema.index({ user: 1, host_id: 1, client_id: 1, resource: 1 }, { unique: true });

export const OAuthConsent = mongoose.model('OAuthConsent', oauthConsentSchema);
