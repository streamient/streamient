import mongoose from './mongoose.js';
import { textSanitizerPlugin } from '../modules/text_sanitize.js';

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
		html_content: { type: String, default: '' },
		html_content_has_remote_images: { type: Boolean, default: false },
		attachment_text_content: { type: String, default: '' },

		source: { type: String, enum: ['api', 'emailforwarding'], default: 'api' },
		raw_hash: { type: String, default: '' },
		mailbox: { type: String, enum: ['inbox', 'archived', 'sent', 'spam'], default: 'inbox' },
		labels: [{ type: String, trim: true }],

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
emailSchema.index({ host_id: 1, in_trash: 1, project: 1, updatedAt: -1, _id: -1 });
emailSchema.index({ host_id: 1, in_trash: 1, mailbox: 1, updatedAt: -1 });
emailSchema.index({ host_id: 1, in_trash: 1, labels: 1 });
emailSchema.index({ is_indexed: 1, in_trash: 1 });
emailSchema.index({ host_id: 1, message_id: 1 }, { unique: true, name: 'host_message_id_unique', partialFilterExpression: { message_id: { $type: 'string', $gt: '' } } });
emailSchema.index({ host_id: 1, references: 1 });

emailSchema.plugin(textSanitizerPlugin);

export const Email = mongoose.model('Email', emailSchema);
