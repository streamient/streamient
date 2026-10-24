import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'assets', 'screenshots');

// Ensure directory exists on module load
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

/**
 * Normalize a URL for consistent hashing across tenants.
 * Lowercases protocol + host, strips trailing slash, sorts query params.
 */
export function normalizeUrl(rawUrl) {
    const u = new URL(rawUrl);
    u.hash = '';
    // Sort search params for consistent ordering
    const sorted = new URLSearchParams([...u.searchParams].sort((a, b) => a[0].localeCompare(b[0])));
    u.search = sorted.toString() ? `?${sorted.toString()}` : '';
    // Remove trailing slash from pathname (except bare root)
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
}

/**
 * Deterministic filename from URL — SHA-256 hash of the normalized URL.
 */
export function urlToFilename(url) {
    const normalized = normalizeUrl(url);
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    return `${hash}.png`;
}

// Public (server-captured) screenshots are URL-only and globally reused.
// Private (client-provided) screenshots are scoped to a tenant so one tenant's
// paywalled capture can never be served or overwritten by another tenant.
const PUBLIC_SCREENSHOT_RE = /^pub-[a-f0-9]{64}\.png$/i;
const PRIVATE_SCREENSHOT_RE = /^[a-f0-9]{24}-[a-f0-9]{64}\.png$/i;

function publicScreenshotFilename(url) {
	return `pub-${urlToFilename(url)}`;
}

function privateScreenshotFilename(hostId, url) {
	if (!/^[a-f0-9]{24}$/i.test(String(hostId || ''))) throw new Error('Invalid tenant for screenshot storage');
	return `${hostId}-${urlToFilename(url)}`;
}

// Legacy bare `{hash}.png` files predate tenant scoping and are ambiguous
// (they may hold a private capture). Fail closed: never serve or sign them.
function isStoredScreenshotFilename(filename) {
	return typeof filename === 'string' && (PUBLIC_SCREENSHOT_RE.test(filename) || PRIVATE_SCREENSHOT_RE.test(filename));
}

/**
 * Call the screenshot service and return the image buffer, or null on failure.
 */
export async function captureScreenshot(url) {
	// shortcut: remote browsers cannot enforce our pinned DNS policy; enable only with verified network isolation.
	return null;
}

/**
 * Save a screenshot for the given URL.
 * Returns the filename (pub-{hash}.png) if successful, null otherwise.
 * Public screenshots are URL-only and globally reused, but never read from or
 * write to a tenant's private screenshot location.
 */
export async function saveScreenshot(url) {
    if (!config.screenshotUrl) return null;

    const filename = publicScreenshotFilename(url);
    const filePath = path.join(SCREENSHOTS_DIR, filename);

    // Dedup: file already exists for this URL
    try {
        await fs.promises.access(filePath);
        return filename;
    } catch {
        // File doesn't exist — proceed with capture
    }

    const buffer = await captureScreenshot(url);
    if (!buffer) return null;

	return writeScreenshotThumbnail(url, buffer, { overwrite: false, filename });
}

/**
 * Save a client-provided screenshot data URL for the given URL, scoped to a
 * tenant. Used by browser extensions when the logged-in user's session can see
 * paywalled pages. The tenant-scoped filename keeps it separate from the
 * globally reused public screenshot for the same URL.
 */
export async function saveScreenshotDataUrl(url, dataUrl, hostId) {
	if (!dataUrl) return null;

	const match = String(dataUrl).match(/^data:image\/(?:png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i);
	if (!match) {
		throw new Error('Invalid screenshot data URL');
	}

	const buffer = Buffer.from(match[1], 'base64');
	const filename = privateScreenshotFilename(hostId, url);
	return writeScreenshotThumbnail(url, buffer, { overwrite: true, filename });
}

async function writeScreenshotThumbnail(url, buffer, { overwrite = false, filename } = {}) {
	const target = filename || urlToFilename(url);
	const filePath = path.join(SCREENSHOTS_DIR, target);

	if (!overwrite) {
		try {
			await fs.promises.access(filePath);
			return target;
		} catch {
			// File doesn't exist — proceed with write
		}
	}

	await sharp(buffer)
		.resize(400, null, { fit: 'contain', position: 'top' })
		.png()
		.toFile(filePath);

	return target;
}

/**
 * Generate a signed URL for a screenshot file.
 * Uses HMAC-SHA256 with an expiration timestamp. Returns null for legacy
 * ambiguous (bare hash) filenames so they are never served.
 */
export function signScreenshotUrl(filename, expiresInSeconds = 3600) {
    if (!isStoredScreenshotFilename(filename)) return null;
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = `${filename}:${expires}`;
    const sig = crypto.createHmac('sha256', config.screenshotSecret).update(payload).digest('hex');
    return `/api/v1/screenshots/${filename}?expires=${expires}&sig=${sig}`;
}

/**
 * Verify a signed screenshot URL.
 * Returns true if the signature is valid and hasn't expired.
 */
export function verifyScreenshotSignature(filename, expires, sig) {
    if (!filename || !expires || !sig) return false;
    if (!isStoredScreenshotFilename(filename)) return false;

    const now = Math.floor(Date.now() / 1000);
    if (parseInt(expires, 10) < now) return false;

    const payload = `${filename}:${expires}`;
    const expected = crypto.createHmac('sha256', config.screenshotSecret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/**
 * Resolve the absolute file path for a screenshot filename.
 * Returns null for path traversal and for legacy ambiguous (bare hash) names,
 * which predate tenant scoping and may hold a private capture.
 */
export function resolveScreenshotPath(filename) {
    if (!filename || /[\/\\]|\.\./.test(filename)) return null;
    if (!isStoredScreenshotFilename(filename)) return null;
    return path.join(SCREENSHOTS_DIR, filename);
}
