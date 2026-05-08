import { Url } from '../model/url.js';
import { searchCollection, removeDocument } from '../modules/typesense.js';
import { extractUrlContent } from '../modules/url_content_extractor.js';
import { emitToTenant } from '../modules/socket.js';
import { invalidateGraphCache, removeLinksForItem } from './graph_service.js';
import * as audit from './audit_service.js';
import { saveScreenshot, saveScreenshotDataUrl, signScreenshotUrl } from '../modules/screenshot.js';
import { normalizeUrl } from '../modules/screenshot.js';

function attachScreenshotUrl(doc) {
	if (!doc) return doc;
	const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
	if (obj.screenshot) {
		obj.screenshot_url = signScreenshotUrl(obj.screenshot);
	}
	return obj;
}

function attachScreenshotUrls(docs) {
	return docs.map(attachScreenshotUrl);
}

export async function saveUrl(userId, host_id, data, ctx = {}) {
	const rawUrl = String(data.url || '').trim();
	const normalizedUrl = normalizeUrl(rawUrl);
	const duplicateQuery = {
		host_id,
		in_trash: { $ne: true },
		$or: [
			{ normalized_url: normalizedUrl },
			{ url: rawUrl },
			{ url: normalizedUrl },
		],
	};
	const existingUrl = await Url.findOne(duplicateQuery);

	if (existingUrl) {
		let shouldSaveExisting = false;
		if (!existingUrl.normalized_url) {
			existingUrl.normalized_url = normalizedUrl;
			shouldSaveExisting = true;
		}
		if (await attachClientScreenshot(existingUrl, rawUrl, data.screenshot_data_url)) {
			shouldSaveExisting = true;
		}
		if (shouldSaveExisting && typeof existingUrl.save === 'function') {
			await existingUrl.save().catch((err) => console.error('URL duplicate update error:', err.message));
		}
		existingUrl.$locals = existingUrl.$locals || {};
		existingUrl.$locals.wasDuplicate = true;
		return existingUrl;
	}

	let extracted = {};
	try {
		extracted = await extractUrlContent(rawUrl);
	} catch (err) {
		console.error('URL extraction error:', err.message);
	}

	const screenshot = await saveClientScreenshot(rawUrl, data.screenshot_data_url);

	const urlDoc = await Url.create({
		url: rawUrl,
		normalized_url: normalizedUrl,
		title: data.title || extracted.title || rawUrl,
		description: data.description || extracted.description || '',
		og_image: extracted.og_image || '',
		screenshot: screenshot || '',
		text_content: extracted.text_content || '',
		crawl_enabled: data.crawl_enabled || false,
		project: data.project,
		owner: userId,
		host_id,
	});

	emitToTenant(host_id, 'url:created', urlDoc);
	invalidateGraphCache(host_id).catch(() => {});
	audit.log({ action: 'create', resource: 'url', resource_id: urlDoc._id.toString(), user_id: userId, host_id, ...ctx });

	if (!screenshot) {
		// Fire-and-forget: capture screenshot in background
		saveScreenshot(rawUrl).then((filename) => {
			if (filename) {
				Url.updateOne({ _id: urlDoc._id }, { $set: { screenshot: filename } }).catch(() => {});
			}
		}).catch((err) => console.error('Screenshot capture error:', err.message));
	}

	return urlDoc;
}

async function attachClientScreenshot(urlDoc, rawUrl, dataUrl) {
	const screenshot = await saveClientScreenshot(rawUrl, dataUrl);
	if (screenshot) {
		urlDoc.screenshot = screenshot;
		return true;
	}
	return false;
}

async function saveClientScreenshot(rawUrl, dataUrl) {
	if (!dataUrl) {
		return '';
	}

	try {
		return await saveScreenshotDataUrl(rawUrl, dataUrl);
	} catch (err) {
		console.error('Client screenshot save error:', err.message);
		return '';
	}
}

export async function listUrls(host_id, projectId, { page = 1, limit = 50 } = {}) {
	const query = { host_id, in_trash: { $ne: true } };
	if (projectId) query.project = projectId;

	const docs = await Url.find(query)
		.select('-text_content')
		.sort({ updatedAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit);
	return attachScreenshotUrls(docs);
}

export async function getUrl(host_id, urlId) {
	const doc = await Url.findOne({ _id: urlId, host_id });
	return attachScreenshotUrl(doc);
}

export async function updateUrl(host_id, urlId, data, ctx = {}) {
	const update = {};
	if (data.title !== undefined) update.title = data.title;
	if (data.description !== undefined) update.description = data.description;
	if (data.crawl_enabled !== undefined) update.crawl_enabled = data.crawl_enabled;
	if (data.project !== undefined) update.project = data.project;
	update.is_indexed = false;

	const before = ctx.user_id ? await Url.findOne({ _id: urlId, host_id }).lean() : null;

	const urlDoc = await Url.findOneAndUpdate(
		{ _id: urlId, host_id },
		{ $set: update },
		{ returnDocument: 'after' },
	);

	if (urlDoc) {
		removeDocument(host_id, 'urls', urlId).catch((err) => console.error('Typesense remove error:', err.message));
		emitToTenant(host_id, 'url:updated', urlDoc);
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) {
			const details = audit.diffSnapshot(before, urlDoc);
			audit.log({ action: 'update', resource: 'url', resource_id: urlId, host_id, details, ...ctx });
		}
	}

	return urlDoc;
}

export async function deleteUrl(host_id, urlId, ctx = {}) {
	const urlDoc = await Url.findOneAndUpdate(
		{ _id: urlId, host_id, in_trash: { $ne: true } },
		{ $set: { in_trash: true, trashed_at: new Date() } },
		{ returnDocument: 'after' },
	);
	if (urlDoc) {
		removeDocument(host_id, 'urls', urlId).catch((err) => console.error('Typesense remove error:', err.message));
		removeLinksForItem(host_id, urlId).catch((err) => console.error('Remove links error:', err.message));
		emitToTenant(host_id, 'url:deleted', { _id: urlId });
		invalidateGraphCache(host_id).catch(() => {});
		if (ctx.user_id) audit.log({ action: 'delete', resource: 'url', resource_id: urlId, host_id, ...ctx });
	}
	return urlDoc;
}

export async function searchUrls(host_id, query, options = {}) {
	return searchCollection(host_id, 'urls', query, {
		queryBy: 'title,description,text_content,embedding',
		...options,
	});
}

export async function countUrls(host_id) {
	return Url.countDocuments({ host_id, in_trash: { $ne: true } });
}
