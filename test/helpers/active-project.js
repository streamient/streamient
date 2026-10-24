import { Project } from '../../model/project.js';

// Business-service fixtures supply their destination project without a live MongoDB.
// Project-write leases (create/move/restore) also touch `Project.updateOne`; make
// those active_work bookkeeping writes a no-op so fixtures stay DB-free.
export function mockActiveProject() {
	const original = Project.findOne;
	const atomic = Project.findOneAndUpdate;
	const updateOne = Project.updateOne;
	Project.findOneAndUpdate = (filter) => Project.findOne(filter);
	Project.findOne = (filter) => ({ select() { return this; }, read() { return this; }, lean: async () => ({ _id: filter._id || 'project-1' }) });
	Project.updateOne = function (filter, update, options) {
		const fields = [...Object.keys(update?.$set || {}), ...Object.keys(update?.$unset || {})];
		if (fields.length && fields.every((field) => field.startsWith('active_work.'))) return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
		return updateOne.call(this, filter, update, options);
	};
	return () => { Project.findOne = original; Project.findOneAndUpdate = atomic; Project.updateOne = updateOne; };
}