import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema(
	{
		message_id: { type: String, trim: true, default: '' },
		references: [{ type: String, trim: true }],
		in_reply_to: { type: String, trim: true, default: '' },

		from: [{ type: String, trim: true }],
		to: [{ type: String, trim: true }],
		cc: [{ type: String, trim: true }],
		bcc: [{ type: String, trim: true }],
		subject: { type: String, trim: true, default: '' },

		text_content: { type: String, default: '' },
		attachment_text_content: { type: String, default: '' },

		source: { type: String, enum: ['api', 'emailforwarding'], default: 'api' },
		raw_hash: { type: String, default: '' },
		mailbox: { type: String, enum: ['inbox', 'archived', 'sent'], default: 'inbox' },
		labels: [{ type: String, trim: true }],
		triaged: { type: Boolean, default: false },
		triaged_at: { type: Date, default: null },
		triage_summary: { type: String, default: '' },
		triage_reason: { type: String, default: '' },

		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
		is_indexed: { type: Boolean, default: false },
		in_trash: { type: Boolean, default: false },
		trashed_at: { type: Date, default: null },
	},
	{ timestamps: true },
);

emailSchema.index({ host_id: 1, in_trash: 1, project: 1 });
emailSchema.index({ host_id: 1, in_trash: 1, mailbox: 1, triaged_at: 1 });
emailSchema.index({ host_id: 1, in_trash: 1, mailbox: 1, triaged: 1, updatedAt: -1 });
emailSchema.index({ host_id: 1, in_trash: 1, labels: 1 });
emailSchema.index({ is_indexed: 1, in_trash: 1 });
emailSchema.index({ message_id: 1 }, { unique: true, partialFilterExpression: { message_id: { $type: 'string', $ne: '' } } });
emailSchema.index({ host_id: 1, references: 1 });
emailSchema.index({ trashed_at: 1 }, { expireAfterSeconds: 2592000, partialFilterExpression: { trashed_at: { $type: 'date' }, in_trash: true } });

export const Email = mongoose.model('Email', emailSchema);
