import { Project } from '../../model/project.js';

// Business-service fixtures supply their destination project without a live MongoDB.
export function mockActiveProject() {
	const original = Project.findOne;
	Project.findOne = (filter) => ({ select() { return this; }, read() { return this; }, lean: async () => ({ _id: filter._id || 'project-1' }) });
	return () => { Project.findOne = original; };
}
