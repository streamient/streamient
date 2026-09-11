import config from '../config.js';
import { deleteImportFilesForHost } from './note_import_service.js';
import { getWhiteLabelAssetsDir } from './white_label_service.js';
import { deleteHostname, isCloudflareConfigured } from '../modules/cloudflare_api.js';
import { assertConversationCleanupOwnership } from '../modules/typesense.js';
import { MongoQueue, MongoWorker, COLLECTION_NAME, JOB_HOST_REFERENCES, getQueueAppInstance } from '../modules/mongo_queue.js';
import { checkAccountDeletionBilling, cancelAccountTrackingSubscriptions } from './billing_service.js';
import { applyTenantContextToSession, resolveActiveTenantContext } from '../modules/tenancy.js';
import { disconnectTenantSockets, deleteTenantSocketPackets } from '../modules/socket.js';
import mongoose from '../model/mongoose.js';
import crypto from 'node:crypto';
import path from 'node:path';
import { PendingSignup } from '../model/pending_signup.js';
import { NoteImportUpload } from '../model/note_import_upload.js';
import { EmailLabel } from '../model/email_label.js';
import { GitSyncLog } from '../model/git_sync_log.js';
import fs from 'node:fs';
import { User } from '../model/user.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { CrawlState } from '../model/crawl_state.js';
import { Email } from '../model/email.js';
import { Project } from '../model/project.js';
import { GraphLink } from '../model/graph_link.js';
import { GitRepo } from '../model/git_repo.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { ObsidianUpload } from '../model/obsidian_upload.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { ObsidianManifestBatch } from '../model/obsidian_manifest_batch.js';
import { OAuthAuthorizationCode } from '../model/oauth_authorization_code.js';
import { OAuthClient } from '../model/oauth_client.js';
import { OAuthConsent } from '../model/oauth_consent.js';
import { OAuthRefreshToken } from '../model/oauth_refresh_token.js';
import { TeamInvite } from '../model/team_invite.js';
import { TenantMember } from '../model/tenant_member.js';
import { UserPasskey } from '../model/user_passkey.js';
import { MagicLink } from '../model/magic_link.js';
import { Export } from '../model/export.js';
import { AuditLog } from '../model/audit_log.js';
import { Tenant } from '../modules/tenancy.js';
import { getTypesenseClient, deleteConversationDataForHost, buildCollectionName } from '../modules/typesense.js';
import { deleteGitRepoHostDirectory } from './git_sync_service.js';
import { deleteObsidianHostDirectory } from './obsidian_sync_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('account-cleanup');

export const HOST_SCOPED_MODELS = { Note, Memory, Url, CrawlState, Email, Project, GraphLink, GitRepo, GitSyncLog, EmailLabel, NoteImportUpload, ObsidianConnection, ObsidianFile, ObsidianChange, ObsidianRevision, ObsidianUpload, ObsidianBlob, ObsidianManifestBatch, OAuthAuthorizationCode, OAuthClient, OAuthConsent, OAuthRefreshToken, TeamInvite, TenantMember, Export, AuditLog };

const TENANT_COLLECTION_TYPES = ['notes', 'memory', 'urls', 'emails', 'pages', 'vault_files'];

async function deleteTypesenseCollection(collectionName) {
	const ts = getTypesenseClient();
	try {
		await ts.collections(collectionName).delete();
		return true;
	} catch (err) {
		if (err.httpStatus !== 404) {
			log.error({ err, collection: collectionName }, 'Failed to delete Typesense collection');
		}
		if (err.httpStatus !== 404) throw err;
		return true;
	}
}

export function getTenantTypesenseCollectionNames(hostId) {
	return TENANT_COLLECTION_TYPES.map((type) => buildCollectionName(type, hostId));
}

export async function deleteAccountDataForUser(userOrId, deps = {}) {
	const models = { User, Tenant, TenantMember, UserPasskey, MagicLink, ...(deps.models || {}) };
	const user = typeof userOrId === 'object' ? userOrId : await models.User.findById(userOrId);
	if (!user) return { deleted: false, reason: 'user_not_found' };

	// A user can lack host_id/tenant when signup failed between User.create and
	// user.save (host_id is only assigned after tenant creation). Fall back to
	// the tenant they own so those accounts are still fully deletable.
	const tenant = user.tenant
		? await models.Tenant.findById(user.tenant)
		: await models.Tenant.findOne({ owner: user._id });
	const hostId = user.host_id || tenant?.host_id || null;
	if (hostId) return (deps.deleteTenantData || deleteTenantData)(hostId, tenant?._id || user.tenant || null, deps);

	// No host was ever provisioned, so there is no host-scoped data. Never pass
	// an undefined host_id into the host-scoped deletes: Mongoose drops
	// undefined filter values and the query would match every tenant's rows.
	await Promise.all([
		models.UserPasskey.deleteMany({ user: user._id }),
		models.MagicLink.deleteMany({ user: user._id }),
		models.TenantMember.deleteMany({ user: user._id }),
	]);
	if (tenant?._id) {
		await models.Tenant.findByIdAndDelete(tenant._id);
	}
	await models.User.deleteMany({ _id: user._id });

	return {
		deleted: true,
		host_id: null,
		tenant_id: tenant?._id?.toString() || null,
		users: 1,
		export_files: 0,
		typesense_collections_deleted: 0,
	};
}

export const ACCOUNT_DELETION_QUEUE = 'account_deletion';
const BATCH_SIZE = 500;
let deletionWorker;

export function publicDeletionState(tenant) {
	const value = tenant?.deletion;
	return value?.requested_at ? { requested_at: value.requested_at, stage: value.stage, error: value.error || '', job_id: value.job_id } : null;
}

export async function previewAccountDeletion(hostId, actor, options = {}) {
	const tenant = await (options.tenantModel || Tenant).findOne({ host_id: hostId }).read('primary').lean();
	if (!tenant) throw Object.assign(new Error('Account not found'), { status: 404 });
	if (!actor?.admin && (actor?.impersonating || String(tenant.owner) !== String(actor?.userId))) throw Object.assign(new Error('Only the account owner can delete this account'), { status: 403 });
	if (!tenant.deletion?.requested_at) {
		await (options.checkBilling || checkAccountDeletionBilling)(tenant);
		await (options.checkResources || preflightAccountResources)(tenant);
	}
	return { host_id: hostId, name: tenant.name, eligible: true, deletion: publicDeletionState(tenant) };
}

export async function requestAccountDeletion(hostId, actor, confirmation, options = {}) {
	if (confirmation !== 'DELETE') throw Object.assign(new Error('Type DELETE to confirm account deletion'), { status: 400 });
	const preview = await previewAccountDeletion(hostId, actor, options);
	if (!preview.deletion) await Tenant.updateOne({ host_id: hostId, 'deletion.requested_at': null }, { $set: { is_active: false, deletion: { requested_at: new Date(), stage: 'requested', job_id: `account-deletion:${hostId}`, error: '' } } });
	const tenant = await Tenant.findOne({ host_id: hostId }).read('primary').lean();
	if (!tenant && preview.deletion) return { host_id: hostId, deletion: { ...preview.deletion, stage: 'complete' }, message: 'Account deletion completed.' };
	await revokeAccountAccess(tenant).catch((error) => log.error({ err: error, host_id: hostId }, 'Account locked; task will finish revocation'));
	await (options.enqueueDeletion || enqueueAccountDeletion)(tenant).catch((error) => log.error({ err: error, host_id: hostId }, 'Deletion outbox awaits recovery'));
	return { host_id: hostId, deletion: publicDeletionState(tenant), message: 'Account deletion requested. Cleanup continues in the background.' };
}

async function enqueueAccountDeletion(tenant) {
	return MongoQueue.add(ACCOUNT_DELETION_QUEUE, { host_id: tenant.host_id }, { jobId: tenant.deletion.job_id, dedupKey: tenant.host_id, requeueCompleted: true, requeueFailed: true, maxAttempts: 3 });
}

export async function pruneDeletedAccountSession(session, tenant, deletedUserIds = []) {
	const disabled = new Set(deletedUserIds.map(String));
	if (disabled.has(String(session.userId))) {
		delete session.userId;
		delete session.lastLoginRecordedAt;
		applyTenantContextToSession(session, null);
		return null;
	}
	if (!session.userId) return null;
	const context = await resolveActiveTenantContext(session.userId);
	applyTenantContextToSession(session, context.activeTenant);
	for (const key of ['pending2FA', 'pendingReset', 'passkeyChallenge']) delete session[key];
	return context.activeTenant;
}

async function revokeAccountAccess(tenant) {
	const hostId = tenant.host_id;
	await Promise.all([OAuthRefreshToken.updateMany({ host_id: hostId }, { $set: { revoked_at: new Date() } }), OAuthConsent.updateMany({ host_id: hostId }, { $set: { revoked_at: new Date() } }), OAuthAuthorizationCode.deleteMany({ host_id: hostId })]);
	await stopAccountProducers(tenant);
	const members = await TenantMember.find({ host_id: hostId }).select('user').read('primary').lean();
	const users = await User.find({ $or: [{ host_id: hostId }, { tenant: tenant._id }, { _id: { $in: members.map((member) => member.user) } }] }).select('_id host_id tenant').read('primary').lean();
	const disabled = [];
	for (const user of users) {
		const other = await TenantMember.find({ user: user._id, host_id: { $ne: hostId } }).select('tenant').read('primary').lean();
		const needed = await Tenant.exists({ host_id: { $ne: hostId }, 'deletion.requested_at': null, $or: [{ _id: { $in: other.map((row) => row.tenant) } }, { owner: user._id }] }).read('primary');
		const primaryDeleted = user.host_id === hostId || String(user.tenant) === String(tenant._id);
		if (!needed || primaryDeleted) await User.updateOne({ _id: user._id }, { $set: { ...(primaryDeleted ? { access_tokens: [] } : {}), ...(!needed ? { is_active: false } : {}) } });
		if (!needed) {
			disabled.push(user._id);
			await Promise.all([MagicLink.deleteMany({ user: user._id }), UserPasskey.deleteMany({ user: user._id })]);
		}
	}
	const sessions = mongoose.connection.db.collection('sessions');
	for await (const row of sessions.find({}, { projection: { session: 1 }, readPreference: 'primary' }).batchSize(BATCH_SIZE)) {
		let session;
		try { session = typeof row.session === 'string' ? JSON.parse(row.session) : row.session; } catch { continue; }
		if (!session || (String(session.host_id || '') !== hostId && !disabled.some((id) => String(id) === String(session.userId)))) continue;
		const destination = await pruneDeletedAccountSession(session, tenant, disabled);
		if (!destination) await sessions.deleteOne({ _id: row._id, session: row.session });
		else await sessions.updateOne({ _id: row._id, session: row.session }, { $set: { session: typeof row.session === 'string' ? JSON.stringify(session) : session } });
	}
	await disconnectTenantSockets(hostId);
}

async function tagAndDrainAccountJobs(hostId) {
	const db = mongoose.connection.db;
	const jobs = db.collection(COLLECTION_NAME);
	const appInstance = getQueueAppInstance();
	for (const [field, name] of Object.entries(JOB_HOST_REFERENCES)) {
		const cursor = jobs.aggregate([
			{ $match: { app_instance: appInstance, queue: { $ne: ACCOUNT_DELETION_QUEUE }, [`data.${field}`]: { $exists: true }, 'data.host_id': { $exists: false } } },
			{ $set: { account_ref: { $convert: { input: `$data.${field}`, to: 'objectId', onError: null, onNull: null } } } },
			{ $lookup: { from: name, localField: 'account_ref', foreignField: '_id', as: 'account_parent' } },
			{ $match: { 'account_parent.host_id': hostId } },
			{ $project: { _id: 1 } },
		]);
		for await (const job of cursor) await jobs.updateOne({ _id: job._id }, { $set: { 'data.host_id': hostId } });
	}
	const filter = { app_instance: appInstance, queue: { $ne: ACCOUNT_DELETION_QUEUE }, $or: [{ 'data.host_id': hostId }, { 'data.hostId': hostId }] };
	await jobs.deleteMany({ ...filter, status: { $ne: 'processing' } });
	return jobs.countDocuments({ ...filter, status: 'processing' });
}

export async function deleteTenantData(hostId, tenantId = null, options = {}) {
	if (!hostId) return { deleted: false, reason: 'host_id_required' };
	const tenant = await (options.models?.Tenant || Tenant).findOne({ host_id: hostId, ...(tenantId ? { _id: tenantId } : {}) }).read('primary').lean();
	if (!tenant) return { deleted: false, reason: 'tenant_not_found' };
	if (!tenant.deletion?.requested_at) throw new Error('Account deletion must be requested before cleanup');
	return (options.processAccountDeletion || processAccountDeletion)({ host_id: hostId }, options);
}

export async function processAccountDeletion(data, options = {}) {
	const hostId = data.host_id;
	const leaseOwner = crypto.randomUUID();
	const now = new Date();
	const tenant = await Tenant.findOneAndUpdate({ host_id: hostId, 'deletion.requested_at': { $ne: null }, $or: [{ 'deletion.lease_until': { $lte: now } }, { 'deletion.lease_until': null }] }, { $set: { 'deletion.lease_owner': leaseOwner, 'deletion.lease_until': new Date(now.getTime() + 10 * 60 * 1000) } }, { returnDocument: 'after' }).read('primary').lean();
	if (!tenant) return { deleted: false };
	const lock = { _id: tenant._id, 'deletion.lease_owner': leaseOwner };
	const step = async (stage, extra = {}) => {
		options.signal?.throwIfAborted();
		const updated = await Tenant.updateOne(lock, { $set: { 'deletion.stage': stage, 'deletion.error': '', ...extra } });
		if (!updated.matchedCount) throw new Error('Deletion lease lost');
	};
	try {
		await revokeAccountAccess(tenant);
		await step('draining');
		const jobs = await tagAndDrainAccountJobs(hostId);
		if (jobs || Object.values(tenant.active_work || {}).some((until) => new Date(until).getTime() > Date.now())) return { pending: true };
		if (!tenant.deletion.billing_done) {
			await step('billing');
			const billing = await (options.cancelBilling || cancelAccountTrackingSubscriptions)(tenant);
			await step('resources', { 'deletion.billing_done': true, 'deletion.billing_customer_id': billing?.customer_id || '' });
		}
		let userIds = tenant.deletion.user_ids;
		if (!userIds) {
			const users = await User.find({ $or: [{ host_id: hostId }, { tenant: tenant._id }] }).select('_id').read('primary').lean();
			const members = await TenantMember.find({ host_id: hostId }).select('user').read('primary').lean();
			userIds = [...new Set([String(tenant.owner), ...users.map((user) => String(user._id)), ...members.map((member) => String(member.user))])];
			await step('resources', { 'deletion.user_ids': userIds });
		}
		await step('resources');
		if ((await (options.cleanupResources || cleanupAccountResources)(tenant, { ...options, userIds }))?.pending) return { pending: true };
		await step('database');
		let remaining = 0;
		for (const model of Object.values(HOST_SCOPED_MODELS)) {
			options.signal?.throwIfAborted();
			const rows = await model.find({ host_id: hostId }).select('_id').limit(BATCH_SIZE).read('primary').lean();
			if (rows.length) await model.deleteMany({ host_id: hostId, _id: { $in: rows.map((row) => row._id) } });
			remaining += await model.countDocuments({ host_id: hostId }).read('primary');
		}
		if (remaining || await tagAndDrainAccountJobs(hostId)) {
			await step('database', { 'deletion.clean_at': null });
			return { pending: true };
		}
		if (!tenant.deletion.clean_at) {
			await step('verifying', { 'deletion.clean_at': new Date() });
			return { pending: true };
		}
		if (Date.now() - new Date(tenant.deletion.clean_at).getTime() < 5000) return { pending: true };
		await (options.cancelBilling || cancelAccountTrackingSubscriptions)(tenant, tenant.deletion.billing_customer_id ? { user: { stripe_customer_id: tenant.deletion.billing_customer_id } } : {});
		await step('users');
		for (const id of userIds) {
			const user = await User.findById(id).select('_id email tenant host_id').read('primary').lean();
			if (!user) continue;
			const memberships = await TenantMember.find({ user: id, host_id: { $ne: hostId } }).sort({ createdAt: 1, _id: 1 }).read('primary').lean();
			const survivors = await Tenant.find({ _id: { $in: memberships.map((row) => row.tenant) }, 'deletion.requested_at': null }).select('_id').read('primary').lean();
			const membership = memberships.find((member) => survivors.some((row) => String(row._id) === String(member.tenant)));
			const owned = await Tenant.findOne({ owner: id, host_id: { $ne: hostId }, 'deletion.requested_at': null }).select('_id host_id').read('primary').lean();
			if (membership || owned) {
				if (user.host_id === hostId || String(user.tenant) === String(tenant._id)) {
					const next = owned || { _id: membership.tenant, host_id: membership.host_id };
					await User.updateOne({ _id: id }, { $set: { tenant: next._id, host_id: next.host_id, access_tokens: [] }, $unset: { stripe_customer_id: '', stripe_subscription_id: '', stripe_free_subscription_id: '', subscription_status: '', trial_source: '', trial_ends_at: '' } });
				}
				continue;
			}
			await Promise.all([UserPasskey.deleteMany({ user: id }), MagicLink.deleteMany({ user: id }), PendingSignup.deleteMany({ email: user.email }), TenantMember.deleteMany({ user: id }), OAuthRefreshToken.deleteMany({ user: id }), OAuthAuthorizationCode.deleteMany({ user: id }), OAuthConsent.deleteMany({ user: id })]);
			await User.deleteOne({ _id: id });
		}
		await step('complete');
		await Tenant.deleteOne(lock);
		log.info({ host_id: hostId, event: 'account_deletion_completed' }, 'Account deletion verified');
		return { deleted: true, host_id: hostId };
	} catch (error) {
		await Tenant.updateOne(lock, { $set: { 'deletion.stage': 'failed', 'deletion.error': String(error.code || 'cleanup_failed') } });
		log.error({ err: error, host_id: hostId }, 'Account deletion requires retry');
		throw error;
	} finally {
		await Tenant.updateOne(lock, { $unset: { 'deletion.lease_owner': '', 'deletion.lease_until': '' } });
	}
}

export async function recoverAccountDeletions(options = {}) {
	const tenants = Tenant.find({ 'deletion.requested_at': { $ne: null }, 'deletion.stage': { $ne: 'failed' }, ...(options.hostId ? { host_id: options.hostId } : {}) }).select('host_id deletion').read('primary').lean().cursor();
	for await (const tenant of tenants) await (options.enqueueDeletion || enqueueAccountDeletion)(tenant);
}

export async function retryAccountDeletion(tenantId) {
	const tenant = await Tenant.findOneAndUpdate({ _id: tenantId, 'deletion.stage': 'failed' }, { $set: { 'deletion.stage': 'requested', 'deletion.error': '' } }, { returnDocument: 'after' }).read('primary').lean();
	if (!tenant) throw Object.assign(new Error('No failed deletion to retry'), { status: 409 });
	await enqueueAccountDeletion(tenant);
	return publicDeletionState(tenant);
}

export async function startAccountDeletionWorker(options = {}) {
	if (deletionWorker) return deletionWorker;
	deletionWorker = new MongoWorker({ queue: ACCOUNT_DELETION_QUEUE, concurrency: 1, pollIntervalMs: options.pollIntervalMs, handlerTimeoutMs: 120000, retryDelayMs: 30000, appInstance: getQueueAppInstance(), handler: ({ data, signal }) => processAccountDeletion(data, { signal }) });
	await deletionWorker.start();
	await recoverAccountDeletions(options);
	return deletionWorker;
}

export async function preflightAccountResources(tenant, options = {}) {
	if (!/^[a-f\d]{24}$/i.test(tenant.host_id)) throw Object.assign(new Error('Invalid account storage scope'), { status: 409 });
	if (tenant.settings?.white_label?.cloudflare_custom_hostname_id && !isCloudflareConfigured()) throw Object.assign(new Error('Custom domain cleanup is not configured'), { status: 409 });
	await assertConversationCleanupOwnership(tenant.host_id, options);
}

async function stopAccountProducers(tenant) {
	await Promise.all([GitRepo.updateMany({ host_id: tenant.host_id }, { $set: { enabled: false } }), ObsidianConnection.updateMany({ host_id: tenant.host_id }, { $set: { enabled: false } })]);
}

export async function cleanupAccountResources(tenant, options = {}) {
	const hostId = tenant.host_id;
	await preflightAccountResources(tenant, options);
	await deleteImportFilesForHost(hostId);
	await deleteGitRepoHostDirectory(hostId);
	await deleteObsidianHostDirectory(hostId);
	const exportRoot = path.resolve('assets/export');
	const files = await fs.promises.readdir(exportRoot).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
	for (const file of files) if (file.startsWith(`export-${hostId}-`) && file.endsWith('.zip')) await fs.promises.rm(path.join(exportRoot, file), { force: true });
	await fs.promises.rm(path.join(getWhiteLabelAssetsDir(), hostId), { recursive: true, force: true });
	if (tenant.settings?.white_label?.cloudflare_custom_hostname_id) await deleteHostname(tenant.settings.white_label.cloudflare_custom_hostname_id);
	const history = await deleteConversationDataForHost(hostId, options.userIds || [], options);
	if (history?.pending) return history;
	for (const name of getTenantTypesenseCollectionNames(hostId)) await deleteTypesenseCollection(name);
	await deleteTenantSocketPackets(hostId);
	return { pending: false };
}
