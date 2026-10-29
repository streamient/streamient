import mongoose from './mongoose.js';

const productUpdateSchema = new mongoose.Schema(
	{
		ghost_id: { type: String, required: true, unique: true, trim: true },
		title: { type: String, required: true, trim: true },
		excerpt: { type: String, default: '' },
		slug: { type: String, required: true, trim: true },
		link: { type: String, required: true, trim: true },
		feature_image: { type: String, default: '' },
		published_at: { type: Date, required: true },
		show_modal: { type: Boolean, default: false },
		active: { type: Boolean, default: true },
	},
	{ timestamps: true, collection: 'product_updates', read: 'secondaryPreferred' },
);

productUpdateSchema.index({ active: 1, published_at: -1, _id: -1 });
productUpdateSchema.index({ active: 1, show_modal: 1, published_at: -1, _id: -1 });

export const ProductUpdate = mongoose.model('ProductUpdate', productUpdateSchema);
