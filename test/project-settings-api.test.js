import { beforeEach as beforeAccountWork, afterEach as afterAccountWork } from 'node:test';
import { mockTenantWork } from './helpers/tenant-work.js';
let restoreAccountWork;
beforeAccountWork(() => { restoreAccountWork = mockTenantWork(); });
afterAccountWork(() => { restoreAccountWork(); });
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';
import { TenantMember } from '../model/tenant_member.js';
import { Project } from '../model/project.js';
import { Email } from '../model/email.js';
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

describe('Project settings API', () => {
	const originalAppUrl = config.appUrl;
	const originalIsHosted = config.isHosted;
	const originalEncryptionKey = config.gitEncryptionKey;
	const originalObsidianEnabled = config.obsidian.enabled;
	const originalObsidianEncryptionKey = config.obsidian.encryptionKey;
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
	const originalGitRepoFind = GitRepo.find;
	const originalAuditLogCreate = AuditLog.create;
	let tenant;
	let billingUser;
	let memberRole;
	let projects;

	beforeEach(() => {
		config.appUrl = 'https://app.streamient.com';
		config.isHosted = true;
		config.gitEncryptionKey = '12345678901234567890123456789012';
		config.obsidian.enabled = true;
		config.obsidian.encryptionKey = 'a'.repeat(64);
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
		billingUser = {
			_id: { toString: () => '507f1f77bcf86cd799439011' },
			tenant: tenant._id,
			host_id: tenant.host_id,
			subscription_status: 'active',
			trial_source: '',
			trial_ends_at: null,
		};

		User.findById = () => ({
			select: async () => billingUser,
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
		config.obsidian.enabled = originalObsidianEnabled;
		config.obsidian.encryptionKey = originalObsidianEncryptionKey;
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
		GitRepo.find = originalGitRepoFind;
		AuditLog.create = originalAuditLogCreate;
	});

	it('blocks members from project settings and settings-backed mutations', async () => {
		memberRole = 'member';
		const server = await createServer();
		try {
			const settingsResponse = await request(server, 'GET', '/projects/project-1/settings');
			const projectUpdateResponse = await request(server, 'PUT', '/projects/project-1', { name: 'Nope', color: '#000000' });
			const applyFilterResponse = await request(server, 'POST', '/projects/project-1/email-filter/apply', {});
			const gitResponse = await request(server, 'GET', '/projects/project-1/git-repos');

			assert.equal(settingsResponse.status, 403);
			assert.equal(projectUpdateResponse.status, 403);
			assert.equal(applyFilterResponse.status, 403);
			assert.equal(gitResponse.status, 403);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('lets project admins apply saved email filters to project inbox and labeled emails', async () => {
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

	it('reports Obsidian access with the same hosted and self-hosted matrix as Git Sync', async () => {
		const server = await createServer();
		try {
			const proResponse = await request(server, 'GET', '/projects/project-1/settings');
			const pro = await proResponse.json();
			assert.deepEqual(pro.features, { git_sync: true, email_ingest: true, obsidian_sync: true, obsidian_sync_configured: true });

			tenant.plan = 'free';
			const freeResponse = await request(server, 'GET', '/features');
			const free = await freeResponse.json();
			assert.deepEqual(free.features, { email_ingest: false, git_sync: false, obsidian_sync: false, obsidian_sync_configured: true });

			billingUser = { ...billingUser, subscription_status: 'trialing', trial_source: 'no_card', trial_ends_at: new Date('2099-01-01T00:00:00.000Z') };
			const trialResponse = await request(server, 'GET', '/features');
			const trial = await trialResponse.json();
			assert.equal(trial.features.git_sync, true);
			assert.equal(trial.features.obsidian_sync, true);

			config.isHosted = false;
			config.obsidian.enabled = false;
			config.obsidian.encryptionKey = '';
			const selfHostedResponse = await request(server, 'GET', '/features');
			const selfHosted = await selfHostedResponse.json();
			assert.equal(selfHosted.features.git_sync, true);
			assert.equal(selfHosted.features.obsidian_sync, true);
			assert.equal(selfHosted.features.obsidian_sync_configured, false);
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
