import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            enum: ['create', 'update', 'delete', 'search', 'login', 'export', 'import', 'restore', 'reindex'],
        },
        resource: {
            type: String,
            required: true,
	            enum: ['note', 'memory', 'url', 'email', 'email_draft', 'email_internal_note', 'email_identity', 'outgoing_email', 'project', 'link', 'user', 'passkey', 'conversation', 'trash', 'git_repo', 'team_member', 'team_invite', 'oauth_client', 'oauth_consent'],
        },
        resource_id: { type: String },
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        host_id: { type: String, required: true },
        channel: {
            type: String,
            required: true,
            enum: ['web', 'api', 'mcp', 'emailforwarding'],
        },
        token_label: { type: String },
        mcp_client: { type: String },
        details: { type: mongoose.Schema.Types.Mixed },
        ip: { type: String },
        user_agent: { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ host_id: 1, createdAt: -1 });
auditLogSchema.index({ user_id: 1, createdAt: -1 });
auditLogSchema.index({ host_id: 1, resource: 1, action: 1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
