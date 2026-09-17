import { createHmac, timingSafeEqual } from 'node:crypto';
import config from '../config.js';
import { SearchFilters } from './search_filters.js';
import { searchCollection } from './typesense.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { Project } from '../model/project.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import * as notes from '../services/note_service.js';
import * as memories from '../services/memory_service.js';
import * as urls from '../services/url_service.js';
import * as emails from '../services/email_ingest_service.js';

export class SearchResults {
	constructor(hostId, { includeEmails = true, models, search = searchCollection, secret = config.sessionSecret } = {}) {
		this.hostId = hostId;
		this.includeEmails = includeEmails;
		this.models = models || { notes: Note, memory: Memory, urls: Url, emails: Email, vault_files: ObsidianFile };
		this.search = search;
		this.secret = secret;
	}

	static fields = { notes: 'title,text_content,tags', memory: 'title,content,source,tags', urls: 'title,url,description,text_content,tags', emails: 'subject,text_content,attachment_text_content', pages: 'title,url,text_content', vault_files: 'title,path,text_content' };
	static operations = { notes: { update: notes.updateNote, trash: notes.deleteNote }, memory: { update: memories.updateMemory, trash: memories.deleteMemory }, urls: { update: urls.updateUrl, trash: urls.deleteUrl }, emails: { update: emails.updateEmail, trash: emails.deleteEmail } };

	ticket(item, filters) {
		return createHmac('sha256', this.secret).update(JSON.stringify([String(this.hostId), item.type, item.id, item.version, SearchFilters.parse(filters)])).digest('hex');
	}

	row(type, doc, filters) {
		const value = doc.toObject ? doc.toObject() : doc;
		const id = String(value.source_id || value._id || value.id);
		const version = value.updatedAt ? new Date(value.updatedAt).toISOString() : String(value.updated_at || value.crawled_at || '');
		const item = { id, type, _type: type, title: value.title || value.subject || value.url || value.path || 'Untitled', project_id: String(value.project || value.project_id || ''), tags: value.tags || [], updated_at: value.updatedAt ? Math.floor(new Date(value.updatedAt).getTime() / 1000) : value.updated_at || value.crawled_at, version, excerpt: String(value.text_content || value.content || value.description || '').replace(/<[^>]*>/g, '').slice(0, 260), url: value.url || '', parent_url_id: value.parent_url_id || '', actions: type === 'emails' ? ['move', 'trash'] : ['notes', 'memory', 'urls'].includes(type) ? ['move', 'add_tags', 'remove_tags', 'trash'] : [] };
		item.ticket = this.ticket(item, filters);
		return item;
	}

	async collection(type, filters, page, perPage) {
		const Model = this.models[type];
		const mongo = SearchFilters.mongo(this.hostId, filters);
		if (!filters.query && Model) {
			const [found, docs] = await Promise.all([Model.countDocuments(mongo), Model.find(mongo).select('-embedding -content -text_content -attachment_text_content -html_content').sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * perPage).limit(perPage).lean()]);
			return { found, page, hits: docs.map((doc) => ({ document: this.row(type, doc, filters) })) };
		}
		const indexed = await this.search(this.hostId, type, filters.query || '*', { queryBy: SearchResults.fields[type], filter_by: SearchFilters.typesense(filters), page, perPage, paginate: true, strict: true });
		let hits = indexed.hits || [];
		if (Model && hits.length) {
			const ids = hits.map((hit) => hit.document.source_id || hit.document.id).filter((id) => /^[a-f\d]{24}$/i.test(id));
			const docs = await Model.find({ ...mongo, _id: { $in: ids } }).select('-embedding -html_content').lean();
			const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
			hits = hits.flatMap((hit) => {
				const doc = byId.get(String(hit.document.source_id || hit.document.id));
				return doc ? [{ document: this.row(type, doc, filters) }] : [];
			});
		} else hits = hits.map((hit) => ({ document: this.row(type, hit.document, filters) }));
		return { found: indexed.found || 0, page, hits };
	}

	async list(input = {}, allowedTypes = Object.keys(SearchResults.fields)) {
		const filters = SearchFilters.parse(input);
		const page = Math.max(1, Math.floor(Number(input.page) || 1));
		const perPage = Math.min(100, Math.max(1, Math.floor(Number(input.per_page) || 10)));
		const types = allowedTypes.filter((type) => (this.includeEmails || type !== 'emails') && SearchFilters.includesType(filters, type));
		const collections = await Promise.all(types.map(async (type) => [type, await this.collection(type, filters, page, perPage)]));
		const results = Object.fromEntries(collections);
		const items = collections.flatMap(([, data]) => data.hits.map((hit) => hit.document));
		const total = collections.reduce((sum, [, data]) => sum + data.found, 0);
		const pages = Math.max(1, ...collections.map(([, data]) => Math.ceil(data.found / perPage)));
		return { filters, results, items, total, page, pages, per_page: perPage };
	}

	async selection(input) {
		const items = new Map();
		let page = 1;
		let pages = 1;
		do {
			const result = await this.list({ ...input, page, per_page: 100 });
			pages = result.pages;
			for (const item of result.items) items.set(item.type + ':' + item.id, { id: item.id, type: item.type, version: item.version, ticket: item.ticket, actions: item.actions });
			page++;
		} while (page <= pages);
		return [...items.values()];
	}

	async refresh(input) {
		const filters = SearchFilters.parse(input.filters);
		const { type, id } = input;
		const Model = this.models[type];
		if (!Model || (type === 'emails' && !this.includeEmails) || !/^[a-f\d]{24}$/i.test(id || '')) throw Object.assign(new Error('Invalid record'), { status: 400 });
		if (!SearchFilters.includesType(filters, type)) return { id, type, success: true, removed: true, item: null };
		let doc = await Model.findOne({ ...SearchFilters.mongo(this.hostId, filters), _id: id }).lean();
		if (doc && filters.query && doc.is_indexed !== false) {
			const matches = await this.search(this.hostId, type, filters.query, { queryBy: SearchResults.fields[type], filter_by: [SearchFilters.typesense(filters), 'source_id:=' + SearchFilters.exact(id)].filter(Boolean).join(' && '), perPage: 1, paginate: true, strict: true });
			if (!matches.hits?.length) doc = null;
		} else if (doc && filters.query) {
			// The existing update operations invalidate the index before reindexing.
			// Keep matching records visible during that window using their current text.
			const text = SearchResults.fields[type].split(',').map((field) => String(doc[field] || '')).join(' ').toLowerCase();
			if (!filters.query.toLowerCase().split(/\s+/).every((word) => text.includes(word))) doc = null;
		}
		return { id, type, success: true, removed: !doc, item: doc ? this.row(type, doc, filters) : null };
	}

	async apply(input, ctx = {}) {
		const filters = SearchFilters.parse(input.filters);
		if (!['move', 'add_tags', 'remove_tags', 'trash'].includes(input.action)) throw Object.assign(new Error('Invalid action'), { status: 400 });
		if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw Object.assign(new Error('Provide 1–50 selected records per request'), { status: 400 });
		if (input.items.some((item) => !item || ['id', 'type', 'version', 'ticket'].some((key) => typeof item[key] !== 'string'))) throw Object.assign(new Error('Every selection requires id, type, version and ticket'), { status: 400 });
		const tags = SearchFilters.parse({ tags: input.tags }).tags;
		if (['add_tags', 'remove_tags'].includes(input.action) && !tags.length) throw Object.assign(new Error('Select at least one tag'), { status: 400 });
		if (input.action === 'move' && (!/^[a-f\d]{24}$/i.test(input.project_id || '') || !(await Project.findOne({ _id: input.project_id, host_id: this.hostId }).select('_id').lean()))) throw Object.assign(new Error('Destination project is unavailable'), { status: 400 });
		const outcomes = [];
		const seen = new Set();
		for (const item of input.items) {
			const key = item.type + ':' + item.id;
			if (seen.has(key)) continue;
			seen.add(key);
			try {
				const signature = this.ticket(item, filters);
				if (typeof item.ticket !== 'string' || item.ticket.length !== signature.length || !timingSafeEqual(Buffer.from(item.ticket), Buffer.from(signature))) throw new Error('Selection is invalid; search again.');
				const operation = SearchResults.operations[item.type];
				if (!operation || (item.type === 'emails' && (!this.includeEmails || input.action.endsWith('tags')))) throw new Error('This action is unavailable for this record type.');
				if (!SearchFilters.includesType(filters, item.type)) throw new Error('Record type is outside the selected filters.');
				const doc = await this.models[item.type].findOne({ ...SearchFilters.mongo(this.hostId, filters), _id: item.id }).lean();
				if (!doc || this.row(item.type, doc, filters).version !== item.version) throw new Error('Record changed since selection; review it before retrying.');
				const update = input.action === 'move' ? { project: input.project_id } : { tags: input.action === 'add_tags' ? [...new Set([...(doc.tags || []), ...tags])] : (doc.tags || []).filter((tag) => !tags.includes(tag)) };
				const context = { ...ctx, expected_updated_at: item.version };
				const result = input.action === 'trash' ? await operation.trash(this.hostId, item.id, context) : await operation.update(this.hostId, item.id, update, context);
				if (!result) throw new Error('Record is no longer available.');
				const row = this.row(item.type, result, filters);
				const removed = input.action === 'trash' || (filters.project_id && row.project_id !== filters.project_id) || filters.tags.some((tag) => !row.tags.includes(tag));
				outcomes.push({ id: item.id, type: item.type, success: true, removed: !!removed, item: row });
			} catch (error) {
				outcomes.push({ id: item.id, type: item.type, success: false, error: error.message });
			}
		}
		return outcomes;
	}
}
