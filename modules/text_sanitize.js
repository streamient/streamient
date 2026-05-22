// Strip characters that are valid UTF-8 / accepted by JSON.stringify but break
// strict SSE/JSON parsers (notably MCP clients): C0 controls except tab/LF/CR,
// DEL, the C1 control block (e.g. U+0085 NEL / U+009C that show up in mojibake'd
// imports), and the Unicode line/paragraph separators U+2028 / U+2029.
const UNSAFE_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g;

export function sanitizeText(value) {
	return typeof value === 'string' ? value.replace(UNSAFE_CONTROL_CHARS, '') : value;
}

function isPlainObject(value) {
	if (value === null || typeof value !== 'object') return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

// Recursively sanitize strings in plain objects/arrays. Non-plain objects
// (ObjectId, Date, Buffer, RegExp, etc.) are passed through untouched so we
// never corrupt Mongo update payloads or special types.
export function sanitizeDeep(value) {
	if (typeof value === 'string') return sanitizeText(value);
	if (Array.isArray(value)) return value.map(sanitizeDeep);
	if (isPlainObject(value)) {
		const out = {};
		for (const [key, val] of Object.entries(value)) out[key] = sanitizeDeep(val);
		return out;
	}
	return value;
}

// Mongoose plugin: sanitize string fields on every write path.
// Covers document saves (.create / new+save) and query updates
// (findOneAndUpdate / updateOne / updateMany).
export function textSanitizerPlugin(schema) {
	const stringPaths = [];
	const stringArrayPaths = [];
	schema.eachPath((path, type) => {
		if (type.instance === 'String') stringPaths.push(path);
		else if (type.instance === 'Array' && type.caster?.instance === 'String') stringArrayPaths.push(path);
	});

	schema.pre('save', function sanitizeOnSave() {
		for (const path of stringPaths) {
			const value = this.get(path);
			if (typeof value === 'string') {
				const cleaned = sanitizeText(value);
				if (cleaned !== value) this.set(path, cleaned);
			}
		}
		for (const path of stringArrayPaths) {
			const arr = this.get(path);
			if (Array.isArray(arr)) this.set(path, arr.map(sanitizeText));
		}
	});

	function sanitizeOnUpdate() {
		const update = this.getUpdate();
		if (update && typeof update === 'object') this.setUpdate(sanitizeDeep(update));
	}
	schema.pre('findOneAndUpdate', sanitizeOnUpdate);
	schema.pre('updateOne', sanitizeOnUpdate);
	schema.pre('updateMany', sanitizeOnUpdate);
}
