import mongoose from './mongoose.js';

const emailExternalSyncStateSchema = new mongoose.Schema(
	{
		host_id: { type: String, required: true, index: true },
		project: { type: String, default: '', index: true },
		provider: { type: String, enum: ['helpmonks', 'fastmail'], required: true, index: true },
		local_type: { type: String, enum: ['email', 'draft', 'outgoing'], required: true, index: true },
		local_id: { type: String, required: true, index: true },
		identity: { type: String, default: '', index: true },
		remote_conversation_id: { type: String, default: '' },
		remote_draft_id: { type: String, default: '' },
		remote_email_id: { type: String, default: '' },
		remote_thread_id: { type: String, default: '' },
		remote_mailbox_ids: { type: mongoose.Schema.Types.Mixed, default: null },
		last_action: { type: String, default: '' },
		last_status: { type: String, enum: ['', 'queued', 'synced', 'skipped', 'error'], default: '' },
		last_synced_hash: { type: String, default: '' },
		last_synced_at: { type: Date, default: null },
		last_error: { type: String, default: '' },
		last_error_at: { type: Date, default: null },
		last_skipped_reason: { type: String, default: '' },
	},
	{ timestamps: true },
);

emailExternalSyncStateSchema.index(
	{ host_id: 1, provider: 1, local_type: 1, local_id: 1, identity: 1 },
	{ unique: true },
);

export const EmailExternalSyncState = mongoose.model('EmailExternalSyncState', emailExternalSyncStateSchema);
