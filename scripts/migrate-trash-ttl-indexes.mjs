import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { migrateTrashTtlIndexes } from '../services/trash_ttl_migration_service.js';

const apply = process.argv.includes('--apply');
if (apply && !process.argv.includes('--confirm-all-replicas-upgraded')) throw new Error('--apply requires --confirm-all-replicas-upgraded');

await mongoose.connect(config.mongoUri, config.mongoOptions);
try {
	const result = await migrateTrashTtlIndexes({ apply });
	console.log(JSON.stringify(result));
} finally {
	await mongoose.disconnect();
}
