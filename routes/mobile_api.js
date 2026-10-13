import { Router } from 'express';
import { avatarStyleValues } from '../modules/avatar.js';
import mongoose, { queryForSave } from '../model/mongoose.js';
import { requireOAuthScopes, generateSocketToken, SOCKET_TOKEN_EXPIRES_IN_SECONDS, SOCKET_TOKEN_REFRESH_AFTER_SECONDS } from '../middleware/auth.js';
import { createAiDailyLimiter } from '../middleware/rate_limit.js';
import { Tenant } from '../modules/tenancy.js';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { User } from '../model/user.js';
import { isSupportedTimezone } from '../modules/timezones.js';
import { hasProFeatureAccess } from '../services/subscription_access_service.js';
import * as mobileService from '../services/mobile_service.js';
import * as noteService from '../services/note_service.js';
import * as urlService from '../services/url_service.js';
import * as noteImportService from '../services/note_import_service.js';
import { processChatStream, friendlyChatError } from '../services/ai_chat_service.js';
import { listConversations, getConversationMessages } from '../modules/typesense.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('mobile-api');
const router = Router();
const aiDailyLimiter = createAiDailyLimiter();

function auditCtx(req) {
	return { user_id: req.userId, channel: 'mobile', token_label: req.tokenLabel, ip: req.ip, user_agent: req.headers['user-agent'] };
}

async function emailAccess(req) {
	if (!req.isHosted) return true;
	const tenant = await Tenant.findOne({ host_id: req.host_id }).select('plan').lean();
	return hasProFeatureAccess(req.billingUser, tenant?.plan || 'free', req.isHosted);
}

async function ensureProject(req, projectId) {
	if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) return null;
	return Project.findOne({ _id: projectId, host_id: req.host_id, is_active: true }).select('_id').lean();
}

function requireObjectId(req, res, next) {
	if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid record id' });
	next();
}

function tags(value) {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.map((tag) => String(tag || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 50);
}

function plainText(value) {
	return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sendError(res, err, fallback = 'Request failed') {
	const status = err?.status || 500;
	return res.status(status).json({ error: status >= 500 ? fallback : err.message, code: err?.code || undefined });
}

router.get('/bootstrap', requireOAuthScopes('knowledge:read'), async (req, res) => {
	try {
		res.json(await mobileService.bootstrap(req.userId, req.host_id, { includeEmails: await emailAccess(req) }));
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile bootstrap error');
		sendError(res, err, 'Bootstrap failed');
	}
});

router.get('/projects', requireOAuthScopes('knowledge:read'), async (req, res) => {
	try {
		res.json({ projects: await mobileService.listProjects(req.host_id, { includeEmails: await emailAccess(req) }) });
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile projects error');
		sendError(res, err, 'Projects failed');
	}
});

router.get('/projects/counts', requireOAuthScopes('knowledge:read'), async (req, res) => {
	try {
		res.json({ projects: await mobileService.listProjects(req.host_id, { includeEmails: await emailAccess(req) }) });
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile project counts error');
		sendError(res, err, 'Project counts failed');
	}
});

router.get('/records', requireOAuthScopes('knowledge:read'), async (req, res) => {
	try {
		res.json(await mobileService.listRecords(req.host_id, { projectId: req.query.project_id, type: req.query.type, cursor: req.query.cursor, limit: req.query.limit, includeEmails: await emailAccess(req) }));
	} catch (err) {
		sendError(res, err, 'Records failed');
	}
});

router.get('/records/changes', requireOAuthScopes('knowledge:read'), async (req, res) => {
	try {
		res.json(await mobileService.getChanges(req.host_id, { projectId: req.query.project_id, type: req.query.type, cursor: req.query.cursor, limit: req.query.limit, includeEmails: await emailAccess(req) }));
	} catch (err) {
		sendError(res, err, 'Changes failed');
	}
});

router.get('/records/:type/:id', requireOAuthScopes('knowledge:read'), requireObjectId, async (req, res) => {
	try {
		const record = await mobileService.getRecord(req.host_id, req.params.type, req.params.id, { includeEmails: await emailAccess(req) });
		if (!record) return res.status(404).json({ error: 'Record not found' });
		res.json({ record });
	} catch (err) {
		sendError(res, err, 'Record failed');
	}
});

router.get('/search', requireOAuthScopes('knowledge:read'), async (req, res) => {
	try {
		const query = String(req.query.q || '').trim();
		if (!query) return res.status(400).json({ error: 'q is required' });
		res.json(await mobileService.searchRecords(req.host_id, query, { projectId: req.query.all_projects === 'true' ? null : req.query.project_id, type: req.query.type, includeEmails: await emailAccess(req), limit: req.query.limit }));
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile search error');
		sendError(res, err, 'Search failed');
	}
});

router.get('/notes/tags', requireOAuthScopes('knowledge:read'), async (req, res) => {
	try {
		if (req.query.project_id && !mongoose.Types.ObjectId.isValid(req.query.project_id)) return res.status(400).json({ error: 'Invalid project_id' });
		const match = { host_id: req.host_id, in_trash: { $ne: true } };
		if (req.query.project_id) match.project = req.query.project_id;
		const [noteTags, memoryTags] = await Promise.all([Note.distinct('tags', match), Memory.distinct('tags', match)]);
		res.json({ tags: [...new Set([...noteTags, ...memoryTags].filter(Boolean))].sort().slice(0, 200) });
	} catch (err) {
		sendError(res, err, 'Tags failed');
	}
});

router.post('/notes', requireOAuthScopes('knowledge:write'), async (req, res) => {
	try {
		if (!await ensureProject(req, req.body.project_id)) return res.status(404).json({ error: 'Project not found' });
		const content = String(req.body.content || '');
		const note = await noteService.createNote(req.userId, req.host_id, { title: String(req.body.title || 'Untitled').trim().slice(0, 240), content, text_content: String(req.body.text_content || plainText(content)), tags: tags(req.body.tags), project: req.body.project_id }, auditCtx(req));
		res.status(201).json({ record: mobileService.normalizeRecord('notes', note) });
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile note create error');
		sendError(res, err, 'Note creation failed');
	}
});

router.put('/notes/:id', requireOAuthScopes('knowledge:write'), requireObjectId, async (req, res) => {
	try {
		if (!await Note.exists({ _id: req.params.id, host_id: req.host_id, in_trash: { $ne: true } })) return res.status(404).json({ error: 'Note not found' });
		if (req.body.project_id && !await ensureProject(req, req.body.project_id)) return res.status(404).json({ error: 'Project not found' });
		const content = req.body.content === undefined ? undefined : String(req.body.content);
		const note = await noteService.updateNote(req.host_id, req.params.id, { title: req.body.title === undefined ? undefined : String(req.body.title).trim().slice(0, 240), content, text_content: req.body.text_content === undefined && content === undefined ? undefined : String(req.body.text_content || plainText(content)), tags: req.body.tags === undefined ? undefined : tags(req.body.tags), project: req.body.project_id }, auditCtx(req));
		if (!note || note.in_trash) return res.status(404).json({ error: 'Note not found' });
		res.json({ record: mobileService.normalizeRecord('notes', note) });
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile note update error');
		sendError(res, err, 'Note update failed');
	}
});

router.post('/urls', requireOAuthScopes('knowledge:write'), async (req, res) => {
	try {
		if (!await ensureProject(req, req.body.project_id)) return res.status(404).json({ error: 'Project not found' });
		const rawUrl = String(req.body.url || '').trim();
		let parsed;
		try {
			parsed = new URL(rawUrl);
		} catch {
			return res.status(400).json({ error: 'A valid HTTP(S) URL is required' });
		}
		if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ error: 'A valid HTTP(S) URL is required' });
		const url = await urlService.saveUrl(req.userId, req.host_id, { url: parsed.toString(), title: String(req.body.title || '').trim().slice(0, 240), project: req.body.project_id }, auditCtx(req));
		res.status(url.$locals?.wasDuplicate ? 200 : 201).json({ record: mobileService.normalizeRecord('urls', url), duplicate: !!url.$locals?.wasDuplicate });
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile URL create error');
		sendError(res, err, 'URL save failed');
	}
});

router.post('/note-imports', requireOAuthScopes('knowledge:write'), async (req, res) => {
	try {
		const upload = await noteImportService.createUpload(req.userId, req.host_id, req.body);
		res.set('Location', `/api/v1/mobile/note-imports/${upload.id}`);
		res.status(201).json({ upload });
	} catch (err) {
		sendError(res, err, 'Import session creation failed');
	}
});

router.head('/note-imports/:id', requireOAuthScopes('knowledge:write'), requireObjectId, async (req, res) => {
	try {
		const upload = await noteImportService.getUpload(req.userId, req.host_id, req.params.id, { touch: true });
		res.set({ 'Upload-Offset': String(upload.upload_offset), 'Upload-Length': String(upload.upload_length), 'Upload-State': upload.state, 'Upload-Chunk-Size': String(upload.chunk_size), 'Cache-Control': 'no-store' });
		res.status(204).end();
	} catch (err) {
		sendError(res, err, 'Import lookup failed');
	}
});

router.patch('/note-imports/:id', requireOAuthScopes('knowledge:write'), requireObjectId, async (req, res) => {
	try {
		if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/offset+octet-stream')) return res.status(415).json({ error: 'Content-Type must be application/offset+octet-stream' });
		const upload = await noteImportService.appendChunk(req.userId, req.host_id, req.params.id, req);
		res.set({ 'Upload-Offset': String(upload.upload_offset), 'Upload-Length': String(upload.upload_length), 'Upload-State': upload.state, 'Cache-Control': 'no-store' });
		res.status(204).end();
	} catch (err) {
		sendError(res, err, 'Chunk upload failed');
	}
});

router.post('/note-imports/:id/complete', requireOAuthScopes('knowledge:write'), requireObjectId, async (req, res) => {
	try {
		res.status(202).json({ upload: await noteImportService.completeUpload(req.userId, req.host_id, req.params.id) });
	} catch (err) {
		sendError(res, err, 'Import completion failed');
	}
});

router.get('/note-imports/:id', requireOAuthScopes('knowledge:write'), requireObjectId, async (req, res) => {
	try {
		res.json({ upload: await noteImportService.getUpload(req.userId, req.host_id, req.params.id, { touch: true }) });
	} catch (err) {
		sendError(res, err, 'Import lookup failed');
	}
});

router.delete('/note-imports/:id', requireOAuthScopes('knowledge:write'), requireObjectId, async (req, res) => {
	try {
		res.json({ upload: await noteImportService.cancelUpload(req.userId, req.host_id, req.params.id) });
	} catch (err) {
		sendError(res, err, 'Import cancellation failed');
	}
});

router.post('/chat/stream', requireOAuthScopes('ai:chat'), aiDailyLimiter, async (req, res) => {
	res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
	res.flushHeaders();
	let closed = false;
	req.on('close', () => { closed = true; });
	const send = (event, data) => { if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
	try {
		const query = String(req.body.query || '').trim();
		if (!query) {
			send('error', { error: 'query required' });
			return res.end();
		}
		const { stream, answer, metadata } = await processChatStream({ hostId: req.host_id, userId: req.userId, query, conversationId: req.body.conversation_id, projectId: req.body.all_projects ? null : req.body.project_id, contextResults: req.body.context_results || [], includeEmails: await emailAccess(req), allowActions: false, ctx: auditCtx(req) });
		if (stream) for await (const text of stream) { if (closed) break; send('token', { text }); }
		else if (answer) send('token', { text: answer });
		send('done', { conversation_id: metadata.conversationId, results: (metadata.results || []).map(mobileService.normalizeSearchReference).filter(Boolean), action: null, display_in: metadata.displayIn });
	} catch (err) {
		log.error({ err, host_id: req.host_id }, 'Mobile AI stream error');
		send('error', { error: friendlyChatError(err) });
	}
	res.end();
});

router.get('/chat/conversations', requireOAuthScopes('ai:chat'), async (req, res) => {
	try {
		const conversations = await listConversations(req.host_id, req.userId, { limit: Math.min(Number.parseInt(req.query.limit, 10) || 20, 50) });
		res.json({ conversations: conversations.map((conversation) => ({ ...conversation, timestamp: mobileService.normalizeMobileTimestamp(conversation.timestamp) })) });
	} catch (err) {
		sendError(res, err, 'Chat history failed');
	}
});

router.get('/chat/conversations/:id/messages', requireOAuthScopes('ai:chat'), async (req, res) => {
	try {
		const messages = await getConversationMessages(req.host_id, req.userId, req.params.id);
		res.json({ messages: messages.map((message) => ({ ...message, timestamp: mobileService.normalizeMobileTimestamp(message.timestamp) })) });
	} catch (err) {
		sendError(res, err, 'Chat messages failed');
	}
});

router.get('/profile', requireOAuthScopes('knowledge:read'), async (req, res) => {
	const user = await User.findById(req.userId).select('name email timezone time_format avatar_style').lean();
	if (!user) return res.status(404).json({ error: 'User not found' });
	res.json({ user });
});

router.put('/profile', requireOAuthScopes('profile:write'), async (req, res) => {
	try {
		const body = req.body || {};
		if (Object.hasOwn(body, 'avatar_style') && !avatarStyleValues.includes(body.avatar_style)) return res.status(400).json({ error: 'Invalid avatar style' });
		if (Object.hasOwn(body, 'timezone') && !isSupportedTimezone(String(body.timezone || '').trim())) return res.status(400).json({ error: 'Invalid timezone' });
		if (Object.hasOwn(body, 'time_format') && !['12-hour', '24-hour'].includes(body.time_format)) return res.status(400).json({ error: 'Invalid time format' });
		const user = await queryForSave(User.findById(req.userId));
		if (!user) return res.status(404).json({ error: 'User not found' });
		if (body.name) user.name = String(body.name).trim().slice(0, 160);
		if (Object.hasOwn(body, 'timezone')) { user.timezone = String(body.timezone).trim(); user.timezone_configured = true; }
		if (Object.hasOwn(body, 'time_format')) user.time_format = body.time_format;
		if (Object.hasOwn(body, 'avatar_style')) user.avatar_style = body.avatar_style;
		await user.save();
		res.json({ user: { _id: user._id, name: user.name, email: user.email, timezone: user.timezone, time_format: user.time_format, avatar_style: user.avatar_style || 'initials' } });
	} catch (err) {
		sendError(res, err, 'Profile update failed');
	}
});

router.post('/socket-token', requireOAuthScopes('knowledge:read'), (req, res) => {
	res.json({ token: generateSocketToken(req.userId, req.host_id, req.tenantId), expires_in: SOCKET_TOKEN_EXPIRES_IN_SECONDS, refresh_after: SOCKET_TOKEN_REFRESH_AFTER_SECONDS });
});

export default router;
