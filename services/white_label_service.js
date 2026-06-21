import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { domainToASCII } from 'node:url';
import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';

import config, { isHostedHostname } from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { createHostname, getHostnameStatus, isCloudflareConfigured } from '../modules/cloudflare_api.js';
import { hasProFeatureAccess } from './subscription_access_service.js';

export const MAX_ASSET_FILE_SIZE = 5 * 1024 * 1024;

const ASSET_CONFIG = {
	logo: {
		field: 'logo',
		label: 'Top navigation logo',
		proOnly: false,
		width: 260,
		height: 48,
		fit: 'inside',
	},
	favicon: {
		field: 'favicon',
		label: 'Favicon',
		proOnly: false,
		width: 64,
		height: 64,
		fit: 'contain',
	},
	login_logo: {
		field: 'login_logo',
		label: 'Login logo',
		proOnly: true,
		width: 500,
		height: 120,
		fit: 'inside',
	},
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'image/avif',
	'image/x-icon',
	'image/vnd.microsoft.icon',
]);

function createHttpError(status, message, code = '') {
	const err = new Error(message);
	err.status = status;
	if (code) err.code = code;
	return err;
}

function cleanString(value) {
	return String(value || '').trim();
}

function cleanDnsName(value) {
	return cleanString(value).toLowerCase().replace(/\.$/, '');
}

function normalizeAsset(asset) {
	if (!asset?.url) return null;
	return {
		url: asset.url,
		mime_type: asset.mime_type || '',
		size: asset.size || 0,
		width: asset.width || 0,
		height: asset.height || 0,
		updated_at: asset.updated_at || null,
	};
}

function getAssetsRoot() {
	return path.resolve(process.cwd(), config.whiteLabel?.assetsDir || 'assets/white-label');
}

function getAssetDir(hostId, kind) {
	return path.join(getAssetsRoot(), String(hostId), kind);
}

function getStorageKey(hostId, kind, fileName) {
	return `${hostId}/${kind}/${fileName}`;
}

function getPublicAssetUrl(storageKey) {
	return `/white-label-assets/${storageKey}`;
}

export function getWhiteLabelAssetsDir() {
	return getAssetsRoot();
}

export function getWhiteLabelTempDir() {
	return path.join(getAssetsRoot(), '_tmp');
}

export async function ensureWhiteLabelTempDir() {
	await fs.mkdir(getWhiteLabelTempDir(), { recursive: true });
	return getWhiteLabelTempDir();
}

export function getCnameTarget() {
	return cleanDnsName(config.whiteLabel?.cnameTarget);
}

export function normalizeCustomDomain(value, options = {}) {
	const allowEmpty = options.allowEmpty !== false;
	let domain = cleanString(value).toLowerCase();
	if (!domain) {
		if (allowEmpty) return '';
		throw createHttpError(400, 'Custom domain is required', 'CUSTOM_DOMAIN_REQUIRED');
	}

	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(domain)) {
		try {
			domain = new URL(domain).hostname;
		} catch {
			throw createHttpError(400, 'Custom domain is invalid', 'CUSTOM_DOMAIN_INVALID');
		}
	} else {
		domain = domain.split('/')[0].split('?')[0].split('#')[0];
		if (domain.includes(':')) domain = domain.split(':')[0];
	}

	domain = cleanDnsName(domain);
	const ascii = domainToASCII(domain);
	if (!ascii || ascii.length > 253 || ascii.includes('*')) {
		throw createHttpError(400, 'Custom domain is invalid', 'CUSTOM_DOMAIN_INVALID');
	}

	const labels = ascii.split('.');
	if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
		throw createHttpError(400, 'Custom domain is invalid', 'CUSTOM_DOMAIN_INVALID');
	}

	if (!options.allowPlatformHost && isHostedHostname(ascii)) {
		throw createHttpError(400, 'Use a domain you own, not a Kumbukum platform hostname', 'CUSTOM_DOMAIN_PLATFORM_HOST');
	}

	return ascii;
}

function canUseProFeature(billingUser, plan, isHosted) {
	return hasProFeatureAccess(billingUser, plan || 'free', isHosted);
}

function assertProFeatureAccess(billingUser, plan, isHosted, message) {
	if (canUseProFeature(billingUser, plan, isHosted)) return;
	throw createHttpError(403, message, 'PLAN_LIMIT');
}

export function serializeWhiteLabelSettings(tenantOrSettings, options = {}) {
	const settings = tenantOrSettings?.settings?.white_label || tenantOrSettings?.white_label || tenantOrSettings || {};
	const canUsePro = Boolean(options.canUsePro);
	const cloudflareConfigured = isCloudflareConfigured();
	return {
		logo: normalizeAsset(settings.logo),
		favicon: normalizeAsset(settings.favicon),
		login_logo: normalizeAsset(settings.login_logo),
		logo_url: settings.logo?.url || '',
		favicon_url: settings.favicon?.url || '',
		login_logo_url: settings.login_logo?.url || '',
		dns_name_custom: settings.dns_name_custom || '',
		dns_verified: Boolean(settings.dns_verified),
		ssl_ready: Boolean(settings.ssl_ready),
		cloudflare_status: settings.cloudflare_status || '',
		cloudflare_ssl_status: settings.cloudflare_ssl_status || '',
		dns_checked_at: settings.dns_checked_at || null,
		cloudflare_checked_at: settings.cloudflare_checked_at || null,
		last_error: settings.last_error || '',
		cname_target: getCnameTarget(),
		cloudflare_configured: cloudflareConfigured,
		can_use_custom_domain: canUsePro,
		can_use_login_logo: canUsePro,
	};
}

export function serializePublicWhiteLabel(settings) {
	const whiteLabel = settings?.settings?.white_label || settings?.white_label || settings || {};
	return {
		logo_url: whiteLabel.logo?.url || '',
		favicon_url: whiteLabel.favicon?.url || '',
		login_logo_url: whiteLabel.login_logo?.url || '',
		dns_name_custom: whiteLabel.dns_name_custom || '',
	};
}

export async function getSettings(hostId, { billingUser = null, isHosted = false } = {}) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan settings.white_label').lean();
	if (!tenant) throw createHttpError(404, 'Account not found', 'TENANT_NOT_FOUND');
	return serializeWhiteLabelSettings(tenant, {
		canUsePro: canUseProFeature(billingUser, tenant.plan || 'free', isHosted),
	});
}

export async function getPublicSettingsForHost(hostId) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('settings.white_label').lean();
	if (!tenant) return serializePublicWhiteLabel({});
	return serializePublicWhiteLabel(tenant);
}

export async function updateSettings(hostId, payload = {}, { billingUser = null, isHosted = false } = {}) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan settings.white_label').lean();
	if (!tenant) throw createHttpError(404, 'Account not found', 'TENANT_NOT_FOUND');

	const updates = {};
	if (Object.hasOwn(payload, 'dns_name_custom')) {
		assertProFeatureAccess(billingUser, tenant.plan || 'free', isHosted, 'Custom domains are available on the Pro plan');
		const domain = normalizeCustomDomain(payload.dns_name_custom, { allowEmpty: true });
		updates['settings.white_label.dns_name_custom'] = domain;
		updates['settings.white_label.dns_verified'] = false;
		updates['settings.white_label.ssl_ready'] = false;
		updates['settings.white_label.cloudflare_custom_hostname_id'] = '';
		updates['settings.white_label.cloudflare_status'] = '';
		updates['settings.white_label.cloudflare_ssl_status'] = '';
		updates['settings.white_label.last_error'] = '';
	}

	if (!Object.keys(updates).length) {
		return getSettings(hostId, { billingUser, isHosted });
	}

	try {
		const updated = await Tenant.findOneAndUpdate(
			{ host_id: hostId },
			{ $set: updates },
			{ new: true },
		).select('plan settings.white_label').lean();
		return serializeWhiteLabelSettings(updated, {
			canUsePro: canUseProFeature(billingUser, updated?.plan || tenant.plan || 'free', isHosted),
		});
	} catch (err) {
		if (err?.code === 11000) {
			throw createHttpError(409, 'That custom domain is already mapped to another account', 'CUSTOM_DOMAIN_CONFLICT');
		}
		throw err;
	}
}

async function assertAssetUploadAllowed(hostId, kind, billingUser, isHosted) {
	const assetConfig = ASSET_CONFIG[kind];
	if (!assetConfig) throw createHttpError(404, 'White-label asset type not found', 'ASSET_KIND_NOT_FOUND');
	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan').lean();
	if (!tenant) throw createHttpError(404, 'Account not found', 'TENANT_NOT_FOUND');
	if (assetConfig.proOnly) {
		assertProFeatureAccess(billingUser, tenant.plan || 'free', isHosted, `${assetConfig.label} is available on the Pro plan`);
	}
	return tenant;
}

async function detectAllowedImage(filePath) {
	const detected = await fileTypeFromFile(filePath).catch(() => null);
	if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
		throw createHttpError(400, 'Upload a PNG, JPG, WebP, AVIF, GIF, or ICO image', 'ASSET_TYPE_INVALID');
	}
	return detected;
}

export async function uploadAsset(hostId, kind, file, { billingUser = null, isHosted = false } = {}) {
	const tenant = await assertAssetUploadAllowed(hostId, kind, billingUser, isHosted);
	const assetConfig = ASSET_CONFIG[kind];
	const filePath = file?.filepath || file?.path;
	if (!filePath) throw createHttpError(400, 'No file uploaded', 'ASSET_REQUIRED');
	if (file.size > MAX_ASSET_FILE_SIZE) throw createHttpError(400, 'White-label assets must be 5 MB or smaller', 'ASSET_TOO_LARGE');

	await detectAllowedImage(filePath);

	const fileName = `${kind}-${Date.now()}-${crypto.randomUUID()}.png`;
	const tempDir = await ensureWhiteLabelTempDir();
	const tempOutputPath = path.join(tempDir, fileName);
	const assetDir = getAssetDir(hostId, kind);
	const outputPath = path.join(assetDir, fileName);

	try {
		await sharp(filePath, { pages: 1, animated: false })
			.resize({
				width: assetConfig.width,
				height: assetConfig.height,
				fit: assetConfig.fit,
				withoutEnlargement: true,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toFile(tempOutputPath);
	} catch {
		throw createHttpError(400, 'Uploaded image could not be processed', 'ASSET_PROCESS_FAILED');
	}

	const metadata = await sharp(tempOutputPath).metadata();
	const stat = await fs.stat(tempOutputPath);
	await fs.rm(assetDir, { recursive: true, force: true });
	await fs.mkdir(assetDir, { recursive: true });
	await fs.rename(tempOutputPath, outputPath);
	const storageKey = getStorageKey(hostId, kind, fileName);
	const asset = {
		url: getPublicAssetUrl(storageKey),
		storage_key: storageKey,
		mime_type: 'image/png',
		size: stat.size,
		width: metadata.width || 0,
		height: metadata.height || 0,
		updated_at: new Date(),
	};

	const updated = await Tenant.findOneAndUpdate(
		{ host_id: hostId },
		{ $set: { [`settings.white_label.${assetConfig.field}`]: asset } },
		{ new: true },
	).select('plan settings.white_label').lean();

	return serializeWhiteLabelSettings(updated, {
		canUsePro: canUseProFeature(billingUser, updated?.plan || tenant.plan || 'free', isHosted),
	});
}

export async function deleteAsset(hostId, kind, { billingUser = null, isHosted = false } = {}) {
	const tenant = await assertAssetUploadAllowed(hostId, kind, billingUser, isHosted);
	const assetConfig = ASSET_CONFIG[kind];
	await fs.rm(getAssetDir(hostId, kind), { recursive: true, force: true });
	const updated = await Tenant.findOneAndUpdate(
		{ host_id: hostId },
		{ $set: { [`settings.white_label.${assetConfig.field}`]: null } },
		{ new: true },
	).select('plan settings.white_label').lean();
	return serializeWhiteLabelSettings(updated, {
		canUsePro: canUseProFeature(billingUser, updated?.plan || tenant.plan || 'free', isHosted),
	});
}

export async function verifyCname(domain) {
	const target = getCnameTarget();
	if (!target) throw createHttpError(400, 'White-label CNAME target is not configured', 'CNAME_TARGET_NOT_CONFIGURED');
	const records = await dns.resolveCname(domain).catch(() => []);
	const normalizedRecords = records.map(cleanDnsName);
	const verified = normalizedRecords.includes(target);
	return {
		verified,
		target,
		records: normalizedRecords,
	};
}

function cloudflareStatusPayload(result) {
	const hostnameStatus = result?.status || '';
	const sslStatus = result?.ssl?.status || '';
	return {
		cloudflare_custom_hostname_id: result?.id || '',
		cloudflare_status: hostnameStatus,
		cloudflare_ssl_status: sslStatus,
		ssl_ready: hostnameStatus === 'active' && sslStatus === 'active',
	};
}

async function updateDomainStatus(hostId, updates) {
	const setUpdates = {};
	for (const [key, value] of Object.entries(updates)) {
		setUpdates[`settings.white_label.${key}`] = value;
	}
	const tenant = await Tenant.findOneAndUpdate(
		{ host_id: hostId },
		{ $set: setUpdates },
		{ new: true },
	).select('plan settings.white_label').lean();
	return tenant;
}

export async function verifyDomain(hostId, { billingUser = null, isHosted = false } = {}) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan settings.white_label').lean();
	if (!tenant) throw createHttpError(404, 'Account not found', 'TENANT_NOT_FOUND');
	assertProFeatureAccess(billingUser, tenant.plan || 'free', isHosted, 'Custom domains are available on the Pro plan');

	const domain = normalizeCustomDomain(tenant.settings?.white_label?.dns_name_custom, { allowEmpty: false });
	const dnsResult = await verifyCname(domain);
	if (!dnsResult.verified) {
		const updated = await updateDomainStatus(hostId, {
			dns_verified: false,
			ssl_ready: false,
			dns_checked_at: new Date(),
			last_error: `CNAME must point to ${dnsResult.target}`,
		});
		const err = createHttpError(400, `CNAME must point to ${dnsResult.target}`, 'CNAME_NOT_VERIFIED');
		err.details = { expected: dnsResult.target, records: dnsResult.records };
		err.settings = serializeWhiteLabelSettings(updated, {
			canUsePro: canUseProFeature(billingUser, updated?.plan || tenant.plan || 'free', isHosted),
		});
		throw err;
	}

	if (!isCloudflareConfigured()) {
		const updated = await updateDomainStatus(hostId, {
			dns_verified: true,
			dns_checked_at: new Date(),
			last_error: 'Cloudflare custom hostname provisioning is not configured',
		});
		const err = createHttpError(400, 'Cloudflare custom hostname provisioning is not configured', 'CLOUDFLARE_NOT_CONFIGURED');
		err.settings = serializeWhiteLabelSettings(updated, {
			canUsePro: canUseProFeature(billingUser, updated?.plan || tenant.plan || 'free', isHosted),
		});
		throw err;
	}

	const existingId = tenant.settings?.white_label?.cloudflare_custom_hostname_id || '';
	const result = existingId
		? await getHostnameStatus(existingId)
		: await createHostname(domain, { metadata: { host_id: hostId } });
	const statusPayload = cloudflareStatusPayload(result);
	const updated = await updateDomainStatus(hostId, {
		dns_verified: true,
		dns_checked_at: new Date(),
		cloudflare_checked_at: new Date(),
		last_error: '',
		...statusPayload,
	});
	return serializeWhiteLabelSettings(updated, {
		canUsePro: canUseProFeature(billingUser, updated?.plan || tenant.plan || 'free', isHosted),
	});
}

export async function refreshDomain(hostId, { billingUser = null, isHosted = false } = {}) {
	const tenant = await Tenant.findOne({ host_id: hostId }).select('plan settings.white_label').lean();
	if (!tenant) throw createHttpError(404, 'Account not found', 'TENANT_NOT_FOUND');
	assertProFeatureAccess(billingUser, tenant.plan || 'free', isHosted, 'Custom domains are available on the Pro plan');

	const customHostnameId = tenant.settings?.white_label?.cloudflare_custom_hostname_id || '';
	if (!customHostnameId) {
		return verifyDomain(hostId, { billingUser, isHosted });
	}
	if (!isCloudflareConfigured()) throw createHttpError(400, 'Cloudflare custom hostname provisioning is not configured', 'CLOUDFLARE_NOT_CONFIGURED');

	const result = await getHostnameStatus(customHostnameId);
	const updated = await updateDomainStatus(hostId, {
		cloudflare_checked_at: new Date(),
		last_error: '',
		...cloudflareStatusPayload(result),
	});
	return serializeWhiteLabelSettings(updated, {
		canUsePro: canUseProFeature(billingUser, updated?.plan || tenant.plan || 'free', isHosted),
	});
}

export function normalizeRequestHostname(req) {
	const forwarded = cleanString(req.headers?.['x-forwarded-host']).split(',')[0].trim();
	const rawHost = forwarded || req.headers?.host || req.hostname || '';
	return cleanDnsName(String(rawHost).split(':')[0]);
}

function isLocalHostname(hostname) {
	return hostname === 'localhost'
		|| hostname === '127.0.0.1'
		|| hostname === '::1'
		|| hostname.endsWith('.localhost')
		|| hostname.endsWith('.lan')
		|| hostname.endsWith('.local');
}

export function shouldResolveWhiteLabelHost(hostname) {
	if (!hostname) return false;
	if (!hostname.includes('.')) return false;
	if (isLocalHostname(hostname)) return false;
	if (isHostedHostname(hostname)) return false;
	return true;
}

export async function findTenantByCustomDomain(hostname) {
	const domain = normalizeCustomDomain(hostname, { allowEmpty: false, allowPlatformHost: true });
	return Tenant.findOne({
		is_active: { $ne: false },
		'settings.white_label.dns_name_custom': domain,
		'settings.white_label.dns_verified': true,
		'settings.white_label.ssl_ready': true,
	}).select('name host_id settings.white_label').lean();
}

export async function resolveWhiteLabelRequest(req, res, next) {
	try {
		const hostname = normalizeRequestHostname(req);
		res.locals.white_label = null;
		req.whiteLabelHostId = '';
		req.whiteLabel = null;

		if (!shouldResolveWhiteLabelHost(hostname)) return next();

		const tenant = await findTenantByCustomDomain(hostname);
		if (tenant) {
			req.whiteLabelHostId = tenant.host_id;
			req.whiteLabel = serializePublicWhiteLabel(tenant);
			res.locals.white_label = req.whiteLabel;
			return next();
		}

		if (config.whiteLabel?.enforceCustomDomains) {
			if (req.accepts('html')) return res.status(403).send('Custom domain is not configured.');
			return res.status(403).json({ error: 'Custom domain is not configured' });
		}

		return next();
	} catch (err) {
		return next(err);
	}
}
