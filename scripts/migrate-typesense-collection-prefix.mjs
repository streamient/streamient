// One-off migration: move this product's Typesense collections to the prefixed
// naming scheme (st_*) so streamient, mailtwine, and managani can share one
// cluster. For every tenant host: reindexHost() drops/creates the prefixed
// collections and queues all docs for the scheduler indexer, then the legacy
// unprefixed collections are deleted (404-tolerant — another product may have
// already removed a contested name).
//
// Run inside the app container AFTER deploying the prefixed code (the scheduler
// must run on new code so it repopulates the prefixed collections):
//   docker compose exec app node scripts/migrate-typesense-collection-prefix.mjs
//
// Notes:
// - pages_* collections are crawler-populated; they are recreated empty and
//   repopulate on the next crawl.
// - conversation_store is global/unprefixed and intentionally untouched.
import mongoose from 'mongoose';
import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { getTypesenseClient, reindexHost, buildCollectionName } from '../modules/typesense.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';

const LEGACY_TYPES = ['notes', 'memory', 'urls', 'emails', 'pages'];
const MODELS = { Note, Memory, Url, Email };

const prefix = config.typesense.collectionPrefix;
if (!prefix) {
	console.error('TYPESENSE_COLLECTION_PREFIX is empty — nothing to migrate.');
	process.exit(1);
}

await mongoose.connect(config.mongoUri);
const hosts = await Tenant.find({}).select('host_id').lean();
const ts = getTypesenseClient();

let reindexed = 0;
let deleted = 0;
for (const { host_id } of hosts) {
	if (!host_id) continue;
	try {
		const results = await reindexHost(host_id, MODELS);
		reindexed++;
		console.log(`reindexed ${host_id}:`, JSON.stringify(results));
	} catch (err) {
		console.error(`reindexHost failed for ${host_id}:`, err.message);
		continue; // keep legacy collections when reindex failed for this host
	}
	for (const type of LEGACY_TYPES) {
		const legacy = `${type}_${host_id}`;
		if (legacy === buildCollectionName(type, host_id)) continue;
		try {
			await ts.collections(legacy).delete();
			deleted++;
			console.log(`deleted legacy collection ${legacy}`);
		} catch (err) {
			if (err.httpStatus !== 404) console.error(`failed to delete ${legacy}:`, err.message);
		}
	}
}

console.log(`Done: ${reindexed}/${hosts.length} hosts reindexed, ${deleted} legacy collections deleted.`);
console.log('The scheduler indexer repopulates the prefixed collections over the next minutes.');
await mongoose.disconnect();
process.exit(0);
