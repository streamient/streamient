import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { Project } from '../model/project.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { TenantMember } from '../model/tenant_member.js';

async function createServer() {
	const { default: apiRoutes } = await import(`../routes/api.js?project_limit_test=${Date.now()}_${Math.random()}`);
	const app = express();
	app.use(express.json());
	app.use((req, _res, next) => {
		req.session = {
			userId: '507f1f77bcf86cd799439011',
			tenantId: '507f1f77bcf86cd799439012',
			host_id: 'host-1',
		};
		req.isHosted = true;
		next();
	});
	app.use('/api/v1', apiRoutes);
	return app.listen(0);
}

async function createProject(server) {
	const { port } = server.address();
	return fetch(`http://127.0.0.1:${port}/api/v1/projects`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name: 'Second project' }),
	});
}

describe('stored account project limit', () => {
	const originalAppUrl = config.appUrl;
	const originalUserFindById = User.findById;
	const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
	const originalTenantFindOne = Tenant.findOne;
	const originalTenantMemberFind = TenantMember.find;
	const originalTenantMemberFindOneAndUpdate = TenantMember.findOneAndUpdate;
	const originalProjectCountDocuments = Project.countDocuments;
	let tenant;

	beforeEach(() => {
		config.appUrl = 'https://app.streamient.com';
		tenant = {
			_id: { toString: () => '507f1f77bcf86cd799439012' },
			host_id: 'host-1',
			name: 'Test Account',
			is_active: true,
			owner: '507f1f77bcf86cd799439011',
			plan: 'pro',
			limit_projects: 1,
			limit_users: 0,
		};
		User.findById = () => ({
			select: async () => ({
				_id: { toString: () => '507f1f77bcf86cd799439011' },
				tenant: tenant._id,
				host_id: tenant.host_id,
				subscription_status: 'trialing',
				trial_source: 'no_card',
				trial_ends_at: new Date(Date.now() + 86_400_000),
			}),
		});
		User.findByIdAndUpdate = async () => null;
		TenantMember.find = () => ({
			populate: () => ({
				lean: async () => [{ _id: { toString: () => 'membership-1' }, role: 'owner', tenant }],
			}),
		});
		TenantMember.findOneAndUpdate = async () => null;
		Tenant.findOne = (filter) => {
			if (filter?.is_active === true) return tenant;
			return { select: () => ({ lean: async () => tenant }) };
		};
		Project.countDocuments = async () => 1;
	});

	afterEach(() => {
		config.appUrl = originalAppUrl;
		User.findById = originalUserFindById;
		User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
		Tenant.findOne = originalTenantFindOne;
		TenantMember.find = originalTenantMemberFind;
		TenantMember.findOneAndUpdate = originalTenantMemberFindOneAndUpdate;
		Project.countDocuments = originalProjectCountDocuments;
	});

	it('blocks creation at the stored limit despite Pro and active trial state', async () => {
		const server = await createServer();
		try {
			const response = await createProject(server);
			const json = await response.json();
			assert.equal(response.status, 403);
			assert.equal(json.code, 'ACCOUNT_LIMIT');
			assert.equal(json.limit, 'projects');
			assert.match(json.error, /account allows 1 project/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
