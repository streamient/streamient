import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import sharp from 'sharp';

import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import * as whiteLabelService from '../services/white_label_service.js';

function setPath(obj, key, value) {
	const parts = key.split('.');
	let target = obj;
	for (const part of parts.slice(0, -1)) {
		target[part] ||= {};
		target = target[part];
	}
	target[parts.at(-1)] = value;
}

function tenantQuery(tenant) {
	return {
		select: () => ({
			lean: async () => tenant,
		}),
	};
}

describe('white-label service', () => {
	const originalTenantFindOne = Tenant.findOne;
	const originalTenantFindOneAndUpdate = Tenant.findOneAndUpdate;
	const originalWhiteLabelConfig = { ...config.whiteLabel, cloudflare: { ...config.whiteLabel.cloudflare } };
	const originalResolveCname = dns.resolveCname;
	let tenant;
	let tempDir;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streamient-wl-'));
		config.whiteLabel.assetsDir = path.join(tempDir, 'assets');
		config.whiteLabel.cnameTarget = 'app.streamient.com';
		config.whiteLabel.cloudflare = { apiToken: '', zoneId: '' };
		tenant = {
			_id: 'tenant-1',
			host_id: 'host-1',
			plan: 'free',
			settings: {
				white_label: {
					dns_name_custom: '',
					dns_verified: false,
					ssl_ready: false,
				},
			},
		};

		Tenant.findOne = () => tenantQuery(tenant);
		Tenant.findOneAndUpdate = (query, update) => {
			for (const [key, value] of Object.entries(update.$set || {})) {
				setPath(tenant, key, value);
			}
			return tenantQuery(tenant);
		};
	});

	afterEach(async () => {
		Tenant.findOne = originalTenantFindOne;
		Tenant.findOneAndUpdate = originalTenantFindOneAndUpdate;
		dns.resolveCname = originalResolveCname;
		config.whiteLabel = { ...originalWhiteLabelConfig, cloudflare: { ...originalWhiteLabelConfig.cloudflare } };
		if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
	});

	it('normalizes custom domains and rejects platform hostnames', () => {
		assert.equal(whiteLabelService.normalizeCustomDomain('https://Brand.Example.com/login'), 'brand.example.com');
		assert.throws(
			() => whiteLabelService.normalizeCustomDomain('app.streamient.com'),
			/Use a domain you own/,
		);
	});

	it('does not treat Docker service hostnames as custom domains', () => {
		assert.equal(whiteLabelService.shouldResolveWhiteLabelHost('app'), false);
		assert.equal(whiteLabelService.shouldResolveWhiteLabelHost('streamient-app-1'), false);
		assert.equal(whiteLabelService.shouldResolveWhiteLabelHost('brand.example.com'), true);
	});

	it('allows Free accounts to upload top navigation logo but not login logo', async () => {
		const source = path.join(tempDir, 'source.png');
		await sharp({
			create: {
				width: 260,
				height: 48,
				channels: 4,
				background: { r: 20, g: 40, b: 80, alpha: 1 },
			},
		}).png().toFile(source);

		const sourceSize = (await fs.stat(source)).size;
		const settings = await whiteLabelService.uploadAsset('host-1', 'logo', {
			filepath: source,
			size: sourceSize,
		}, {
			billingUser: null,
			isHosted: true,
		});

		assert.match(settings.logo_url, /^\/white-label-assets\/host-1\/logo\//);
		assert.equal(settings.logo.mime_type, 'image/png');

		await assert.rejects(
			() => whiteLabelService.uploadAsset('host-1', 'login_logo', {
				filepath: source,
				size: sourceSize,
			}, {
				billingUser: null,
				isHosted: true,
			}),
			/login logo is available on the Pro plan/i,
		);
	});

	it('returns a clear error when CNAME passes but Cloudflare env is missing', async () => {
		tenant.plan = 'pro';
		tenant.settings.white_label.dns_name_custom = 'brand.example.com';
		dns.resolveCname = async () => ['app.streamient.com.'];

		await assert.rejects(
			() => whiteLabelService.verifyDomain('host-1', { billingUser: null, isHosted: true }),
			(err) => {
				assert.equal(err.code, 'CLOUDFLARE_NOT_CONFIGURED');
				assert.equal(err.status, 400);
				assert.equal(tenant.settings.white_label.dns_verified, true);
				return true;
			},
		);
	});
});
