import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import mongoose from '../model/mongoose.js';
import { Tenant } from '../modules/tenancy.js';
import { User } from '../model/user.js';
import { TenantMember } from '../model/tenant_member.js';
import { Project } from '../model/project.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import {
	AdminAccountError,
	getAdminAccount,
	listAdminAccounts,
	updateAdminAccount,
} from '../services/admin_account_service.js';

const originals = {
	tenantFind: Tenant.find,
	tenantFindById: Tenant.findById,
	tenantCountDocuments: Tenant.countDocuments,
	tenantFindByIdAndUpdate: Tenant.findByIdAndUpdate,
	userFindOne: User.findOne,
	userFindByIdAndUpdate: User.findByIdAndUpdate,
	memberFind: TenantMember.find,
	memberCountDocuments: TenantMember.countDocuments,
	projectCountDocuments: Project.countDocuments,
	noteCountDocuments: Note.countDocuments,
	memoryCountDocuments: Memory.countDocuments,
	urlCountDocuments: Url.countDocuments,
};

function queryResult(value) {
	const query = {
		select() { return query; },
		populate() { return query; },
		sort() { return query; },
		skip() { return query; },
		limit() { return query; },
		lean: async () => value,
	};
	return query;
}

afterEach(() => {
	Tenant.find = originals.tenantFind;
	Tenant.findById = originals.tenantFindById;
	Tenant.countDocuments = originals.tenantCountDocuments;
	Tenant.findByIdAndUpdate = originals.tenantFindByIdAndUpdate;
	User.findOne = originals.userFindOne;
	User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
	TenantMember.find = originals.memberFind;
	TenantMember.countDocuments = originals.memberCountDocuments;
	Project.countDocuments = originals.projectCountDocuments;
	Note.countDocuments = originals.noteCountDocuments;
	Memory.countDocuments = originals.memoryCountDocuments;
	Url.countDocuments = originals.urlCountDocuments;
});

describe('admin tenant accounts', () => {
	it('lists one inactive row per tenant with tenant-scoped counts', async () => {
		const tenantId = new mongoose.Types.ObjectId();
		let tenantFilter;
		Tenant.find = (filter) => {
			tenantFilter = filter;
			return queryResult([{
				_id: tenantId,
				host_id: 'host-1',
				name: 'Acme',
				is_active: false,
				plan: 'free',
				limit_projects: 3,
				limit_users: 5,
				limit_ai_workflows_per_day: 25,
				owner: { _id: new mongoose.Types.ObjectId(), name: 'Alice', email: 'alice@example.com' },
			}]);
		};
		Tenant.countDocuments = async () => 1;
		Project.countDocuments = async (filter) => {
			assert.equal(filter.host_id, 'host-1');
			return 2;
		};
		Note.countDocuments = async (filter) => {
			assert.equal(filter.host_id, 'host-1');
			return 4;
		};
		Memory.countDocuments = async () => 3;
		Url.countDocuments = async () => 2;
		TenantMember.countDocuments = async (filter) => {
			assert.equal(filter.tenant.toString(), tenantId.toString());
			return 3;
		};

		const result = await listAdminAccounts({ status: 'inactive' });
		assert.deepEqual(tenantFilter, { is_active: false });
		assert.equal(result.accounts[0]._id, tenantId.toString());
		assert.equal(result.accounts[0].owner.email, 'alice@example.com');
		assert.equal(result.accounts[0].projectCount, 2);
		assert.equal(result.accounts[0].memberCount, 3);
		assert.equal(result.accounts[0].itemCount, 9);
	});

	it('returns read-only members and synthesizes missing owner membership', async () => {
		const tenantId = new mongoose.Types.ObjectId();
		const ownerId = new mongoose.Types.ObjectId();
		Tenant.findById = () => queryResult({
			_id: tenantId,
			host_id: 'host-1',
			name: 'Acme',
			is_active: true,
			plan: 'pro',
			limit_projects: 0,
			limit_users: 0,
			limit_ai_workflows_per_day: 0,
			owner: { _id: ownerId, name: 'Alice', email: 'alice@example.com' },
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
		});
		Project.countDocuments = async () => 1;
		Note.countDocuments = async () => 4;
		Memory.countDocuments = async () => 3;
		Url.countDocuments = async () => 3;
		TenantMember.find = () => queryResult([{
			_id: new mongoose.Types.ObjectId(),
			role: 'member',
			joined_at: new Date('2026-02-01T00:00:00.000Z'),
			user: { _id: new mongoose.Types.ObjectId(), name: 'Bob', email: 'bob@example.com' },
		}]);

		const account = await getAdminAccount(tenantId.toString());
		assert.equal(account.memberCount, 2);
		assert.deepEqual(account.members.map((member) => member.role), ['owner', 'member']);
		assert.equal(account.members[0].user.email, 'alice@example.com');
	});

	it('allows lower limits and does not rewrite them on plan change', async () => {
		const tenantId = new mongoose.Types.ObjectId();
		const updates = [];
		Tenant.findById = () => queryResult({ owner: new mongoose.Types.ObjectId() });
		Tenant.findByIdAndUpdate = async (id, update, options) => updates.push({ id, update, options });
		User.findByIdAndUpdate = async () => {};

		await updateAdminAccount(tenantId.toString(), {
			plan: 'pro',
			limit_projects: 1,
		}, {
			transaction: async (callback) => callback('session-1'),
			getAccount: async () => ({ _id: tenantId.toString() }),
		});
		assert.deepEqual(updates[0].update, { plan: 'pro', limit_projects: 1 });
		assert.equal(updates[0].options.session, 'session-1');
		assert.equal(Object.hasOwn(updates[0].update, 'limit_users'), false);
		assert.equal(Object.hasOwn(updates[0].update, 'limit_ai_workflows_per_day'), false);
	});

	it('rejects invalid limits and duplicate owner email', async () => {
		const tenantId = new mongoose.Types.ObjectId();
		Tenant.findById = () => queryResult({ owner: new mongoose.Types.ObjectId() });
		for (const limit_projects of [-1, 1.5]) {
			await assert.rejects(
				() => updateAdminAccount(tenantId.toString(), { limit_projects }),
				(err) => err instanceof AdminAccountError && err.status === 400,
			);
		}
		User.findOne = () => queryResult({ _id: new mongoose.Types.ObjectId() });
		await assert.rejects(
			() => updateAdminAccount(tenantId.toString(), { owner_email: 'used@example.com' }),
			(err) => err instanceof AdminAccountError && err.status === 409 && err.code === 'ACCOUNT_EMAIL_EXISTS',
		);
	});
});
