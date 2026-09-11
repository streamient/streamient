import { Tenant, accountWork } from '../../modules/tenancy.js';

// Route/service unit fixtures have no Mongo connection. Keep account-work
// bookkeeping separate from the business writes asserted by those fixtures.
// Real locking and ownership are exercised by account-deletion integration.
export function mockTenantWork() {
	const updateOne = Tenant.updateOne;
	const acquire = accountWork.acquire;
	const available = accountWork.assertAvailable;
	accountWork.acquire = async () => async () => {};
	accountWork.assertAvailable = async () => {};
	const findOne = Tenant.findOne;
	Tenant.findOne = function (filter, ...args) {
		if (filter?.owner && filter['deletion.requested_at'] === null) {
			const value = { _id: filter._id, host_id: filter.host_id, owner: filter.owner, is_active: true };
			const query = { select() { return this; }, read() { return this; }, lean: async () => value };
			return query;
		}
		return findOne.call(this, filter, ...args);
	};
	Tenant.updateOne = function (filter, update, options) {
		const fields = [...Object.keys(update?.$set || {}), ...Object.keys(update?.$unset || {})];
		if (fields.length && fields.every((field) => field.startsWith('active_work.'))) return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
		return updateOne.call(this, filter, update, options);
	};
	return () => { Tenant.updateOne = updateOne; Tenant.findOne = findOne; accountWork.acquire = acquire; accountWork.assertAvailable = available; };
}
