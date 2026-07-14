import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initializeAdminProvisionedAccount } from '../routes/admin.js';

describe('admin account post-commit initialization', () => {
	const user = { email: 'owner@example.com' };
	const tenant = { host_id: 'host-1' };
	const logger = { warn() {} };

	it('reports success when external initialization completes', async () => {
		const result = await initializeAdminProvisionedAccount(user, tenant, {
			initializeBilling: async () => {},
			initializeTypesense: async () => {},
			sendOwnerMagicLink: async () => {},
			logger,
		});
		assert.deepEqual(result, { magic_link_sent: true, warnings: [] });
	});

	it('preserves creation and reports every external failure as a warning', async () => {
		const result = await initializeAdminProvisionedAccount(user, tenant, {
			initializeBilling: async () => { throw new Error('Stripe unavailable'); },
			initializeTypesense: async () => { throw new Error('Typesense unavailable'); },
			sendOwnerMagicLink: async () => { throw new Error('SMTP unavailable'); },
			logger,
		});
		assert.equal(result.magic_link_sent, false);
		assert.deepEqual(result.warnings, [
			'Stripe setup failed',
			'Typesense setup failed',
			'Magic-link email failed; the owner can request another from login',
		]);
	});
});
