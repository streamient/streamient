import { Cron } from 'croner';
import { reindexDue } from './crawler.js';
import { removeDocument, runKumbukumIndexer } from './typesense.js';
import { User } from '../model/user.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { sendTrialEnding3DayEmail, sendTrialEnding24HourEmail, sendTrialExpiredEmail } from '../services/email_service.js';
import { cleanupExpiredExports } from '../services/export_service.js';
import { runScheduledSync } from '../services/git_sync_service.js';
import { removeLinksForItem } from '../services/graph_service.js';
import { createLogger } from './logger.js';

const log = createLogger('scheduler');

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RETENTION_DAYS = 30;
const EMAIL_RETENTION_BATCH_SIZE = 500;

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

function buildExpiredEmailRetentionQuery(cutoff) {
	return {
		$or: [
			{ in_trash: true, trashed_at: { $lte: cutoff } },
			{ in_trash: { $ne: true }, mailbox: 'spam', updatedAt: { $lte: cutoff } },
		],
	};
}

async function cleanupDeletedEmailReferences(email, removeSearchDocument, removeGraphLinks) {
	const emailId = email._id?.toString ? email._id.toString() : String(email._id || '');
	if (!emailId || !email.host_id) return;

	await Promise.all([
		Promise.resolve(removeSearchDocument(email.host_id, 'emails', emailId)).catch((err) => {
			log.error({ err }, 'Typesense remove error');
		}),
		Promise.resolve(removeGraphLinks(email.host_id, emailId)).catch((err) => {
			log.error({ err }, 'Graph link cleanup error');
		}),
	]);
}

export async function runEmailRetentionCleanup({
	now = new Date(),
	emailModel = Email,
	removeSearchDocument = removeDocument,
	removeGraphLinks = removeLinksForItem,
	batchSize = EMAIL_RETENTION_BATCH_SIZE,
} = {}) {
	const cutoff = new Date(now.getTime() - EMAIL_RETENTION_DAYS * DAY_MS);
	const query = buildExpiredEmailRetentionQuery(cutoff);
	let deleted = 0;

	while (true) {
		const emails = await emailModel
			.find(query)
			.select('_id host_id')
			.limit(batchSize)
			.lean();

		if (!emails.length) break;

		const ids = emails.map((email) => email._id);
		const result = await emailModel.deleteMany({ _id: { $in: ids } });
		const deletedInBatch = result?.deletedCount ?? emails.length;
		deleted += deletedInBatch;

		await Promise.all(emails.map((email) => cleanupDeletedEmailReferences(email, removeSearchDocument, removeGraphLinks)));

		if (deletedInBatch === 0 || emails.length < batchSize) break;
	}

	return { deleted, cutoff };
}

/**
 * Schedule crawl reindexing for due URLs every 10 minutes.
 * Schedule trial-ending reminders daily at 9 AM.
 * Schedule Typesense catch-up indexing every 5 minutes.
 * Schedule spam/trash email retention cleanup daily.
 */
export function startScheduler() {
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

	// Kumbukum indexer: find documents with is_indexed:false and batch-import to Typesense
	new Cron('*/20 * * * * *', async () => {
		try {
			const indexed = await runKumbukumIndexer({ Note, Memory, Url, Email });
			if (indexed > 0) log.info({ indexed }, 'Kumbukum indexer batch complete');
		} catch (err) {
			log.error({ err }, 'Kumbukum indexer batch error');
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

	// Email retention: permanently delete spam/trash emails older than 30 days.
	new Cron('30 2 * * *', async () => {
		try {
			const summary = await runEmailRetentionCleanup();
			log.info({ deleted: summary.deleted }, 'Email retention cleanup complete');
		} catch (err) {
			log.error({ err }, 'Email retention cleanup error');
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

	log.info('Scheduler started: due crawl every 10min, trial lifecycle at 09:00, batch index every 20s, export cleanup hourly, email retention daily at 02:30, git sync every 10min');
}
