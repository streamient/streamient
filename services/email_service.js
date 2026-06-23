import nodemailer from 'nodemailer';
import config from '../config.js';
import emailTemplates from '../config/email_templates.js';
import { getSetting } from './system_settings_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('email');

const transporters = new Map();
let smtpRoundRobinIndex = 0;

export function pickSmtpServer(servers, currentIndex = 0) {
	if (!servers?.length) return { server: null, nextIndex: 0 };
	const normalizedIndex = currentIndex % servers.length;
	return {
		server: servers[normalizedIndex],
		nextIndex: (normalizedIndex + 1) % servers.length,
	};
}

function getConfiguredSmtpServers() {
	if (config.smtp.servers?.length) return config.smtp.servers;
	if (!config.smtp.host) return [];
	return [{
		name: 'smtp-1',
		host: config.smtp.host,
		port: config.smtp.port,
		secure: config.smtp.port === 465,
		user: config.smtp.user,
		pass: config.smtp.pass,
		from: config.smtp.from,
	}];
}

function getTransporter(server) {
	const key = server.name || `${server.host}:${server.port}:${server.user || ''}`;
	if (!transporters.has(key)) {
		transporters.set(key, nodemailer.createTransport({
			host: server.host,
			port: server.port,
			secure: server.secure !== undefined ? server.secure : server.port === 465,
			auth: server.user
				? { user: server.user, pass: server.pass }
				: undefined,
		}));
	}
	return transporters.get(key);
}

export function createSystemTransport() {
	const servers = getConfiguredSmtpServers();
	const picked = pickSmtpServer(servers, smtpRoundRobinIndex);
	smtpRoundRobinIndex = picked.nextIndex;
	if (!picked.server) return null;
	return { transporter: getTransporter(picked.server), server: picked.server };
}

async function sendMail({ to, subject, html, text, from, replyTo }) {
	const servers = getConfiguredSmtpServers();
	const picked = pickSmtpServer(servers, smtpRoundRobinIndex);
	smtpRoundRobinIndex = picked.nextIndex;

	if (!picked.server) {
		log.info({ to, subject }, 'Email (no SMTP)');
		return;
	}

	const t = getTransporter(picked.server);
	const mailOptions = { from: from || picked.server.from || config.smtp.from, to, subject, html, text, replyTo };

	return t.sendMail(mailOptions);
}

async function resolveTemplate(templateKey) {
	const subjectOverride = await getSetting(`email_template.${templateKey}.subject`);
	const htmlOverride = await getSetting(`email_template.${templateKey}.html`);
	const defaults = emailTemplates[templateKey] || {};
	return {
		subject: subjectOverride || defaults.subject,
		html: htmlOverride || defaults.html,
	};
}

function renderTemplate(template, variables) {
	let result = template;
	for (const [key, value] of Object.entries(variables)) {
		result = result.replaceAll(`{{${key}}}`, value);
	}
	return result;
}

function buildUrl(baseUrl, path) {
	return `${String(baseUrl || config.appUrl).replace(/\/$/, '')}${path}`;
}

export async function sendVerificationEmail(email, token, name, baseUrl = null) {
	const url = buildUrl(baseUrl, `/verify?token=${encodeURIComponent(token)}`);
	const { subject, html } = await resolveTemplate('verification');
	return sendMail({
		to: email,
		subject: renderTemplate(subject, { url, name: name || '' }),
		html: renderTemplate(html, { url, name: name || '' }),
	});
}

export async function sendPasswordResetEmail(email, token, baseUrl = null) {
	const url = buildUrl(baseUrl, `/reset-password?token=${encodeURIComponent(token)}`);
	const { subject, html } = await resolveTemplate('password_reset');
	return sendMail({
		to: email,
		subject: renderTemplate(subject, { url }),
		html: renderTemplate(html, { url }),
	});
}

export async function sendMagicLinkEmail(email, token, baseUrl = null) {
	const url = buildUrl(baseUrl, `/magic?token=${encodeURIComponent(token)}`);
	const { subject, html } = await resolveTemplate('magic_link');
	return sendMail({
		to: email,
		subject: renderTemplate(subject, { url }),
		html: renderTemplate(html, { url }),
	});
}

export async function sendTeamInviteEmail(email, token, tenantName, inviterName, name) {
	const url = `${config.appUrl}/team-invite?token=${encodeURIComponent(token)}`;
	const { subject, html } = await resolveTemplate('team_invite');
	const templateData = {
		url,
		tenantName,
		inviterName,
		name: name || 'there',
	};
	return sendMail({
		to: email,
		subject: renderTemplate(subject, templateData),
		html: renderTemplate(html, templateData),
	});
}

export async function sendTeamMemberAddedEmail(email, name, tenantName) {
	const loginUrl = `${config.appUrl}/login`;
	const { subject, html } = await resolveTemplate('team_member_added');
	const templateData = {
		loginUrl,
		name: name || 'there',
		tenantName,
	};
	return sendMail({
		to: email,
		subject: renderTemplate(subject, templateData),
		html: renderTemplate(html, templateData),
	});
}

export async function sendWelcomeEmail(email, name) {
	const loginUrl = `${config.appUrl}/login`;
	const { subject, html } = await resolveTemplate('welcome');
	return sendMail({
		to: email,
		subject: renderTemplate(subject, { name: name || '', loginUrl }),
		html: renderTemplate(html, { name: name || '', loginUrl }),
	});
}

async function sendTrialTemplateEmail(templateKey, email, name, trialEndDate) {
	const subscriptionUrl = `${config.appUrl}/settings/subscription`;
	const { subject, html } = await resolveTemplate(templateKey);
	const templateData = { name: name || '', trialEndDate, subscriptionUrl };
	return sendMail({
		to: email,
		subject: renderTemplate(subject, templateData),
		html: renderTemplate(html, templateData),
	});
}

export async function sendTrialEnding3DayEmail(email, name, trialEndDate) {
	return sendTrialTemplateEmail('trial_ending_3_days', email, name, trialEndDate);
}

export async function sendTrialEnding24HourEmail(email, name, trialEndDate) {
	return sendTrialTemplateEmail('trial_ending_24_hours', email, name, trialEndDate);
}

export async function sendTrialExpiredEmail(email, name, trialEndDate) {
	return sendTrialTemplateEmail('trial_expired', email, name, trialEndDate);
}

export function formatSignupNotificationDate(date = new Date()) {
	const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
	const day = date.getDate();
	const lastTwoDigits = day % 100;
	const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
		? 'th'
		: ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th');
	return `${months[date.getMonth()]} ${day}${suffix} ${date.getFullYear()}`;
}

export async function sendTrialSignupNotificationEmail(email, signupDate = new Date()) {
	return sendMail({
		to: 'hi@kumbukum.com',
		from: 'server@kumbukum.com',
		replyTo: email,
		subject: `Kumbukum signup: ${email} - Date ${formatSignupNotificationDate(signupDate)}`,
		text: '',
		html: '',
	});
}

export async function sendExportReadyEmail(email, name, token) {
	const downloadUrl = `${config.appUrl}/api/v1/export/download/${token}`;
	const { subject, html } = await resolveTemplate('export_ready');
	return sendMail({
		to: email,
		subject: renderTemplate(subject, { name: name || '', downloadUrl }),
		html: renderTemplate(html, { name: name || '', downloadUrl }),
	});
}

export async function sendTestEmail(to, templateKey, sampleVariables) {
	const { subject, html } = await resolveTemplate(templateKey);
	return sendMail({
		to,
		subject: renderTemplate(subject, sampleVariables),
		html: renderTemplate(html, sampleVariables),
	});
}
