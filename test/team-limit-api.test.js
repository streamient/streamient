import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { AuditLog } from '../model/audit_log.js';
import { TeamInvite } from '../model/team_invite.js';
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
	const originalTenantMemberCreate = TenantMember.create;
	const originalTenantMemberCount = TenantMember.countDocuments;
	const originalTeamInviteDeleteMany = TeamInvite.deleteMany;
	const originalAuditCreate = AuditLog.create;
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
		User.findOne = () => ({ lean: async () => ({ _id: { toString: () => 'existing-user' }, email: 'new@example.com', name: 'Existing User' }) });
		TenantMember.findOne = () => ({ lean: async () => null });
		TenantMember.findOneAndUpdate = async () => null;
		TenantMember.create = async (payload) => ({
			_id: { toString: () => 'membership-2' },
			role: payload.role,
			joined_at: payload.joined_at,
			user: payload.user,
		});
		TenantMember.countDocuments = async () => memberCount;
		Tenant.findOne = (filter) => {
			if (filter?.is_active === true) return tenant;
			return {
				select: (fields) => ({ lean: async () => (fields.includes('plan') ? { plan: tenant.plan } : tenant) }),
			};
		};
		TeamInvite.deleteMany = async () => ({ deletedCount: 0 });
		AuditLog.create = async (payload) => payload;
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
		TenantMember.create = originalTenantMemberCreate;
		TenantMember.countDocuments = originalTenantMemberCount;
		TeamInvite.deleteMany = originalTeamInviteDeleteMany;
		AuditLog.create = originalAuditCreate;
	});

	it('allows adding a 6th user on Free (users are unlimited)', async () => {
		memberCount = 5;
		const server = await createServer();
		try {
			const res = await request(server, 'POST', '/team/members', {
				name: 'New User', email: 'new@example.com', password: 'password123',
			});
			const json = await res.json();
			assert.equal(res.status, 201);
			assert.equal(json.member._id, 'membership-2');
			assert.equal(json.member.user.email, 'new@example.com');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	// The quota middleware stays mounted so a future cap is one config edit —
	// prove the 403 path still works when a user cap is configured.
	it('enforces a configured user cap with an upgrade-worthy message', async () => {
		const originalUsers = config.planLimits.free.users;
		config.planLimits.free.users = 5;
		memberCount = 5;
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
			config.planLimits.free.users = originalUsers;
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
