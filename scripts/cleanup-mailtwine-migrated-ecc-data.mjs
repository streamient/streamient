// Remove Streamient ECC-only data after Mailtwine import has been verified.
//
// Dry run:
//   docker compose exec app node scripts/cleanup-mailtwine-migrated-ecc-data.mjs --dry-run --host-id=<host_id>
//
// Destructive run:
//   docker compose exec app env MAILTWINE_MIGRATION_CONFIRMED=copy-complete node scripts/cleanup-mailtwine-migrated-ecc-data.mjs --confirm --host-id=<host_id>
import mongoose from '../model/mongoose.js';
import config from '../config.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const confirmed = args.includes('--confirm') && process.env.MAILTWINE_MIGRATION_CONFIRMED === 'copy-complete';
const hostId = valueArg('--host-id') || process.env.STREAMIENT_HOST_ID || '';

const eccCollections = [
	'emaildrafts',
	'emailinternalnotes',
	'emaillabels',
	'emailidentities',
	'emailexternalsyncstates',
	'outgoingemails',
	'emailtriageruns',
];

const triageEmailFields = [
	'triaged',
	'triaged_at',
	'triage_summary',
	'triage_reason',
	'triage_primary_action',
	'triage_confidence',
	'triage_action_points',
	'triage_related_context',
	'triage_mailbox_action',
	'triage_status',
	'triage_error',
	'triage_run_id',
	'triage_draft_id',
];

const eccSystemLabels = ['reply-required', 'human-do', 'waiting', 'marketing', 'no-action', 'triaged'];

if (!dryRun && !confirmed) {
	console.error('Refusing cleanup. Use --confirm and MAILTWINE_MIGRATION_CONFIRMED=copy-complete after verifying Mailtwine import.');
	process.exit(1);
}

function valueArg(name) {
	const exact = args.find((arg) => arg.startsWith(`${name}=`));
	if (exact) return exact.slice(name.length + 1).trim();
	const index = args.indexOf(name);
	return index >= 0 ? String(args[index + 1] || '').trim() : '';
}

function hostFilter() {
	return hostId ? { host_id: hostId } : {};
}

function unsetFields(fields) {
	return Object.fromEntries(fields.map((field) => [field, '']));
}

function triageFieldFilter() {
	return {
		...hostFilter(),
		$or: triageEmailFields.map((field) => ({ [field]: { $exists: true } })),
	};
}

async function cleanupCollection(db, name) {
	const collection = db.collection(name);
	const filter = hostFilter();
	const found = await collection.countDocuments(filter);
	if (dryRun) return { collection: name, found, deleted: 0 };
	const result = await collection.deleteMany(filter);
	return { collection: name, found, deleted: result.deletedCount || 0 };
}

async function cleanupEmails(db) {
	const collection = db.collection('emails');
	const found = await collection.countDocuments(triageFieldFilter());
	if (dryRun) return { found, modified: 0 };

	const result = await collection.updateMany(
		hostFilter(),
		{
			$unset: unsetFields(triageEmailFields),
			$pull: { labels: { $in: eccSystemLabels } },
		},
	);
	return { found, modified: result.modifiedCount || 0 };
}

async function cleanupTenantSettings(db) {
	const collection = db.collection('tenants');
	const unset = unsetFields([
		'settings.email.auto_triage_incoming',
		'settings.email.send_draft_emails_automatically',
		'settings.email.spam_guard',
		'settings.ai_instructions.email',
		'settings.ai_instructions.email_triage',
		'settings.byo_ai.email',
	]);
	const found = await collection.countDocuments(hostFilter());
	if (dryRun) return { found, modified: 0 };
	const result = await collection.updateMany(hostFilter(), { $unset: unset });
	return { found, modified: result.modifiedCount || 0 };
}

await mongoose.connect(config.mongoUri);

try {
	const db = mongoose.connection.db;
	const collections = [];

	for (const name of eccCollections) {
		collections.push(await cleanupCollection(db, name));
	}

	const emails = await cleanupEmails(db);
	const tenant_settings = await cleanupTenantSettings(db);

	console.log(JSON.stringify({ dry_run: dryRun, host_id: hostId || null, collections, emails, tenant_settings }, null, 2));
} finally {
	await mongoose.disconnect();
}
