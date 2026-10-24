import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { reconcileActiveTrashTenants, reconcileTrashForTenant } from '../services/trash_reconciliation_service.js';

function optionValue(name) {
	const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
	if (inline) return inline.slice(name.length + 1);
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : '';
}

const apply = process.argv.includes('--apply');
const hostId = optionValue('--host-id');
const batchSize = Number(optionValue('--batch-size') || 250);
if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 250) throw new Error('--batch-size must be an integer from 1 to 250');
if (apply && !process.argv.includes('--confirm-typesense-healthy')) throw new Error('--apply requires --confirm-typesense-healthy after verifying every Typesense follower and Raft applied gap');

let hasErrors = false;
await mongoose.connect(config.mongoUri, config.mongoOptions);
try {
	const summaries = hostId
		? [await reconcileTrashForTenant(hostId, { dryRun: !apply, batchSize })]
		: await reconcileActiveTrashTenants({ dryRun: !apply, batchSize });
	for (const summary of summaries) {
		console.log(JSON.stringify(summary));
		if (summary.totals?.errors || summary.errors?.length) hasErrors = true;
	}
} finally {
	await mongoose.disconnect();
}
if (hasErrors) process.exitCode = 1;
