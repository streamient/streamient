import { Tenant, accountWork } from '../../modules/tenancy.js';
import { User } from '../../model/user.js';
import mongoose from '../../model/mongoose.js';

// Route/service unit fixtures have no Mongo connection. Keep account-work
// bookkeeping separate from the business writes asserted by those fixtures.
// Real locking and ownership are exercised by account-deletion integration.
export function mockTenantWork() {
	const updateOne = Tenant.updateOne;
	const acquire = accountWork.acquire;
	const available = accountWork.assertAvailable;
	const transaction = mongoose.connection.transaction;
	const userUpdateOne = User.updateOne;
	if (mongoose.connection.readyState !== 1) mongoose.connection.transaction = async (callback) => callback('unit-session');
	User.updateOne = function (filter, update, options) {
		if (mongoose.connection.readyState !== 1 && update?.$inc?.__v === 1) return Promise.resolve({ matchedCount: 1 });
		return userUpdateOne.call(this, filter, update, options);
	};
	accountWork.acquire = async () => async () => {};
	accountWork.assertAvailable = async () => {};
	const findOne = Tenant.findOne;
	const findOneAndUpdate = Tenant.findOneAndUpdate;
	const userFindOneAndUpdate = User.findOneAndUpdate;
	User.findOneAndUpdate = function (filter, update, options) {
		if (filter?._id && update?.$set?.is_active === true && options?.timestamps === false) return User.findById(filter._id);
		return userFindOneAndUpdate.call(this, filter, update, options);
	};
	Tenant.findOneAndUpdate = function (filter, update, options) {
		if (filter?.owner && update?.$set?.is_active === true && options?.timestamps === false) return Tenant.findOne(filter);
		return findOneAndUpdate.call(this, filter, update, options);
	};
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
	return () => { mongoose.connection.transaction = transaction; User.updateOne = userUpdateOne; Tenant.updateOne = updateOne; Tenant.findOne = findOne; Tenant.findOneAndUpdate = findOneAndUpdate; User.findOneAndUpdate = userFindOneAndUpdate; accountWork.acquire = acquire; accountWork.assertAvailable = available; };
}
