import mongoose from './mongoose.js';
import { OAUTH_GRANT_TYPES, OAUTH_RESPONSE_TYPES, OAUTH_TOKEN_ENDPOINT_AUTH_METHODS } from '../modules/oauth.js';

const oauthClientSchema = new mongoose.Schema(
	{
		tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
		host_id: { type: String, index: true },
		client_id: { type: String, required: true, unique: true, index: true },
		client_secret_hash: { type: String, select: false },
		client_name: { type: String, required: true, trim: true },
		client_uri: { type: String, trim: true },
		logo_uri: { type: String, trim: true },
		redirect_uris: [{ type: String, required: true }],
		jwks: { type: mongoose.Schema.Types.Mixed },
		jwks_uri: { type: String, trim: true },
		grant_types: [{ type: String, enum: OAUTH_GRANT_TYPES, default: 'authorization_code' }],
		response_types: [{ type: String, enum: OAUTH_RESPONSE_TYPES, default: 'code' }],
		token_endpoint_auth_method: { type: String, enum: OAUTH_TOKEN_ENDPOINT_AUTH_METHODS, default: 'none' },
		registration_source: { type: String, enum: ['manual', 'dynamic'], default: 'manual' },
		created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		last_used_at: { type: Date },
	},
	{ timestamps: true },
);

oauthClientSchema.index({ host_id: 1, createdAt: -1 });

export const OAuthClient = mongoose.model('OAuthClient', oauthClientSchema);
