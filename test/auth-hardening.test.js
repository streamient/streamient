import { it } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { generateSecret, generateSync } from 'otplib';
import config from '../config.js';
import authRoutes from '../routes/auth.js';
import { MagicLink } from '../model/magic_link.js';
import { PendingSignup } from '../model/pending_signup.js';
import { SystemSetting } from '../model/system_setting.js';
import { User } from '../model/user.js';

const handler = (path) => authRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods.post).route.stack.at(-1).handle;
const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; }, render(view, locals) { this.view = view; this.locals = locals; }, redirect(url) { this.redirected = url; } });

it('rejects operator-object tokens before any Mongo lookup', async (t) => {
	const magic = t.mock.method(MagicLink, 'findOneAndUpdate', () => { throw new Error('must not query'); });
	const pending = t.mock.method(PendingSignup, 'findOne', () => { throw new Error('must not query'); });
	const users = t.mock.method(User, 'findOne', () => { throw new Error('must not query'); });
	for (const path of ['/magic', '/verify']) {
		const res = response();
		await handler(path)({ body: { token: { $ne: '' } } }, res);
		assert.equal(res.locals.error, 'Token required');
	}
	const login = response();
	await handler('/login')({ body: { email: { $ne: '' }, password: { $ne: '' } }, is: () => false, session: {} }, login);
	assert.equal(login.statusCode, 400);
	assert.equal(magic.mock.callCount() + pending.mock.callCount() + users.mock.callCount(), 0);
});

it('builds magic links from the configured app URL, not Host headers', async (t) => {
	let message;
	const originalSmtp = config.smtp;
	config.smtp = { servers: [{ name: 'host-header-test', host: 'smtp.example.invalid', port: 1025, from: 'test@example.invalid' }] };
	t.after(() => { config.smtp = originalSmtp; });
	t.mock.method(User, 'findOne', () => ({ select: async () => ({ _id: 'user-1' }) }));
	t.mock.method(MagicLink, 'generate', async () => ({ token: 'magic-token' }));
	t.mock.method(SystemSetting, 'findOne', async () => null);
	t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (data) => { message = data; } }));
	const headers = { host: 'evil.tld', 'x-forwarded-host': 'evil.tld', 'x-forwarded-proto': 'https' };
	await handler('/magic-link')({ body: { email: 'owner@example.com' }, headers, protocol: 'http' }, response());
	assert.equal(message.html.includes('evil.tld'), false);
	assert.ok(message.html.includes(`${config.appUrl.replace(/\/$/, '')}/magic?token=magic-token`));

	await handler('/magic-link')({ body: { email: 'owner@example.com' }, headers, whiteLabelHostId: 'host-1', whiteLabel: { dns_name_custom: 'docs.customer.example' } }, response());
	assert.ok(message.html.includes('https://docs.customer.example/magic?token=magic-token'));
});

it('clears the pending 2FA login after five wrong codes', async (t) => {
	const secret = generateSecret();
	const wrong = String((Number(generateSync({ secret })) + 1) % 1000000).padStart(6, '0');
	t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'user-1', totp_secret: secret }) }));
	const session = { pending2FA: { userId: 'user-1', token: 'temp-token' } };
	for (let i = 1; i <= 5; i += 1) {
		const res = response();
		await handler('/2fa/verify')({ body: { code: wrong, tempToken: 'temp-token' }, session }, res);
		assert.equal(res.statusCode, 401);
		if (i < 5) assert.equal(session.pending2FA.failures, i);
	}
	assert.equal(session.pending2FA, undefined);
	const res = response();
	await handler('/2fa/verify')({ body: { code: generateSync({ secret }), tempToken: 'temp-token' }, session }, res);
	assert.equal(res.body.error, 'Invalid 2FA session');
});
