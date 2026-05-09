import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
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

/**
 * Call the screenshot service and return the image buffer, or null on failure.
 */
export async function captureScreenshot(url) {
    if (!config.screenshotUrl) return null;

    const response = await axios.post(config.screenshotUrl, { url }, {
        responseType: 'arraybuffer',
        timeout: 30000,
    });
    return Buffer.from(response.data);
}

/**
 * Save a screenshot for the given URL.
 * Returns the filename (hash.png) if successful, null otherwise.
 * Cross-tenant dedup: if the file already exists on disk, skip capture.
 */
export async function saveScreenshot(url) {
    if (!config.screenshotUrl) return null;

    const filename = urlToFilename(url);
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

	return writeScreenshotThumbnail(url, buffer, { overwrite: false });
}

/**
 * Save a client-provided screenshot data URL for the given URL.
 * Used by browser extensions when the logged-in user's session can see paywalled pages.
 */
export async function saveScreenshotDataUrl(url, dataUrl) {
	if (!dataUrl) return null;

	const match = String(dataUrl).match(/^data:image\/(?:png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i);
	if (!match) {
		throw new Error('Invalid screenshot data URL');
	}

	const buffer = Buffer.from(match[1], 'base64');
	return writeScreenshotThumbnail(url, buffer, { overwrite: true });
}

async function writeScreenshotThumbnail(url, buffer, { overwrite = false } = {}) {
	const filename = urlToFilename(url);
	const filePath = path.join(SCREENSHOTS_DIR, filename);

	if (!overwrite) {
		try {
			await fs.promises.access(filePath);
			return filename;
		} catch {
			// File doesn't exist — proceed with write
		}
	}

	await sharp(buffer)
		.resize(400, null, { fit: 'contain', position: 'top' })
		.png()
		.toFile(filePath);

	return filename;
}

/**
 * Generate a signed URL for a screenshot file.
 * Uses HMAC-SHA256 with an expiration timestamp.
 */
export function signScreenshotUrl(filename, expiresInSeconds = 3600) {
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

    const now = Math.floor(Date.now() / 1000);
    if (parseInt(expires, 10) < now) return false;

    const payload = `${filename}:${expires}`;
    const expected = crypto.createHmac('sha256', config.screenshotSecret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/**
 * Resolve the absolute file path for a screenshot filename.
 * Returns null if the filename contains path traversal characters.
 */
export function resolveScreenshotPath(filename) {
    if (!filename || /[\/\\]|\.\./.test(filename)) return null;
    if (!/^[a-f0-9]{64}\.png$/.test(filename)) return null;
    return path.join(SCREENSHOTS_DIR, filename);
}
