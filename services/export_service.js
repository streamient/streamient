import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ZipArchive } from 'archiver';
import { Export } from '../model/export.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailInternalNote } from '../model/email_internal_note.js';
import { OutgoingEmail } from '../model/outgoing_email.js';
import { GraphLink } from '../model/graph_link.js';
import { sendExportReadyEmail } from './email_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('export');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, '..', 'assets', 'export');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function startExport(userId, hostId, userEmail, userName) {
	// Prevent concurrent exports for the same tenant
	const existing = await Export.findOne({ host_id: hostId, status: { $in: ['pending', 'processing'] } });
	if (existing) {
		throw new Error('An export is already in progress');
	}

	const token = crypto.randomBytes(32).toString('hex');
	const doc = await Export.create({
		token,
		owner: userId,
		host_id: hostId,
		status: 'pending',
	});

	setImmediate(() => {
		processExport(doc._id, hostId, userEmail, userName).catch((err) => {
			log.error({ err }, 'Export processing error');
		});
	});

	return doc;
}

async function processExport(exportId, hostId, userEmail, userName) {
	const doc = await Export.findById(exportId);
	if (!doc) return;

	doc.status = 'processing';
	await doc.save();

	const filename = `export-${hostId}-${Date.now()}.zip`;
	const filePath = path.join(EXPORT_DIR, filename);

	try {
		const [notes, memories, urls, emails, drafts, internalNotes, outgoingEmails, links] = await Promise.all([
			Note.find({ host_id: hostId, in_trash: false }).lean(),
			Memory.find({ host_id: hostId, in_trash: false }).lean(),
			Url.find({ host_id: hostId, in_trash: false }).lean(),
			Email.find({ host_id: hostId, in_trash: false }).lean(),
			EmailDraft.find({ host_id: hostId }).lean(),
			EmailInternalNote.find({ host_id: hostId }).lean(),
			OutgoingEmail.find({ host_id: hostId }).lean(),
			GraphLink.find({ host_id: hostId }).lean(),
		]);

		await new Promise((resolve, reject) => {
			const output = fs.createWriteStream(filePath);
			const archive = new ZipArchive({ zlib: { level: 9 } });

			output.on('close', resolve);
			archive.on('error', reject);

			archive.pipe(output);
			archive.append(JSON.stringify(notes, null, 2), { name: 'notes.json' });
			archive.append(JSON.stringify(memories, null, 2), { name: 'memories.json' });
			archive.append(JSON.stringify(urls, null, 2), { name: 'urls.json' });
			archive.append(JSON.stringify(emails, null, 2), { name: 'emails.json' });
			archive.append(JSON.stringify(drafts, null, 2), { name: 'email-drafts.json' });
			archive.append(JSON.stringify(internalNotes, null, 2), { name: 'email-internal-notes.json' });
			archive.append(JSON.stringify(outgoingEmails, null, 2), { name: 'outgoing-emails.json' });
			archive.append(JSON.stringify(links, null, 2), { name: 'links.json' });
			archive.finalize();
		});

		doc.file_path = filePath;
		doc.status = 'ready';
		doc.expires_at = new Date(Date.now() + EXPIRY_MS);
		await doc.save();

		sendExportReadyEmail(userEmail, userName, doc.token).catch((e) =>
			log.warn({ err: e, user_email: userEmail }, 'Export email failed'),
		);
	} catch (err) {
		doc.status = 'failed';
		doc.error = err.message;
		await doc.save();
		// Clean up partial file
		fs.unlink(filePath, () => {});
	}
}

export async function getExportStatus(hostId) {
	return Export.findOne({ host_id: hostId }).sort({ createdAt: -1 }).lean();
}

export async function getExportFile(token, hostId) {
	const doc = await Export.findOne({ token, host_id: hostId, status: 'ready' });
	if (!doc) return null;
	if (doc.expires_at && doc.expires_at < new Date()) return null;
	if (!fs.existsSync(doc.file_path)) return null;
	return doc.file_path;
}

export async function cleanupExpiredExports() {
	const now = new Date();
	const expired = await Export.find({ status: 'ready', expires_at: { $lt: now } });

	let cleaned = 0;
	for (const doc of expired) {
		if (doc.file_path) {
			fs.unlink(doc.file_path, () => {});
		}
		await doc.deleteOne();
		cleaned++;
	}

	if (cleaned > 0) {
		log.info({ count: cleaned }, 'Cleaned up expired exports');
	}

	return cleaned;
}
