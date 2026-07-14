import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
	AccountProvisioningError,
	normalizeAccountProvisioningInput,
	provisionAccount,
	provisionSignupAccount,
} from '../services/account_provisioning_service.js';

function validInput(overrides = {}) {
	return {
		name: 'Acme Account',
		owner_name: 'Alice Owner',
		owner_email: 'alice@example.com',
		plan: 'free',
		limit_projects: 3,
		limit_users: 8,
		limit_ai_workflows_per_day: 40,
		...overrides,
	};
}

describe('account provisioning', () => {
	it('normalizes fields and supplies Free defaults when limits are omitted', () => {
		const input = validInput({ owner_email: ' Alice@Example.com ' });
		delete input.limit_projects;
		delete input.limit_users;
		delete input.limit_ai_workflows_per_day;
		const normalized = normalizeAccountProvisioningInput(input);
		assert.equal(normalized.owner_email, 'alice@example.com');
		assert.equal(normalized.limit_projects, 1);
		assert.equal(normalized.limit_users, 5);
		assert.equal(normalized.limit_ai_workflows_per_day, 25);
		assert.ok(normalized.password.length >= 24);
	});

	it('rejects duplicate owner email with conflict', async () => {
		await assert.rejects(
			() => provisionAccount(validInput(), {
				userModel: { findOne: async () => ({ _id: 'existing-user' }) },
				transaction: async (callback) => callback('session-1'),
			}),
			(err) => err instanceof AccountProvisioningError && err.status === 409 && err.code === 'ACCOUNT_EMAIL_EXISTS',
		);
	});

	it('uses a primary duplicate lookup inside the transaction', async () => {
		const calls = [];
		const query = {
			session(session) {
				calls.push(['session', session]);
				return this;
			},
			read(preference) {
				calls.push(['read', preference]);
				return this;
			},
			then(resolve, reject) {
				return Promise.resolve({ _id: 'existing-user' }).then(resolve, reject);
			},
		};
		await assert.rejects(
			() => provisionAccount(validInput(), {
				userModel: { findOne: () => query },
				transaction: async (callback) => callback('session-1'),
			}),
			(err) => err instanceof AccountProvisioningError && err.status === 409,
		);
		assert.deepEqual(calls, [['session', 'session-1'], ['read', 'primary']]);
	});

	it('creates every core record with one transaction session', async () => {
		const calls = [];
		const user = {
			_id: 'user-1',
			async save(options) {
				calls.push(['user.save', options]);
			},
		};
		const result = await provisionAccount(validInput(), {
			userModel: {
				findOne: async () => null,
				create: async (payload, options) => {
					calls.push(['user.create', payload, options]);
					return [Object.assign(user, payload[0])];
				},
			},
			tenantMemberModel: {
				create: async (payload, options) => calls.push(['membership.create', payload, options]),
			},
			createTenant: async (userId, name, data, options) => {
				calls.push(['tenant.create', userId, name, data, options]);
				return { _id: 'tenant-1', host_id: 'host-1', name };
			},
			createDefaultProject: async (userId, hostId, options) => {
				calls.push(['project.create', userId, hostId, options]);
				return { _id: 'project-1' };
			},
			transaction: async (callback) => callback('session-1'),
		});

		assert.equal(result.user.host_id, 'host-1');
		assert.equal(result.user.tenant, 'tenant-1');
		assert.equal(calls.find((call) => call[0] === 'tenant.create')[3].limit_projects, 3);
		assert.equal(calls.find((call) => call[0] === 'membership.create')[1][0].role, 'owner');
		for (const call of calls.filter((entry) => ['user.create', 'user.save', 'tenant.create', 'membership.create', 'project.create'].includes(entry[0]))) {
			const options = call[0] === 'tenant.create' ? call[4] : call.at(-1);
			assert.equal(options.session, 'session-1');
		}
	});

	it('rejects negative and fractional limits before transaction', async () => {
		for (const field of ['limit_projects', 'limit_users', 'limit_ai_workflows_per_day']) {
			for (const value of [-1, 1.5]) {
				let started = false;
				await assert.rejects(
					() => provisionAccount(validInput({ [field]: value }), {
						transaction: async () => {
							started = true;
						},
					}),
					/whole number/,
				);
				assert.equal(started, false);
			}
		}
	});

	it('propagates failures through the transaction rollback path', async () => {
		let rolledBack = false;
		await assert.rejects(
			() => provisionAccount(validInput(), {
				userModel: {
					findOne: async () => null,
					create: async (payload) => [{ _id: 'user-1', ...payload[0], async save() {} }],
				},
				tenantMemberModel: { create: async () => [] },
				createTenant: async () => ({ _id: 'tenant-1', host_id: 'host-1' }),
				createDefaultProject: async () => {
					throw new Error('project create failed');
				},
				transaction: async (callback) => {
					try {
						return await callback('session-1');
					} catch (err) {
						rolledBack = true;
						throw err;
					}
				},
			}),
			/project create failed/,
		);
		assert.equal(rolledBack, true);
	});

	it('public signup always provisions Free defaults', async () => {
		let provisioned;
		await provisionSignupAccount({
			email: 'owner@example.com',
			password: 'secret',
			name: 'Owner',
			plan: 'pro',
		}, {
			provisionAccount: async (input) => {
				provisioned = input;
				return { user: { email: input.owner_email }, tenant: { host_id: 'host-1' } };
			},
			ensureStripeCustomer: async () => null,
			ensureFreeSubscription: async () => null,
		});
		assert.equal(provisioned.plan, 'free');
		assert.equal(provisioned.limit_projects, 1);
		assert.equal(provisioned.limit_users, 5);
		assert.equal(provisioned.limit_ai_workflows_per_day, 25);
	});
});
