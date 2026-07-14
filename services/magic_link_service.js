import { MagicLink } from '../model/magic_link.js';
import { sendMagicLinkEmail } from './email_service.js';
import { User } from '../model/user.js';

export async function sendMagicLink(email, baseUrl = null, options = {}) {
	let userId = options.userId || null;
	if (!userId) {
		const user = await User.findOne({ email, is_active: true }).select('_id').read('primary');
		if (!user) return false; // silent fail to prevent enumeration
		userId = user._id;
	}

	const generateLink = options.generateLink || ((id) => MagicLink.generate(id));
	const sendEmail = options.sendEmail || sendMagicLinkEmail;
	const link = await generateLink(userId);
	const delivery = await sendEmail(email, link.token, baseUrl);
	return Boolean(delivery);
}

export async function isMagicLinkValid(token) {
	if (!token) return false;
	const link = await MagicLink.findOne({
		token,
		used: false,
		expires_at: { $gt: new Date() },
	}).select('_id');
	return Boolean(link);
}

export async function verifyMagicLink(token) {
	const link = await MagicLink.verify(token);
	if (!link) return null;

	const user = await User.findById(link.user);
	if (!user || !user.is_active) return null;

	return user;
}
