import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pickActiveTenantContext } from '../modules/tenancy.js';
import { AuditLog } from '../model/audit_log.js';
import { TeamInvite } from '../model/team_invite.js';
import { TenantMember } from '../model/tenant_member.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { canManageMembership, canManageTeam, createTeamMember, removeTeamMember, sortTeamMembers } from '../services/team_service.js';

describe('team membership helpers', () => {
	it('prefers explicit tenant id when picking the active tenant', () => {
		const accessibleTenants = [
			{ tenantId: 'tenant-1', host_id: 'host-1', name: 'Alpha', role: 'owner', is_primary: true },
			{ tenantId: 'tenant-2', host_id: 'host-2', name: 'Beta', role: 'member', is_primary: false },
		];

		const active = pickActiveTenantContext(accessibleTenants, 'tenant-2', null);

		assert.equal(active.tenantId, 'tenant-2');
	});

	it('falls back to the preferred host id when tenant id is absent', () => {
		const accessibleTenants = [
			{ tenantId: 'tenant-1', host_id: 'host-1', name: 'Alpha', role: 'owner', is_primary: false },
			{ tenantId: 'tenant-2', host_id: 'host-2', name: 'Beta', role: 'member', is_primary: false },
		];

		const active = pickActiveTenantContext(accessibleTenants, null, 'host-2');

		assert.equal(active.host_id, 'host-2');
	});

	it('falls back to the primary tenant when no explicit match exists', () => {
		const accessibleTenants = [
			{ tenantId: 'tenant-1', host_id: 'host-1', name: 'Alpha', role: 'owner', is_primary: false },
			{ tenantId: 'tenant-2', host_id: 'host-2', name: 'Beta', role: 'member', is_primary: true },
		];

		const active = pickActiveTenantContext(accessibleTenants, 'missing', 'missing');

		assert.equal(active.tenantId, 'tenant-2');
	});

	it('allows owners to manage admins and members but not create another owner', () => {
		assert.equal(canManageTeam('owner'), true);
		assert.equal(canManageMembership('owner', 'admin', 'member'), true);
		assert.equal(canManageMembership('owner', 'member', 'admin'), true);
		assert.equal(canManageMembership('owner', 'member', 'owner'), false);
	});

	it('limits admins to managing members only', () => {
		assert.equal(canManageTeam('admin'), true);
		assert.equal(canManageMembership('admin', 'member', 'admin'), true);
		assert.equal(canManageMembership('admin', 'admin', 'member'), false);
		assert.equal(canManageMembership('admin', 'owner', 'member'), false);
	});

	it('sorts members by role rank before display', () => {
		const members = [
			{ role: 'member', user: { email: 'member@example.com' } },
			{ role: 'owner', user: { email: 'owner@example.com' } },
			{ role: 'admin', user: { email: 'admin@example.com' } },
		];

		members.sort(sortTeamMembers);

		assert.deepEqual(
			members.map((member) => member.role),
			['owner', 'admin', 'member'],
		);
	});

	it('removes stale membership rows whose user document is gone', async () => {
		const originalFindOne = TenantMember.findOne;
		const originalDeleteOne = TenantMember.deleteOne;
		const originalAuditCreate = AuditLog.create;
		const membership = {
			_id: { toString: () => 'membership-1' },
			role: 'member',
			user: null,
		};
		let deleteFilter;
		let auditPayload;

		TenantMember.findOne = (filter) => ({
			populate: async (path, select) => {
				assert.deepEqual(filter, { _id: 'membership-1', host_id: 'host-1' });
				assert.equal(path, 'user');
				assert.equal(select, 'name email');
				return membership;
			},
		});
		TenantMember.deleteOne = async (filter) => {
			deleteFilter = filter;
			return { deletedCount: 1 };
		};
		AuditLog.create = async (payload) => {
			auditPayload = payload;
			return payload;
		};

		try {
			await removeTeamMember('host-1', 'membership-1', { userId: 'actor-1', role: 'owner' }, { channel: 'web' });

			assert.deepEqual(deleteFilter, { _id: membership._id });
			assert.equal(auditPayload.details.missing_user, true);
			assert.equal(auditPayload.details.member_email, null);
		} finally {
			TenantMember.findOne = originalFindOne;
			TenantMember.deleteOne = originalDeleteOne;
			AuditLog.create = originalAuditCreate;
		}
	});

	it('creates a member when welcome email is unchecked', async () => {
		const originalTenantFindOne = Tenant.findOne;
		const originalUserFindOne = User.findOne;
		const originalUserCreate = User.create;
		const originalTenantMemberFindOne = TenantMember.findOne;
		const originalTenantMemberCreate = TenantMember.create;
		const originalTeamInviteDeleteMany = TeamInvite.deleteMany;
		const originalAuditCreate = AuditLog.create;
		const tenant = { _id: { toString: () => 'tenant-1' }, host_id: 'host-1', is_active: true };
		const user = {
			_id: { toString: () => 'user-2' },
			email: 'new@example.com',
			name: 'New User',
			last_login: null,
			createdAt: new Date('2026-06-23T00:00:00Z'),
		};
		let createdUserPayload;
		let createdMembershipPayload;
		let deletedInviteFilter;

		Tenant.findOne = (filter) => {
			assert.deepEqual(filter, { host_id: 'host-1', is_active: true });
			return tenant;
		};
		User.findOne = (filter) => ({
			lean: async () => {
				assert.deepEqual(filter, { email: 'new@example.com' });
				return null;
			},
		});
		User.create = async (payload) => {
			createdUserPayload = payload;
			return user;
		};
		TenantMember.findOne = () => ({
			lean: async () => null,
		});
		TenantMember.create = async (payload) => {
			createdMembershipPayload = payload;
			const membership = {
				_id: { toString: () => 'membership-2' },
				role: 'member',
				joined_at: payload.joined_at,
				user: payload.user,
				populate: async () => {
					throw new Error('createTeamMember should not populate after create');
				},
			};
			return membership;
		};
		TeamInvite.deleteMany = async (filter) => {
			deletedInviteFilter = filter;
			return { deletedCount: 0 };
		};
		AuditLog.create = async (payload) => payload;

		try {
			const member = await createTeamMember('actor-1', 'host-1', {
				name: ' New User ',
				email: ' NEW@example.com ',
				password: 'password123',
				send_welcome_email: false,
			}, { channel: 'web' });

			assert.equal(member._id, 'membership-2');
			assert.equal(member.user.email, 'new@example.com');
			assert.deepEqual(createdUserPayload, {
				email: 'new@example.com',
				password: 'password123',
				name: 'New User',
				is_verified: true,
				is_active: true,
			});
			assert.equal(createdMembershipPayload.role, 'member');
			assert.equal(createdMembershipPayload.host_id, 'host-1');
			assert.equal(createdMembershipPayload.user, user._id);
			assert.deepEqual(deletedInviteFilter, {
				tenant: tenant._id,
				email: 'new@example.com',
				accepted_at: null,
			});
		} finally {
			Tenant.findOne = originalTenantFindOne;
			User.findOne = originalUserFindOne;
			User.create = originalUserCreate;
			TenantMember.findOne = originalTenantMemberFindOne;
			TenantMember.create = originalTenantMemberCreate;
			TeamInvite.deleteMany = originalTeamInviteDeleteMany;
			AuditLog.create = originalAuditCreate;
		}
	});

	it('adds an existing user to the current tenant without changing their primary tenant', async () => {
		const originalTenantFindOne = Tenant.findOne;
		const originalUserFindOne = User.findOne;
		const originalUserCreate = User.create;
		const originalTenantMemberFindOne = TenantMember.findOne;
		const originalTenantMemberCreate = TenantMember.create;
		const originalTeamInviteDeleteMany = TeamInvite.deleteMany;
		const originalAuditCreate = AuditLog.create;
		const tenant = { _id: { toString: () => 'tenant-current' }, host_id: 'host-current', is_active: true, name: 'Current Account' };
		const existingUser = {
			_id: { toString: () => 'user-existing' },
			email: 'existing@example.com',
			name: 'Existing User',
			tenant: { toString: () => 'tenant-primary' },
			host_id: 'host-primary',
			last_login: null,
			createdAt: new Date('2026-06-20T00:00:00Z'),
		};
		const originalPrimaryTenant = existingUser.tenant;
		const originalHostId = existingUser.host_id;
		let createdMembershipPayload;
		let deletedInviteFilter;
		let auditPayload;

		Tenant.findOne = async (filter) => {
			assert.deepEqual(filter, { host_id: 'host-current', is_active: true });
			return tenant;
		};
		User.findOne = (filter) => ({
			lean: async () => {
				assert.deepEqual(filter, { email: 'existing@example.com' });
				return existingUser;
			},
		});
		User.create = async () => {
			throw new Error('Existing users must not be recreated');
		};
		TenantMember.findOne = (filter) => ({
			lean: async () => {
				assert.deepEqual(filter, { tenant: tenant._id, user: existingUser._id });
				return null;
			},
		});
		TenantMember.create = async (payload) => {
			createdMembershipPayload = payload;
			return {
				_id: { toString: () => 'membership-existing' },
				role: payload.role,
				joined_at: payload.joined_at,
				user: payload.user,
			};
		};
		TeamInvite.deleteMany = async (filter) => {
			deletedInviteFilter = filter;
			return { deletedCount: 0 };
		};
		AuditLog.create = async (payload) => {
			auditPayload = payload;
			return payload;
		};

		try {
			const member = await createTeamMember('actor-1', 'host-current', {
				email: ' EXISTING@example.com ',
				send_welcome_email: false,
			}, { channel: 'web' });

			assert.equal(member._id, 'membership-existing');
			assert.equal(member.user._id, 'user-existing');
			assert.equal(member.user.email, 'existing@example.com');
			assert.equal(createdMembershipPayload.tenant, tenant._id);
			assert.equal(createdMembershipPayload.user, existingUser._id);
			assert.equal(createdMembershipPayload.host_id, 'host-current');
			assert.equal(existingUser.tenant, originalPrimaryTenant);
			assert.equal(existingUser.host_id, originalHostId);
			assert.deepEqual(deletedInviteFilter, {
				tenant: tenant._id,
				email: 'existing@example.com',
				accepted_at: null,
			});
			assert.equal(auditPayload.details.created_directly, false);
			assert.equal(auditPayload.details.existing_user_linked, true);
		} finally {
			Tenant.findOne = originalTenantFindOne;
			User.findOne = originalUserFindOne;
			User.create = originalUserCreate;
			TenantMember.findOne = originalTenantMemberFindOne;
			TenantMember.create = originalTenantMemberCreate;
			TeamInvite.deleteMany = originalTeamInviteDeleteMany;
			AuditLog.create = originalAuditCreate;
		}
	});

	it('rejects an existing user who is already a current tenant member', async () => {
		const originalTenantFindOne = Tenant.findOne;
		const originalUserFindOne = User.findOne;
		const originalTenantMemberFindOne = TenantMember.findOne;
		const tenant = { _id: { toString: () => 'tenant-current' }, host_id: 'host-current', is_active: true, name: 'Current Account' };
		const existingUser = {
			_id: { toString: () => 'user-existing' },
			email: 'existing@example.com',
			name: 'Existing User',
		};

		Tenant.findOne = async () => tenant;
		User.findOne = () => ({
			lean: async () => existingUser,
		});
		TenantMember.findOne = (filter) => ({
			lean: async () => {
				assert.deepEqual(filter, { tenant: tenant._id, user: existingUser._id });
				return { _id: { toString: () => 'membership-existing' } };
			},
		});

		try {
			await assert.rejects(
				createTeamMember('actor-1', 'host-current', { email: 'existing@example.com' }, { channel: 'web' }),
				/User is already a member of this account/,
			);
		} finally {
			Tenant.findOne = originalTenantFindOne;
			User.findOne = originalUserFindOne;
			TenantMember.findOne = originalTenantMemberFindOne;
		}
	});
});
