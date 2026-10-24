import { requireActiveProject, acquireProjectWrite } from './project_service.js';
import { validatePublicUrl } from '../modules/public_url.js';
import { Url } from '../model/url.js';
import { queryForSave } from '../model/mongoose.js';
import { searchCollection, indexDocument, removeDocument } from '../modules/typesense.js';
import { extractUrlContent } from '../modules/url_content_extractor.js';
import { emitToTenant } from '../modules/socket.js';
import { invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { saveScreenshot, saveScreenshotDataUrl, signScreenshotUrl } from '../modules/screenshot.js';
import { normalizeUrl } from '../modules/screenshot.js';
import { createLogger } from '../modules/logger.js';
import { syncStreamientItem } from './obsidian_sync_service.js';
import { renderFile } from 'pug';
import { fileURLToPath } from 'node:url';

const log = createLogger('url');

export function attachScreenshotUrl(doc) {
	if (!doc) return doc;
	const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
	if (obj.screenshot) {
		obj.screenshot_url = signScreenshotUrl(obj.screenshot);
	}
	obj.html = renderFile(fileURLToPath(new URL('../views/ajax/url_item.pug', import.meta.url)), { url: obj, cache: true });
	return obj;
}

function attachScreenshotUrls(docs) {
	return docs.map(attachScreenshotUrl);
}

export async function saveUrl(userId, host_id, data, ctx = {}) {
	const project = await requireActiveProject(host_id, data.project);
	const rawUrl = String(data.url || '').trim();
	validatePublicUrl(rawUrl);
	const normalizedUrl = normalizeUrl(rawUrl);
	const duplicateQuery = {
		host_id,
		project,
		in_trash: { $ne: true },
		$or: [
			{ normalized_url: normalizedUrl },
			{ url: rawUrl },
			{ url: normalizedUrl },
		],
	};
	const existingUrl = await queryForSave(Url.findOne(duplicateQuery));

	if (existingUrl) {
		let shouldSaveExisting = false;
		if (!existingUrl.normalized_url) {
			existingUrl.normalized_url = normalizedUrl;
			shouldSaveExisting = true;
		}
		if (await attachClientScreenshot(existingUrl, rawUrl, data.screenshot_data_url, host_id)) {
			shouldSaveExisting = true;
		}
		if (shouldSaveExisting && typeof existingUrl.save === 'function') {
			await existingUrl.save().catch((err) => log.error({ err }, 'URL duplicate update error'));
		}
		existingUrl.$locals = existingUrl.$locals || {};
		existingUrl.$locals.wasDuplicate = true;
		return existingUrl;
	}

	let extracted = {};
	try {
		extracted = await extractUrlContent(rawUrl);
	} catch (err) {
		log.error({ err }, 'URL extraction error');
	}

	const screenshot = await saveClientScreenshot(rawUrl, data.screenshot_data_url, host_id);

	const { release, publish } = await acquireProjectWrite(host_id, project, ctx);
	let urlDoc;
	try {
		urlDoc = await publish(async (session) => persistUrl(userId, host_id, {
			url: rawUrl,
			normalized_url: normalizedUrl,
			title: data.title || extracted.title || rawUrl,
			description: data.description || extracted.description || '',
			tags: data.tags || [],
			og_image: extracted.og_image || '',
			screenshot: screenshot || '',
			text_content: extracted.text_content || '',
			crawl_enabled: data.crawl_enabled || false,
			project,
			owner: userId,
			host_id,
		}, ctx, session));
	} finally {
		await release();
	}

	if (!screenshot) {
		// Fire-and-forget: capture screenshot in background
		saveScreenshot(rawUrl).then((filename) => {
			if (filename) {
				Url.updateOne({ _id: urlDoc._id }, { $set: { screenshot: filename } }).catch(() => {});
			}
		}).catch((err) => log.error({ err }, 'Screenshot capture error'));
	}

	return urlDoc;
}

async function persistUrl(userId, host_id, payload, ctx, session) {
	const urlDoc = session ? (await Url.create([payload], { session }))[0] : await Url.create(payload);

	emitToTenant(host_id, 'url:created', attachScreenshotUrl(urlDoc));
	invalidateGraphCache(host_id).catch(() => {});
	audit.log({ action: 'create', resource: 'url', resource_id: urlDoc._id.toString(), user_id: userId, host_id, ...ctx });
	await syncStreamientItem('url', urlDoc._id, host_id, { item: urlDoc }).catch((err) => log.error({ err, url_id: urlDoc._id }, 'Obsidian URL export deferred'));

	return urlDoc;
}

export async function copyUrl(userId, host_id, source, project, ctx = {}) {
	const { release, publish } = await acquireProjectWrite(host_id, project, ctx);
	try {
		validatePublicUrl(source.url);
		return await publish(async (session) => persistUrl(userId, host_id, { url: source.url, normalized_url: normalizeUrl(source.url), title: source.title, description: source.description, tags: source.tags || [], og_image: source.og_image || '', screenshot: source.screenshot || '', text_content: source.text_content || '', crawl_enabled: false, project, owner: userId, host_id, is_indexed: false }, ctx, session));
	} finally {
		await release();
	}
}

async function attachClientScreenshot(urlDoc, rawUrl, dataUrl, host_id) {
	const screenshot = await saveClientScreenshot(rawUrl, dataUrl, host_id);
	if (screenshot) {
		urlDoc.screenshot = screenshot;
		return true;
	}
	return false;
}

async function saveClientScreenshot(rawUrl, dataUrl, host_id) {
	if (!dataUrl) {
		return '';
	}

	try {
		return await saveScreenshotDataUrl(rawUrl, dataUrl, host_id);
	} catch (err) {
		log.error({ err }, 'Client screenshot save error');
		return '';
	}
}

export async function listUrls(host_id, projectId, { page = 1, limit = 50, offset } = {}) {
	const start = offset === undefined ? (page - 1) * limit : Number(offset);
	if (!Number.isSafeInteger(start) || start < 0) throw Object.assign(new Error('offset must be a nonnegative integer'), { status: 400 });
	const query = { host_id, in_trash: { $ne: true } };
	if (projectId) query.project = projectId;

	const docs = await Url.find(query)
		.select('-text_content')
		.sort({ createdAt: -1, _id: -1 })
		.skip(start)
		.limit(limit)
		.lean();
	return attachScreenshotUrls(docs);
}

export async function getUrl(host_id, urlId) {
	const doc = await Url.findOne({ _id: urlId, host_id }).lean();
	return attachScreenshotUrl(doc);
}

export async function updateUrl(host_id, urlId, data, ctx = {}) {
	const current = await Url.findOne({ _id: urlId, host_id }).select('project').lean();
	if (!current) return null;
	await requireActiveProject(host_id, data.project !== undefined ? data.project : current.project);
	const update = {};
	if (data.url !== undefined) {
		update.url = String(data.url || '').trim();
		validatePublicUrl(update.url);
		update.normalized_url = normalizeUrl(update.url);
	}
	if (data.title !== undefined) update.title = data.title;
	if (data.description !== undefined) update.description = data.description;
	if (data.tags !== undefined) update.tags = data.tags;
	if (data.crawl_enabled !== undefined) update.crawl_enabled = data.crawl_enabled;
	if (data.project !== undefined) update.project = data.project;
	update.is_indexed = false;

	const before = ctx.user_id ? await Url.findOne({ _id: urlId, host_id }).lean() : null;

	// A move must hold the destination project's write lease across the update,
	// fenced atomically with the record write so a deactivated project is rejected.
	const write = data.project !== undefined ? await acquireProjectWrite(host_id, data.project) : null;
	let urlDoc;
	try {
		const apply = (session) => Url.findOneAndUpdate(
			{ _id: urlId, host_id, ...(ctx.expected_updated_at ? { updatedAt: new Date(ctx.expected_updated_at), in_trash: { $ne: true } } : {}) },
			{ $set: update },
			{ returnDocument: 'after', ...(session ? { session } : {}) },
		);
		urlDoc = write ? await write.publish(apply) : await apply();
	} finally {
		if (write) await write.release();
	}

	let syncWarning;
	if (urlDoc) {
		removeDocument(host_id, 'urls', urlId).catch((err) => log.error({ err }, 'Typesense remove error'));
		emitToTenant(host_id, 'url:updated', attachScreenshotUrl(urlDoc));
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, urlDoc);
			audit.log({ action: 'update', resource: 'url', resource_id: urlId, host_id, details, ...ctx });
		}
		await syncStreamientItem('url', urlId, host_id, { item: urlDoc }).catch((err) => { log.error({ err, item_id: urlDoc._id }, 'Obsidian export deferred after saved update'); syncWarning = 'The item was saved; Obsidian sync is pending.'; });
	}

	const result = attachScreenshotUrl(urlDoc);
	if (syncWarning && result) result.sync_warning = syncWarning;
	return result;
}

export async function deleteUrl(host_id, urlId, ctx = {}) {
	const urlDoc = await Url.findOneAndUpdate(
		{ _id: urlId, host_id, in_trash: { $ne: true }, ...(ctx.expected_updated_at ? { updatedAt: new Date(ctx.expected_updated_at) } : {}) },
		{ $set: { in_trash: true, trashed_at: new Date(), is_indexed: false } },
		{ returnDocument: 'after' },
	);
	let syncWarning;
	if (urlDoc) {
		indexDocument(host_id, 'urls', urlDoc).catch((err) => log.error({ err }, 'Typesense trash index error'));
		removeLinksForItem(host_id, urlId).catch((err) => log.error({ err }, 'Remove links error'));
		emitToTenant(host_id, 'url:deleted', { _id: urlDoc._id, project: urlDoc.project, updatedAt: urlDoc.updatedAt, in_trash: true });
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'url', resource_id: urlId, host_id, ...ctx });
		await syncStreamientItem('url', urlId, host_id, { item: urlDoc }).catch((err) => { log.error({ err, item_id: urlDoc._id }, 'Obsidian trash export deferred after saved deletion'); syncWarning = 'The item was moved to trash; Obsidian sync is pending.'; });
	}
	const result = attachScreenshotUrl(urlDoc);
	if (syncWarning && result) result.sync_warning = syncWarning;
	return result;
}

export async function searchUrls(host_id, query, options = {}) {
	return searchCollection(host_id, 'urls', query, {
		queryBy: 'embedding',
		...options,
	});
}

export async function countUrls(host_id) {
	return Url.countDocuments({ host_id, in_trash: { $ne: true } });
}
