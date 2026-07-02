import { Memory } from '../model/memory.js';
import mongoose from '../model/mongoose.js';
import { searchCollection, indexDocument, removeDocument } from '../modules/typesense.js';
import { emitToTenant } from '../modules/socket.js';
import { invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('memory');
const DEFAULT_TAG_SUGGESTION_LIMIT = 50;
const MAX_TAG_SUGGESTION_LIMIT = 100;
const GENERATED_TAG_REGEX = /^(?:[a-z0-9-]+-id-[a-f0-9]{24}|[a-f0-9]{24})$/i;

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTagLimit(value) {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_TAG_SUGGESTION_LIMIT;
	return Math.min(parsed, MAX_TAG_SUGGESTION_LIMIT);
}

function maybeObjectId(value) {
	if (!value || typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) return value;
	return new mongoose.Types.ObjectId(value);
}

export async function storeMemory(userId, host_id, data, ctx = {}) {
	const mem = await Memory.create({
		title: data.title,
		content: data.content || '',
		tags: data.tags || [],
		source: data.source || '',
		project: data.project,
		owner: userId,
		host_id,
	});

	emitToTenant(host_id, 'memory:created', mem);
	invalidateGraphCache(host_id).catch(() => {});
	audit.log({ action: 'create', resource: 'memory', resource_id: mem._id.toString(), user_id: userId, host_id, ...ctx });
	return mem;
}

export async function listMemories(host_id, projectId, { page = 1, limit = 50 } = {}) {
	const query = { host_id, in_trash: { $ne: true } };
	if (projectId) query.project = maybeObjectId(projectId);

	return Memory.aggregate([
		{ $match: query },
		{ $addFields: { list_date: { $ifNull: ['$git_commit.committed_at', '$updatedAt'] } } },
		{ $sort: { list_date: -1, updatedAt: -1 } },
		{ $skip: (page - 1) * limit },
		{ $limit: limit },
		{ $project: { list_date: 0 } },
	]);
}

export async function getMemory(host_id, memoryId) {
	return Memory.findOne({ _id: memoryId, host_id });
}

export async function updateMemory(host_id, memoryId, data, ctx = {}) {
	const update = {};
	if (data.title !== undefined) update.title = data.title;
	if (data.content !== undefined) update.content = data.content;
	if (data.tags !== undefined) update.tags = data.tags;
	if (data.source !== undefined) update.source = data.source;
	if (data.project !== undefined) update.project = data.project;
	update.is_indexed = false;

	const before = ctx.user_id ? await Memory.findOne({ _id: memoryId, host_id }).lean() : null;

	const mem = await Memory.findOneAndUpdate(
		{ _id: memoryId, host_id },
		{ $set: update },
		{ returnDocument: 'after' },
	);

	if (mem) {
		removeDocument(host_id, 'memory', memoryId).catch((err) => log.error({ err }, 'Typesense remove error'));
		emitToTenant(host_id, 'memory:updated', mem);
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, mem);
			audit.log({ action: 'update', resource: 'memory', resource_id: memoryId, host_id, details, ...ctx });
		}
	}

	return mem;
}

export async function deleteMemory(host_id, memoryId, ctx = {}) {
	const mem = await Memory.findOneAndUpdate(
		{ _id: memoryId, host_id, in_trash: { $ne: true } },
		{ $set: { in_trash: true, trashed_at: new Date(), is_indexed: false } },
		{ returnDocument: 'after' },
	);
	if (mem) {
		indexDocument(host_id, 'memory', mem).catch((err) => log.error({ err }, 'Typesense trash index error'));
		removeLinksForItem(host_id, memoryId).catch((err) => log.error({ err }, 'Remove links error'));
		emitToTenant(host_id, 'memory:deleted', { _id: memoryId });
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'memory', resource_id: memoryId, host_id, ...ctx });
	}
	return mem;
}

export async function recallMemory(host_id, query, options = {}) {
	return searchCollection(host_id, 'memory', query, {
		queryBy: 'embedding',
		...options,
	});
}

export async function suggestMemoryTags(host_id, options = {}) {
	const limit = normalizeTagLimit(options.limit);
	const query = String(options.query || options.q || '').trim();
	const projectId = options.projectId || options.project_id || options.project;
	const tagPrefix = query ? `^${escapeRegExp(query)}` : null;
	const match = { host_id, in_trash: { $ne: true } };

	if (projectId) match.project = maybeObjectId(projectId);
	if (tagPrefix) match.tags = { $regex: tagPrefix, $options: 'i' };

	const tagMatches = [
		{ tag: { $ne: '' } },
		{ tag: { $not: GENERATED_TAG_REGEX } },
	];

	if (tagPrefix) tagMatches.push({ tag: { $regex: tagPrefix, $options: 'i' } });

	const rows = await Memory.aggregate([
		{ $match: match },
		{ $unwind: '$tags' },
		{ $project: { tag: { $trim: { input: { $ifNull: ['$tags', ''] } } }, updatedAt: 1 } },
		{ $match: { $and: tagMatches } },
		{ $group: { _id: '$tag', count: { $sum: 1 }, last_used_at: { $max: '$updatedAt' } } },
		{ $sort: { count: -1, last_used_at: -1, _id: 1 } },
		{ $limit: limit },
		{ $project: { _id: 0, tag: '$_id' } },
	]);

	return rows.map(row => row.tag).filter(Boolean);
}

export async function countMemories(host_id) {
	return Memory.countDocuments({ host_id, in_trash: { $ne: true } });
}
