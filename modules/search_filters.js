export class SearchFilters {
	static typeNames = { note: 'notes', notes: 'notes', memory: 'memory', memories: 'memory', url: 'urls', urls: 'urls', email: 'emails', emails: 'emails', pages: 'pages', vault_files: 'vault_files' };

	static parse(input = {}) {
		if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string'))) throw Object.assign(new Error('tags must be an array of strings'), { status: 400 });
		if (input.types != null && (!Array.isArray(input.types) || input.types.some((type) => typeof type !== 'string'))) throw Object.assign(new Error('types must be an array of strings'), { status: 400 });
		const tags = [...(input.tags || [])];
		const types = [...(input.types || [])];
		const query = String(input.query || '').replace(/(?:^|\s)tag:(?:"([^"\n]+)"|'([^'\n]+)'|([^\s"']+))/gi, (_, double, single, plain) => {
			tags.push(double || single || plain);
			return ' ';
		}).replace(/(?:^|\s)type:([^\s]*)/gi, (_, values) => {
			types.push(...values.split(','));
			return ' ';
		}).trim();
		if (/(?:^|\s)tag:/i.test(query)) throw Object.assign(new Error('Complete the tag filter; use quotes for tags containing spaces.'), { status: 400 });
		const normalizedTypes = [...new Set(types.map((value) => {
			const type = value.trim().toLowerCase();
			if (!Object.hasOwn(this.typeNames, type)) throw Object.assign(new Error('Invalid type filter; use type:note,memory,url,email.'), { status: 400 });
			return this.typeNames[type];
		}))].sort();
		const project_id = String(input.project_id || '').trim();
		if (project_id && !/^[a-f\d]{24}$/i.test(project_id)) throw Object.assign(new Error('Invalid project ID'), { status: 400 });
		const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort();
		if (normalized.length > 30 || normalized.some((tag) => tag.length > 200)) throw Object.assign(new Error('Too many tags or tag too long'), { status: 400 });
		return { query: query === '*' ? '' : query, project_id, tags: normalized, ...(normalizedTypes.length ? { types: normalizedTypes } : {}) };
	}

	static intent(query) {
		const text = String(query || '').trim();
		if (/^(?:show|find|list|search|get)\b/i.test(text) && /\b(?:move|delete|remove|add|create|save|remember)\b/i.test(text)) return null;
		const match = text.match(/^(?:(?:show|find|list|get)(?:\s+me)?\s+)?(?:all\s+)?(?:the\s+)?(?:records|items|notes|memories|urls)\s+(?:with|having)\s+(?:the\s+)?tags?\s+(.+?)[.!?]?$/i);
		if (match) {
			const values = [...match[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map((item) => item[1] || item[2]);
			if (!values.length && /^[\w.-]+$/.test(match[1])) values.push(match[1]);
			if (!values.length) return null;
			const type = text.match(/\b(notes|memories|urls)\b/i)?.[1]?.toLowerCase();
			return { intent: 'search', query: '', tags: values, types: type ? [type === 'memories' ? 'memory' : type] : null, action_type: null, params: {} };
		}
		if (/^(?:tag:|type:|"|')/i.test(text) || !/\b(move|delete|remove|add|create|save|remember)\b/i.test(text)) {
			const parsed = this.parse({ query: text });
			if (parsed.tags.length || parsed.types?.length) return { intent: 'search', query: parsed.query, tags: parsed.tags, types: parsed.types || null, action_type: null, params: {} };
		}
		return null;
	}

	static includesType(filters, type) {
		return (!filters.types || filters.types.includes(type)) && (!filters.tags.length || ['notes', 'memory', 'urls'].includes(type));
	}

	static mongo(hostId, filters) {
		return { host_id: hostId, in_trash: { $ne: true }, ...(filters.project_id ? { project: filters.project_id } : {}), ...(filters.tags.length ? { tags: { $all: filters.tags } } : {}) };
	}

	static exact(value) {
		return '`' + String(value).replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
	}

	static typesense(filters) {
		return [...(filters.project_id ? ['project_id:=' + this.exact(filters.project_id)] : []), ...filters.tags.map((tag) => 'tags:=' + this.exact(tag))].join(' && ');
	}
}
