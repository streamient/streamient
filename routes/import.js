import { Router, raw } from 'express';
import mongoose from 'mongoose';

import config from '../config.js';
import { Project } from '../model/project.js';
import { Tenant } from '../modules/tenancy.js';
import * as emailIngestService from '../services/email_ingest_service.js';

const router = Router();
const is_hosted = new URL(config.appUrl).hostname.endsWith('kumbukum.com');

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

function normalizeForwardedPayload(payload) {
	return {
		...payload,
		to: payload.to || payload.recipient || payload.rcpt_to || payload.envelope?.to || payload.envelope?.recipient || payload.session?.recipient,
		from: payload.from || payload.sender || payload.envelope?.from || payload.envelope?.sender || payload.session?.sender,
	};
}

function findForwardRecipient(payload, email) {
	const forwardDomain = String(config.emailForwardDomain || '').trim().replace(/^@+/, '').toLowerCase();
	if (!forwardDomain) return { error: 'EMAIL_FORWARD_DOMAIN is not configured' };

	const parsed = payload?.parsed_email || payload?.mailparser || payload || {};
	const candidates = [
		parsed.recipients,
		parsed.recipient,
		parsed.rcpt_to,
		parsed.rcptTo,
		parsed.session?.recipient,
		parsed.session?.recipients,
		parsed.envelope?.to,
		parsed.envelope?.recipient,
		parsed.envelope?.rcpt_to,
		parsed.envelope?.rcptTo,
		getHeaderValues(parsed.headers, 'x-original-to'),
		getHeaderValues(parsed.headerLines, 'x-original-to'),
		email.to,
	];

	for (const address of candidates.flatMap((candidate) => extractEmailAddresses(candidate))) {
		const value = firstValue(address).trim().toLowerCase();
		const atIndex = value.lastIndexOf('@');
		if (atIndex === -1) continue;

		const localPart = value.slice(0, atIndex);
		const domain = value.slice(atIndex + 1);
		if (domain === forwardDomain) return { localPart, address: value };
	}

	return { error: 'Forwarded email recipient must use EMAIL_FORWARD_DOMAIN' };
}

async function emailForwardingEnabled(host_id) {
	if (!is_hosted) return true;
	const tenant = await Tenant.findOne({ host_id }).select('plan').lean();
	return tenant?.plan === 'pro';
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

	try {
		const email = await emailIngestService.ingestForwardedEmail(project.owner, project.host_id, {
			...payload,
			project: project._id,
		}, {
			user_id: project.owner,
			channel: 'emailforwarding',
			ip: req.ip,
			user_agent: req.headers['user-agent'],
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
