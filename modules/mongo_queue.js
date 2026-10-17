import { acquireTenantWork } from './tenancy.js';
import mongoose from '../model/mongoose.js';
import { randomUUID } from 'node:crypto';
import { createLogger } from './logger.js';

const log = createLogger('queue');

export const COLLECTION_NAME = 'mongo_queue_jobs';
export const STATUS = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	FAILED: 'failed',
};

const STALLED_THRESHOLD_MS = 5 * 60 * 1000;
const HANDLER_TIMEOUT_MS = 3 * 60 * 1000;
const COMPLETED_TTL_SECONDS = 24 * 60 * 60;

let indexesEnsured = false;
let indexesPromise = null;

function getAppInstance(options = {}) {
	return options.appInstance || process.env.STREAMIENT_QUEUE_APP || process.env.KUMBUKUM_QUEUE_APP || 'streamient';
}

function getCollection() {
	const db = mongoose.connection?.db;
	if (!db) throw new Error('MongoQueue: MongoDB connection is not ready');
	return db.collection(COLLECTION_NAME);
}

function namespaced(filter, appInstance) {
	return { app_instance: appInstance || getAppInstance(), ...(filter || {}) };
}

async function ensureIndexes() {
	if (indexesEnsured) return;
	if (indexesPromise) return indexesPromise;
	indexesPromise = (async () => {
		const col = getCollection();
		await col.createIndex({ app_instance: 1, queue: 1, status: 1, scheduled_at: 1 }, { background: true });
		await col.createIndex({ app_instance: 1, queue: 1, dedup_key: 1 }, { background: true, unique: true, partialFilterExpression: { dedup_key: { $type: 'string' } } });
		await col.createIndex({ completed_at: 1 }, { background: true, expireAfterSeconds: COMPLETED_TTL_SECONDS });
		indexesEnsured = true;
		indexesPromise = null;
	})().catch((err) => {
		indexesPromise = null;
		throw err;
	});
	return indexesPromise;
}

export const MongoQueue = {
	async add(queueName, data, options = {}) {
		await ensureIndexes();
		const col = getCollection();
		const now = new Date();
		const hostId = queueName === 'account_deletion' ? '' : await resolveJobHost(data, options);
		if (hostId) {
			const tenant = await mongoose.connection.db.collection('tenants').findOne({ host_id: hostId, is_active: { $ne: false }, 'deletion.requested_at': null }, { projection: { _id: 1 }, readPreference: 'primary' });
			if (!tenant) throw Object.assign(new Error('Account access is unavailable'), { code: 'account_unavailable' });
			data = { ...data, host_id: hostId };
		}

		const appInstance = getAppInstance(options);
		const doc = {
			app_instance: appInstance,
			queue: queueName,
			status: STATUS.PENDING,
			data: data || {},
			attempts: 0,
			max_attempts: options.maxAttempts || 3,
			created_at: now,
			updated_at: now,
			scheduled_at: options.delay ? new Date(now.getTime() + options.delay) : now,
			error: null,
			completed_at: null,
		};
		if (options.jobId) doc._id = String(options.jobId);
		if (options.dedupKey) doc.dedup_key = String(options.dedupKey);
		try {
			const result = await col.insertOne(doc);
			return { _id: result.insertedId, ...doc };
		} catch (err) {
			if (err?.code === 11000 && options.dedupKey) {
				if (options.requeueCompleted || options.requeueFailed) {
					const statuses = [...(options.requeueCompleted ? [STATUS.COMPLETED] : []), ...(options.requeueFailed ? [STATUS.FAILED] : [])];
					const { _id, ...update } = doc;
					return col.findOneAndUpdate(namespaced({ queue: queueName, dedup_key: doc.dedup_key, status: { $in: statuses } }, appInstance), { $set: update }, { returnDocument: 'after' });
				}
				return null;
			}
			throw err;
		}
	},

	async getJob(jobId, options = {}) {
		const col = getCollection();
		return col.findOne(namespaced({ _id: String(jobId) }, getAppInstance(options)));
	},

	async removeJob(jobId, options = {}) {
		const col = getCollection();
		const result = await col.deleteOne(namespaced({ _id: String(jobId), status: STATUS.PENDING }, getAppInstance(options)));
		return result.deletedCount > 0;
	},
};

export class MongoWorker {
	constructor(queueOrOptions, extraOptions) {
		const options = typeof queueOrOptions === 'string'
			? { ...(extraOptions || {}), queue: queueOrOptions }
			: (queueOrOptions || {});
		if (!options.queue) throw new Error('MongoWorker: queue name is required');
		if (!options.handler) throw new Error('MongoWorker: handler is required');
		this.queueName = options.queue;
		this.appInstance = getAppInstance(options);
		this.handler = options.handler;
		this.concurrency = options.concurrency || 1;
		this.stalledThresholdMs = options.stalledThresholdMs || STALLED_THRESHOLD_MS;
		this.handlerTimeoutMs = options.handlerTimeoutMs || HANDLER_TIMEOUT_MS;
		this.retryDelayMs = Number.isFinite(Number(options.retryDelayMs)) && Number(options.retryDelayMs) >= 0 ? Number(options.retryDelayMs) : 0;
		this.activeCount = 0;
		this.running = false;
		this.stopping = false;
		this.changeStream = null;
		this.sweepInterval = null;
		this.stalledInterval = null;
		this.sweepPromise = null;
		this.sweepRequested = false;
		this.sweepRetryAt = 0;
		this.recoveryPromise = null;
		this.activeJobs = new Map();
	}

	async start() {
		if (this.running) return;
		this.running = true;
		this.stopping = false;
		await ensureIndexes();
		await this.recoverStalledJobs();
		await this.sweepPendingJobs();
		if (!this.running) return;
		this.openChangeStream();
		this.sweepInterval = setInterval(() => this.sweepPendingJobs().catch((err) => log.error({ err, queue: this.queueName }, 'MongoWorker sweep error')), 30000);
		this.stalledInterval = setInterval(() => this.recoverStalledJobs().catch((err) => log.error({ err, queue: this.queueName }, 'MongoWorker stalled recovery error')), 120000);
		log.info({ queue: this.queueName, concurrency: this.concurrency }, 'MongoWorker started');
	}

	async stop() {
		this.running = false;
		this.stopping = true;
		if (this.changeStream) await this.changeStream.close().catch(() => {});
		if (this.sweepInterval) clearInterval(this.sweepInterval);
		if (this.stalledInterval) clearInterval(this.stalledInterval);
		for (const controller of this.activeJobs.values()) controller.abort(new Error('Worker stopped'));
		while (this.activeCount) await new Promise((resolve) => setTimeout(resolve, 10));
	}

	openChangeStream() {
		if (!this.running) return;
		try {
			const col = getCollection();
			this.changeStream = col.watch([{
				$match: {
					$or: [
						{ operationType: 'insert', 'fullDocument.app_instance': this.appInstance, 'fullDocument.queue': this.queueName, 'fullDocument.status': STATUS.PENDING },
						{ operationType: 'update', 'fullDocument.app_instance': this.appInstance, 'fullDocument.queue': this.queueName, 'fullDocument.status': STATUS.PENDING },
						{ operationType: 'replace', 'fullDocument.app_instance': this.appInstance, 'fullDocument.queue': this.queueName, 'fullDocument.status': STATUS.PENDING },
					],
				},
			}], { fullDocument: 'updateLookup' });
			this.changeStream.on('change', (change) => {
				if (!change.fullDocument) return;
				if (new Date(change.fullDocument.scheduled_at) > new Date()) return;
				this.tryProcess(change.fullDocument);
			});
			this.changeStream.on('error', (err) => {
				log.error({ err, queue: this.queueName }, 'MongoWorker change stream error');
				if (this.running) setTimeout(() => this.openChangeStream(), 5000);
			});
		} catch (err) {
			log.warn({ err, queue: this.queueName }, 'MongoWorker change stream unavailable; periodic sweep remains active');
		}
	}

	tryProcess(doc) {
		if (!this.running || this.activeCount >= this.concurrency) return;
		this.processJob(doc).catch((err) => log.error({ err, queue: this.queueName, job_id: String(doc?._id || '') }, 'MongoWorker process error'));
	}

	async processJob(doc) {
		if (this.activeCount >= this.concurrency) return;
		// Reserve capacity before the asynchronous claim, including change-stream claims.
		this.activeCount++;
		let claimed;
		let claimFinished = false;
		let heartbeat;
		let timeoutHandle;
		const owner = randomUUID();
		const controller = new AbortController();
		try {
			const col = getCollection();
			const result = await col.findOneAndUpdate(
				namespaced({ _id: doc._id, queue: this.queueName, status: STATUS.PENDING, scheduled_at: { $lte: new Date() } }, this.appInstance),
				{ $set: { status: STATUS.PROCESSING, claim_owner: owner, lease_expires_at: new Date(Date.now() + this.stalledThresholdMs), updated_at: new Date() }, $inc: { attempts: 1 } },
				{ returnDocument: 'after' },
			);
			claimFinished = true;
			claimed = result?.value || result;
			if (!claimed?._id) return;
			const jobId = String(claimed._id);
			const claimFilter = namespaced({ _id: claimed._id, status: STATUS.PROCESSING, claim_owner: owner }, this.appInstance);
			this.activeJobs.set(owner, controller);
			const isOwner = async () => !!await col.findOne({ ...claimFilter, lease_expires_at: { $gt: new Date() } }, { projection: { _id: 1 } });
			const assertOwnership = async () => {
				controller.signal.throwIfAborted();
				if (!await isOwner()) { controller.abort(new Error('Job claim lost')); controller.signal.throwIfAborted(); }
			};
			const withOwnership = async (callback, { allowAborted = false } = {}) => {
				const session = await mongoose.connection.startSession();
				try {
					return await session.withTransaction(async () => {
						if (!allowAborted) controller.signal.throwIfAborted();
						// Writing the claim makes recovery conflict with publication, including a paused old owner.
						const result = await col.updateOne({ ...claimFilter, lease_expires_at: { $gt: new Date() } }, { $inc: { claim_revision: 1 }, $set: { lease_expires_at: new Date(Date.now() + this.stalledThresholdMs) } }, { session });
						if (!result.matchedCount) throw new Error('Job claim lost');
						const value = await callback(session);
						if (!allowAborted) controller.signal.throwIfAborted();
						return value;
					}, { readPreference: 'primary' });
				} finally { await session.endSession(); }
			};
			heartbeat = setInterval(async () => {
				try {
					const result = await col.updateOne({ ...claimFilter, lease_expires_at: { $gt: new Date() } }, { $set: { lease_expires_at: new Date(Date.now() + this.stalledThresholdMs) } });
					if (!result.matchedCount && result.matchedCount !== undefined) controller.abort(new Error('Job claim lost'));
				} catch (error) { controller.abort(error); }
			}, Math.max(10, Math.min(30000, Math.floor(this.stalledThresholdMs / 3))));
			const startedAt = Date.now();
			try {
				const hostId = this.queueName === 'account_deletion' ? '' : await resolveJobHost(claimed.data);
				if (hostId) {
					await col.updateOne(claimFilter, { $set: { 'data.host_id': hostId } });
					const tenant = await mongoose.connection.db.collection('tenants').findOne({ host_id: hostId, is_active: { $ne: false }, 'deletion.requested_at': null }, { projection: { _id: 1 }, readPreference: 'primary' });
					if (!tenant) { await col.deleteOne(claimFilter); return; }
				}
				if (this.stopping) controller.abort(new Error('Worker stopped'));
				controller.signal.throwIfAborted();
				timeoutHandle = setTimeout(() => controller.abort(new Error('Job handler timed out')), this.handlerTimeoutMs);
				const release = hostId ? await acquireTenantWork(hostId) : null;
				try {
					// Cancellation must settle the handler before capacity, tenant protection, or retries are released.
					await this.handler({ id: claimed._id, data: claimed.data, attempts: claimed.attempts, maxAttempts: claimed.max_attempts, signal: controller.signal, assertOwnership, isOwner, withOwnership });
					controller.signal.throwIfAborted();
				} finally { if (release) await release(); }
				const completion = await col.updateOne(claimFilter, { $set: { status: STATUS.COMPLETED, updated_at: new Date(), completed_at: new Date() }, $unset: { claim_owner: '', lease_expires_at: '' } });
				if (completion?.matchedCount === 0) throw new Error('Job claim lost');
				log.debug({ queue: this.queueName, job_id: jobId, attempts: claimed.attempts, duration_ms: Date.now() - startedAt }, 'Job completed');
			} catch (err) {
				const error = err?.message || String(err);
				const willRetry = claimed.attempts < claimed.max_attempts;
				const nextStatus = willRetry ? STATUS.PENDING : STATUS.FAILED;
				const failedAt = new Date();
				const update = { status: nextStatus, error, updated_at: failedAt };
				if (willRetry) update.scheduled_at = new Date(failedAt.getTime() + this.retryDelayMs);
				await col.updateOne(claimFilter, { $set: update, $unset: { claim_owner: '', lease_expires_at: '' } });
				log[willRetry ? 'warn' : 'error']({ err, queue: this.queueName, job_id: jobId, attempts: claimed.attempts, max_attempts: claimed.max_attempts, will_retry: willRetry, duration_ms: Date.now() - startedAt }, willRetry ? 'Job failed; will retry' : 'Job failed permanently');
				throw err;
			}
		} catch (err) {
			if (!claimed?._id) this.sweepRetryAt = Date.now() + 30000;
			throw err;
		} finally {
			clearInterval(heartbeat);
			clearTimeout(timeoutHandle);
			this.activeJobs.delete(owner);
			this.activeCount--;
			if (claimFinished && this.running) this.sweepPendingJobs().catch((err) => log.error({ err, queue: this.queueName }, 'MongoWorker refill error'));
		}
	}

	async sweepPendingJobs() {
		if (!this.running || Date.now() < this.sweepRetryAt) return;
		if (this.sweepPromise) {
			this.sweepRequested = true;
			return this.sweepPromise;
		}
		if (this.activeCount >= this.concurrency) return;
		// Completion, timer, and concurrent triggers share one query and one pending follow-up.
		this.sweepPromise = (async () => {
			do {
				this.sweepRequested = false;
				const col = getCollection();
				const docs = await col.find(namespaced({ queue: this.queueName, status: STATUS.PENDING, scheduled_at: { $lte: new Date() } }, this.appInstance), { maxTimeMS: 10000 }).sort({ scheduled_at: 1 }).limit(this.concurrency - this.activeCount).toArray();
				for (const doc of docs) this.tryProcess(doc);
			} while (this.sweepRequested && this.running && this.activeCount < this.concurrency);
		})();
		try {
			await this.sweepPromise;
		} catch (err) {
			this.sweepRetryAt = Date.now() + 30000;
			throw err;
		} finally {
			this.sweepPromise = null;
			if (this.sweepRequested && this.running && this.activeCount < this.concurrency && Date.now() >= this.sweepRetryAt) queueMicrotask(() => this.sweepPendingJobs().catch((err) => log.error({ err, queue: this.queueName }, 'MongoWorker follow-up error')));
			this.sweepRequested = false;
		}
	}

	async recoverStalledJobs() {
		if (this.recoveryPromise) return this.recoveryPromise;
		this.recoveryPromise = (async () => {
			const col = getCollection();
			const staleBefore = new Date(Date.now() - this.stalledThresholdMs);
			const stale = namespaced({ queue: this.queueName, status: STATUS.PROCESSING, $or: [{ lease_expires_at: { $lt: new Date() } }, { lease_expires_at: { $exists: false }, updated_at: { $lt: staleBefore } }] }, this.appInstance);
			await col.updateMany({ ...stale, $expr: { $gte: ['$attempts', '$max_attempts'] } }, { $set: { status: STATUS.FAILED, updated_at: new Date(), error: 'Stalled job exhausted retries' }, $unset: { claim_owner: '', lease_expires_at: '' } });
			const result = await col.updateMany({ ...stale, $expr: { $lt: ['$attempts', '$max_attempts'] } }, { $set: { status: STATUS.PENDING, updated_at: new Date(), scheduled_at: new Date(Date.now() + this.retryDelayMs), error: 'Recovered stalled job' }, $unset: { claim_owner: '', lease_expires_at: '' } });
			if (result.modifiedCount) log.warn({ queue: this.queueName, recovered: result.modifiedCount }, 'MongoWorker recovered stalled jobs');
		})();
		try { await this.recoveryPromise; } finally { this.recoveryPromise = null; }
	}
}

export const JOB_HOST_REFERENCES = Object.freeze({ upload_id: 'noteimportuploads', uploadId: 'noteimportuploads', file_id: 'obsidianfiles', repo_id: 'gitrepos', url_id: 'urls' });

export async function resolveJobHost(data, options = {}) {
	if (data?.host_id || data?.hostId) return String(data.host_id || data.hostId);
	const db = options.db || mongoose.connection.db;
	for (const [key, name] of Object.entries(JOB_HOST_REFERENCES)) {
		if (!data?.[key] || !mongoose.isValidObjectId(data[key])) continue;
		const row = await db.collection(name).findOne({ _id: new mongoose.Types.ObjectId(data[key]) }, { projection: { host_id: 1 }, readPreference: 'primary', ...(options.session ? { session: options.session } : {}) });
		if (row?.host_id) return row.host_id;
		return '__missing_account__';
	}
	return '';
}

export { getAppInstance as getQueueAppInstance };
