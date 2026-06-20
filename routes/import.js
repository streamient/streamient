import { Router, raw } from 'express';
import mongoose from 'mongoose';

import config from '../config.js';
import { Project } from '../model/project.js';
import { EmailIdentity } from '../model/email_identity.js';
import { Tenant } from '../modules/tenancy.js';
import { getBillingUserForHost, hasProFeatureAccess } from '../services/subscription_access_service.js';
import * as emailIngestService from '../services/email_ingest_service.js';

const router = Router();
const is_hosted = config.isHosted;

function parseJsonBody(req) {
	if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
	const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
	if (!rawBody.trim()) throw new Error('Request body is required');
	return JSON.parse(rawBody);
}

function firstValue(value) {
	if (!value) return '';
	if (Array.isArray(value)) return firstValue(value[0]);
	if (typeof value === 'object') {
		return value.address || value.text || value.email || value.recipient || value.sender || firstValue(value.value) || '';
	}
	return String(value);
}

function collectValues(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.flatMap((entry) => collectValues(entry));
	if (typeof value === 'object') {
		const values = [];
		for (const key of ['address', 'text', 'email', 'recipient', 'sender', 'line', 'value']) {
			values.push(...collectValues(value[key]));
		}
		return values;
	}
	return [String(value)];
}

function extractEmailAddresses(value) {
	return collectValues(value).flatMap((entry) => {
		const matches = entry.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
		return matches || [];
	});
}

function getHeaderValues(headers, name) {
	if (!headers) return [];
	const lowerName = name.toLowerCase();
	const stripHeaderName = (line) => String(line || '').replace(new RegExp(`^${name}\\s*:\\s*`, 'i'), '').trim();

	if (typeof headers === 'string') {
		return headers
			.replace(/\r?\n[ \t]+/g, ' ')
			.split(/\r?\n/g)
			.filter((line) => line.toLowerCase().startsWith(`${lowerName}:`))
			.map(stripHeaderName);
	}

	if (Array.isArray(headers)) {
		return headers
			.filter((entry) => String(entry?.key || entry?.name || entry?.[0] || '').toLowerCase() === lowerName)
			.flatMap((entry) => collectValues(entry?.value || entry?.[1] || stripHeaderName(entry?.line)));
	}

	if (typeof headers === 'object') {
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === lowerName) return collectValues(value);
		}
	}

	return [];
}

function getHeaderValuesFromParsed(parsed, name) {
	return [
		...getHeaderValues(parsed.headers, name),
		...getHeaderValues(parsed.headerLines, name),
	].filter(Boolean);
}

function getReceivedForValues(parsed) {
	const receivedValues = getHeaderValuesFromParsed(parsed, 'received');
	const addresses = [];
	for (const value of receivedValues) {
		const text = String(value || '');
		const matches = text.matchAll(/\bfor\s+<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/gi);
		for (const match of matches) addresses.push(match[1]);
	}
	return addresses;
}

function normalizeForwardedPayload(payload) {
	return {
		...payload,
		from: payload.from || payload.sender || payload.envelope?.from || payload.envelope?.sender || payload.session?.sender,
	};
}

function findForwardRecipient(payload, email) {
	const forwardDomain = String(config.emailForwardDomain || '').trim().replace(/^@+/, '').toLowerCase();
	if (!forwardDomain) return { error: 'EMAIL_FORWARD_DOMAIN is not configured' };

	const parsed = payload?.parsed_email || payload?.mailparser || payload || {};
	const candidates = [
		{ source: 'recipients', value: parsed.recipients },
		{ source: 'recipient', value: parsed.recipient },
		{ source: 'rcpt_to', value: parsed.rcpt_to },
		{ source: 'rcptTo', value: parsed.rcptTo },
		{ source: 'session.recipient', value: parsed.session?.recipient },
		{ source: 'session.recipients', value: parsed.session?.recipients },
		{ source: 'envelope.to', value: parsed.envelope?.to },
		{ source: 'envelope.recipient', value: parsed.envelope?.recipient },
		{ source: 'envelope.recipients', value: parsed.envelope?.recipients },
		{ source: 'envelope.rcpt_to', value: parsed.envelope?.rcpt_to },
		{ source: 'envelope.rcptTo', value: parsed.envelope?.rcptTo },
		{ source: 'receipt.recipients', value: parsed.receipt?.recipients },
		{ source: 'originalRecipient', value: parsed.originalRecipient || parsed.OriginalRecipient },
		{ source: 'delivered-to', value: getHeaderValuesFromParsed(parsed, 'delivered-to') },
		{ source: 'x-original-to', value: getHeaderValuesFromParsed(parsed, 'x-original-to') },
		{ source: 'envelope-to', value: getHeaderValuesFromParsed(parsed, 'envelope-to') },
		{ source: 'x-envelope-to', value: getHeaderValuesFromParsed(parsed, 'x-envelope-to') },
		{ source: 'x-forwarded-to', value: getHeaderValuesFromParsed(parsed, 'x-forwarded-to') },
		{ source: 'received.for', value: getReceivedForValues(parsed) },
		{ source: 'to', value: email.to },
	];

	for (const candidate of candidates) {
		for (const address of extractEmailAddresses(candidate.value)) {
			const value = firstValue(address).trim().toLowerCase();
			const atIndex = value.lastIndexOf('@');
			if (atIndex === -1) continue;

			const localPart = value.slice(0, atIndex);
			const domain = value.slice(atIndex + 1);
			if (domain === forwardDomain) return { localPart, address: value, source: candidate.source };
		}
	}

	return { error: 'Forwarded email recipient must use EMAIL_FORWARD_DOMAIN' };
}

function isHiddenDeliveryRecipientSource(source) {
	return source && source !== 'to';
}

function projectForwardAddress(project) {
	const forwardDomain = String(config.emailForwardDomain || '').trim().replace(/^@+/, '').toLowerCase();
	const projectId = project?._id?.toString ? project._id.toString() : String(project?._id || '');
	return projectId && forwardDomain ? `${projectId}@${forwardDomain}` : '';
}

function hasAddress(addresses, address) {
	const normalized = String(address || '').trim().toLowerCase();
	if (!normalized) return false;
	return (addresses || []).some((item) => String(item || '').trim().toLowerCase() === normalized);
}

function hasHeaderAddress(parsed, headerName, address) {
	const normalized = String(address || '').trim().toLowerCase();
	if (!normalized) return false;
	return getHeaderValuesFromParsed(parsed, headerName)
		.flatMap((value) => extractEmailAddresses(value))
		.some((value) => String(value || '').trim().toLowerCase() === normalized);
}

async function isProjectBccReply(project, email, recipient, payload) {
	const forwardAddress = projectForwardAddress(project);
	if (!forwardAddress) {
		return false;
	}

	const deliveredToProject = String(recipient?.address || '').trim().toLowerCase() === forwardAddress || hasAddress(email.bcc, forwardAddress);
	if (!deliveredToProject) return false;

	const parsed = payload?.parsed_email || payload?.mailparser || payload || {};
	const visibleProjectRecipient = hasHeaderAddress(parsed, 'to', forwardAddress) || hasHeaderAddress(parsed, 'cc', forwardAddress) || hasAddress(email.cc, forwardAddress) || (recipient?.source === 'to' && hasAddress(email.to, forwardAddress));
	const hiddenProjectRecipient = hasAddress(email.bcc, forwardAddress) || (isHiddenDeliveryRecipientSource(recipient?.source) && !visibleProjectRecipient);
	if (!hiddenProjectRecipient) return false;

	const sender = String((email.from || [])[0] || '').trim().toLowerCase();
	if (!sender) return false;
	const identity = await EmailIdentity.findOne({
		host_id: project.host_id,
		project: project._id,
		email: sender,
	}).select('_id').lean();
	return Boolean(identity);
}

async function emailForwardingEnabled(host_id) {
	if (!is_hosted) return true;
	const [tenant, billingUser] = await Promise.all([
		Tenant.findOne({ host_id }).select('plan').lean(),
		getBillingUserForHost(host_id),
	]);
	return hasProFeatureAccess(billingUser, tenant?.plan || 'free', is_hosted);
}

router.post('/email', raw({ type: () => true, limit: '25mb' }), async (req, res) => {
	let payload;
	try {
		payload = normalizeForwardedPayload(parseJsonBody(req));
	} catch {
		return res.status(400).json({ error: 'Invalid JSON payload' });
	}

	let normalized;
	try {
		normalized = emailIngestService.parseForwardedEmailInput(payload);
	} catch (err) {
		return res.status(400).json({ error: err.message });
	}

	if (!normalized.from.length) {
		return res.status(400).json({ error: 'Forwarded email sender is required' });
	}

	const recipient = findForwardRecipient(payload, normalized);
	if (recipient.error) {
		const status = recipient.error.includes('configured') ? 503 : 403;
		return res.status(status).json({ error: recipient.error });
	}

	if (!mongoose.Types.ObjectId.isValid(recipient.localPart)) {
		return res.json({ accepted: false });
	}

	const project = await Project.findOne({ _id: recipient.localPart, is_active: true }).lean();
	if (!project) {
		return res.json({ accepted: false });
	}

	if (!(await emailForwardingEnabled(project.host_id))) {
		return res.json({ accepted: false });
	}

	const bccReply = await isProjectBccReply(project, normalized, recipient, payload);
	const filtered = !bccReply && emailIngestService.matchesEmailFilter(project.email_filter, {
		from: normalized.from,
		subject: normalized.subject,
	});

	try {
		const email = await emailIngestService.ingestForwardedEmail(project.owner, project.host_id, {
			...payload,
			project: project._id,
			mailbox: bccReply ? 'archived' : 'inbox',
			labels: bccReply ? [] : payload.labels,
			triaged: bccReply ? false : payload.triaged,
			triaged_at: bccReply ? null : payload.triaged_at,
			in_trash: filtered,
			trashed_at: filtered ? new Date() : null,
		}, {
			user_id: project.owner,
			channel: 'emailforwarding',
			ip: req.ip,
			user_agent: req.headers['user-agent'],
			archiveBccReplyThread: bccReply,
		});

		res.json({ accepted: true, email_id: email._id.toString() });
	} catch (err) {
		if (err.message === 'Email message already exists') {
			return res.json({ accepted: false });
		}
		res.status(400).json({ error: err.message });
	}
});

export default router;
