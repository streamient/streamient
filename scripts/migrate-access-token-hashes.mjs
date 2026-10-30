import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import mongoose from '../model/mongoose.js';
import config from '../config.js';
import { User } from '../model/user.js';

// Match each original token so concurrent revocation or creation is never overwritten.
export async function migrateAccessTokenHashes({ collection = User.collection, apply = false } = {}) {
	let tokens = 0;
	let modified = 0;
	for await (const user of collection.find({ 'access_tokens.token': { $type: 'string' } }, { projection: { access_tokens: 1 } })) {
		for (const entry of user.access_tokens || []) {
			if (typeof entry.token !== 'string') continue;
			tokens++;
			if (!apply) continue;
			const result = await collection.updateOne({ _id: user._id, access_tokens: { $elemMatch: { _id: entry._id, token: entry.token } } }, { $set: { 'access_tokens.$.token_hash': crypto.createHash('sha256').update(entry.token).digest('hex') }, $unset: { 'access_tokens.$.token': '' } });
			modified += result.modifiedCount;
		}
	}
	return { apply, tokens, modified };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await mongoose.connect(config.mongoUri, config.mongoOptions);
	try { console.log(JSON.stringify(await migrateAccessTokenHashes({ apply: process.argv.includes('--apply') }))); }
	finally { await mongoose.disconnect(); }
}
