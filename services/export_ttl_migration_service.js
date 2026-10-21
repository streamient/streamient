import mongoose from '../model/mongoose.js';

export const EXPORT_ADMISSION_INDEX = 'one_active_export_per_account';
export const EXPORT_ADMISSION_OPTIONS = { name: EXPORT_ADMISSION_INDEX, unique: true, partialFilterExpression: { status: { $in: ['pending', 'processing'] } } };

export async function migrateExportIndexes({ apply = false, db = mongoose.connection.db } = {}) {
	const collection = db.collection('exports');
	const indexes = await collection.listIndexes().toArray().catch((err) => { if (err.code === 26) return []; throw err; });
	const ttl = indexes.filter((index) => index.key?.expires_at === 1 && index.expireAfterSeconds !== undefined);
	const duplicates = [];
	const hosts = new Set();
	for await (const row of collection.find({ status: { $in: ['pending', 'processing'] } }).sort({ createdAt: -1, _id: -1 })) {
		if (hosts.has(row.host_id)) duplicates.push(row._id);
		hosts.add(row.host_id);
	}
	if (apply) {
		// Upgrade every application replica before removing the database's file-blind expiry.
		for (const index of ttl) await collection.dropIndex(index.name).catch((err) => { if (err.code !== 26 && err.code !== 27) throw err; });
		if (duplicates.length) await collection.updateMany({ _id: { $in: duplicates }, status: { $in: ['pending', 'processing'] } }, { $set: { status: 'failed', error: 'Superseded duplicate export; please retry', updatedAt: new Date() } });
		await collection.createIndex({ host_id: 1 }, EXPORT_ADMISSION_OPTIONS);
	}
	return { apply, ttl_indexes: ttl.map((index) => index.name), duplicate_exports: duplicates.map(String) };
}
