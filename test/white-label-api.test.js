import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { TenantMember } from '../model/tenant_member.js';

function setPath(obj, key, value) {
	const parts = key.split('.');
	let target = obj;
	for (const part of parts.slice(0, -1)) {
		target[part] ||= {};
		target = target[part];
	}
	target[parts.at(-1)] = value;
}

async function createServer() {
	const { default: apiRoutes } = await import(`../routes/api.js?white_label_api_test=${Date.now()}_${Math.random()}`);
	const app = express();
	app.use(express.json());
	app.use((req, res, next) => {
		req.session = {
			userId: '507f1f77bcf86cd799439011',
			tenantId: '507f1f77bcf86cd799439012',
			host_id: 'host-1',
		};
		req.isHosted = config.isHosted;
		next();
	});
	app.use('/api/v1', apiRoutes);
	return app.listen(0);
}

async function request(server, method, route, body) {
	const { port } = server.address();
	return fetch(`http://127.0.0.1:${port}/api/v1${route}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
}

describe('White-label API', () => {
	const originalAppUrl = config.appUrl;
	const originalIsHosted = config.isHosted;
	const originalWhiteLabelConfig = { ...config.whiteLabel, cloudflare: { ...config.whiteLabel.cloudflare } };
	const originalUserFindById = User.findById;
	const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
	const originalTenantFindOne = Tenant.findOne;
	const originalTenantFindOneAndUpdate = Tenant.findOneAndUpdate;
	const originalTenantMemberFind = TenantMember.find;
	const originalTenantMemberFindOneAndUpdate = TenantMember.findOneAndUpdate;
	let tenant;
	let memberRole;

	beforeEach(() => {
		config.appUrl = 'https://app.kumbukum.com';
		config.isHosted = true;
		config.whiteLabel.cnameTarget = 'app.kumbukum.com';
		config.whiteLabel.cloudflare = { apiToken: '', zoneId: '' };
		memberRole = 'owner';
		tenant = {
			_id: { toString: () => '507f1f77bcf86cd799439012' },
			host_id: 'host-1',
			name: 'Test Account',
			is_active: true,
			owner: '507f1f77bcf86cd799439011',
			plan: 'free',
			settings: {
				white_label: {
					dns_name_custom: '',
					dns_verified: false,
					ssl_ready: false,
				},
			},
		};

		User.findById = () => ({
			select: async () => ({
				_id: { toString: () => '507f1f77bcf86cd799439011' },
				tenant: tenant._id,
				host_id: tenant.host_id,
				subscription_status: 'incomplete',
				trial_source: '',
				trial_ends_at: null,
			}),
		});
		User.findByIdAndUpdate = async () => null;
		TenantMember.findOneAndUpdate = async () => null;
		TenantMember.find = () => ({
			populate: () => ({
				lean: async () => [{
					_id: { toString: () => 'membership-1' },
					role: memberRole,
					tenant,
				}],
			}),
		});
		Tenant.findOne = () => ({
			select: () => ({
				lean: async () => tenant,
			}),
		});
		Tenant.findOneAndUpdate = (query, update) => {
			for (const [key, value] of Object.entries(update.$set || {})) {
				setPath(tenant, key, value);
			}
			return {
				select: () => ({
					lean: async () => tenant,
				}),
			};
		};
	});

	afterEach(() => {
		config.appUrl = originalAppUrl;
		config.isHosted = originalIsHosted;
		config.whiteLabel = { ...originalWhiteLabelConfig, cloudflare: { ...originalWhiteLabelConfig.cloudflare } };
		User.findById = originalUserFindById;
		User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
		Tenant.findOne = originalTenantFindOne;
		Tenant.findOneAndUpdate = originalTenantFindOneAndUpdate;
		TenantMember.find = originalTenantMemberFind;
		TenantMember.findOneAndUpdate = originalTenantMemberFindOneAndUpdate;
	});

	it('lets Free account admins load white-label settings without domain access', async () => {
		const server = await createServer();
		try {
			const response = await request(server, 'GET', '/settings/white-label');
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.equal(json.settings.can_use_custom_domain, false);
			assert.equal(json.settings.can_use_login_logo, false);
			assert.equal(json.settings.cname_target, 'app.kumbukum.com');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('blocks Free accounts from setting a custom domain', async () => {
		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/settings/white-label', {
				dns_name_custom: 'brand.example.com',
			});
			const json = await response.json();

			assert.equal(response.status, 403);
			assert.equal(json.code, 'PLAN_LIMIT');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('lets Pro account admins save a normalized custom domain without Cloudflare config', async () => {
		tenant.plan = 'pro';
		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/settings/white-label', {
				dns_name_custom: 'https://Brand.Example.com/login',
			});
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.equal(json.settings.dns_name_custom, 'brand.example.com');
			assert.equal(json.settings.dns_verified, false);
			assert.equal(json.settings.cloudflare_configured, false);
			assert.equal(json.settings.can_use_custom_domain, true);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('blocks non-admin account members', async () => {
		memberRole = 'member';
		const server = await createServer();
		try {
			const response = await request(server, 'GET', '/settings/white-label');
			const json = await response.json();

			assert.equal(response.status, 403);
			assert.match(json.error, /Account admin/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
