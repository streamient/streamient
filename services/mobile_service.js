import mongoose from '../model/mongoose.js';
import striptags from 'striptags';
import { load } from 'cheerio';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { User, toSafeUser } from '../model/user.js';
import { getProjectCounts } from './project_service.js';
import { quickSearchKnowledge } from './quick_search_service.js';

const MODEL_BY_TYPE = { notes: Note, memories: Memory, urls: Url, emails: Email };
const ALL_TYPES = Object.keys(MODEL_BY_TYPE);
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function compact(value, limit = 260, richText = false) {
	const source = String(value || '');
	const text = (richText && /<\/?[a-z][^>]*>/i.test(source) ? load(striptags(source, [], ' '), {}, false).text() : source).replace(/\s+/g, ' ').trim();
	return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

function dateValue(value) {
	return value ? new Date(value).toISOString() : null;
}

function searchDateValue(value) {
	if (!value) return new Date(0).toISOString();
	const numeric = typeof value === 'number' ? value : /^\d+$/.test(String(value)) ? Number(value) : null;
	const date = numeric === null ? new Date(value) : new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
	return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function normalizeMobileTimestamp(value) {
	return searchDateValue(value);
}

function normalizeType(value) {
	const type = String(value || '').toLowerCase();
	if (type === 'note') return 'notes';
	if (type === 'memory') return 'memories';
	if (type === 'url') return 'urls';
	if (type === 'email') return 'emails';
	return type;
}

function selectedTypes(input, includeEmails) {
	const requested = String(input || 'all').split(',').map(normalizeType).filter((type) => ALL_TYPES.includes(type));
	const types = requested.length ? requested : ALL_TYPES;
	return types.filter((type) => includeEmails || type !== 'emails');
}

function validateProjectId(projectId) {
	if (projectId && !mongoose.Types.ObjectId.isValid(projectId)) throw Object.assign(new Error('Invalid project_id'), { status: 400 });
}

function encodeCursor(record) {
	if (!record) return null;
	return Buffer.from(JSON.stringify({ updated_at: record.updated_at, id: record.id }), 'utf8').toString('base64url');
}

function decodeCursor(value) {
	if (!value) return null;
	try {
		const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
		if (!parsed.updated_at || !mongoose.Types.ObjectId.isValid(parsed.id)) return null;
		return { updatedAt: new Date(parsed.updated_at), id: new mongoose.Types.ObjectId(parsed.id) };
	} catch {
		return null;
	}
}

function cursorFilter(cursor) {
	if (!cursor) return {};
	return { $or: [{ updatedAt: { $lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, _id: { $lt: cursor.id } }] };
}

function forwardCursorFilter(cursor) {
	if (!cursor) return null;
	return { $or: [{ updatedAt: { $gt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, _id: { $gt: cursor.id } }] };
}

function metadata(type, doc) {
	if (type === 'notes') return { tags: doc.tags || [], editable: true };
	if (type === 'memories') return { tags: doc.tags || [], source: doc.source || '', editable: false };
	if (type === 'urls') return { url: doc.url || '', domain: safeHostname(doc.url), editable: false };
	return { from: doc.from || [], to: doc.to || [], mailbox: doc.mailbox || 'inbox', editable: false };
}

function safeHostname(value) {
	try {
		return new URL(value).hostname;
	} catch {
		return '';
	}
}

export function normalizeRecord(type, doc) {
	const id = String(doc._id);
	const title = type === 'emails' ? doc.subject || '(No subject)' : doc.title || (type === 'urls' ? doc.url : '') || 'Untitled';
	const excerptSource = type === 'notes' ? doc.text_content || doc.content : type === 'memories' ? doc.content : type === 'urls' ? doc.description || doc.text_content : doc.text_content || doc.attachment_text_content;
	return {
		key: `${type}:${id}`,
		type,
		id,
		project_id: String(doc.project),
		title,
		excerpt: compact(excerptSource, 260, type === 'memories' || (type === 'notes' && !doc.text_content)),
		created_at: dateValue(doc.createdAt),
		updated_at: dateValue(doc.updatedAt),
		metadata: metadata(type, doc),
	};
}

export function normalizeSearchReference(item = {}) {
	const sourceType = String(item._type || item.type || '').toLowerCase();
	const type = sourceType === 'pages' ? 'urls' : normalizeType(sourceType);
	if (!ALL_TYPES.includes(type)) return null;
	const id = String(sourceType === 'pages' ? item.parent_url_id || '' : item.source_id || item.id || '');
	if (!id) return null;
	const title = type === 'emails' ? item.subject || item.title || '(No subject)' : item.title || item.url || 'Untitled';
	const excerpt = compact(item.excerpt || item.text_content || item.content || item.description, 260, (type === 'memories' && Boolean(item.excerpt || !item.text_content)) || (!item.excerpt && !item.text_content && Boolean(item.content)));
	return {
		key: `${type}:${id}`,
		type,
		id,
		project_id: String(item.project_id || ''),
		title,
		excerpt,
		created_at: searchDateValue(item.created_at || item.updated_at),
		updated_at: searchDateValue(item.updated_at || item.created_at),
		metadata: type === 'urls' ? { url: item.url || '', domain: safeHostname(item.url), editable: false } : { editable: type === 'notes' },
	};
}

function compareRecords(a, b) {
	const dateComparison = String(b.updated_at).localeCompare(String(a.updated_at));
	if (dateComparison) return dateComparison;
	return b.id.localeCompare(a.id);
}

const LIST_FIELDS = {
	notes: '_id project title text_content content tags createdAt updatedAt in_trash',
	memories: '_id project title content tags source createdAt updatedAt in_trash',
	urls: '_id project title url description text_content createdAt updatedAt in_trash',
	emails: '_id project subject text_content attachment_text_content from to mailbox createdAt updatedAt in_trash',
};

async function queryType(type, host_id, projectId, cursor, limit, includeTrash = false) {
	const query = { host_id, ...(includeTrash ? {} : { in_trash: { $ne: true } }), ...cursorFilter(cursor) };
	if (projectId) query.project = projectId;
	return MODEL_BY_TYPE[type].find(query).select(LIST_FIELDS[type]).sort({ updatedAt: -1, _id: -1 }).limit(limit).lean();
}

export async function listProjects(host_id, { includeEmails = true } = {}) {
	const [projects, counts] = await Promise.all([
		Project.find({ host_id, is_active: true }).sort({ is_default: -1, name: 1 }).lean(),
		getProjectCounts(host_id),
	]);
	return projects.map((project) => {
		const projectCounts = counts[String(project._id)] || { notes: 0, memory: 0, urls: 0, emails: 0 };
		return {
			id: String(project._id),
			name: project.name,
			color: project.color,
			is_default: !!project.is_default,
			counts: { notes: projectCounts.notes, memories: projectCounts.memory, urls: projectCounts.urls, ...(includeEmails ? { emails: projectCounts.emails } : {}) },
		};
	});
}

export async function bootstrap(userId, host_id, options = {}) {
	const [user, projects] = await Promise.all([
		User.findById(userId).lean(),
		listProjects(host_id, options),
	]);
	return {
		user: toSafeUser(user),
		account: { host_id },
		projects,
		features: { emails: options.includeEmails !== false, realtime: true, offline_mutations: false, push_notifications: false },
		server_time: new Date().toISOString(),
		change_cursor: Buffer.from(JSON.stringify({ updated_at: new Date().toISOString(), id: '000000000000000000000000' }), 'utf8').toString('base64url'),
	};
}

export async function listRecords(host_id, options = {}) {
	validateProjectId(options.projectId);
	const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
	const cursor = decodeCursor(options.cursor);
	if (options.cursor && !cursor) throw Object.assign(new Error('Invalid cursor'), { status: 400 });
	const types = selectedTypes(options.type, options.includeEmails !== false);
	const rows = await Promise.all(types.map(async (type) => (await queryType(type, host_id, options.projectId, cursor, limit + 1)).map((doc) => normalizeRecord(type, doc))));
	const records = rows.flat().sort(compareRecords).slice(0, limit);
	return { records, next_cursor: records.length === limit ? encodeCursor(records.at(-1)) : null };
}

export async function getRecord(host_id, typeInput, id, { includeEmails = true } = {}) {
	const type = normalizeType(typeInput);
	if (!MODEL_BY_TYPE[type] || (type === 'emails' && !includeEmails) || !mongoose.Types.ObjectId.isValid(id)) return null;
	const doc = await MODEL_BY_TYPE[type].findOne({ _id: id, host_id, in_trash: { $ne: true } }).lean();
	if (!doc) return null;
	const summary = normalizeRecord(type, doc);
	return {
		...summary,
		content: type === 'notes' ? doc.content : type === 'memories' ? doc.content : type === 'urls' ? doc.text_content : doc.html_content || doc.text_content,
		text_content: type === 'notes' ? doc.text_content : type === 'urls' ? doc.text_content : type === 'emails' ? doc.text_content : compact(doc.content, 100_000, true),
		metadata: { ...summary.metadata, ...(type === 'urls' ? { description: doc.description || '', og_image: doc.og_image || '' } : {}), ...(type === 'emails' ? { cc: doc.cc || [], labels: doc.labels || [] } : {}) },
	};
}

export async function getChanges(host_id, options = {}) {
	validateProjectId(options.projectId);
	const cursor = decodeCursor(options.cursor);
	if (!cursor) throw Object.assign(new Error('A valid changes cursor is required'), { status: 400 });
	const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || MAX_LIMIT, 1), MAX_LIMIT);
	const types = selectedTypes(options.type, options.includeEmails !== false);
	const rows = await Promise.all(types.map(async (type) => {
		const query = { host_id, ...forwardCursorFilter(cursor) };
		if (options.projectId) query.project = options.projectId;
		return MODEL_BY_TYPE[type].find(query).select(LIST_FIELDS[type]).sort({ updatedAt: 1, _id: 1 }).limit(limit + 1).lean().then((docs) => docs.map((doc) => ({ type, doc })));
	}));
	const selected = rows.flat().sort((a, b) => {
		const dateComparison = new Date(a.doc.updatedAt) - new Date(b.doc.updatedAt);
		return dateComparison || String(a.doc._id).localeCompare(String(b.doc._id));
	}).slice(0, limit);
	const changes = selected.map(({ type, doc }) => {
		const record = normalizeRecord(type, doc);
		return doc.in_trash ? { action: 'delete', key: record.key } : { action: 'upsert', key: record.key, record };
	});
	const last = selected.at(-1);
	const nextCursor = last ? encodeCursor(normalizeRecord(last.type, last.doc)) : options.cursor;
	return { changes, next_cursor: nextCursor, has_more: selected.length === limit };
}

export async function searchRecords(host_id, query, options = {}) {
	validateProjectId(options.projectId);
	const types = selectedTypes(options.type, options.includeEmails !== false);
	const result = await quickSearchKnowledge(host_id, query, { projectId: options.projectId, includeEmails: options.includeEmails !== false, limit: options.limit || 50 });
	const results = result.results.filter((item) => types.includes(normalizeType(item.type))).map(normalizeSearchReference).filter(Boolean);
	return { results, found: results.length };
}
