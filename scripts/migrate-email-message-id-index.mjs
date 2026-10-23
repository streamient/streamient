import { pathToFileURL } from 'node:url';
import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { Email } from '../model/email.js';

export async function migrateEmailMessageIdIndex({ apply = false, collection = Email.collection } = {}) {
	const [key, options] = Email.schema.indexes().find(([, entry]) => entry.name === 'host_message_id_unique');
	const indexes = await collection.listIndexes().toArray();
	const legacy = indexes.filter((index) => index.unique && Object.keys(index.key).length === 1 && index.key.message_id === 1);
	const result = { apply, create: options.name, drop: legacy.map((index) => index.name) };
	if (!apply) return result;
	// Build first: duplicate data or an incompatible index aborts without dropping any protection or data.
	await collection.createIndex(key, options);
	for (const index of legacy) await collection.dropIndex(index.name);
	return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const apply = process.argv.includes('--apply');
	if (apply && !process.argv.includes('--confirm-all-replicas-upgraded')) throw new Error('--apply requires --confirm-all-replicas-upgraded');
	await mongoose.connect(config.mongoUri, { ...config.mongoOptions, autoIndex: false });
	try {
		console.log(JSON.stringify(await migrateEmailMessageIdIndex({ apply })));
	} finally {
		await mongoose.disconnect();
	}
}
