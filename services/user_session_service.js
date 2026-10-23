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

function parseSession(row) {
	try { return typeof row.session === 'string' ? JSON.parse(row.session) : row.session; } catch { return null; }
}

async function findUserSessions(userId) {
	const id = String(userId);
	if (!/^[a-f0-9]{24}$/.test(id)) return [];
	const sessions = mongoose.connection.db.collection('sessions');
	// shortcut: connect-mongo stores the session as a JSON string, so this scans the collection; switch the store to stringify:false and index session.userId if the Security page gets slow.
	const rows = await sessions.find({ session: { $regex: `"userId":"${id}"` } }, { projection: { session: 1, expires: 1, lastModified: 1 } }).toArray();
	return rows.map((row) => ({ row, data: parseSession(row) })).filter(({ data }) => data && String(data.userId) === id && !data.impersonating);
}

export async function listUserSessions(userId, currentSid) {
	const sessions = await findUserSessions(userId);
	return sessions.map(({ row, data }) => ({ id: publicSessionId(row._id), current: row._id === currentSid, device: describeUserAgent(data.userAgent), ip: data.ip || '', login_at: data.lastLoginRecordedAt || null, last_active_at: row.lastModified || null })).sort((a, b) => Number(b.current) - Number(a.current) || new Date(b.last_active_at || 0) - new Date(a.last_active_at || 0));
}

export async function revokeUserSession(userId, publicId, currentSid) {
	const match = (await findUserSessions(userId)).find(({ row }) => publicSessionId(row._id) === publicId && row._id !== currentSid);
	if (!match) return false;
	await mongoose.connection.db.collection('sessions').deleteOne({ _id: match.row._id });
	return true;
}

export async function revokeOtherUserSessions(userId, currentSid) {
	const ids = (await findUserSessions(userId)).map(({ row }) => row._id).filter((id) => id !== currentSid);
	if (ids.length) await mongoose.connection.db.collection('sessions').deleteMany({ _id: { $in: ids } });
	return ids.map(publicSessionId);
}
