import mongoose from 'mongoose';

const outgoingEmailSchema = new mongoose.Schema(
	{
		draft: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailDraft', required: true, index: true },
		source_email: { type: mongoose.Schema.Types.ObjectId, ref: 'Email', required: true, index: true },
		email_identity: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailIdentity', required: true },
		from: { type: String, required: true, trim: true, lowercase: true },
		to: [{ type: String, trim: true, lowercase: true }],
		cc: [{ type: String, trim: true, lowercase: true }],
		bcc: [{ type: String, trim: true, lowercase: true }],
		subject: { type: String, trim: true, default: '' },
		body_text: { type: String, default: '' },
		body_html: { type: String, default: '' },
		message_id: { type: String, trim: true, default: '' },
		in_reply_to: { type: String, trim: true, default: '' },
		references: [{ type: String, trim: true }],
		status: { type: String, enum: ['queued', 'sending', 'sent', 'error', 'canceled'], default: 'queued', index: true },
		send_after: { type: Date, required: true, index: true },
		sent_at: { type: Date, default: null },
		error: { type: String, default: '' },
		attempts: { type: Number, default: 0 },
		queue_job_id: { type: String, default: '' },
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
	},
	{ timestamps: true },
);

outgoingEmailSchema.index({ host_id: 1, status: 1, send_after: 1 });
outgoingEmailSchema.index({ host_id: 1, draft: 1, status: 1 });
outgoingEmailSchema.index({ message_id: 1 }, { unique: true, partialFilterExpression: { message_id: { $type: 'string', $ne: '' } } });

export const OutgoingEmail = mongoose.model('OutgoingEmail', outgoingEmailSchema);
