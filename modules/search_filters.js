export class SearchFilters {
	static parse(input = {}) {
		if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string'))) throw Object.assign(new Error('tags must be an array of strings'), { status: 400 });
		const tags = [...(input.tags || [])];
		const query = String(input.query || '').replace(/(?:^|\s)tag:(?:"([^"\n]+)"|'([^'\n]+)'|([^\s"']+))/gi, (_, double, single, plain) => {
			tags.push(double || single || plain);
			return ' ';
		}).trim();
		if (/(?:^|\s)tag:/i.test(query)) throw Object.assign(new Error('Complete the tag filter; use quotes for tags containing spaces.'), { status: 400 });
		const project_id = String(input.project_id || '').trim();
		if (project_id && !/^[a-f\d]{24}$/i.test(project_id)) throw Object.assign(new Error('Invalid project ID'), { status: 400 });
		const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort();
		if (normalized.length > 30 || normalized.some((tag) => tag.length > 200)) throw Object.assign(new Error('Too many tags or tag too long'), { status: 400 });
		return { query: query === '*' ? '' : query, project_id, tags: normalized };
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
		if (/^(?:tag:|"|')/i.test(text) || !/\b(move|delete|remove|add|create|save|remember)\b/i.test(text)) {
			const parsed = this.parse({ query: text });
			if (parsed.tags.length) return { intent: 'search', query: parsed.query, tags: parsed.tags, types: null, action_type: null, params: {} };
		}
		return null;
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
