import { Project } from '../model/project.js';
import crypto from 'node:crypto';
import mongoose, { queryForSave } from '../model/mongoose.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { GitRepo } from '../model/git_repo.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { emitToTenant } from '../modules/socket.js';
import * as audit from './audit_service.js';

export async function requireActiveProject(hostId, projectId) {
	if (projectId !== undefined && (projectId === null || (typeof projectId !== 'string' && !(projectId instanceof mongoose.Types.ObjectId)))) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
	let project;
	try {
		project = await Project.findOneAndUpdate({ host_id: hostId, is_active: true, ...(projectId === undefined ? { is_default: true } : { _id: projectId }) }, { $set: { is_active: true } }, { timestamps: false, returnDocument: 'after' }).select('_id').lean();
	} catch (err) {
		if (err.name !== 'CastError') throw err;
	}
	if (!project) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
	return project._id;
}

// Shared project write gate. A create/move/restore acquires a lease on the
// destination project and holds it across the record insert. `deleteProject`
// gates new writers, drains these leases, then checks blockers authoritatively
// before deactivating — so a record can never land in a deactivated project.
async function acquireProjectWorkImpl(hostId, projectId) {
	if (projectId !== undefined && (projectId === null || (typeof projectId !== 'string' && !(projectId instanceof mongoose.Types.ObjectId)))) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
	const key = `active_work.${crypto.randomUUID()}`;
	const expiry = () => new Date(Date.now() + 5 * 60 * 1000);
	const filter = projectId === undefined
		? { host_id: hostId, is_active: true, is_default: true, 'deletion.requested_at': null }
		: { _id: projectId, host_id: hostId, is_active: true, 'deletion.requested_at': null };
	let project;
	try {
		project = await Project.findOneAndUpdate(filter, { $set: { [key]: expiry() } }, { timestamps: false, returnDocument: 'after' }).select('_id').lean();
	} catch (err) {
		if (err.name !== 'CastError') throw err;
	}
	if (!project) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
	const resolvedId = project._id;
	const timer = setInterval(() => { void Project.updateOne({ _id: resolvedId, host_id: hostId, [key]: { $exists: true } }, { $set: { [key]: expiry() } }, { timestamps: false }).catch(() => {}); }, 20000);
	timer.unref();
	return {
		projectId: resolvedId,
		release: async () => { clearInterval(timer); await Project.updateOne({ _id: resolvedId, host_id: hostId }, { $unset: { [key]: '' } }, { timestamps: false }).catch(() => {}); },
	};
}

export const projectWork = { acquire: acquireProjectWorkImpl };
export function acquireProjectWrite(hostId, projectId) { return projectWork.acquire(hostId, projectId); }

export async function createDefaultProject(userId, host_id, options = {}) {
	const payload = {
		name: 'Default',
		owner: userId,
		host_id,
		is_default: true,
	};
	if (!options.session) return Project.create(payload);
	const [project] = await Project.create([payload], { session: options.session });
	return project;
}

export async function createProject(userId, host_id, data, ctx = {}) {
	const project = await Project.create({
		name: data.name,
		owner: userId,
		host_id,
		color: data.color,
	});
	emitToTenant(host_id, 'project:created', project);
	audit.log({ action: 'create', resource: 'project', resource_id: project._id.toString(), user_id: userId, host_id, ...ctx });
	return project;
}

export async function listProjects(host_id) {
	return Project.find({ host_id, is_active: true }).sort({ is_default: -1, name: 1 });
}

export async function getProjectNames(host_id, projectIds) {
	const uniqueProjectIds = [...new Set((projectIds || []).filter(Boolean).map(String).filter((projectId) => mongoose.isObjectIdOrHexString(projectId)))];
	if (!uniqueProjectIds.length) return new Map();
	const projects = await Project.find({ _id: { $in: uniqueProjectIds }, host_id }).select('_id name').lean();
	return new Map(projects.map((project) => [project._id.toString(), project.name]));
}

export async function countActiveProjects(host_id) {
	return Project.countDocuments({ host_id, is_active: true });
}

export async function getProject(host_id, projectId) {
	return Project.findOne({ _id: projectId, host_id });
}

export async function getProjectDeleteState(host_id, projectId) {
	const filter = { project: projectId, host_id, in_trash: { $ne: true } };
	const [notes, memory, urls, emails, gitRepos, obsidianConnections] = await Promise.all([
		Note.countDocuments(filter),
		Memory.countDocuments(filter),
		Url.countDocuments(filter),
		Email.countDocuments(filter),
		GitRepo.countDocuments({ project: projectId, host_id }),
		ObsidianConnection.countDocuments({ project: projectId, host_id }),
	]);
	const blockers = [];
	if (notes) blockers.push(`${notes} note${notes > 1 ? 's' : ''}`);
	if (memory) blockers.push(`${memory} ${memory > 1 ? 'memories' : 'memory'}`);
	if (urls) blockers.push(`${urls} URL${urls > 1 ? 's' : ''}`);
	if (emails) blockers.push(`${emails} email${emails > 1 ? 's' : ''}`);
	if (gitRepos) blockers.push(`${gitRepos} git repo${gitRepos > 1 ? 's' : ''}`);
	if (obsidianConnections) blockers.push(`${obsidianConnections} Obsidian connection${obsidianConnections > 1 ? 's' : ''}`);
	return {
		canDelete: blockers.length === 0,
		blockers,
		counts: { notes, memory, urls, emails, gitRepos, obsidianConnections },
	};
}

export async function updateProject(host_id, projectId, data, ctx = {}) {
	const before = ctx.user_id ? await Project.findOne({ _id: projectId, host_id }).lean() : null;

	const set = {};
	if (data.name !== undefined) set.name = data.name;
	if (data.color !== undefined) set.color = data.color;
	if (data.email_filter !== undefined) set.email_filter = String(data.email_filter || '');

	const project = await Project.findOneAndUpdate(
		{ _id: projectId, host_id },
		{ $set: set },
		{ returnDocument: 'after' },
	);
	if (project) {
		emitToTenant(host_id, 'project:updated', project);
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, project);
			audit.log({ action: 'update', resource: 'project', resource_id: projectId, host_id, details, ...ctx });
		}
	}
	return project;
}

// Enumerate records through write results so a lagging replica cannot make an
// occupied project look empty. Mirrors the account-cleanup enumeration fence.
async function countProjectRecords(model, filter) {
	let count = 0;
	const seen = [];
	while (true) {
		let row;
		try {
			row = await model.findOneAndUpdate({ ...filter, _id: { $nin: seen } }, { $inc: { __v: 0 } }, { timestamps: false, returnDocument: 'after' }).select('_id').lean();
		} catch (err) {
			if (err?.name !== 'CastError') throw err;
			row = null;
		}
		if (!row) return count;
		seen.push(row._id);
		count++;
	}
}

async function getProjectDeleteStateAuthoritative(host_id, projectId) {
	const itemFilter = { project: projectId, host_id, in_trash: { $ne: true } };
	const [notes, memory, urls, emails, gitRepos, obsidianConnections] = await Promise.all([
		countProjectRecords(Note, itemFilter),
		countProjectRecords(Memory, itemFilter),
		countProjectRecords(Url, itemFilter),
		countProjectRecords(Email, itemFilter),
		countProjectRecords(GitRepo, { project: projectId, host_id }),
		countProjectRecords(ObsidianConnection, { project: projectId, host_id }),
	]);
	const blockers = [];
	if (notes) blockers.push(`${notes} note${notes > 1 ? 's' : ''}`);
	if (memory) blockers.push(`${memory} ${memory > 1 ? 'memories' : 'memory'}`);
	if (urls) blockers.push(`${urls} URL${urls > 1 ? 's' : ''}`);
	if (emails) blockers.push(`${emails} email${emails > 1 ? 's' : ''}`);
	if (gitRepos) blockers.push(`${gitRepos} git repo${gitRepos > 1 ? 's' : ''}`);
	if (obsidianConnections) blockers.push(`${obsidianConnections} Obsidian connection${obsidianConnections > 1 ? 's' : ''}`);
	return {
		canDelete: blockers.length === 0,
		blockers,
		counts: { notes, memory, urls, emails, gitRepos, obsidianConnections },
	};
}

// Wait for in-flight project writers to release their leases. Leases heartbeat
// every 20s and expire after 5m, so an expired entry is a dead writer and does
// not block deletion. Authoritative via a write-based read of `active_work`.
async function drainProjectWork(host_id, projectId, timeoutMs = 10000) {
	const deadline = Date.now() + timeoutMs;
	while (true) {
		const snapshot = await Project.findOneAndUpdate({ _id: projectId, host_id }, { $inc: { __v: 0 } }, { timestamps: false, returnDocument: 'after' }).select('active_work').lean();
		const active = Object.values(snapshot?.active_work || {}).some((until) => new Date(until).getTime() > Date.now());
		if (!active) return;
		if (Date.now() >= deadline) throw Object.assign(new Error('Cannot delete project: writers are still active, try again'), { status: 409, code: 'project_busy' });
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

export async function deleteProject(host_id, projectId, ctx = {}) {
	const project = await queryForSave(Project.findOne({ _id: projectId, host_id }));
	if (!project) return null;
	if (project.is_default) throw new Error('Cannot delete the default project');
	if (project.is_active === false) return project;

	// Gate new writers before draining. The gate write is authoritative: it only
	// lands when the project is still active and no deletion is already pending.
	const gate = await Project.findOneAndUpdate({ _id: projectId, host_id, is_active: true, 'deletion.requested_at': null }, { $set: { deletion: { requested_at: new Date() } } }, { timestamps: false, returnDocument: 'after' }).select('_id').lean();
	if (!gate) throw new Error('Cannot delete project: deletion already in progress');

	try {
		await drainProjectWork(host_id, projectId);
		const deleteState = await getProjectDeleteStateAuthoritative(host_id, projectId);
		if (deleteState.blockers.length) throw new Error(`Cannot delete project: has ${deleteState.blockers.join(', ')}`);

		project.is_active = false;
		await project.save();
		emitToTenant(host_id, 'project:deleted', { _id: projectId });
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'project', resource_id: projectId, host_id, ...ctx });
		return project;
	} catch (err) {
		await Project.updateOne({ _id: projectId, host_id }, { $unset: { deletion: '' } }, { timestamps: false }).catch(() => {});
		throw err;
	}
}

/**
 * Get per-project document counts from MongoDB.
 * Returns { projectId: { notes: N, memory: N, urls: N, emails: N }, ... }
 */
export async function getProjectCounts(host_id) {
	const [noteCounts, memoryCounts, urlCounts, emailCounts] = await Promise.all([
		Note.aggregate([
			{ $match: { host_id, in_trash: { $ne: true } } },
			{ $group: { _id: '$project', count: { $sum: 1 } } },
		]),
		Memory.aggregate([
			{ $match: { host_id, in_trash: { $ne: true } } },
			{ $group: { _id: '$project', count: { $sum: 1 } } },
		]),
		Url.aggregate([
			{ $match: { host_id, in_trash: { $ne: true } } },
			{ $group: { _id: '$project', count: { $sum: 1 } } },
		]),
		Email.aggregate([
			{ $match: { host_id, in_trash: { $ne: true } } },
			{ $group: { _id: '$project', count: { $sum: 1 } } },
		]),
	]);

	const counts = {};
	for (const { _id, count } of noteCounts) {
		const pid = _id.toString();
		if (!counts[pid]) counts[pid] = { notes: 0, memory: 0, urls: 0, emails: 0 };
		counts[pid].notes = count;
	}
	for (const { _id, count } of memoryCounts) {
		const pid = _id.toString();
		if (!counts[pid]) counts[pid] = { notes: 0, memory: 0, urls: 0, emails: 0 };
		counts[pid].memory = count;
	}
	for (const { _id, count } of urlCounts) {
		const pid = _id.toString();
		if (!counts[pid]) counts[pid] = { notes: 0, memory: 0, urls: 0, emails: 0 };
		counts[pid].urls = count;
	}
	for (const { _id, count } of emailCounts) {
		const pid = _id.toString();
		if (!counts[pid]) counts[pid] = { notes: 0, memory: 0, urls: 0, emails: 0 };
		counts[pid].emails = count;
	}

	return counts;
}
