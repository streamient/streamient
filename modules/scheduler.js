import { Cron } from 'croner';
import { reindexDue } from './crawler.js';
import { indexMissing } from './typesense.js';
import { User } from '../model/user.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { sendTrialEnding3DayEmail, sendTrialEnding24HourEmail, sendTrialExpiredEmail } from '../services/email_service.js';
import { cleanupExpiredExports } from '../services/export_service.js';
import { runScheduledSync } from '../services/git_sync_service.js';
import { deleteTenantData } from '../services/account_cleanup_service.js';

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
	deleteTenant = deleteTenantData,
} = {}) {
	const threeDaysFromNow = new Date(now.getTime() + 3 * DAY_MS);
	const fourDaysFromNow = new Date(now.getTime() + 4 * DAY_MS);
	const tomorrow = new Date(now.getTime() + DAY_MS);
	const deletionCutoff = new Date(now.getTime() - 3 * DAY_MS);

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
			console.warn(`3-day trial reminder failed for ${user.email}:`, err.message);
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
			console.warn(`24-hour trial reminder failed for ${user.email}:`, err.message);
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
			await userModel.updateOne({ _id: user._id }, { $set: { subscription_status: 'trial_expired', trial_locked_at: now } });
			const endDate = new Date(user.trial_ends_at).toLocaleDateString();
			await sendExpiredEmail(user.email, user.name, endDate);
			expired++;
		} catch (err) {
			console.warn(`Trial expired email failed for ${user.email}:`, err.message);
		}
	}

	const deletionCandidates = await userModel.find({
		trial_source: 'no_card',
		subscription_status: { $ne: 'active' },
		trial_ends_at: { $lte: deletionCutoff },
	});

	let deleted = 0;
	const seenHosts = new Set();
	for (const user of deletionCandidates) {
		if (!user.host_id || seenHosts.has(user.host_id)) continue;
		seenHosts.add(user.host_id);
		try {
			await deleteTenant(user.host_id, user.tenant);
			deleted++;
		} catch (err) {
			console.error(`Trial cleanup failed for host ${user.host_id}:`, err);
		}
	}

	return {
		reminders_3d: reminders3d,
		reminders_24h: reminders24h,
		expired,
		deleted,
	};
}

/**
 * Schedule crawl reindexing for due URLs every 10 minutes.
 * Schedule trial-ending reminders daily at 9 AM.
 * Schedule Typesense catch-up indexing every 5 minutes.
 */
export function startScheduler() {
	let crawlReindexRunning = false;
	new Cron('*/10 * * * *', async () => {
		if (crawlReindexRunning) return;
		crawlReindexRunning = true;
		try {
			const crawled = await reindexDue({ intervalHours: 24 });
			if (crawled > 0) console.log(`Scheduled due crawl complete: crawled ${crawled} URL(s)`);
		} catch (err) {
			console.error('Scheduled due crawl error:', err);
		} finally {
			crawlReindexRunning = false;
		}
	});

	// Trial lifecycle: reminders, expiry lock, and abandoned trial cleanup.
	new Cron('0 9 * * *', async () => {
		try {
			const summary = await runTrialLifecycle();
			console.log(`Trial lifecycle run complete: 3d ${summary.reminders_3d}, 24h ${summary.reminders_24h}, expired ${summary.expired}, deleted ${summary.deleted}`);
		} catch (err) {
			console.error('Trial lifecycle error:', err);
		}
	});

	// Batch indexing: find documents with is_indexed:false and batch-import to Typesense
	new Cron('*/20 * * * * *', async () => {
		try {
			const indexed = await indexMissing({ Note, Memory, Url, Email });
			if (indexed > 0) console.log(`Index batch complete: indexed ${indexed} document(s)`);
		} catch (err) {
			console.error('Index batch error:', err);
		}
	});

	// Cleanup expired export files every hour
	new Cron('0 * * * *', async () => {
		try {
			const cleaned = await cleanupExpiredExports();
			console.log(`Export cleanup complete: removed ${cleaned} export(s)`);
		} catch (err) {
			console.error('Export cleanup error:', err);
		}
	});

	// Git repo sync every 10 minutes
	new Cron('*/10 * * * *', async () => {
		try {
			const summary = await runScheduledSync();
			console.log(`Git sync run complete: checked ${summary.checked} repo(s), due ${summary.due}, synced ${summary.synced}, failed ${summary.failed}`);
		} catch (err) {
			console.error('Git sync scheduler error:', err);
		}
	});

	console.log('Scheduler started: due crawl every 10min, trial lifecycle at 09:00, batch index every 20s, export cleanup hourly, git sync every 10min');
}
