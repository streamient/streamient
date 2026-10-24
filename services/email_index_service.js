import { bulkIndexDocuments, bulkRemoveDocuments } from '../modules/typesense.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('email-index');

function emailIndexId(emailOrId) {
	return emailOrId?._id?.toString?.() || emailOrId?.id?.toString?.() || String(emailOrId || '');
}

function normalizeBulkResults(items, results) {
	if (Array.isArray(results)) {
		return results.map((result, index) => ({
			id: result?.id || emailIndexId(items[index]),
			success: result?.success !== false,
			error: result?.error || null,
		}));
	}
	return items.map((item) => ({ id: emailIndexId(item), success: true, error: null }));
}

async function runIndexEmails(hostId, emails, options) {
	const indexManyFn = options.indexManyFn || options.bulkIndexFn;
	if (indexManyFn) {
		const results = await indexManyFn(hostId, 'emails', emails);
		return normalizeBulkResults(emails, results);
	}

	if (options.indexFn) {
		const results = [];
		for (const email of emails) {
			const id = emailIndexId(email);
			try {
				await options.indexFn(hostId, 'emails', email);
				results.push({ id, success: true, error: null });
			} catch (err) {
				results.push({ id, success: false, error: err.message });
			}
		}
		return results;
	}

	return bulkIndexDocuments(hostId, 'emails', emails);
}

async function runRemoveEmails(hostId, ids, options) {
	const removeManyFn = options.removeManyFn || options.bulkRemoveFn;
	if (removeManyFn) {
		const results = await removeManyFn(hostId, 'emails', ids);
		return normalizeBulkResults(ids, results);
	}

	if (options.removeFn) {
		const results = [];
		for (const id of ids) {
			try {
				await options.removeFn(hostId, 'emails', id);
				results.push({ id, success: true, error: null });
			} catch (err) {
				results.push({ id, success: false, error: err.message });
			}
		}
		return results;
	}

	return bulkRemoveDocuments(hostId, 'emails', ids);
}

export async function indexEmailsNow(hostId, emails, options = {}) {
	const emailList = (Array.isArray(emails) ? emails : [emails]).filter((email) => hostId && emailIndexId(email));
	if (!emailList.length) return [];

	const results = [];

	try {
		results.push(...await runIndexEmails(hostId, emailList, options));

		const successIds = results.filter((result) => result.success).map((result) => result.id);

		const failed = results.filter((result) => !result.success);
		if (failed.length) {
			log.error({ host_id: hostId, failed }, 'Email Typesense bulk index failures');
		}
		log.debug({ host_id: hostId, indexed: successIds.length, failed: failed.length }, 'Email index updated');
		return results;
	} catch (err) {
		log.error({ err, host_id: hostId, email_count: emailList.length }, 'Email Typesense bulk index error');
		return emailList.map((email) => ({ id: emailIndexId(email), success: false, error: err.message }));
	}
}

export async function indexEmailNow(hostId, email, options = {}) {
	const id = emailIndexId(email);
	if (!hostId || !id) return false;
	const results = await indexEmailsNow(hostId, [email], options);
	return results.some((result) => result.id === id && result.success);
}

export async function removeEmailsFromIndexNow(hostId, emailOrIds, options = {}) {
	const ids = (Array.isArray(emailOrIds) ? emailOrIds : [emailOrIds]).map(emailIndexId).filter((id) => hostId && id);
	if (!ids.length) return [];

	try {
		const results = await runRemoveEmails(hostId, ids, options);
		const successIds = results.filter((result) => result.success).map((result) => result.id);

		const failed = results.filter((result) => !result.success);
		if (failed.length) {
			log.error({ host_id: hostId, failed }, 'Email Typesense bulk remove failures');
		}
		log.debug({ host_id: hostId, removed: successIds.length, failed: failed.length }, 'Email removed from index');
		return results;
	} catch (err) {
		log.error({ err, host_id: hostId, email_ids: ids }, 'Email Typesense bulk remove error');
		return ids.map((id) => ({ id, success: false, error: err.message }));
	}
}

export async function removeEmailFromIndexNow(hostId, emailOrId, options = {}) {
	const id = emailIndexId(emailOrId);
	if (!hostId || !id) return false;
	const results = await removeEmailsFromIndexNow(hostId, [id], options);
	return results.some((result) => result.id === id && result.success);
}
