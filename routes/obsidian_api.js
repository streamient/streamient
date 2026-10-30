import { once } from 'node:events';
import { Router } from 'express';
import mongoose from '../model/mongoose.js';

import config from '../config.js';
import { requireOAuthScopes } from '../middleware/auth.js';
import { Tenant } from '../modules/tenancy.js';
import { Project } from '../model/project.js';
import { User } from '../model/user.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { hasProFeatureAccess } from '../services/subscription_access_service.js';
import * as blobService from '../services/obsidian_blob_service.js';
import * as syncService from '../services/obsidian_sync_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('obsidian-api');
const router = Router();

for (const parameter of ['connectionId', 'id']) {
	router.param(parameter, (req, res, next, value) => {
		if (!mongoose.isObjectIdOrHexString(value)) return res.status(400).json({ error: `Invalid ${parameter}`, code: 'invalid_id' });
		next();
	});
}

function auditCtx(req) {
	return { user_id: req.userId, channel: 'obsidian', ip: req.ip, user_agent: req.headers['user-agent'] };
}

function sendError(res, err, fallback = 'Obsidian sync request failed') {
	const status = err?.status || 500;
	if (status >= 500) log.error({ err }, fallback);
	return res.status(status).json({ error: status >= 500 ? fallback : err.message, code: err?.code || undefined });
}

async function streamBlobResponse(res, blob, hostId, mimeType) {
	res.set({
		'Content-Type': mimeType || blob.mime_type || 'application/octet-stream',
		'Content-Length': String(blob.total_bytes),
		'ETag': `"sha256-${blob.sha256}"`,
		'Cache-Control': 'private, no-store',
		'X-Content-Type-Options': 'nosniff',
		'Content-Disposition': 'attachment',
		'Content-Security-Policy': "sandbox; default-src 'none'",
	});
	for await (const chunk of blobService.readBlob(blob, hostId)) {
		if (!res.write(chunk)) await once(res, 'drain');
	}
	res.end();
}

export async function requireObsidianAccess(req, res, next) {
	const tenant = await Tenant.findOne({ host_id: req.host_id }).select('plan').lean();
	if (!hasProFeatureAccess(req.billingUser, tenant?.plan || 'free', req.isHosted)) return res.status(403).json({ error: 'Obsidian Sync requires Streamient Pro', code: 'pro_required' });
	if (!config.obsidian.enabled) return res.status(403).json({ error: 'Obsidian Sync is disabled', code: 'feature_disabled' });
	if (!config.obsidian.encryptionKey) return res.status(503).json({ error: 'Obsidian Sync encryption is not configured', code: 'encryption_key_missing' });
	next();
}

async function requireConnection(req, res, next) {
	const id = req.params.connectionId || req.body?.connection_id;
	if (!id) return res.status(400).json({ error: 'connection_id is required', code: 'connection_required' });
	const connection = await ObsidianConnection.findOne({ _id: id, host_id: req.host_id }).select('_id').lean().catch(() => null);
	if (!connection) return res.status(404).json({ error: 'Obsidian connection not found', code: 'connection_not_found' });
	next();
}

export function requireProjectManager(req, res, next) {
	if (req.memberRole === 'owner' || req.memberRole === 'admin') return next();
	return res.status(403).json({ error: 'Project settings admin access is required', code: 'admin_required' });
}

router.use(requireObsidianAccess);

router.get('/account', requireOAuthScopes('vault:read'), async (req, res) => {
	try {
		const [tenant, user] = await Promise.all([
			Tenant.findById(req.tenantId).select('_id name').lean(),
			User.findById(req.userId).select('_id name email').lean(),
		]);
		if (!tenant || !user) return res.status(404).json({ error: 'Streamient account not found', code: 'account_not_found' });
		res.json({ account: { id: String(tenant._id), name: tenant.name, role: req.memberRole, user: { id: String(user._id), name: user.name, email: user.email } } });
	} catch (err) {
		sendError(res, err, 'Account lookup failed');
	}
});

router.get('/projects', requireOAuthScopes('vault:read'), async (req, res) => {
	try {
		const projects = await Project.find({ host_id: req.host_id, is_active: true }).select('_id name color is_default').sort({ is_default: -1, name: 1 }).lean();
		res.json({ projects });
	} catch (err) {
		sendError(res, err, 'Projects failed');
	}
});

router.get('/connections', requireOAuthScopes('vault:read'), async (req, res) => {
	try {
		res.json({ connections: await syncService.listConnections(req.host_id, req.query.project_id) });
	} catch (err) {
		sendError(res, err);
	}
});

router.post('/connections', requireOAuthScopes('vault:write'), requireProjectManager, async (req, res) => {
	try {
		const connection = await syncService.createConnection(req.userId, req.host_id, req.body, auditCtx(req));
		res.status(201).json({ connection });
	} catch (err) {
		sendError(res, err, 'Connection failed');
	}
});

router.patch('/connections/:connectionId', requireOAuthScopes('vault:write'), requireProjectManager, requireConnection, async (req, res) => {
	try {
		res.json({ connection: await syncService.updateConnection(req.host_id, req.params.connectionId, req.body, auditCtx(req)) });
	} catch (err) {
		sendError(res, err, 'Connection update failed');
	}
});

router.delete('/connections/:connectionId', requireOAuthScopes('vault:write'), requireProjectManager, requireConnection, async (req, res) => {
	try {
		res.json(await syncService.removeConnection(req.host_id, req.params.connectionId, auditCtx(req)));
	} catch (err) {
		sendError(res, err, 'Connection removal failed');
	}
});

router.post('/connections/:connectionId/devices', requireOAuthScopes('vault:write'), requireConnection, async (req, res) => {
	try {
		res.json({ connection: await syncService.registerDevice(req.host_id, req.params.connectionId, req.body) });
	} catch (err) {
		sendError(res, err, 'Device registration failed');
	}
});

router.post('/connections/:connectionId/request-sync', requireOAuthScopes('vault:write'), requireConnection, async (req, res) => {
	try {
		res.status(202).json({ connection: await syncService.requestSync(req.host_id, req.params.connectionId, auditCtx(req)) });
	} catch (err) {
		sendError(res, err, 'Sync request failed');
	}
});

router.post('/connections/:connectionId/manifest', requireOAuthScopes('vault:read', 'vault:write'), requireConnection, async (req, res) => {
	try {
		res.json(await syncService.reconcileManifest(req.userId, req.host_id, req.params.connectionId, req.body));
	} catch (err) {
		sendError(res, err, 'Manifest reconciliation failed');
	}
});

router.post('/connections/:connectionId/exports', requireOAuthScopes('vault:read', 'vault:write'), requireConnection, async (req, res) => {
	try {
		res.json(await syncService.materializeProjectExports(req.host_id, req.params.connectionId, req.body));
	} catch (err) {
		sendError(res, err, 'Project export failed');
	}
});

router.post('/connections/:connectionId/relocate', requireOAuthScopes('vault:write'), requireProjectManager, requireConnection, async (req, res) => {
	try {
		res.json(await syncService.relocateConnectionFolder(req.host_id, req.params.connectionId, req.body, auditCtx(req)));
	} catch (err) {
		sendError(res, err, 'Project folder relocation failed');
	}
});

router.post('/connections/:connectionId/mutations', requireOAuthScopes('vault:write'), requireConnection, async (req, res) => {
	try {
		res.json(await syncService.applyMutations(req.userId, req.host_id, req.params.connectionId, req.body));
	} catch (err) {
		sendError(res, err, 'Mutation failed');
	}
});

router.get('/connections/:connectionId/changes', requireOAuthScopes('vault:read'), requireConnection, async (req, res) => {
	try {
		res.json(await syncService.getChanges(req.host_id, req.params.connectionId, { after: req.query.after, limit: req.query.limit, device_id: req.query.device_id }));
	} catch (err) {
		sendError(res, err, 'Changes failed');
	}
});

router.get('/connections/:connectionId/conflicts', requireOAuthScopes('vault:read'), requireConnection, async (req, res) => {
	try {
		res.json({ conflicts: await syncService.listConflicts(req.host_id, req.params.connectionId, req.query.limit) });
	} catch (err) {
		sendError(res, err, 'Conflict history failed');
	}
});

router.post('/connections/:connectionId/resolve', requireOAuthScopes('vault:read'), requireConnection, async (req, res) => {
	try {
		res.json({ files: await syncService.resolveVaultPaths(req.host_id, req.params.connectionId, req.body.paths) });
	} catch (err) {
		sendError(res, err, 'Vault link resolution failed');
	}
});

router.post('/uploads', requireOAuthScopes('vault:write'), requireConnection, async (req, res) => {
	try {
		const normalizedPath = syncService.normalizeVaultPath(req.body.path);
		if (syncService.isExcludedVaultPath(normalizedPath)) return res.status(400).json({ error: 'File path is excluded', code: 'path_excluded' });
		const connection = await ObsidianConnection.findOne({ _id: req.body.connection_id, host_id: req.host_id }).select('enabled storage_bytes').lean();
		if (!connection?.enabled) return res.status(409).json({ error: 'Obsidian connection is disabled', code: 'connection_disabled' });
		const existing = await ObsidianFile.findOne({ connection: connection._id, host_id: req.host_id, path: normalizedPath }).select('size').lean();
		const totalBytes = Number(req.body.total_bytes ?? req.body.upload_length);
		if (config.obsidian.maxVaultBytes && Number(connection.storage_bytes || 0) - Number(existing?.size || 0) + totalBytes > config.obsidian.maxVaultBytes) return res.status(413).json({ error: 'Vault exceeds the configured Streamient storage limit', code: 'vault_too_large' });
		const upload = await blobService.createUpload(req.userId, req.host_id, { ...req.body, path: normalizedPath });
		res.set('Location', `/api/v1/obsidian/uploads/${upload.id}`);
		res.status(201).json({ upload });
	} catch (err) {
		sendError(res, err, 'Upload creation failed');
	}
});

router.head('/uploads/:id', requireOAuthScopes('vault:write'), async (req, res) => {
	try {
		const upload = await blobService.getUpload(req.userId, req.host_id, req.params.id);
		res.set({ 'Upload-Offset': String(upload.upload_offset), 'Upload-Length': String(upload.upload_length), 'Upload-State': upload.state, 'Upload-Chunk-Size': String(upload.chunk_size), 'Cache-Control': 'no-store' });
		res.status(204).end();
	} catch (err) {
		sendError(res, err, 'Upload status failed');
	}
});

router.get('/uploads/:id', requireOAuthScopes('vault:write'), async (req, res) => {
	try {
		res.json({ upload: await blobService.getUpload(req.userId, req.host_id, req.params.id) });
	} catch (err) {
		sendError(res, err, 'Upload status failed');
	}
});

router.patch('/uploads/:id', requireOAuthScopes('vault:write'), async (req, res) => {
	try {
		const upload = await blobService.appendUploadChunk(req.userId, req.host_id, req.params.id, req);
		res.set({ 'Upload-Offset': String(upload.upload_offset), 'Upload-Length': String(upload.upload_length), 'Upload-State': upload.state, 'Cache-Control': 'no-store' });
		res.status(204).end();
	} catch (err) {
		sendError(res, err, 'Chunk upload failed');
	}
});

router.post('/uploads/:id/complete', requireOAuthScopes('vault:write'), async (req, res) => {
	try {
		res.json({ upload: await blobService.completeUpload(req.userId, req.host_id, req.params.id) });
	} catch (err) {
		sendError(res, err, 'Upload completion failed');
	}
});

router.delete('/uploads/:id', requireOAuthScopes('vault:write'), async (req, res) => {
	try {
		res.json({ upload: await blobService.cancelUpload(req.userId, req.host_id, req.params.id) });
	} catch (err) {
		sendError(res, err, 'Upload cancellation failed');
	}
});

router.get('/files/:id', requireOAuthScopes('vault:read'), async (req, res) => {
	try {
		const file = await syncService.getFile(req.host_id, req.params.id);
		res.json({ file: { id: String(file._id), path: file.path, kind: file.kind, mime_type: file.mime_type, size: file.size, sha256: file.sha256, revision: file.revision, modified_at: file.modified_at, in_trash: file.in_trash } });
	} catch (err) {
		sendError(res, err, 'File lookup failed');
	}
});

router.get('/files/:id/content', requireOAuthScopes('vault:read'), async (req, res) => {
	try {
		const file = await syncService.getFile(req.host_id, req.params.id);
		if (!file.blob) return res.status(404).json({ error: 'File content not found', code: 'content_not_found' });
		const blob = await ObsidianBlob.findOne({ _id: file.blob, host_id: req.host_id }).lean();
		if (!blob) return res.status(404).json({ error: 'File content not found', code: 'content_not_found' });
		await streamBlobResponse(res, blob, req.host_id, file.mime_type);
	} catch (err) {
		if (res.headersSent) return res.destroy(err);
		sendError(res, err, 'File download failed');
	}
});

router.get('/revisions/:id/content', requireOAuthScopes('vault:read'), async (req, res) => {
	try {
		const revision = await syncService.getRevision(req.host_id, req.params.id);
		const blob = await ObsidianBlob.findOne({ _id: revision.blob, host_id: req.host_id }).lean();
		if (!blob) return res.status(404).json({ error: 'Conflict revision content not found', code: 'content_not_found' });
		await streamBlobResponse(res, blob, req.host_id, blob.mime_type);
	} catch (err) {
		if (res.headersSent) return res.destroy(err);
		sendError(res, err, 'Conflict revision download failed');
	}
});

export default router;
