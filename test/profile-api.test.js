import { beforeEach as beforeAccountWork, afterEach as afterAccountWork } from 'node:test';
import { mockTenantWork } from './helpers/tenant-work.js';
let restoreAccountWork;
beforeAccountWork(() => { restoreAccountWork = mockTenantWork(); });
afterAccountWork(() => { restoreAccountWork(); });
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import swaggerSpec from '../swagger.js';

async function createServer() {
	const { default: apiRoutes } = await import(`../routes/api.js?profile_test=${Date.now()}_${Math.random()}`);
	const app = express();
	app.use(express.json());
	app.use((req, res, next) => {
		req.session = {
			userId: '507f1f77bcf86cd799439011',
			tenantId: '507f1f77bcf86cd799439012',
			host_id: 'host-1',
		};
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

describe('profile API', () => {
	const originalUserFindById = User.findById;
	const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
	const originalTenantMemberFind = TenantMember.find;
	const originalTenantMemberFindOneAndUpdate = TenantMember.findOneAndUpdate;
	let profileUser;
	let authUser;
	let tenant;

	beforeEach(() => {
		tenant = {
			_id: { toString: () => '507f1f77bcf86cd799439012' },
			host_id: 'host-1',
			name: 'Test Account',
			is_active: true,
		};
		authUser = {
			_id: { toString: () => '507f1f77bcf86cd799439011' },
			tenant: tenant._id,
			host_id: tenant.host_id,
		};
		profileUser = {
			_id: '507f1f77bcf86cd799439011',
			name: 'Test User',
			email: 'test@example.com',
			timezone: 'UTC',
			timezone_configured: false,
			time_format: undefined,
			save: async () => {},
			toSafe() {
				return {
					_id: this._id,
					name: this.name,
					email: this.email,
					timezone: this.timezone,
					time_format: this.time_format,
				};
			},
		};

		User.findById = () => ({
			select: async () => authUser,
			then: (resolve, reject) => Promise.resolve(profileUser).then(resolve, reject),
			catch: (reject) => Promise.resolve(profileUser).catch(reject),
		});
		User.findByIdAndUpdate = async () => null;
		TenantMember.findOneAndUpdate = async () => null;
		TenantMember.find = () => ({
			populate: () => ({
				lean: async () => [{
					_id: { toString: () => 'membership-1' },
					role: 'owner',
					tenant,
				}],
			}),
		});
	});

	afterEach(() => {
		User.findById = originalUserFindById;
		User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
		TenantMember.find = originalTenantMemberFind;
		TenantMember.findOneAndUpdate = originalTenantMemberFindOneAndUpdate;
	});

	it('saves supported timezone and clock preferences', async () => {
		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/profile', {
				name: 'Nitai',
				email: 'NITAI@EXAMPLE.COM',
				timezone: 'America/New_York',
				time_format: '24-hour',
			});
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.equal(profileUser.timezone, 'America/New_York');
			assert.equal(profileUser.timezone_configured, true);
			assert.equal(profileUser.email, 'nitai@example.com');
			assert.equal(profileUser.time_format, '24-hour');
			assert.equal(json.user.timezone, 'America/New_York');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('rejects an unsupported timezone without partially updating the profile', async () => {
		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/profile', {
				name: 'Changed too early',
				timezone: 'Moon/Base',
			});
			const json = await response.json();

			assert.equal(response.status, 400);
			assert.equal(json.error, 'Invalid timezone');
			assert.equal(profileUser.name, 'Test User');
			assert.equal(profileUser.timezone, 'UTC');
			assert.equal(profileUser.timezone_configured, false);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('rejects an invalid time format without partially updating the profile', async () => {
		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/profile', {
				name: 'Changed too early',
				time_format: 'system',
			});
			const json = await response.json();

			assert.equal(response.status, 400);
			assert.equal(json.error, 'Invalid time format');
			assert.equal(profileUser.name, 'Test User');
			assert.equal(profileUser.time_format, undefined);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('marks an explicitly saved UTC timezone as configured', async () => {
		const server = await createServer();
		try {
			const response = await request(server, 'PUT', '/profile', { timezone: 'UTC' });

			assert.equal(response.status, 200);
			assert.equal(profileUser.timezone, 'UTC');
			assert.equal(profileUser.timezone_configured, true);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('documents profile timezone and clock preferences', () => {
		const schema = swaggerSpec.paths['/profile'].put.requestBody.content['application/json'].schema;
		assert.equal(schema.properties.timezone.type, 'string');
		assert.deepEqual(schema.properties.time_format.enum, ['12-hour', '24-hour']);
		assert.equal(swaggerSpec.components.schemas.UserProfile.properties.timezone.type, 'string');
	});
});
