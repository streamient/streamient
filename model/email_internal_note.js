import mongoose from 'mongoose';

const emailInternalNoteSchema = new mongoose.Schema(
	{
		source_email: { type: mongoose.Schema.Types.ObjectId, ref: 'Email', required: true, index: true },
		project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		parent_note: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailInternalNote', default: null, index: true },
		host_id: { type: String, required: true, index: true },
		content: { type: String, default: '' },
		text_content: { type: String, default: '' },
	},
	{ timestamps: true },
);

emailInternalNoteSchema.index({ host_id: 1, source_email: 1, createdAt: 1 });
emailInternalNoteSchema.index({ host_id: 1, project: 1, createdAt: -1 });
emailInternalNoteSchema.index({ host_id: 1, parent_note: 1, createdAt: 1 });

export const EmailInternalNote = mongoose.model('EmailInternalNote', emailInternalNoteSchema);
