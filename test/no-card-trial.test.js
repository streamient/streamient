import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { buildHostedTrialFields } from '../routes/auth.js';
import { BILLING_SUBSCRIPTION_URL, buildCheckoutSessionParams, buildPortalSessionParams, buildSubscriptionUserUpdate, resolveCheckoutPlan, resolveCheckoutPriceId } from '../services/billing_service.js';
import { formatSignupNotificationDate } from '../services/email_service.js';
import { runEmailRetentionCleanup, runTrialLifecycle } from '../modules/scheduler.js';
import { deleteTenantData, getTenantTypesenseCollectionNames } from '../services/account_cleanup_service.js';
import { formatTrialEndsIn, hasProductAccess, hasProFeatureAccess } from '../services/subscription_access_service.js';

describe('no-card trial signup and billing helpers', () => {
	it('builds hosted no-card trial fields from configured trial days', () => {
		const now = new Date('2026-01-01T00:00:00.000Z');
		const fields = buildHostedTrialFields(now, 7);

		assert.equal(fields.subscription_status, 'trialing');
		assert.equal(fields.trial_source, 'no_card');
		assert.equal(fields.trial_ends_at.toISOString(), '2026-01-08T00:00:00.000Z');
	});

	it('formats signup notification dates with month and ordinal day', () => {
		assert.equal(formatSignupNotificationDate(new Date(2026, 10, 12)), 'Nov. 12th 2026');
		assert.equal(formatSignupNotificationDate(new Date(2026, 10, 1)), 'Nov. 1st 2026');
		assert.equal(formatSignupNotificationDate(new Date(2026, 10, 22)), 'Nov. 22nd 2026');
	});

	it('creates paid Checkout params without adding a second Stripe trial', () => {
		const params = buildCheckoutSessionParams({ _id: 'user-1' }, 'cus_123', 'price_123');

		assert.equal(params.mode, 'subscription');
		assert.equal(params.payment_method_collection, 'always');
		assert.deepEqual(params.line_items, [{ price: 'price_123', quantity: 1 }]);
		assert.equal(params.metadata.kumbukum_user_id, 'user-1');
		assert.equal(params.cancel_url, BILLING_SUBSCRIPTION_URL);
		assert.equal(Object.hasOwn(params, 'subscription_data'), false);
	});

	it('returns from Stripe portal to the production subscription settings page', () => {
		const params = buildPortalSessionParams({ stripe_customer_id: 'cus_123' });

		assert.equal(params.customer, 'cus_123');
		assert.equal(params.return_url, BILLING_SUBSCRIPTION_URL);
	});

	it('uses legacy Stripe price ID as the Starter checkout fallback', () => {
		const original = {
			priceId: config.stripe.priceId,
			starterPriceId: config.stripe.starterPriceId,
			proPriceId: config.stripe.proPriceId,
		};
		config.stripe.priceId = 'price_legacy';
		config.stripe.starterPriceId = '';
		config.stripe.proPriceId = 'price_pro';

		try {
			assert.equal(resolveCheckoutPriceId('starter'), 'price_legacy');
			assert.equal(resolveCheckoutPriceId('pro'), 'price_pro');
		} finally {
			config.stripe.priceId = original.priceId;
			config.stripe.starterPriceId = original.starterPriceId;
			config.stripe.proPriceId = original.proPriceId;
		}
	});

	it('defaults Checkout to Starter unless Pro is explicitly requested', () => {
		assert.equal(resolveCheckoutPlan(), 'starter');
		assert.equal(resolveCheckoutPlan('starter'), 'starter');
		assert.equal(resolveCheckoutPlan('pro'), 'pro');
		assert.equal(resolveCheckoutPlan('enterprise'), 'starter');
	});

	it('clears no-card trial lock fields when Stripe subscription state is applied', () => {
		const update = buildSubscriptionUserUpdate({ id: 'sub_123', status: 'active', trial_end: null }, 'cus_123');

		assert.equal(update.stripe_customer_id, 'cus_123');
		assert.equal(update.stripe_subscription_id, 'sub_123');
		assert.equal(update.subscription_status, 'active');
		assert.equal(update.trial_source, null);
		assert.equal(update.trial_ends_at, null);
		assert.equal(update.trial_reminder_3d_sent_at, null);
		assert.equal(update.trial_reminder_24h_sent_at, null);
		assert.equal(update.trial_locked_at, null);
	});
});

describe('no-card trial scheduler lifecycle', () => {
	it('sends separate reminders, expires trials, and deletes abandoned no-card tenants', async () => {
		const now = new Date('2026-01-01T09:00:00.000Z');
		const threeDayUser = {
			_id: 'user-3d',
			email: 'three@example.com',
			name: 'Three',
			trial_ends_at: new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000),
		};
		const twentyFourHourUser = {
			_id: 'user-24h',
			email: 'day@example.com',
			name: 'Day',
			trial_ends_at: new Date(now.getTime() + 6 * 60 * 60 * 1000),
		};
		const expiredUser = {
			_id: 'user-expired',
			email: 'expired@example.com',
			name: 'Expired',
			trial_ends_at: new Date(now.getTime() - 60 * 1000),
		};
		const deleteUser = {
			_id: 'user-delete',
			email: 'delete@example.com',
			host_id: 'host-delete',
			tenant: 'tenant-delete',
			trial_ends_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
		};
		const duplicateHostUser = {
			_id: 'user-delete-2',
			email: 'delete2@example.com',
			host_id: 'host-delete',
			tenant: 'tenant-delete',
			trial_ends_at: deleteUser.trial_ends_at,
		};

		const findResponses = [[threeDayUser], [twentyFourHourUser], [expiredUser], [deleteUser, duplicateHostUser]];
		const findQueries = [];
		const updateOneCalls = [];
		const userModel = {
			find: async (query) => {
				findQueries.push(query);
				return findResponses.shift();
			},
			updateOne: async (query, update) => {
				updateOneCalls.push({ query, update });
				return { modifiedCount: 1 };
			},
		};
		const threeDayEmails = [];
		const twentyFourHourEmails = [];
		const expiredEmails = [];
		const deletedTenants = [];

		const summary = await runTrialLifecycle({
			now,
			userModel,
			send3DayEmail: async (email) => threeDayEmails.push(email),
			send24HourEmail: async (email) => twentyFourHourEmails.push(email),
			sendExpiredEmail: async (email) => expiredEmails.push(email),
			deleteTenant: async (hostId, tenantId) => deletedTenants.push({ hostId, tenantId }),
		});

		assert.deepEqual(threeDayEmails, ['three@example.com']);
		assert.deepEqual(twentyFourHourEmails, ['day@example.com']);
		assert.deepEqual(expiredEmails, ['expired@example.com']);
		assert.equal(updateOneCalls[0].update.$set.trial_reminder_3d_sent_at, now);
		assert.equal(updateOneCalls[1].update.$set.trial_reminder_24h_sent_at, now);
		assert.equal(updateOneCalls[2].update.$set.subscription_status, 'trial_expired');
		assert.equal(updateOneCalls[2].update.$set.trial_locked_at, now);
		assert.equal(findQueries[2].trial_locked_at, null);
		assert.equal(findQueries[3].subscription_status.$ne, 'active');
		assert.deepEqual(deletedTenants, [{ hostId: 'host-delete', tenantId: 'tenant-delete' }]);
		assert.deepEqual(summary, { reminders_3d: 1, reminders_24h: 1, expired: 1, deleted: 1 });
	});
});

describe('email retention scheduler cleanup', () => {
	it('permanently deletes spam and trash emails older than 30 days', async () => {
		const now = new Date('2026-01-31T02:30:00.000Z');
		const trashEmail = { _id: 'trash-email', host_id: 'host-1' };
		const spamEmail = { _id: 'spam-email', host_id: 'host-2' };
		const findQueries = [];
		const findLimits = [];
		const deleteQueries = [];
		const removedSearchDocs = [];
		const removedGraphLinks = [];
		const findBatches = [[trashEmail, spamEmail], []];
		const emailModel = {
			find: (query) => ({
				select: (fields) => {
					assert.equal(fields, '_id host_id');
					return {
						limit: (limit) => {
							findQueries.push(query);
							findLimits.push(limit);
							return {
								lean: async () => findBatches.shift(),
							};
						},
					};
				},
			}),
			deleteMany: async (query) => {
				deleteQueries.push(query);
				return { deletedCount: query._id.$in.length };
			},
		};

		const summary = await runEmailRetentionCleanup({
			now,
			emailModel,
			batchSize: 25,
			removeSearchDocument: async (hostId, type, id) => removedSearchDocs.push({ hostId, type, id }),
			removeGraphLinks: async (hostId, id) => removedGraphLinks.push({ hostId, id }),
		});

		assert.equal(summary.deleted, 2);
		assert.equal(summary.cutoff.toISOString(), '2026-01-01T02:30:00.000Z');
		assert.equal(findLimits[0], 25);
		assert.deepEqual(findQueries[0], {
			$or: [
				{ in_trash: true, trashed_at: { $lte: summary.cutoff } },
				{ in_trash: { $ne: true }, mailbox: 'spam', updatedAt: { $lte: summary.cutoff } },
			],
		});
		assert.deepEqual(deleteQueries, [{ _id: { $in: ['trash-email', 'spam-email'] } }]);
		assert.deepEqual(removedSearchDocs, [
			{ hostId: 'host-1', type: 'emails', id: 'trash-email' },
			{ hostId: 'host-2', type: 'emails', id: 'spam-email' },
		]);
		assert.deepEqual(removedGraphLinks, [
			{ hostId: 'host-1', id: 'trash-email' },
			{ hostId: 'host-2', id: 'spam-email' },
		]);
	});
});

describe('subscription product access', () => {
	it('locks no-card trials immediately after trial_ends_at', () => {
		const now = new Date('2026-01-08T00:00:00.000Z');

		assert.equal(hasProductAccess({ subscription_status: 'active' }, now), true);
		assert.equal(hasProductAccess({ subscription_status: 'trialing', trial_source: 'stripe' }, now), true);
		assert.equal(hasProductAccess({
			subscription_status: 'trialing',
			trial_source: 'no_card',
			trial_ends_at: new Date('2026-01-08T00:00:01.000Z'),
		}, now), true);
		assert.equal(hasProductAccess({
			subscription_status: 'trialing',
			trial_source: 'no_card',
			trial_ends_at: new Date('2026-01-08T00:00:00.000Z'),
		}, now), false);
		assert.equal(hasProductAccess({ subscription_status: 'trial_expired' }, now), false);
	});

	it('allows active trials to use Pro-gated features', () => {
		const now = new Date('2026-01-07T00:00:00.000Z');
		const trialUser = {
			subscription_status: 'trialing',
			trial_source: 'no_card',
			trial_ends_at: new Date('2026-01-08T00:00:00.000Z'),
		};
		const expiredTrialUser = {
			...trialUser,
			trial_ends_at: new Date('2026-01-06T00:00:00.000Z'),
		};

		assert.equal(hasProFeatureAccess(trialUser, 'free', true, now), true);
		assert.equal(hasProFeatureAccess(expiredTrialUser, 'free', true, now), false);
		assert.equal(hasProFeatureAccess({ subscription_status: 'active' }, 'starter', true, now), false);
		assert.equal(hasProFeatureAccess(null, 'free', false, now), true);
	});

	it('formats trial end text as days remaining', () => {
		const now = new Date('2026-01-01T00:00:00.000Z');

		assert.equal(formatTrialEndsIn({
			trial_ends_at: new Date('2026-01-08T00:00:00.000Z'),
		}, now), 'Trial ends in 7 days');
		assert.equal(formatTrialEndsIn({
			trial_ends_at: new Date('2026-01-05T00:00:00.000Z'),
		}, now), 'Trial ends in 4 days');
		assert.equal(formatTrialEndsIn({
			trial_ends_at: new Date('2026-01-02T00:00:00.000Z'),
		}, now), 'Trial ends in 1 day');
	});
});

describe('no-card trial tenant cleanup', () => {
	function makeDeleteModel(name, calls) {
		return {
			deleteMany: async (query) => {
				calls[name] = query;
				return { deletedCount: 1 };
			},
		};
	}

	it('removes tenant data, files, git directory, and all tenant Typesense collections', async () => {
		const calls = {};
		const models = {};
		for (const name of [
			'Note',
			'Memory',
				'Url',
					'Email',
					'EmailDraft',
					'EmailInternalNote',
					'EmailIdentity',
					'OutgoingEmail',
					'Project',
			'GraphLink',
			'GitRepo',
			'OAuthAuthorizationCode',
			'OAuthClient',
			'OAuthConsent',
			'OAuthRefreshToken',
			'TeamInvite',
			'TenantMember',
			'Export',
			'AuditLog',
			'UserPasskey',
			'MagicLink',
		]) {
			models[name] = makeDeleteModel(name, calls);
		}
		models.User = {
			find: () => ({
				select: () => ({
					lean: async () => [{ _id: 'user-1', email: 'owner@example.com' }],
				}),
			}),
			deleteMany: async (query) => {
				calls.User = query;
				return { deletedCount: 1 };
			},
		};
		models.Tenant = {
			findById: async () => ({ _id: 'tenant-1' }),
			findByIdAndDelete: async (tenantId) => {
				calls.Tenant = tenantId;
				return { _id: tenantId };
			},
		};
		models.Export.find = () => ({
			select: () => ({
				lean: async () => [{ file_path: '/tmp/kumbukum-export.zip' }],
			}),
		});

		const deletedCollections = [];
		const unlinkedFiles = [];
		let deletedGitHost = '';

		const result = await deleteTenantData('host-1', 'tenant-1', {
			models,
			deleteTypesenseCollection: async (collectionName) => {
				deletedCollections.push(collectionName);
				return true;
			},
			deleteGitRepoHostDirectory: (hostId) => {
				deletedGitHost = hostId;
			},
			unlink: (filePath, callback) => {
				unlinkedFiles.push(filePath);
				callback();
			},
		});

		assert.equal(calls.Email.host_id, 'host-1');
		assert.equal(calls.EmailInternalNote.host_id, 'host-1');
		assert.equal(calls.OutgoingEmail.host_id, 'host-1');
		assert.equal(calls.GraphLink.host_id, 'host-1');
		assert.equal(calls.OAuthRefreshToken.host_id, 'host-1');
		assert.deepEqual(calls.UserPasskey.user.$in, ['user-1']);
		assert.deepEqual(calls.MagicLink.user.$in, ['user-1']);
		assert.deepEqual(calls.User._id.$in, ['user-1']);
		assert.equal(calls.Tenant, 'tenant-1');
		assert.deepEqual(unlinkedFiles, ['/tmp/kumbukum-export.zip']);
		assert.equal(deletedGitHost, 'host-1');
		assert.deepEqual(deletedCollections, getTenantTypesenseCollectionNames('host-1'));
		assert.equal(result.deleted, true);
		assert.equal(result.users, 1);
		assert.equal(result.export_files, 1);
		assert.equal(result.typesense_collections_deleted, 6);
	});
});
