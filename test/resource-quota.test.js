import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { requireResourceQuota } from '../services/subscription_access_service.js';
import { Tenant } from '../modules/tenancy.js';
import { Project } from '../model/project.js';
import { TenantMember } from '../model/tenant_member.js';

afterEach(() => mock.restoreAll());
for (const resource of ['projects', 'users']) {
	test(`${resource} quota uses a tenant write and counts inside the creation transaction`, async () => {
		const session = {};
		let claimed = false;
		mock.method(Tenant, 'findOneAndUpdate', (filter, update, options) => {
			assert.equal(options.session, session);
			assert.equal(options.new, true);
			assert.equal(update.$inc.__v, 1);
			claimed = true;
			return { lean: async () => ({ owner: 'owner', limit_projects: 1, limit_users: 1 }) };
		});
		mock.method(resource === 'projects' ? Project : TenantMember, 'countDocuments', (filter) => {
			assert.equal(claimed, true);
			if (resource === 'users') assert.deepEqual(filter.user, { $ne: 'owner' });
			return { session(value) { assert.equal(value, session); return this; }, read: async () => resource === 'projects' ? 1 : 0 };
		});
		await assert.rejects(requireResourceQuota('host', resource, session), { status: 403, code: 'ACCOUNT_LIMIT', limit: resource });
	});
}
test('quota helper rejects invalid resource or missing transaction', async () => {
	await assert.rejects(requireResourceQuota('host', 'projects'), /transaction/);
	await assert.rejects(requireResourceQuota('host', 'unknown', {}), /valid resource/);
});
