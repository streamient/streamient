import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { deleteAccountDataForUser, getTenantTypesenseCollectionNames } from '../services/account_cleanup_service.js';

const HOST_SCOPED_MODELS = [
	'Note',
	'Memory',
	'Url',
	'CrawlState',
	'Email',
	'Project',
	'GraphLink',
	'GitRepo',
	'OAuthAuthorizationCode',
	'OAuthClient',
	'OAuthConsent',
	'OAuthRefreshToken',
	'TeamInvite',
	'TenantMember',
	'Export',
	'AuditLog',
];

describe('account cleanup for users without host_id', () => {
	it('deletes an orphaned user without touching host-scoped collections', async () => {
		const calls = {};
		const models = {};

		// Host-scoped deletes must never run: without a host_id the filter would
		// cast to {} and match every tenant's rows.
		for (const name of HOST_SCOPED_MODELS.filter((n) => n !== 'TenantMember')) {
			models[name] = {
				deleteMany: async () => {
					throw new Error(`${name}.deleteMany must not run for a user without host_id`);
				},
			};
		}

		models.TenantMember = {
			deleteMany: async (query) => {
				calls.TenantMember = query;
				return { deletedCount: 0 };
			},
		};
		models.UserPasskey = {
			deleteMany: async (query) => {
				calls.UserPasskey = query;
				return { deletedCount: 0 };
			},
		};
		models.MagicLink = {
			deleteMany: async (query) => {
				calls.MagicLink = query;
				return { deletedCount: 0 };
			},
		};
		models.Tenant = {
			findById: async () => null,
			findOne: async (query) => {
				calls.TenantFindOne = query;
				return null;
			},
			findByIdAndDelete: async () => {
				throw new Error('no tenant to delete');
			},
		};
		models.User = {
			deleteMany: async (query) => {
				calls.User = query;
				return { deletedCount: 1 };
			},
		};

		const result = await deleteAccountDataForUser(
			{ _id: 'user-1', email: 'orphan@example.com' },
			{ models },
		);

		assert.equal(result.deleted, true);
		assert.equal(result.host_id, null);
		assert.equal(result.tenant_id, null);
		assert.equal(result.users, 1);
		assert.deepEqual(calls.TenantFindOne, { owner: 'user-1' });
		assert.deepEqual(calls.UserPasskey, { user: 'user-1' });
		assert.deepEqual(calls.MagicLink, { user: 'user-1' });
		assert.deepEqual(calls.TenantMember, { user: 'user-1' });
		assert.deepEqual(calls.User, { _id: 'user-1' });
	});


	it('dispatches the exact owned host to the guarded deletion entry point', async () => {
		const tenant = { _id: 'tenant-9', host_id: 'host-9' };
		let scope;
		const result = await deleteAccountDataForUser({ _id: 'user-1' }, {
			models: { Tenant: { findOne: async () => tenant } },
			deleteTenantData: async (hostId, tenantId) => { scope = { hostId, tenantId }; return { pending: true }; },
		});
		assert.deepEqual(scope, { hostId: 'host-9', tenantId: 'tenant-9' });
		assert.equal(result.pending, true);
	});
});
