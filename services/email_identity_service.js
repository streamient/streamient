import { EmailIdentity } from '../model/email_identity.js';
import { Project } from '../model/project.js';
import { encrypt } from '../modules/encryption.js';
import * as audit from './audit_service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function duplicateEmailError(err) {
	return err?.code === 11000;
}

function normalizeString(value) {
	return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
	return value === true;
}

function normalizePort(value) {
	const port = parseInt(value, 10);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('SMTP port must be between 1 and 65535');
	}
	return port;
}

async function assertProject(hostId, projectId) {
	const project = await Project.findOne({ _id: projectId, host_id: hostId }).select('_id').lean();
	if (!project) throw new Error('Project not found');
	return project;
}

function publicIdentity(identity) {
	if (!identity) return null;
	const obj = typeof identity.toObject === 'function' ? identity.toObject() : { ...identity };
	return {
		...obj,
		smtp: {
			host: obj.smtp?.host || '',
			port: obj.smtp?.port || 587,
			auth_user: obj.smtp?.auth_user || '',
			auth_password_configured: Boolean(obj.smtp?.auth_password),
			tls: Boolean(obj.smtp?.tls),
			ssl: Boolean(obj.smtp?.ssl),
		},
	};
}

function createPayload(userId, hostId, projectId, data = {}) {
	const name = normalizeString(data.name);
	const email = normalizeString(data.email).toLowerCase();
	const smtp = data.smtp || {};
	const host = normalizeString(smtp.host);

	if (!email || !EMAIL_RE.test(email)) throw new Error('Valid email is required');
	if (!host) throw new Error('SMTP host is required');

	return {
		project: projectId,
		owner: userId,
		host_id: hostId,
		name,
		email,
		smtp: {
			host,
			port: normalizePort(smtp.port || 587),
			auth_user: normalizeString(smtp.auth_user),
			auth_password: normalizeString(smtp.auth_password) ? encrypt(normalizeString(smtp.auth_password)) : '',
			tls: normalizeBoolean(smtp.tls),
			ssl: normalizeBoolean(smtp.ssl),
		},
	};
}

function updatePayload(data = {}) {
	const update = {};
	if (data.name !== undefined) update.name = normalizeString(data.name);
	if (data.email !== undefined) {
		const email = normalizeString(data.email).toLowerCase();
		if (!email || !EMAIL_RE.test(email)) throw new Error('Valid email is required');
		update.email = email;
	}

	const smtp = data.smtp || {};
	if (smtp.host !== undefined) {
		const host = normalizeString(smtp.host);
		if (!host) throw new Error('SMTP host is required');
		update['smtp.host'] = host;
	}
	if (smtp.port !== undefined) update['smtp.port'] = normalizePort(smtp.port);
	if (smtp.auth_user !== undefined) update['smtp.auth_user'] = normalizeString(smtp.auth_user);
	if (smtp.tls !== undefined) update['smtp.tls'] = normalizeBoolean(smtp.tls);
	if (smtp.ssl !== undefined) update['smtp.ssl'] = normalizeBoolean(smtp.ssl);

	if (data.clear_auth_password === true) {
		update['smtp.auth_password'] = '';
	} else if (smtp.auth_password !== undefined) {
		const password = normalizeString(smtp.auth_password);
		if (password) update['smtp.auth_password'] = encrypt(password);
	}

	return update;
}

export async function listEmailIdentities(hostId, projectId) {
	const identities = await EmailIdentity.find({ host_id: hostId, project: projectId }).sort({ email: 1 }).lean();
	return identities.map(publicIdentity);
}

export async function getEmailIdentity(hostId, identityId) {
	const identity = await EmailIdentity.findOne({ _id: identityId, host_id: hostId }).lean();
	return publicIdentity(identity);
}

export async function createEmailIdentity(userId, hostId, projectId, data, ctx = {}) {
	await assertProject(hostId, projectId);
	try {
		const identity = await EmailIdentity.create(createPayload(userId, hostId, projectId, data));
		audit.log({ action: 'create', resource: 'email_identity', resource_id: identity._id.toString(), user_id: userId, host_id: hostId, ...ctx });
		return publicIdentity(identity);
	} catch (err) {
		if (duplicateEmailError(err)) throw new Error('Email address already exists for this project');
		throw err;
	}
}

export async function updateEmailIdentity(hostId, identityId, data, ctx = {}) {
	const update = updatePayload(data);
	if (Object.keys(update).length === 0) return getEmailIdentity(hostId, identityId);

	try {
		const identity = await EmailIdentity.findOneAndUpdate(
			{ _id: identityId, host_id: hostId },
			{ $set: update },
			{ returnDocument: 'after' },
		);
		if (identity && ctx.user_id) {
			audit.log({ action: 'update', resource: 'email_identity', resource_id: identityId, host_id: hostId, ...ctx });
		}
		return publicIdentity(identity);
	} catch (err) {
		if (duplicateEmailError(err)) throw new Error('Email address already exists for this project');
		throw err;
	}
}

export async function deleteEmailIdentity(hostId, identityId, ctx = {}) {
	const identity = await EmailIdentity.findOneAndDelete({ _id: identityId, host_id: hostId });
	if (identity && ctx.user_id) {
		audit.log({ action: 'delete', resource: 'email_identity', resource_id: identityId, host_id: hostId, ...ctx });
	}
	return identity ? publicIdentity(identity) : null;
}
