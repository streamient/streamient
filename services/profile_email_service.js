import { MagicLink } from '../model/magic_link.js';
import { User } from '../model/user.js';
import { sendEmailChangeEmail } from './email_service.js';

export async function requestEmailChange(user, email, options = {}) {
	if (await User.exists({ email, _id: { $ne: user._id } })) throw Object.assign(new Error('Email address is already in use'), { status: 409 });
	const link = await MagicLink.generate(user._id, { purpose: 'email_change', email, previous_email: user.email });
	const pending = await User.findOneAndUpdate({ _id: user._id, email: user.email, is_active: true }, { $set: { pending_email_token: link.token } }, { new: true }).lean();
	if (!pending) throw Object.assign(new Error('Profile changed. Please try again.'), { status: 409 });
	try {
		const delivery = await (options.sendEmail || sendEmailChangeEmail)(email, link.token);
		if (!delivery || delivery.rejected?.length) throw new Error('Confirmation email could not be sent');
	} catch (error) {
		await User.updateOne({ _id: user._id, pending_email_token: link.token }, { $unset: { pending_email_token: 1 } });
		throw error;
	}
}

export async function confirmEmailChange(token, userId) {
	const link = await MagicLink.verify(token, 'email_change', userId);
	if (!link) return null;
	try {
		return await User.findOneAndUpdate({ _id: userId, is_active: true, email: link.previous_email, pending_email_token: link.token }, { $set: { email: link.email, is_verified: true }, $unset: { pending_email_token: 1 } }, { new: true, runValidators: true }).lean();
	} catch (error) {
		if (error.code === 11000) return null;
		throw error;
	}
}
