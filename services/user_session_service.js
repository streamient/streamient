import crypto from 'node:crypto';
import mongoose from '../model/mongoose.js';

const BROWSERS = [['Edge', /Edg\//], ['Opera', /OPR\//], ['Firefox', /Firefox\//], ['Chrome', /Chrome\//], ['Safari', /Safari\//]];
const SYSTEMS = [['iOS', /iPhone|iPad/], ['Android', /Android/], ['Windows', /Windows/], ['macOS', /Mac OS X/], ['Linux', /Linux/]];

export function describeUserAgent(userAgent) {
	if (!userAgent) return 'Unknown device';
	const browser = BROWSERS.find(([, pattern]) => pattern.test(userAgent))?.[0] || 'Browser';
	const system = SYSTEMS.find(([, pattern]) => pattern.test(userAgent))?.[0];
	return system ? `${browser} on ${system}` : browser;
}

// Public ID so raw session IDs never reach the browser.
export function publicSessionId(sid) {
	return crypto.createHash('sha256').update(String(sid)).digest('hex').slice(0, 32);
}

const revokedSessions = () => mongoose.connection.db.collection('revoked_sessions');

function parseSession(row) {
	try { return typeof row.session === 'string' ? JSON.parse(row.session) : row.session; } catch { return null; }
}

async function findUserSessions(userId) {
	const id = String(userId);
	if (!/^[a-f0-9]{24}$/.test(id)) return [];
	const sessions = mongoose.connection.db.collection('sessions');
	// shortcut: connect-mongo stores the session as a JSON string, so this scans the collection; switch the store to stringify:false and index session.userId if the Security page gets slow.
	const rows = [];
	while (true) {
		const row = await sessions.findOneAndUpdate({ session: { $regex: `"userId":"${id}"` }, _id: { $nin: rows.map((value) => value._id) } }, { $set: {} }, { returnDocument: 'after', projection: { session: 1, expires: 1, lastModified: 1 } });
		if (!row) break;
		rows.push(row);
	}
	const result = [];
	for (const row of rows) {
		const data = parseSession(row);
		if (data && String(data.userId) === id && !data.impersonating && !await isSessionRevoked(publicSessionId(row._id))) result.push({ row, data });
	}
	return result;
}

export async function listUserSessions(userId, currentSid) {
	const sessions = await findUserSessions(userId);
	return sessions.map(({ row, data }) => ({ id: publicSessionId(row._id), current: row._id === currentSid, device: describeUserAgent(data.userAgent), ip: data.ip || '', login_at: data.lastLoginRecordedAt || null, last_active_at: row.lastModified || null })).sort((a, b) => Number(b.current) - Number(a.current) || new Date(b.last_active_at || 0) - new Date(a.last_active_at || 0));
}

export async function isSessionRevoked(publicId) {
	// Match the marker atomically so replica lag cannot restore revoked access.
	return Boolean(publicId) && (await revokedSessions().updateOne({ _id: String(publicId) }, { $set: { _id: String(publicId) } })).matchedCount > 0;
}

// The marker outlives the deleted row so an in-flight save cannot resurrect the session.
async function revokeRows(rows) {
	if (!rows.length) return [];
	const markers = revokedSessions();
	await markers.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
	await markers.bulkWrite(rows.map((row) => ({ updateOne: { filter: { _id: publicSessionId(row._id) }, update: { $set: { expires: row.expires || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } }, upsert: true } })));
	await mongoose.connection.db.collection('sessions').deleteMany({ _id: { $in: rows.map((row) => row._id) } });
	return rows.map((row) => row._id);
}

export async function revokeUserSession(userId, publicId, currentSid) {
	const rows = (await findUserSessions(userId)).map(({ row }) => row).filter((row) => publicSessionId(row._id) === publicId && row._id !== currentSid);
	return revokeRows(rows);
}

export async function revokeOtherUserSessions(userId, currentSid) {
	return revokeRows((await findUserSessions(userId)).map(({ row }) => row).filter((row) => row._id !== currentSid));
}
