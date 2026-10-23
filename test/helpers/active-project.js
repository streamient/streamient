import { Project } from '../../model/project.js';

// Business-service fixtures supply their destination project without a live MongoDB.
export function mockActiveProject() {
	const original = Project.findOne;
	const atomic = Project.findOneAndUpdate;
	Project.findOneAndUpdate = (filter) => Project.findOne(filter);
	Project.findOne = (filter) => ({ select() { return this; }, read() { return this; }, lean: async () => ({ _id: filter._id || 'project-1' }) });
	return () => { Project.findOne = original; Project.findOneAndUpdate = atomic; };
}
