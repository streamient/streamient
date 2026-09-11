import { recoverAccountDeletions } from '../services/account_cleanup_service.js';
import { Cron } from 'croner';
import { reindexDue } from './crawler.js';
import { runStreamientIndexer } from './typesense.js';
import { User } from '../model/user.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { sendTrialEnding3DayEmail, sendTrialEnding24HourEmail, sendTrialExpiredEmail } from '../services/email_service.js';
import { cleanupExpiredExports } from '../services/export_service.js';
import { runScheduledSync } from '../services/git_sync_service.js';
import { reconcileActiveTrashTenants } from '../services/trash_reconciliation_service.js';
import { runEmailRetentionCleanup, runTrashRetentionCleanup } from '../services/trash_retention_service.js';
import { cleanupOrphanedImportFiles, createNoteImportWorker, logImportWorkerError } from '../services/note_import_service.js';
import { startHelpmonksSignupSequenceWorker } from '../services/helpmonks_signup_sequence_service.js';
import { cleanupOrphanedUploads } from '../services/obsidian_blob_service.js';
import { cleanupObsidianRetention, createObsidianExtractionWorker } from '../services/obsidian_sync_service.js';
import { syncProductUpdates } from '../services/product_update_service.js';
import { createLogger } from './logger.js';
import config from '../config.js';

export { runEmailRetentionCleanup };

const log = createLogger('scheduler');

const DAY_MS = 24 * 60 * 60 * 1000;

async function sendTrialReminder(userModel, user, fieldName, now, sendEmail) {
	const endDate = new Date(user.trial_ends_at).toLocaleDateString();
	await sendEmail(user.email, user.name, endDate);
	await userModel.updateOne({ _id: user._id }, { $set: { [fieldName]: now } });
}

export async function runTrialLifecycle({
	now = new Date(),
	userModel = User,
	send3DayEmail = sendTrialEnding3DayEmail,
	send24HourEmail = sendTrialEnding24HourEmail,
	sendExpiredEmail = sendTrialExpiredEmail,
} = {}) {
	const threeDaysFromNow = new Date(now.getTime() + 3 * DAY_MS);
	const fourDaysFromNow = new Date(now.getTime() + 4 * DAY_MS);
	const tomorrow = new Date(now.getTime() + DAY_MS);

	const threeDayUsers = await userModel.find({
		trial_source: 'no_card',
		subscription_status: 'trialing',
		trial_ends_at: { $gte: threeDaysFromNow, $lt: fourDaysFromNow },
		trial_reminder_3d_sent_at: null,
	});

	let reminders3d = 0;
	for (const user of threeDayUsers) {
		try {
			await sendTrialReminder(userModel, user, 'trial_reminder_3d_sent_at', now, send3DayEmail);
			reminders3d++;
		} catch (err) {
			log.warn({ err, email: user.email }, '3-day trial reminder failed');
		}
	}

	const twentyFourHourUsers = await userModel.find({
		trial_source: 'no_card',
		subscription_status: 'trialing',
		trial_ends_at: { $gt: now, $lte: tomorrow },
		trial_reminder_24h_sent_at: null,
	});

	let reminders24h = 0;
	for (const user of twentyFourHourUsers) {
		try {
			await sendTrialReminder(userModel, user, 'trial_reminder_24h_sent_at', now, send24HourEmail);
			reminders24h++;
		} catch (err) {
			log.warn({ err, email: user.email }, '24-hour trial reminder failed');
		}
	}

	const expiredUsers = await userModel.find({
		trial_source: 'no_card',
		subscription_status: 'trialing',
		trial_ends_at: { $lte: now },
		trial_locked_at: null,
	});

	let expired = 0;
	for (const user of expiredUsers) {
		try {
			// Trial over → drop to Free. The account persists (no tenant deletion);
			// Pro features re-lock automatically since status is no longer 'trialing'.
			await userModel.updateOne({ _id: user._id }, { $set: { subscription_status: 'trial_expired', trial_locked_at: now } });
			const endDate = new Date(user.trial_ends_at).toLocaleDateString();
			await sendExpiredEmail(user.email, user.name, endDate);
			expired++;
		} catch (err) {
			log.warn({ err, email: user.email }, 'Trial expired email failed');
		}
	}

	return {
		reminders_3d: reminders3d,
		reminders_24h: reminders24h,
		expired,
	};
}

export async function runProductUpdateSync(sync = syncProductUpdates) {
	try {
		const summary = await sync();
		if (summary.enabled) log.info({ fetched: summary.fetched, upserted: summary.upserted, deactivated: summary.deactivated }, 'Ghost product updates synchronized');
		return summary;
	} catch (err) {
		log.error({ err }, 'Ghost product update synchronization error');
		return { enabled: true, error: err.message };
	}
}

/**
 * Schedule crawl reindexing for due URLs every 10 minutes.
 * Schedule trial-ending reminders daily at 9 AM.
 * Schedule Typesense catch-up indexing every 5 minutes.
 * Schedule spam/trash email retention cleanup daily.
 */
export function startScheduler() {
	new Cron('*/30 * * * * *', () => recoverAccountDeletions().catch((error) => console.error('Account deletion recovery failed:', error.message)));
	void runProductUpdateSync();
	new Cron('*/15 * * * *', () => runProductUpdateSync());
	const noteImportWorker = createNoteImportWorker();
	noteImportWorker.start().catch(logImportWorkerError);
	startHelpmonksSignupSequenceWorker().catch((err) => log.error({ err }, 'Helpmonks signup sequence worker failed to start'));
	if (config.obsidian.enabled) {
		const obsidianExtractionWorker = createObsidianExtractionWorker();
		obsidianExtractionWorker.start().catch((err) => log.error({ err }, 'Obsidian extraction worker failed'));
	}

	let crawlReindexRunning = false;
	new Cron('*/10 * * * *', async () => {
		if (process.env.SCHEDULER_CRAWL_ENABLED === 'false') {
			log.info('Scheduled crawl skipped: SCHEDULER_CRAWL_ENABLED=false');
			return;
		}
		if (crawlReindexRunning) return;
		crawlReindexRunning = true;
		try {
			const crawled = await reindexDue({ intervalHours: 24 });
			if (crawled > 0) log.info({ crawled }, 'Scheduled due crawl complete');
		} catch (err) {
			log.error({ err }, 'Scheduled due crawl error');
		} finally {
			crawlReindexRunning = false;
		}
	});

	// Trial lifecycle: reminders and expiry (downgrade to Free; no deletion).
	new Cron('0 9 * * *', async () => {
		try {
			const summary = await runTrialLifecycle();
			log.info({ reminders_3d: summary.reminders_3d, reminders_24h: summary.reminders_24h, expired: summary.expired }, 'Trial lifecycle run complete');
		} catch (err) {
			log.error({ err }, 'Trial lifecycle error');
		}
	});

	// Streamient indexer: find documents with is_indexed:false and batch-import to Typesense
	let indexRunning = false;
	new Cron('8,28,48 * * * * *', async () => {
		if (indexRunning) return;
		indexRunning = true;
		try {
			const indexed = await runStreamientIndexer({ Note, Memory, Url, Email, ObsidianFile });
			if (indexed > 0) log.info({ indexed }, 'Streamient indexer batch complete');
		} catch (err) {
			log.error({ err }, 'Streamient indexer batch error');
		} finally {
			indexRunning = false;
		}
	});

	// Cleanup expired export files every hour
	new Cron('0 * * * *', async () => {
		try {
			const cleaned = await cleanupExpiredExports();
			log.info({ removed: cleaned }, 'Export cleanup complete');
		} catch (err) {
			log.error({ err }, 'Export cleanup error');
		}
	});

	new Cron('15 * * * *', async () => {
		try {
			const removed = await cleanupOrphanedImportFiles();
			if (removed) log.info({ removed }, 'Orphaned mobile import cleanup complete');
		} catch (err) {
			log.error({ err }, 'Orphaned mobile import cleanup error');
		}
	});

	new Cron('25 * * * *', async () => {
		try {
			const removed = await cleanupOrphanedUploads();
			if (removed) log.info({ removed }, 'Orphaned Obsidian upload cleanup complete');
		} catch (err) {
			log.error({ err }, 'Orphaned Obsidian upload cleanup error');
		}
	});

	new Cron('45 2 * * *', async () => {
		try {
			const summary = await cleanupObsidianRetention();
			if (summary.purged_files || summary.deleted_blobs) log.info(summary, 'Obsidian retention cleanup complete');
		} catch (err) {
			log.error({ err }, 'Obsidian retention cleanup error');
		}
	});

	// Retention: permanently delete all trash plus non-trash spam emails older than 30 days.
	new Cron('30 2 * * *', async () => {
		try {
			const summary = await runTrashRetentionCleanup();
			log.info({ deleted: summary.deleted, errors: summary.errors.length, types: summary.types }, 'Trash retention cleanup complete');
		} catch (err) {
			log.error({ err }, 'Trash retention cleanup error');
		}
	});

	let trashReconciliationRunning = false;
	new Cron('10 3 * * *', async () => {
		if (process.env.SCHEDULER_TRASH_RECONCILIATION_ENABLED !== 'true') {
			log.info('Scheduled trash reconciliation skipped: set SCHEDULER_TRASH_RECONCILIATION_ENABLED=true after Typesense health verification');
			return;
		}
		if (trashReconciliationRunning) {
			log.warn('Scheduled trash reconciliation skipped: previous run active');
			return;
		}
		trashReconciliationRunning = true;
		try {
			const summaries = await reconcileActiveTrashTenants({ dryRun: false });
			for (const summary of summaries) log.info({ summary }, 'Trash reconciliation tenant complete');
		} catch (err) {
			log.error({ err }, 'Trash reconciliation error');
		} finally {
			trashReconciliationRunning = false;
		}
	});

	// Git repo sync every 10 minutes
	new Cron('*/10 * * * *', async () => {
		try {
			const summary = await runScheduledSync();
			log.info({ checked: summary.checked, due: summary.due, synced: summary.synced, failed: summary.failed }, 'Git sync run complete');
		} catch (err) {
			log.error({ err }, 'Git sync scheduler error');
		}
	});

	log.info('Scheduler started: Ghost updates every 15min, mobile import worker, due crawl every 10min, trial lifecycle at 09:00, batch index every 20s, export/import cleanup hourly, trash retention daily at 02:30, trash reconciliation daily at 03:10, git sync every 10min');
}
