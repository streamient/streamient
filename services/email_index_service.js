import { Email } from '../model/email.js';
import { indexDocument, removeDocument } from '../modules/typesense.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('email-index');

function emailIndexId(emailOrId) {
	return emailOrId?._id?.toString?.() || emailOrId?.id?.toString?.() || String(emailOrId || '');
}

export async function indexEmailNow(hostId, email, options = {}) {
	const id = emailIndexId(email);
	if (!hostId || !id) return false;
	const indexFn = options.indexFn || indexDocument;
	const removeFn = options.removeFn || removeDocument;
	const updateFn = options.updateFn || Email.updateOne.bind(Email);
	try {
		if (email.in_trash === true) {
			await removeFn(hostId, 'emails', id);
		} else {
			await indexFn(hostId, 'emails', email);
		}
		await updateFn({ _id: id, host_id: hostId }, { $set: { is_indexed: true } }, { timestamps: false });
		log.debug({ host_id: hostId, email_id: id, action: email.in_trash === true ? 'remove' : 'index' }, 'Email index updated');
		return true;
	} catch (err) {
		log.error({ err, host_id: hostId, email_id: id }, 'Email Typesense index error');
		return false;
	}
}

export async function removeEmailFromIndexNow(hostId, emailOrId, options = {}) {
	const id = emailIndexId(emailOrId);
	if (!hostId || !id) return false;
	const removeFn = options.removeFn || removeDocument;
	const updateFn = options.updateFn || Email.updateOne.bind(Email);
	try {
		await removeFn(hostId, 'emails', id);
		await updateFn({ _id: id, host_id: hostId }, { $set: { is_indexed: true } }, { timestamps: false });
		log.debug({ host_id: hostId, email_id: id }, 'Email removed from index');
		return true;
	} catch (err) {
		log.error({ err, host_id: hostId, email_id: id }, 'Email Typesense remove error');
		return false;
	}
}
