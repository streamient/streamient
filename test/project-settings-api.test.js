import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { TenantMember } from '../model/tenant_member.js';
import { Project } from '../model/project.js';
import { Email } from '../model/email.js';
import { EmailIdentity } from '../model/email_identity.js';
import { GitRepo } from '../model/git_repo.js';
import { AuditLog } from '../model/audit_log.js';

function sameValue(actual, expected) {
	if (actual?.toString && expected?.toString) return actual.toString() === expected.toString();
	return String(actual) === String(expected);
}

function getValue(obj, key) {
	return key.split('.').reduce((acc, part) => acc?.[part], obj);
}

function setValue(obj, key, value) {
	const parts = key.split('.');
	let target = obj;
	for (const part of parts.slice(0, -1)) {
		target[part] ||= {};
		target = target[part];
	}
	target[parts.at(-1)] = value;
}

function matches(doc, query) {
	for (const [key, expected] of Object.entries(query)) {
		if (!sameValue(getValue(doc, key), expected)) return false;
	}
	return true;
}

function modelDoc(data) {
	return {
		...data,
		toObject() {
			return { ...this };
		},
	};
}

function projectQuery(project) {
	return {
		lean: async () => project,
		select: () => ({
			lean: async () => project,
		}),
		then(resolve, reject) {
			return Promise.resolve(project).then(resolve, reject);
		},
		catch(reject) {
			return Promise.resolve(project).catch(reject);
		},
	};
}

async function createServer() {
	const { default: apiRoutes } = await import(`../routes/api.js?project_settings_test=${Date.now()}_${Math.random()}`);
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

describe('Project settings API', () => {
	const originalAppUrl = config.appUrl;
	const originalIsHosted = config.isHosted;
	const originalEncryptionKey = config.gitEncryptionKey;
	const originalEmailForwardDomain = config.emailForwardDomain;
	const originalUserFindById = User.findById;
	const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
	const originalTenantFindOne = Tenant.findOne;
	const originalTenantMemberFind = TenantMember.find;
	const originalTenantMemberFindOneAndUpdate = TenantMember.findOneAndUpdate;
	const originalProjectFindOne = Project.findOne;
	const originalProjectFindOneAndUpdate = Project.findOneAndUpdate;
	const originalEmailFind = Email.find;
	const originalEmailUpdateMany = Email.updateMany;
	const originalEmailIdentityFind = EmailIdentity.find;
	const originalEmailIdentityFindOne = EmailIdentity.findOne;
	const originalEmailIdentityCreate = EmailIdentity.create;
	const originalEmailIdentityFindOneAndUpdate = EmailIdentity.findOneAndUpdate;
	const originalEmailIdentityFindOneAndDelete = EmailIdentity.findOneAndDelete;
	const originalGitRepoFind = GitRepo.find;
	const originalAuditLogCreate = AuditLog.create;
	let tenant;
	let memberRole;
	let projects;
	let identities;

	beforeEach(() => {
		config.appUrl = 'https://app.kumbukum.com';
		config.isHosted = true;
		config.gitEncryptionKey = '12345678901234567890123456789012';
		config.emailForwardDomain = 'email.example.com';
		memberRole = 'owner';
		tenant = {
			_id: { toString: () => '507f1f77bcf86cd799439012' },
			host_id: 'host-1',
			name: 'Test Account',
			is_active: true,
			plan: 'pro',
		};
		projects = [
			modelDoc({
				_id: 'project-1',
				host_id: 'host-1',
				owner: '507f1f77bcf86cd799439011',
				name: 'Project One',
				color: '#123456',
				email_filter: 'noisy.com',
			}),
		];
		identities = [];

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
			select: () => ({
				lean: async () => ({ plan: tenant.plan }),
			}),
		});
		Project.findOne = (query) => projectQuery(projects.find((project) => matches(project, query)) || null);
		Project.findOneAndUpdate = async (query, update) => {
			const project = projects.find((candidate) => matches(candidate, query));
			if (!project) return null;
			for (const [key, value] of Object.entries(update.$set || {})) setValue(project, key, value);
			return project;
		};
		EmailIdentity.find = (query) => ({
			sort: () => ({
				lean: async () => identities.filter((identity) => matches(identity, query)),
			}),
		});
		EmailIdentity.findOne = (query) => ({
			lean: async () => identities.find((identity) => matches(identity, query)) || null,
		});
		EmailIdentity.create = async (payload) => {
			if (identities.some((identity) => identity.host_id === payload.host_id && identity.project === payload.project && identity.email === payload.email)) {
				const err = new Error('duplicate');
				err.code = 11000;
				throw err;
			}
			const identity = modelDoc({
				_id: `identity-${identities.length + 1}`,
				createdAt: new Date(),
				updatedAt: new Date(),
				...payload,
			});
			identities.push(identity);
			return identity;
		};
		EmailIdentity.findOneAndUpdate = async (query, update) => {
			const identity = identities.find((candidate) => matches(candidate, query));
			if (!identity) return null;
			const nextEmail = update.$set?.email || identity.email;
			if (identities.some((candidate) => candidate !== identity && candidate.host_id === identity.host_id && candidate.project === identity.project && candidate.email === nextEmail)) {
				const err = new Error('duplicate');
				err.code = 11000;
				throw err;
			}
			for (const [key, value] of Object.entries(update.$set || {})) setValue(identity, key, value);
			return identity;
		};
		EmailIdentity.findOneAndDelete = async (query) => {
			const index = identities.findIndex((candidate) => matches(candidate, query));
			if (index === -1) return null;
			return identities.splice(index, 1)[0];
		};
		Email.find = () => ({
			select: () => ({
				lean: async () => [],
			}),
		});
		Email.updateMany = async () => ({ modifiedCount: 0 });
		GitRepo.find = () => ({
			sort: () => ({
				lean: async () => [],
			}),
		});
		AuditLog.create = async () => ({});
	});

	afterEach(() => {
		config.appUrl = originalAppUrl;
		config.isHosted = originalIsHosted;
		config.gitEncryptionKey = originalEncryptionKey;
		config.emailForwardDomain = originalEmailForwardDomain;
		User.findById = originalUserFindById;
		User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
		Tenant.findOne = originalTenantFindOne;
		TenantMember.find = originalTenantMemberFind;
		TenantMember.findOneAndUpdate = originalTenantMemberFindOneAndUpdate;
		Project.findOne = originalProjectFindOne;
		Project.findOneAndUpdate = originalProjectFindOneAndUpdate;
		Email.find = originalEmailFind;
		Email.updateMany = originalEmailUpdateMany;
		EmailIdentity.find = originalEmailIdentityFind;
		EmailIdentity.findOne = originalEmailIdentityFindOne;
		EmailIdentity.create = originalEmailIdentityCreate;
		EmailIdentity.findOneAndUpdate = originalEmailIdentityFindOneAndUpdate;
		EmailIdentity.findOneAndDelete = originalEmailIdentityFindOneAndDelete;
		GitRepo.find = originalGitRepoFind;
		AuditLog.create = originalAuditLogCreate;
	});

	it('lets admins load settings and manage masked project email identities', async () => {
		const server = await createServer();
		try {
			const settingsResponse = await request(server, 'GET', '/projects/project-1/settings');
			const settingsJson = await settingsResponse.json();

			assert.equal(settingsResponse.status, 200);
			assert.equal(settingsJson.project._id, 'project-1');
			assert.equal(settingsJson.email_forward_domain, 'email.example.com');

			const createResponse = await request(server, 'POST', '/projects/project-1/email-identities', {
				name: 'Support',
				email: 'Support@Example.com',
				signature: 'Thanks,\nSupport',
				smtp: {
					host: 'smtp.example.com',
					port: 465,
					auth_user: 'support@example.com',
					auth_password: 'secret-pass',
					tls: true,
					ssl: true,
				},
				helpmonks: {
					enabled: true,
					base_url: 'https://helpmonks.example.com',
					api_key: 'hm-secret',
				},
				fastmail: {
					enabled: true,
					account_id: 'fastmail-account',
					api_token: 'fm-secret',
				},
			});
			const createJson = await createResponse.json();

			assert.equal(createResponse.status, 201);
			assert.equal(createJson.identity.email, 'support@example.com');
			assert.equal(createJson.identity.signature, 'Thanks,\nSupport');
			assert.equal(createJson.identity.smtp.auth_password_configured, true);
			assert.equal(createJson.identity.smtp.auth_password, undefined);
			assert.equal(createJson.identity.helpmonks.enabled, true);
			assert.equal(createJson.identity.helpmonks.api_key_configured, true);
			assert.equal(createJson.identity.helpmonks.api_key, undefined);
			assert.equal(createJson.identity.fastmail.enabled, true);
			assert.equal(createJson.identity.fastmail.account_id, 'fastmail-account');
			assert.equal(createJson.identity.fastmail.api_token_configured, true);
			assert.equal(createJson.identity.fastmail.api_token, undefined);
			assert.equal(identities[0].host_id, 'host-1');
			assert.equal(identities[0].project, 'project-1');
			assert.notEqual(identities[0].smtp.auth_password, 'secret-pass');
			assert.match(identities[0].smtp.auth_password, /:/);
			assert.notEqual(identities[0].helpmonks.api_key, 'hm-secret');
			assert.match(identities[0].helpmonks.api_key, /:/);
			assert.notEqual(identities[0].fastmail.api_token, 'fm-secret');
			assert.match(identities[0].fastmail.api_token, /:/);

			const duplicateResponse = await request(server, 'POST', '/projects/project-1/email-identities', {
				name: 'Duplicate',
				email: 'support@example.com',
				smtp: { host: 'smtp.example.com', port: 587 },
			});
			const duplicateJson = await duplicateResponse.json();
			assert.equal(duplicateResponse.status, 400);
			assert.match(duplicateJson.error, /already exists/);

			const storedPassword = identities[0].smtp.auth_password;
			const updateResponse = await request(server, 'PUT', '/email-identities/identity-1', {
				name: 'Support Updated',
				email: 'support@example.com',
				signature: 'Regards,\nSupport Team',
				smtp: {
					host: 'smtp2.example.com',
					port: 587,
					auth_user: 'support2@example.com',
					auth_password: '',
					tls: false,
					ssl: false,
				},
				helpmonks: {
					enabled: true,
					base_url: 'https://helpmonks2.example.com',
					api_key: '',
				},
				fastmail: {
					enabled: true,
					account_id: 'fastmail-account-2',
					api_token: '',
				},
			});
			const updateJson = await updateResponse.json();

			assert.equal(updateResponse.status, 200);
			assert.equal(updateJson.identity.name, 'Support Updated');
			assert.equal(updateJson.identity.signature, 'Regards,\nSupport Team');
			assert.equal(updateJson.identity.smtp.auth_password_configured, true);
			assert.equal(updateJson.identity.helpmonks.base_url, 'https://helpmonks2.example.com');
			assert.equal(updateJson.identity.helpmonks.api_key_configured, true);
			assert.equal(updateJson.identity.fastmail.account_id, 'fastmail-account-2');
			assert.equal(updateJson.identity.fastmail.api_token_configured, true);
			assert.equal(identities[0].smtp.auth_password, storedPassword);

			const clearResponse = await request(server, 'PUT', '/email-identities/identity-1', {
				clear_auth_password: true,
				clear_helpmonks_api_key: true,
				clear_fastmail_api_token: true,
			});
			const clearJson = await clearResponse.json();

			assert.equal(clearResponse.status, 200);
			assert.equal(clearJson.identity.smtp.auth_password_configured, false);
			assert.equal(clearJson.identity.helpmonks.api_key_configured, false);
			assert.equal(clearJson.identity.fastmail.api_token_configured, false);
			assert.equal(identities[0].smtp.auth_password, '');
			assert.equal(identities[0].helpmonks.api_key, '');
			assert.equal(identities[0].fastmail.api_token, '');

			const deleteResponse = await request(server, 'DELETE', '/email-identities/identity-1');
			assert.equal(deleteResponse.status, 200);
			assert.equal(identities.length, 0);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('blocks members from project settings and settings-backed mutations', async () => {
		memberRole = 'member';
		const server = await createServer();
		try {
			const settingsResponse = await request(server, 'GET', '/projects/project-1/settings');
			const projectUpdateResponse = await request(server, 'PUT', '/projects/project-1', { name: 'Nope', color: '#000000' });
			const applyFilterResponse = await request(server, 'POST', '/projects/project-1/email-filter/apply', {});
			const identityResponse = await request(server, 'POST', '/projects/project-1/email-identities', {
				email: 'support@example.com',
				smtp: { host: 'smtp.example.com', port: 587 },
			});
			const gitResponse = await request(server, 'GET', '/projects/project-1/git-repos');

			assert.equal(settingsResponse.status, 403);
			assert.equal(projectUpdateResponse.status, 403);
			assert.equal(applyFilterResponse.status, 403);
			assert.equal(identityResponse.status, 403);
			assert.equal(gitResponse.status, 403);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('lets project admins apply saved email filters to the project inbox', async () => {
		const server = await createServer();
		try {
			const response = await request(server, 'POST', '/projects/project-1/email-filter/apply', {});
			const json = await response.json();

			assert.equal(response.status, 200);
			assert.equal(json.result.project, 'project-1');
			assert.equal(json.result.filter_configured, true);
			assert.equal(json.result.processed, 0);
			assert.equal(json.result.moved, 0);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
