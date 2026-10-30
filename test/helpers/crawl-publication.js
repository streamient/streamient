export function publicationStore() {
	const rows = new Map();
	const matches = (row, query) => row && (!query.expires_at?.$gt || row.expires_at > query.expires_at.$gt) && (!query.expires_at?.$lte || row.expires_at <= query.expires_at.$lte);
	const apply = (row, update) => {
		Object.assign(row, update.$set);
		if (update.$addToSet) row.displaced_ids = [...new Set([...row.displaced_ids, ...update.$addToSet.displaced_ids.$each])];
		return { ...row };
	};
	return {
		rows,
		create: async (row) => { rows.set(row._id, { cleanup: true, finished: false, displaced_ids: [], ...row }); },
		updateOne: async (query, update) => { const row = rows.get(query._id); if (matches(row, query)) apply(row, update); },
		findOneAndUpdate: (query, update) => ({ lean: async () => { const row = rows.get(query._id); return matches(row, query) ? apply(row, update) : null; } }),
		find: (query) => ({ lean: async () => [...rows.values()].filter((row) => matches(row, query)) }),
		deleteOne: async (query) => { rows.delete(query._id); },
	};
}
