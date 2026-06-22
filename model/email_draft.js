import mongoose from './mongoose.js';

const emailDraftSchema = new mongoose.Schema(
	{
		source_email: { type: mongoose.Schema.Types.ObjectId, ref: 'Email', required: true, index: true },
		from: { type: String, default: '' },
		to: [{ type: String, trim: true }],
		cc: [{ type: String, trim: true }],
		bcc: [{ type: String, trim: true }],
		subject: { type: String, trim: true, default: '' },
		body_text: { type: String, default: '' },
		body_html: { type: String, default: '' },
		status: { type: String, enum: ['draft', 'ready', 'discarded'], default: 'draft', index: true },
		generated_by_triage: { type: Boolean, default: false },
		confidence: { type: Number, default: null },
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		host_id: { type: String, required: true, index: true },
	},
	{ timestamps: true },
);

emailDraftSchema.index({ host_id: 1, source_email: 1, generated_by_triage: 1 }, { unique: true, partialFilterExpression: { generated_by_triage: true } });
emailDraftSchema.index({ host_id: 1, project: 1, status: 1, updatedAt: -1 });

export const EmailDraft = mongoose.model('EmailDraft', emailDraftSchema);
