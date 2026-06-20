import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { TenantMember } from '../model/tenant_member.js';

function baseByoAi() {
	return {
		global: {
			openai_api_key: '',
			gemini_api_key: '',
		},
		email: {
			openai_api_key: '',
			gemini_api_key: '',
		},
	};
}

function baseAiInstructions() {
	return {
		global: '',
		email: '',
		email_triage: '',
	};
}

function setPath(obj, path, value) {
	const parts = path.split('.');
	let ref = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		ref[parts[i]] = ref[parts[i]] || {};
		ref = ref[parts[i]];
	}
	ref[parts[parts.length - 1]] = value;
}

async function createServer() {
	const { default: apiRoutes } = await import(`../routes/api.js?byo_ai_test=${Date.now()}_${Math.random()}`);
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

describe('BYO AI API', () => {
	const originalAppUrl = config.appUrl;
	const originalIsHosted = config.isHosted;
	const originalEnv = config.env;
	const originalEncryptionKey = config.gitEncryptionKey;
	const originalUserFindById = User.findById;
	const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
	const originalTenantFindOne = Tenant.findOne;
	const originalTenantFindOneAndUpdate = Tenant.findOneAndUpdate;
	const originalTenantMemberFind = TenantMember.find;
	const originalTenantMemberFindOneAndUpdate = TenantMember.findOneAndUpdate;
	let tenant;
	let memberRole;

	beforeEach(() => {
		config.appUrl = 'https://app.kumbukum.com';
		config.isHosted = true;
		config.env = 'development';
		config.gitEncryptionKey = '12345678901234567890123456789012';
		memberRole = 'owner';
		tenant = {
			_id: { toString: () => '507f1f77bcf86cd799439012' },
			host_id: 'host-1',
			name: 'Test Account',
			is_active: true,
			plan: 'pro',
			settings: { byo_ai: baseByoAi(), ai_instructions: baseAiInstructions(), email: {} },
		};

		User.findById = () => ({
			select: async () => ({
				_id: { toString: () => '507f1f77bcf86cd799439011' },
				tenant: tenant._id,
				host_id: tenant.host_id,
				subscription_status: 'active',
				trial_source: '',
				trial_ends_at: null,
			}),
		});
		User.findByIdAndUpdate = async () => null;
		TenantMember.findOneAndUpdate = async () => null;
		TenantMember.find = () => ({
			populate: () => ({
				lean: async () => [{
					_id: { toString: () => 'membership-1' },
					role: memberRole,
					tenant,
				}],
			}),
		});
		Tenant.findOne = () => ({
			select: (fields) => ({
				lean: async () => fields.includes('plan') ? { plan: tenant.plan } : tenant,
			}),
		});
		Tenant.findOneAndUpdate = (filter, update) => {
			for (const [path, value] of Object.entries(update.$set || {})) {
				setPath(tenant, path, value);
			}
			return {
				select: () => ({
					lean: async () => tenant,
				}),
			};
		};
	});

	afterEach(() => {
		config.appUrl = originalAppUrl;
		config.isHosted = originalIsHosted;
		config.env = originalEnv;
		config.gitEncryptionKey = originalEncryptionKey;
		User.findById = originalUserFindById;
		User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
		Tenant.findOne = originalTenantFindOne;
		Tenant.findOneAndUpdate = originalTenantFindOneAndUpdate;
		TenantMember.find = originalTenantMemberFind;
		TenantMember.findOneAndUpdate = originalTenantMemberFindOneAndUpdate;
	});

	it('lets hosted Pro account admins save and read masked BYO AI status', async () => {
		const server = await createServer();
		try {
			const saveResponse = await request(server, 'PUT', '/settings/byo-ai', {
				global: {
					openai_api_key: 'sk-custom',
				},
			});
			const saveJson = await saveResponse.json();

			assert.equal(saveResponse.status, 200);
			assert.equal(saveJson.settings.global.openai_api_key.configured, true);
			assert.equal(saveJson.settings.global.openai_api_key.masked, '********');
			assert.equal(saveJson.settings.global.openai_api_key.value, undefined);

			const getResponse = await request(server, 'GET', '/settings/byo-ai');
			const getJson = await getResponse.json();

			assert.equal(getResponse.status, 200);
			assert.equal(getJson.settings.global.openai_api_key.configured, true);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('lets hosted Pro account admins save AI instructions', async () => {
		const server = await createServer();
		try {
			const saveResponse = await request(server, 'PUT', '/settings/byo-ai', {
				instructions: {
					global: 'Use company policy.',
					email: 'Draft email replies politely.',
					email_triage: 'Triage support first.',
				},
			});
			const saveJson = await saveResponse.json();

			assert.equal(saveResponse.status, 200);
			assert.equal(saveJson.settings.instructions.global, 'Use company policy.');
			assert.equal(saveJson.settings.instructions.email, 'Draft email replies politely.');
			assert.equal(saveJson.settings.instructions.email_triage, 'Triage support first.');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('lets hosted Pro account admins save email settings', async () => {
		const server = await createServer();
		try {
			const saveResponse = await request(server, 'PUT', '/settings/byo-ai', {
				email_settings: {
					auto_triage_incoming: true,
					send_draft_emails_automatically: true,
					spam_guard: 'spam@example.com\nsubject contains: status update',
				},
			});
			const saveJson = await saveResponse.json();

			assert.equal(saveResponse.status, 200);
			assert.deepEqual(saveJson.settings.email_settings, {
				auto_triage_incoming: true,
				send_draft_emails_automatically: true,
				spam_guard: 'spam@example.com\nsubject contains: status update',
			});

			const getResponse = await request(server, 'GET', '/settings/byo-ai');
			const getJson = await getResponse.json();

			assert.equal(getResponse.status, 200);
			assert.deepEqual(getJson.settings.email_settings, {
				auto_triage_incoming: true,
				send_draft_emails_automatically: true,
				spam_guard: 'spam@example.com\nsubject contains: status update',
			});
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('allows hosted Free accounts to configure their own (BYOK) keys', async () => {
		tenant.plan = 'free';
		const server = await createServer();
		try {
			const response = await request(server, 'GET', '/settings/byo-ai');
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.equal(json.settings.global.openai_api_key.configured, false);
			// Free without managed AI → no env fallback.
			assert.equal(json.settings.managed_ai, false);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('blocks non-admin account members', async () => {
		memberRole = 'member';
		const server = await createServer();
		try {
			const response = await request(server, 'GET', '/settings/byo-ai');
			const json = await response.json();

			assert.equal(response.status, 403);
			assert.match(json.error, /Account admin/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('blocks self-hosted installs from database BYO AI settings', async () => {
		config.appUrl = 'http://localhost:3000';
		config.isHosted = false;
		config.env = 'production';
		const server = await createServer();
		try {
			const response = await request(server, 'GET', '/settings/byo-ai');
			const json = await response.json();

			assert.equal(response.status, 403);
			assert.match(json.error, /environment variables/);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('allows non-production self-hosted access for browser testing', async () => {
		config.appUrl = 'http://localhost:3000';
		config.isHosted = false;
		config.env = 'development';
		tenant.plan = 'free';
		const server = await createServer();
		try {
			const response = await request(server, 'GET', '/settings/byo-ai');
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.equal(json.settings.global.openai_api_key.configured, false);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
