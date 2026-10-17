import { it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSecret, generateSync } from 'otplib';
import { User } from '../model/user.js';
import apiRoutes from '../routes/api.js';

it('requires current authenticator proof before disabling 2FA and safely repeats after disabling', async () => {
	const handler = apiRoutes.stack.find(layer => layer.route?.path === '/2fa/disable').route.stack[0].handle;
	const original = User.findById;
	let saves = 0;
	const user = { totp_enabled: true, totp_secret: generateSecret(), async save() { saves++; } };
	User.findById = () => ({ select: () => ({ lean: async () => user }) });
	async function disable(body) {
		const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
		await handler({ userId: 'user', body }, res);
		return res;
	}
	try {
		for (const body of [{}, { code: 'invalid' }, { code: '1234567' }, { code: '000000' }]) {
			if (body.code === generateSync({ secret: user.totp_secret })) continue;
			assert.equal((await disable(body)).statusCode, 400);
			assert.equal(user.totp_enabled, true);
			assert.equal(saves, 0);
		}
		assert.equal((await disable({ code: generateSync({ secret: user.totp_secret }) })).statusCode, 200);
		assert.equal(user.totp_enabled, false);
		assert.equal(user.totp_secret, undefined);
		assert.equal(saves, 1);
		assert.equal((await disable({})).statusCode, 200);
		assert.equal(saves, 1);
	} finally { User.findById = original; }
});
