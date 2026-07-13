import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildSignupNotificationEmail } from '../services/email_service.js';

describe('signup notification email', () => {
	it('targets the Streamient inbox with signup details', () => {
		const email = buildSignupNotificationEmail({ email: 'owner@example.com', name: 'Owner', hostId: 'host-1', signupDate: new Date(2026, 10, 12) });

		assert.equal(email.to, 'hi@streamient.com');
		assert.equal(email.from, 'server@streamient.com');
		assert.equal(email.replyTo, 'owner@example.com');
		assert.equal(email.subject, 'Streamient signup: owner@example.com - Date Nov. 12th 2026');
		assert.match(email.text, /Name: Owner/);
		assert.match(email.text, /Host ID: host-1/);
	});
});
