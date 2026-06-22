import mongoose from '../model/mongoose.js';
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
	return options.appInstance || process.env.KUMBUKUM_QUEUE_APP || 'kumbukum';
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
			if (err?.code === 11000 && options.dedupKey) return null;
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
		this.activeCount = 0;
		this.running = false;
		this.changeStream = null;
		this.sweepInterval = null;
		this.stalledInterval = null;
	}

	async start() {
		if (this.running) return;
		this.running = true;
		await ensureIndexes();
		await this.recoverStalledJobs();
		await this.sweepPendingJobs();
		this.openChangeStream();
		this.sweepInterval = setInterval(() => this.sweepPendingJobs().catch((err) => log.error({ err, queue: this.queueName }, 'MongoWorker sweep error')), 30000);
		this.stalledInterval = setInterval(() => this.recoverStalledJobs().catch((err) => log.error({ err, queue: this.queueName }, 'MongoWorker stalled recovery error')), 120000);
		log.info({ queue: this.queueName, concurrency: this.concurrency }, 'MongoWorker started');
	}

	async stop() {
		this.running = false;
		if (this.changeStream) await this.changeStream.close().catch(() => {});
		if (this.sweepInterval) clearInterval(this.sweepInterval);
		if (this.stalledInterval) clearInterval(this.stalledInterval);
	}

	openChangeStream() {
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
		if (this.activeCount >= this.concurrency) return;
		this.processJob(doc).catch((err) => log.error({ err, queue: this.queueName, job_id: String(doc?._id || '') }, 'MongoWorker process error'));
	}

	async processJob(doc) {
		const col = getCollection();
		const result = await col.findOneAndUpdate(
			namespaced({ _id: doc._id, queue: this.queueName, status: STATUS.PENDING, scheduled_at: { $lte: new Date() } }, this.appInstance),
			{ $set: { status: STATUS.PROCESSING, updated_at: new Date() }, $inc: { attempts: 1 } },
			{ returnDocument: 'after' },
		);
		const claimed = result?.value || result;
		if (!claimed?._id) return;
		this.activeCount++;
		const jobId = String(claimed._id);
		const startedAt = Date.now();
		try {
			let timeoutHandle;
			const timeout = new Promise((_, reject) => {
				timeoutHandle = setTimeout(() => reject(new Error(`Job handler timed out after ${this.handlerTimeoutMs}ms`)), this.handlerTimeoutMs);
			});
			try {
				await Promise.race([this.handler({ id: claimed._id, data: claimed.data, attempts: claimed.attempts }), timeout]);
			} finally {
				clearTimeout(timeoutHandle);
			}
			await col.updateOne(namespaced({ _id: claimed._id }, this.appInstance), { $set: { status: STATUS.COMPLETED, updated_at: new Date(), completed_at: new Date() } });
			log.debug({ queue: this.queueName, job_id: jobId, attempts: claimed.attempts, duration_ms: Date.now() - startedAt }, 'Job completed');
		} catch (err) {
			const error = err?.message || String(err);
			const willRetry = claimed.attempts < claimed.max_attempts;
			const nextStatus = willRetry ? STATUS.PENDING : STATUS.FAILED;
			await col.updateOne(namespaced({ _id: claimed._id }, this.appInstance), { $set: { status: nextStatus, error, updated_at: new Date() } });
			log[willRetry ? 'warn' : 'error']({ err, queue: this.queueName, job_id: jobId, attempts: claimed.attempts, max_attempts: claimed.max_attempts, will_retry: willRetry, duration_ms: Date.now() - startedAt }, willRetry ? 'Job failed; will retry' : 'Job failed permanently');
			throw err;
		} finally {
			this.activeCount = Math.max(0, this.activeCount - 1);
		}
	}

	async sweepPendingJobs() {
		if (!this.running) return;
		const col = getCollection();
		const docs = await col.find(namespaced({
			queue: this.queueName,
			status: STATUS.PENDING,
			scheduled_at: { $lte: new Date() },
		}, this.appInstance)).sort({ scheduled_at: 1 }).limit(this.concurrency).toArray();
		for (const doc of docs) this.tryProcess(doc);
	}

	async recoverStalledJobs() {
		const col = getCollection();
		const staleBefore = new Date(Date.now() - this.stalledThresholdMs);
		const result = await col.updateMany(namespaced({
			queue: this.queueName,
			status: STATUS.PROCESSING,
			updated_at: { $lt: staleBefore },
		}, this.appInstance), { $set: { status: STATUS.PENDING, updated_at: new Date(), error: 'Recovered stalled job' } });
		if (result.modifiedCount) log.warn({ queue: this.queueName, recovered: result.modifiedCount }, 'MongoWorker recovered stalled jobs');
	}
}
