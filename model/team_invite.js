import mongoose from './mongoose.js';
import { TEAM_MEMBER_ROLES } from './tenant_member.js';

const teamInviteSchema = new mongoose.Schema(
	{
		tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
		host_id: { type: String, required: true, index: true },
		email: { type: String, required: true, lowercase: true, trim: true, index: true },
		name: { type: String, trim: true },
		role: { type: String, enum: TEAM_MEMBER_ROLES, default: 'member' },
		invited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		token: { type: String, required: true, unique: true, index: true },
		expires_at: { type: Date, required: true },
		accepted_at: { type: Date },
	},
	{ timestamps: true },
);

teamInviteSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
teamInviteSchema.index({ host_id: 1, email: 1 });

export const TeamInvite = mongoose.model('TeamInvite', teamInviteSchema);
