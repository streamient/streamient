import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { getSetting, setSetting } from './system_settings_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('typesense-backfill');
const TRASH_FIELDS_BACKFILL_KEY = 'typesense.trash_fields_backfill_v1';

export async function backfillTypesenseTrashFields() {
	const existing = await getSetting(TRASH_FIELDS_BACKFILL_KEY);
	if (existing?.complete === true) return { skipped: true };

	const updates = await Promise.all([
		Note.updateMany({}, { $set: { is_indexed: false } }, { timestamps: false }),
		Memory.updateMany({}, { $set: { is_indexed: false } }, { timestamps: false }),
		Url.updateMany({}, { $set: { is_indexed: false } }, { timestamps: false }),
		Email.updateMany({}, { $set: { is_indexed: false } }, { timestamps: false }),
	]);
	const queued = updates.reduce((sum, result) => sum + (result?.modifiedCount || 0), 0);

	await setSetting(TRASH_FIELDS_BACKFILL_KEY, {
		complete: true,
		queued,
		completed_at: new Date().toISOString(),
	}, 'backfill', 'Queued all content records for trash-aware Typesense reindex');

	log.info({ queued }, 'Typesense trash fields backfill queued');
	return { skipped: false, queued };
}
