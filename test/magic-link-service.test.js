import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MagicLink } from '../model/magic_link.js';
import { User } from '../model/user.js';
import { isMagicLinkValid, sendMagicLink, verifyMagicLink } from '../services/magic_link_service.js';

describe('magic link flow hardening', () => {
	it('uses a supplied user ID without a post-commit user lookup', async () => {
		let generatedFor = null;
		let sent = null;
		const result = await sendMagicLink('owner@example.com', 'https://app.example.com', {
			userId: 'new-user-id',
			generateLink: async (userId) => {
				generatedFor = userId;
				return { token: 'new-token' };
			},
			sendEmail: async (email, token, baseUrl) => {
				sent = { email, token, baseUrl };
				return { messageId: 'message-1' };
			},
		});

		assert.equal(result, true);
		assert.equal(generatedFor, 'new-user-id');
		assert.deepEqual(sent, {
			email: 'owner@example.com',
			token: 'new-token',
			baseUrl: 'https://app.example.com',
		});
	});

	it('reads from primary and returns false when no user exists', async () => {
		const originalFindOne = User.findOne;
		let readPreference = null;

		try {
			User.findOne = () => ({
				select() {
					return this;
				},
				read(preference) {
					readPreference = preference;
					return Promise.resolve(null);
				},
			});

			const result = await sendMagicLink('missing@example.com');
			assert.equal(result, false);
			assert.equal(readPreference, 'primary');
		} finally {
			User.findOne = originalFindOne;
		}
	});

	it('returns false when no SMTP delivery occurs', async () => {
		const result = await sendMagicLink('owner@example.com', null, {
			userId: 'user-1',
			generateLink: async () => ({ token: 'token-1' }),
			sendEmail: async () => undefined,
		});

		assert.equal(result, false);
	});

	it('checks link validity without consuming token', async () => {
		const originalFindOne = MagicLink.findOne;
		const originalVerify = MagicLink.verify;

		let capturedQuery = null;
		let verifyCalled = false;

		try {
			MagicLink.findOne = (query) => {
				capturedQuery = query;
				return {
					select() {
						return { _id: 'magic-id' };
					},
				};
			};
			MagicLink.verify = async () => {
				verifyCalled = true;
				return null;
			};

			const isValid = await isMagicLinkValid('token-123');
			assert.equal(isValid, true);
			assert.equal(capturedQuery.token, 'token-123');
			assert.equal(capturedQuery.used, false);
			assert.equal(verifyCalled, false);
			assert.ok(capturedQuery.expires_at?.$gt instanceof Date);
		} finally {
			MagicLink.findOne = originalFindOne;
			MagicLink.verify = originalVerify;
		}
	});

	it('consumes token exactly once through verification', async () => {
		const originalVerify = MagicLink.verify;
		const originalFindById = User.findById;

		let verifyCount = 0;

		try {
			MagicLink.verify = async () => {
				verifyCount += 1;
				if (verifyCount === 1) return { user: 'user-1' };
				return null;
			};
			User.findById = async () => ({ _id: 'user-1', is_active: true });

			const firstResult = await verifyMagicLink('token-once');
			const secondResult = await verifyMagicLink('token-once');

			assert.equal(firstResult?._id, 'user-1');
			assert.equal(secondResult, null);
			assert.equal(verifyCount, 2);
		} finally {
			MagicLink.verify = originalVerify;
			User.findById = originalFindById;
		}
	});

	it('keeps token redeemable after preview-like validity check', async () => {
		const originalFindOne = MagicLink.findOne;
		const originalVerify = MagicLink.verify;
		const originalFindById = User.findById;

		let verifyCount = 0;

		try {
			MagicLink.findOne = () => ({
				select() {
					return { _id: 'still-unused' };
				},
			});
			MagicLink.verify = async () => {
				verifyCount += 1;
				return { user: 'user-2' };
			};
			User.findById = async () => ({ _id: 'user-2', is_active: true });

			const previewIsValid = await isMagicLinkValid('preview-token');
			const loginUser = await verifyMagicLink('preview-token');

			assert.equal(previewIsValid, true);
			assert.equal(loginUser?._id, 'user-2');
			assert.equal(verifyCount, 1);
		} finally {
			MagicLink.findOne = originalFindOne;
			MagicLink.verify = originalVerify;
			User.findById = originalFindById;
		}
	});
});
