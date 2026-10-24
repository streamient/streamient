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
async function acquireProjectWorkImpl(hostId, projectId, ctx = {}) {
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

	// Authoritative ownership fence: re-verify the captured (unexpired) lease key
	// and that the project is still active with no pending deletion, inside the
	// SAME session as the record write. Deletion's gate/deactivate writes to the
	// Project doc, so this conditional write coordinates with them: an expired
	// lease or a deactivated project fails the fence and aborts the publication.
	const fence = async (session) => {
		let ok;
		try {
			ok = await Project.findOneAndUpdate(
				{ _id: resolvedId, host_id: hostId, is_active: true, 'deletion.requested_at': null, [key]: { $gt: new Date() } },
				{ $set: { [key]: expiry() } },
				{ timestamps: false, returnDocument: 'after', session },
			).select('_id').lean();
		} catch (err) {
			if (err?.name !== 'CastError') throw err;
			ok = null;
		}
		if (!ok) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
	};

	const publish = async (persist) => {
		if (ctx.withOwnership) {
			return ctx.withOwnership(async (session) => { await fence(session); return persist(session); });
		}
		return mongoose.connection.transaction(async (session) => { await fence(session); return persist(session); });
	};

	return {
		projectId: resolvedId,
		release: async () => { clearInterval(timer); await Project.updateOne({ _id: resolvedId, host_id: hostId }, { $unset: { [key]: '' } }, { timestamps: false }).catch(() => {}); },
		publish,
	};
}

export const projectWork = { acquire: acquireProjectWorkImpl };
export function acquireProjectWrite(hostId, projectId, ctx = {}) { return projectWork.acquire(hostId, projectId, ctx); }

// Resolve the destination project for a trash restore. A trashed item whose
// ORIGINAL project is already inactive (or missing) is restored into the host's
// active Default project. An active project with a pending deletion, a foreign
// host, or any other ambiguity fails closed. Write-based reads make the original
// project's state authoritative rather than a lagging replica's view.
export async function resolveRestoreProject(hostId, originalProjectId) {
	if (originalProjectId === null || originalProjectId === undefined || (typeof originalProjectId !== 'string' && !(originalProjectId instanceof mongoose.Types.ObjectId))) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
	let original;
	try {
		original = await Project.findOneAndUpdate({ _id: originalProjectId }, { $inc: { __v: 0 } }, { timestamps: false, returnDocument: 'after' }).select('_id host_id is_active deletion').lean();
	} catch (err) {
		if (err?.name !== 'CastError') throw err;
		original = null;
	}
	if (original) {
		// A foreign host's project ref must fail closed, not silently fall back.
		if (String(original.host_id) !== String(hostId)) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
		if (original.is_active === true) {
			if (original.deletion?.requested_at) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
			return original._id;
		}
		// Inactive → fall through to the default project fallback.
	}
	let fallback;
	try {
		fallback = await Project.findOneAndUpdate({ host_id: hostId, is_active: true, is_default: true, 'deletion.requested_at': null }, { $set: { is_active: true } }, { timestamps: false, returnDocument: 'after' }).select('_id').lean();
	} catch (err) {
		if (err?.name !== 'CastError') throw err;
		fallback = null;
	}
	if (!fallback) throw Object.assign(new Error('Active project not found'), { status: 404, code: 'project_not_found' });
	return fallback._id;
}

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

// Enumerate a single matching row through a write result so a lagging replica
// cannot make an occupied project look empty. One conditional write per model
// is enough to prove a blocker exists; exact totals belong to the preview path
// (getProjectDeleteState), not the authoritative deletion gate.
async function hasProjectRecords(model, filter) {
	try {
		const row = await model.findOneAndUpdate(filter, { $inc: { __v: 0 } }, { timestamps: false, returnDocument: 'after' }).select('_id').lean();
		return !!row;
	} catch (err) {
		if (err?.name !== 'CastError') throw err;
		return false;
	}
}

async function getProjectDeleteStateAuthoritative(host_id, projectId) {
	const itemFilter = { project: projectId, host_id, in_trash: { $ne: true } };
	const [notes, memory, urls, emails, gitRepos, obsidianConnections] = await Promise.all([
		hasProjectRecords(Note, itemFilter),
		hasProjectRecords(Memory, itemFilter),
		hasProjectRecords(Url, itemFilter),
		hasProjectRecords(Email, itemFilter),
		hasProjectRecords(GitRepo, { project: projectId, host_id }),
		hasProjectRecords(ObsidianConnection, { project: projectId, host_id }),
	]);
	const blockers = [];
	if (notes) blockers.push('notes');
	if (memory) blockers.push('memories');
	if (urls) blockers.push('URLs');
	if (emails) blockers.push('emails');
	if (gitRepos) blockers.push('git repos');
	if (obsidianConnections) blockers.push('Obsidian connections');
	return { canDelete: blockers.length === 0, blockers };
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
