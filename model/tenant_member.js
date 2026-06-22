import mongoose from './mongoose.js';

export const TEAM_MEMBER_ROLES = ['owner', 'admin', 'member'];
export const TEAM_MEMBER_ROLE_RANK = {
	owner: 3,
	admin: 2,
	member: 1,
};

const tenantMemberSchema = new mongoose.Schema(
	{
		tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		host_id: { type: String, required: true, index: true },
		role: { type: String, enum: TEAM_MEMBER_ROLES, default: 'member' },
		invited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		joined_at: { type: Date, default: Date.now },
	},
	{ timestamps: true },
);

tenantMemberSchema.index({ tenant: 1, user: 1 }, { unique: true });
tenantMemberSchema.index({ host_id: 1, role: 1 });

export const TenantMember = mongoose.model('TenantMember', tenantMemberSchema);
