import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { TenantMember } from '../model/tenant_member.js';

async function createServer() {
	const { default: apiRoutes } = await import(`../routes/api.js?team_limit_test=${Date.now()}_${Math.random()}`);
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

async function request(server, method, path, body) {
	const { port } = server.address();
	return fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
}

describe('Free plan team user limit', () => {
	const originalAppUrl = config.appUrl;
	const originalIsHosted = config.isHosted;
	const originalUserFindById = User.findById;
	const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
	const originalTenantFindOne = Tenant.findOne;
	const originalUserFindOne = User.findOne;
	const originalTenantMemberFind = TenantMember.find;
	const originalTenantMemberFindOne = TenantMember.findOne;
	const originalTenantMemberFindOneAndUpdate = TenantMember.findOneAndUpdate;
	const originalTenantMemberCount = TenantMember.countDocuments;
	let tenant;
	let memberCount;

	beforeEach(() => {
		config.appUrl = 'https://app.kumbukum.com';
		config.isHosted = true;
		memberCount = 5;
		tenant = {
			_id: { toString: () => '507f1f77bcf86cd799439012' },
			host_id: 'host-1',
			name: 'Test Account',
			is_active: true,
			plan: 'free',
		};

		User.findById = () => ({
			select: async () => ({
				_id: { toString: () => '507f1f77bcf86cd799439011' },
				tenant: tenant._id,
				host_id: tenant.host_id,
				subscription_status: 'incomplete',
				trial_source: null,
				trial_ends_at: null,
			}),
		});
		TenantMember.find = () => ({
			populate: () => ({
				lean: async () => [{ _id: { toString: () => 'membership-1' }, role: 'owner', tenant }],
			}),
		});
		User.findByIdAndUpdate = async () => null;
		// When the quota guard passes, createTeamMember runs; make it fail fast
		// with "email already exists" instead of hitting the real DB.
		User.findOne = () => ({ lean: async () => ({ _id: { toString: () => 'existing-user' } }) });
		TenantMember.findOne = () => ({ lean: async () => null });
		TenantMember.findOneAndUpdate = async () => null;
		TenantMember.countDocuments = async () => memberCount;
		Tenant.findOne = () => ({
			select: (fields) => ({ lean: async () => (fields.includes('plan') ? { plan: tenant.plan } : tenant) }),
		});
	});

	afterEach(() => {
		config.appUrl = originalAppUrl;
		config.isHosted = originalIsHosted;
		User.findById = originalUserFindById;
		User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
		User.findOne = originalUserFindOne;
		Tenant.findOne = originalTenantFindOne;
		TenantMember.find = originalTenantMemberFind;
		TenantMember.findOne = originalTenantMemberFindOne;
		TenantMember.findOneAndUpdate = originalTenantMemberFindOneAndUpdate;
		TenantMember.countDocuments = originalTenantMemberCount;
	});

	it('blocks adding a 6th user on Free with an upgrade-worthy message', async () => {
		const server = await createServer();
		try {
			const res = await request(server, 'POST', '/team/members', {
				name: 'New User', email: 'new@example.com', password: 'password123',
			});
			const json = await res.json();
			assert.equal(res.status, 403);
			assert.equal(json.code, 'PLAN_LIMIT');
			assert.equal(json.limit, 'users');
			assert.match(json.error, /5 users/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('allows adding a user when under the Free limit (quota guard passes)', async () => {
		memberCount = 3;
		const server = await createServer();
		try {
			// Quota passes → createTeamMember runs and fails fast on the mocked
			// existing-email check (400), proving it was NOT blocked by PLAN_LIMIT.
			const res = await request(server, 'POST', '/team/members', {
				name: 'New User', email: 'new@example.com', password: 'password123',
			});
			const json = await res.json();
			assert.equal(res.status, 400);
			assert.notEqual(json.code, 'PLAN_LIMIT');
			assert.match(json.error, /already/i);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
