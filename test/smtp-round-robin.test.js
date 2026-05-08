import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseSmtpServersFromEnv } from '../config.js';
import { pickSmtpServer } from '../services/email_service.js';

describe('SMTP round-robin configuration', () => {
	it('uses legacy SMTP_* settings as one server when SMTP_SERVERS is absent', () => {
		const servers = parseSmtpServersFromEnv({
			SMTP_HOST: 'smtp1.example.com',
			SMTP_PORT: '2525',
			SMTP_USER: 'user1',
			SMTP_PASS: 'pass1',
			SMTP_FROM: 'noreply@example.com',
		});

		assert.deepEqual(servers, [{
			name: 'smtp-1',
			host: 'smtp1.example.com',
			port: 2525,
			secure: false,
			user: 'user1',
			pass: 'pass1',
			from: 'noreply@example.com',
		}]);
	});

	it('parses SMTP_SERVERS JSON and applies global from fallback', () => {
		const servers = parseSmtpServersFromEnv({
			SMTP_FROM: 'global@example.com',
			SMTP_SERVERS: JSON.stringify([
				{ name: 'a', host: 'smtp-a.example.com', port: 587, user: 'a-user', pass: 'a-pass' },
				{ name: 'b', host: 'smtp-b.example.com', port: 465, user: 'b-user', pass: 'b-pass', from: 'b@example.com' },
			]),
		});

		assert.equal(servers[0].from, 'global@example.com');
		assert.equal(servers[0].secure, false);
		assert.equal(servers[1].from, 'b@example.com');
		assert.equal(servers[1].secure, true);
	});

	it('selects SMTP servers in round-robin order', () => {
		const servers = [
			{ name: 'a' },
			{ name: 'b' },
			{ name: 'c' },
		];
		let index = 0;
		const names = [];

		for (let i = 0; i < 5; i++) {
			const picked = pickSmtpServer(servers, index);
			names.push(picked.server.name);
			index = picked.nextIndex;
		}

		assert.deepEqual(names, ['a', 'b', 'c', 'a', 'b']);
	});
});
