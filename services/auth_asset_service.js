import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRedisClient } from '../modules/redis.js';
import { createLogger } from '../modules/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_ASSET_DIR = path.resolve(__dirname, '..', 'assets', 'auth');
const AUTH_BACKGROUND_DIR = path.resolve(__dirname, '..', 'public', 'images', 'auth', 'backgrounds');
const MANIFEST_KEY = 'auth-assets:v1:manifest';
const BODY_KEY_PREFIX = 'auth-assets:v1:body:';
const META_KEY_PREFIX = 'auth-assets:v1:meta:';
const BACKGROUND_MANIFEST_KEY = 'auth-backgrounds:v1:manifest';
const MAX_ASSET_SIZE = 8 * 1024 * 1024;
const log = createLogger('auth-assets');

const MIME_BY_EXTENSION = new Map([
	['.avif', 'image/avif'],
	['.webp', 'image/webp'],
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.png', 'image/png'],
	['.gif', 'image/gif'],
]);

const FORMAT_PRIORITY = [
	{ ext: '.avif', accept: 'image/avif' },
	{ ext: '.webp', accept: 'image/webp' },
	{ ext: '.jpg', accept: 'image/jpeg' },
	{ ext: '.jpeg', accept: 'image/jpeg' },
	{ ext: '.png', accept: 'image/png' },
	{ ext: '.gif', accept: 'image/gif' },
];

let inMemoryManifest = [];
let inMemoryBackgroundManifest = [];

function isSafeAssetName(name = '') {
	return /^[a-z0-9][a-z0-9._-]*$/i.test(String(name || ''));
}

function assetBaseName(filename = '') {
	return path.basename(filename, path.extname(filename)).toLowerCase();
}

function bodyKey(filename) {
	return `${BODY_KEY_PREFIX}${filename}`;
}

function metaKey(filename) {
	return `${META_KEY_PREFIX}${filename}`;
}

function acceptsFormat(acceptHeader = '', mimeType = '') {
	if (!acceptHeader || acceptHeader.includes('*/*') || acceptHeader.includes('image/*')) return true;
	return acceptHeader.includes(mimeType);
}

export function selectAuthAssetName(requestedName = '', acceptHeader = '', manifest = inMemoryManifest) {
	const rawName = String(requestedName || '');
	if (rawName.includes('/') || rawName.includes('\\')) return null;
	const name = path.basename(rawName);
	if (!isSafeAssetName(name)) return null;

	const exact = manifest.find((item) => item.filename === name);
	if (exact) return exact.filename;

	if (path.extname(name)) return null;

	const base = name.toLowerCase();
	const candidates = manifest.filter((item) => item.base === base);
	if (!candidates.length) return null;

	for (const format of FORMAT_PRIORITY) {
		if (!acceptsFormat(acceptHeader, MIME_BY_EXTENSION.get(format.ext))) continue;
		const candidate = candidates.find((item) => item.ext === format.ext);
		if (candidate) return candidate.filename;
	}

	return candidates[0].filename;
}

export function getAuthAssetUrl(name = 'login-cover') {
	return selectAuthAssetName(name, '') ? `/auth-assets/${encodeURIComponent(name)}` : '';
}

export function selectRandomAuthBackground(manifest = inMemoryBackgroundManifest, random = Math.random) {
	if (!Array.isArray(manifest) || !manifest.length) return null;
	const index = Math.min(manifest.length - 1, Math.floor(Math.max(0, random()) * manifest.length));
	return manifest[index]?.filename || null;
}

export function getRandomAuthBackgroundUrl(buildId = '', random = Math.random) {
	const filename = selectRandomAuthBackground(inMemoryBackgroundManifest, random);
	if (!filename) return '';
	const staticPrefix = buildId ? `/static/v-${encodeURIComponent(buildId)}` : '/static';
	return `${staticPrefix}/images/auth/backgrounds/${encodeURIComponent(filename)}`;
}

async function readManifest(client = getRedisClient()) {
	try {
		const raw = await client.get(MANIFEST_KEY);
		if (!raw) return inMemoryManifest;
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return inMemoryManifest;
		inMemoryManifest = parsed;
		return inMemoryManifest;
	} catch {
		return inMemoryManifest;
	}
}

async function readAssetFromDisk(filename) {
	const safeName = path.basename(filename);
	if (!isSafeAssetName(safeName)) return null;
	const ext = path.extname(safeName).toLowerCase();
	const mimeType = MIME_BY_EXTENSION.get(ext);
	if (!mimeType) return null;

	const filePath = path.resolve(AUTH_ASSET_DIR, safeName);
	if (!filePath.startsWith(`${AUTH_ASSET_DIR}${path.sep}`)) return null;
	const buffer = await fs.readFile(filePath);
	if (!buffer.length || buffer.length > MAX_ASSET_SIZE) return null;
	const hash = crypto.createHash('sha256').update(buffer).digest('hex');

	return {
		buffer,
		meta: {
			filename: safeName,
			base: assetBaseName(safeName),
			ext,
			mime_type: mimeType,
			size: buffer.length,
			hash,
		},
	};
}

async function readAsset(client, filename, manifest) {
	const meta = manifest.find((item) => item.filename === filename);
	if (meta) {
		try {
			const raw = await client.get(bodyKey(filename));
			if (raw) return { buffer: Buffer.from(raw, 'base64'), meta };
		} catch {
			// fall through to disk fallback
		}
	}

	return readAssetFromDisk(filename).catch(() => null);
}

export async function preloadAuthAssets() {
	const client = getRedisClient();
	await fs.mkdir(AUTH_ASSET_DIR, { recursive: true });

	const entries = await fs.readdir(AUTH_ASSET_DIR, { withFileTypes: true });
	const manifest = [];

	for (const entry of entries) {
		if (!entry.isFile() || !isSafeAssetName(entry.name)) continue;

		const ext = path.extname(entry.name).toLowerCase();
		const mimeType = MIME_BY_EXTENSION.get(ext);
		if (!mimeType) continue;

		const asset = await readAssetFromDisk(entry.name);
		if (!asset) continue;

		await client.set(bodyKey(entry.name), asset.buffer.toString('base64'));
		await client.set(metaKey(entry.name), JSON.stringify(asset.meta));
		manifest.push(asset.meta);
	}

	manifest.sort((a, b) => a.filename.localeCompare(b.filename));
	inMemoryManifest = manifest;
	await client.set(MANIFEST_KEY, JSON.stringify(manifest));

	if (manifest.length) {
		log.info({ assets: manifest.map((item) => item.filename).join(', ') }, 'Auth assets preloaded into Redis');
	} else {
		log.info({ path: path.relative(path.resolve(__dirname, '..'), AUTH_ASSET_DIR) }, 'Auth assets preloaded into Redis: none found');
	}

	return manifest;
}

export async function preloadAuthBackgrounds() {
	await fs.mkdir(AUTH_BACKGROUND_DIR, { recursive: true });

	const entries = await fs.readdir(AUTH_BACKGROUND_DIR, { withFileTypes: true });
	const manifest = [];

	for (const entry of entries) {
		if (!entry.isFile()) continue;

		const ext = path.extname(entry.name).toLowerCase();
		if (ext !== '.webp') continue;

		const filePath = path.resolve(AUTH_BACKGROUND_DIR, entry.name);
		if (!filePath.startsWith(`${AUTH_BACKGROUND_DIR}${path.sep}`)) continue;

		const buffer = await fs.readFile(filePath);
		if (!buffer.length) continue;

		manifest.push({
			filename: entry.name,
			ext,
			size: buffer.length,
			hash: crypto.createHash('sha256').update(buffer).digest('hex'),
		});
	}

	manifest.sort((a, b) => a.filename.localeCompare(b.filename));
	inMemoryBackgroundManifest = manifest;

	try {
		await getRedisClient().set(BACKGROUND_MANIFEST_KEY, JSON.stringify(manifest));
	} catch {
		// Static background files still work if Redis is temporarily unavailable.
	}

	log.info({ count: manifest.length }, 'Auth background images cached in Redis');
	return manifest;
}

export async function serveAuthAsset(req, res) {
	const client = getRedisClient();
	const manifest = await readManifest(client);
	const filename = selectAuthAssetName(req.params.name, req.headers.accept || '', manifest);
	if (!filename) return res.sendStatus(404);

	const asset = await readAsset(client, filename, manifest);
	if (!asset) return res.sendStatus(404);

	const etag = `"${asset.meta.hash}"`;
	res.setHeader('Content-Type', asset.meta.mime_type);
	res.setHeader('Content-Length', String(asset.buffer.length));
	res.setHeader('ETag', etag);
	res.setHeader('Cache-Control', process.env.NODE_ENV === 'production' ? 'public, max-age=300, stale-while-revalidate=86400' : 'no-store');

	if (req.headers['if-none-match'] === etag) return res.status(304).end();
	return res.send(asset.buffer);
}
