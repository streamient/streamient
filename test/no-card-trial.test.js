import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import config from '../config.js';
import { buildHostedTrialFields } from '../routes/auth.js';
import { BILLING_SUBSCRIPTION_URL, buildCheckoutSessionParams, buildPortalSessionParams, buildStripeCustomerParams, buildSubscriptionUserUpdate, createCheckoutSession, ensureStripeCustomerForAccountHolder, resolveCheckoutPlan, resolveCheckoutPriceId } from '../services/billing_service.js';
import { formatSignupNotificationDate } from '../services/email_service.js';
import { runEmailRetentionCleanup, runTrialLifecycle } from '../modules/scheduler.js';
import { deleteTenantData, getTenantTypesenseCollectionNames } from '../services/account_cleanup_service.js';
import { formatTrialEndsIn, hasProductAccess, hasProFeatureAccess, pickBillingUser } from '../services/subscription_access_service.js';

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
		assert.equal(params.metadata.streamient_user_id, 'user-1');
		assert.equal(params.cancel_url, BILLING_SUBSCRIPTION_URL);
		assert.equal(Object.hasOwn(params, 'subscription_data'), false);
	});

	it('returns from Stripe portal to the production subscription settings page', () => {
		const params = buildPortalSessionParams({ stripe_customer_id: 'cus_123' });

		assert.equal(params.customer, 'cus_123');
		assert.equal(params.return_url, BILLING_SUBSCRIPTION_URL);
	});

	it('always resolves the Pro price for checkout (Pro is the only paid plan)', () => {
		const original = config.stripe.proPriceId;
		config.stripe.proPriceId = 'price_pro';
		try {
			assert.equal(resolveCheckoutPriceId(), 'price_pro');
		} finally {
			config.stripe.proPriceId = original;
		}
	});

	it('always resolves the Pro plan for checkout', () => {
		assert.equal(resolveCheckoutPlan(), 'pro');
		assert.equal(resolveCheckoutPlan('free'), 'pro');
		assert.equal(resolveCheckoutPlan('pro'), 'pro');
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

	it('builds Stripe customer params with host_id as the customer id', () => {
		const params = buildStripeCustomerParams(
			{
				_id: 'user-1',
				email: 'owner@example.com',
				name: 'Owner User',
				host_id: 'old-host',
				tenant: 'old-tenant',
			},
			{
				_id: 'tenant-1',
				host_id: 'host-1',
			},
		);

		assert.equal(params.id, 'host-1');
		assert.equal(params.email, 'owner@example.com');
		assert.equal(params.name, 'Owner User');
		assert.equal(params.metadata.host_id, 'host-1');
		assert.equal(params.metadata.tenant_id, 'tenant-1');
		assert.equal(params.metadata.streamient_user_id, 'user-1');
		assert.equal(params.metadata['Customer Type'], 'streamient');
	});

	it('creates a Stripe customer with host_id and stores it on the account holder', async () => {
		const user = {
			_id: 'user-1',
			email: 'owner@example.com',
			name: 'Owner User',
			host_id: 'host-1',
			tenant: 'tenant-1',
		};
		const tenant = { _id: 'tenant-1', host_id: 'host-1' };
		let createdPayload;
		let updateCall;
		const stripe = {
			customers: {
				create: async (payload) => {
					createdPayload = payload;
					return { id: payload.id };
				},
			},
		};
		const userModel = {
			findByIdAndUpdate: async (...args) => {
				updateCall = args;
				return null;
			},
		};

		const customerId = await ensureStripeCustomerForAccountHolder(user, tenant, { stripe, userModel });

		assert.equal(customerId, 'host-1');
		assert.equal(createdPayload.id, 'host-1');
		assert.deepEqual(updateCall, ['user-1', { stripe_customer_id: 'host-1' }]);
		assert.equal(user.stripe_customer_id, 'host-1');
	});

	it('reuses a Stripe customer when the custom host_id customer already exists', async () => {
		const user = {
			_id: 'user-1',
			email: 'owner@example.com',
			name: 'Owner User',
			host_id: 'host-1',
			tenant: 'tenant-1',
		};
		let retrieveId;
		let updateCall;
		const stripe = {
			customers: {
				create: async () => {
					const err = new Error('Customer already exists');
					err.raw = { code: 'resource_already_exists' };
					throw err;
				},
				retrieve: async (id) => {
					retrieveId = id;
					return { id };
				},
			},
		};
		const userModel = {
			findByIdAndUpdate: async (...args) => {
				updateCall = args;
				return null;
			},
		};

		const customerId = await ensureStripeCustomerForAccountHolder(user, null, { stripe, userModel });

		assert.equal(customerId, 'host-1');
		assert.equal(retrieveId, 'host-1');
		assert.deepEqual(updateCall, ['user-1', { stripe_customer_id: 'host-1' }]);
	});

	it('does not recreate existing Stripe customers, including legacy cus ids', async () => {
		const user = {
			_id: 'user-1',
			email: 'owner@example.com',
			name: 'Owner User',
			host_id: 'host-1',
			tenant: 'tenant-1',
			stripe_customer_id: 'cus_legacy',
		};
		let createCalled = false;
		let updateCalled = false;
		const stripe = {
			customers: {
				create: async () => {
					createCalled = true;
					return { id: 'host-1' };
				},
			},
		};
		const userModel = {
			findByIdAndUpdate: async () => {
				updateCalled = true;
			},
		};

		const customerId = await ensureStripeCustomerForAccountHolder(user, null, { stripe, userModel });

		assert.equal(customerId, 'cus_legacy');
		assert.equal(createCalled, false);
		assert.equal(updateCalled, false);
	});

	it('creates the host_id Stripe customer before checkout when missing', async () => {
		const original = config.stripe.proPriceId;
		config.stripe.proPriceId = 'price_pro';
		const user = {
			_id: 'user-1',
			email: 'owner@example.com',
			name: 'Owner User',
			host_id: 'host-1',
			tenant: 'tenant-1',
		};
		let checkoutParams;
		let updateCall;
		const stripe = {
			customers: {
				create: async (payload) => ({ id: payload.id }),
			},
			checkout: {
				sessions: {
					create: async (params) => {
						checkoutParams = params;
						return { url: 'https://checkout.example/session' };
					},
				},
			},
		};
		const userModel = {
			findByIdAndUpdate: async (...args) => {
				updateCall = args;
				return null;
			},
		};

		try {
			const url = await createCheckoutSession(user, { stripe, userModel });

			assert.equal(url, 'https://checkout.example/session');
			assert.equal(checkoutParams.customer, 'host-1');
			assert.equal(checkoutParams.line_items[0].price, 'price_pro');
			assert.deepEqual(updateCall, ['user-1', { stripe_customer_id: 'host-1' }]);
		} finally {
			config.stripe.proPriceId = original;
		}
	});
});

describe('no-card trial scheduler lifecycle', () => {
	it('sends separate reminders and downgrades expired trials to Free (no tenant deletion)', async () => {
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

		const findResponses = [[threeDayUser], [twentyFourHourUser], [expiredUser]];
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

		const summary = await runTrialLifecycle({
			now,
			userModel,
			send3DayEmail: async (email) => threeDayEmails.push(email),
			send24HourEmail: async (email) => twentyFourHourEmails.push(email),
			sendExpiredEmail: async (email) => expiredEmails.push(email),
		});

		assert.deepEqual(threeDayEmails, ['three@example.com']);
		assert.deepEqual(twentyFourHourEmails, ['day@example.com']);
		assert.deepEqual(expiredEmails, ['expired@example.com']);
		assert.equal(updateOneCalls[0].update.$set.trial_reminder_3d_sent_at, now);
		assert.equal(updateOneCalls[1].update.$set.trial_reminder_24h_sent_at, now);
		assert.equal(updateOneCalls[2].update.$set.subscription_status, 'trial_expired');
		assert.equal(updateOneCalls[2].update.$set.trial_locked_at, now);
		assert.equal(findQueries[2].trial_locked_at, null);
		// No deletion phase: only three find() calls (3d, 24h, expired).
		assert.equal(findQueries.length, 3);
		assert.deepEqual(summary, { reminders_3d: 1, reminders_24h: 1, expired: 1 });
	});
});

describe('email retention scheduler cleanup', () => {
	it('permanently deletes spam and trash emails older than 30 days', async () => {
		const now = new Date('2026-01-31T02:30:00.000Z');
		const trashEmail = { _id: 'trash-email', host_id: 'host-1' };
		const secondTrashEmail = { _id: 'trash-email-2', host_id: 'host-1' };
		const spamEmail = { _id: 'spam-email', host_id: 'host-2' };
		const findQueries = [];
		const findLimits = [];
		const deleteQueries = [];
		const removedSearchDocs = [];
		const removedGraphLinks = [];
		const findBatches = [[trashEmail, secondTrashEmail, spamEmail], []];
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
			removeSearchDocuments: async (hostId, type, ids) => removedSearchDocs.push({ hostId, type, ids }),
			removeGraphLinks: async (hostId, ids) => removedGraphLinks.push({ hostId, ids }),
		});

		assert.equal(summary.deleted, 3);
		assert.equal(summary.cutoff.toISOString(), '2026-01-01T02:30:00.000Z');
		assert.equal(findLimits[0], 25);
		assert.deepEqual(findQueries[0], {
			$or: [
				{ in_trash: true, trashed_at: { $lte: summary.cutoff } },
				{ in_trash: { $ne: true }, mailbox: 'spam', updatedAt: { $lte: summary.cutoff } },
			],
		});
		assert.deepEqual(deleteQueries, [{ _id: { $in: ['trash-email', 'trash-email-2', 'spam-email'] } }]);
		assert.deepEqual(removedSearchDocs, [
			{ hostId: 'host-1', type: 'emails', ids: ['trash-email', 'trash-email-2'] },
			{ hostId: 'host-2', type: 'emails', ids: ['spam-email'] },
		]);
		assert.deepEqual(removedGraphLinks, [
			{ hostId: 'host-1', ids: ['trash-email', 'trash-email-2'] },
			{ hostId: 'host-2', ids: ['spam-email'] },
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
		assert.equal(hasProFeatureAccess({ subscription_status: 'incomplete' }, 'free', true, now), false);
		assert.equal(hasProFeatureAccess({ subscription_status: 'active' }, 'pro', true, now), true);
		assert.equal(hasProFeatureAccess(null, 'free', false, now), true);
	});

	it('uses the tenant owner as the billing user when a member is signed in', () => {
		const member = { _id: 'member-id', subscription_status: 'incomplete' };
		const owner = { _id: 'owner-id', subscription_status: 'active' };

		assert.equal(pickBillingUser(member, owner), owner);
		assert.equal(hasProductAccess(pickBillingUser(member, owner)), true);
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
				'CrawlState',
					'Email',
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
				lean: async () => [{ file_path: '/tmp/streamient-export.zip' }],
			}),
		});

		const deletedCollections = [];
		const unlinkedFiles = [];
		let deletedGitHost = '';
		let conversationCleanupHost = '';

		const result = await deleteTenantData('host-1', 'tenant-1', {
			models,
			deleteTypesenseCollection: async (collectionName) => {
				deletedCollections.push(collectionName);
				return true;
			},
			deleteConversationDataForHost: async (hostId) => {
				conversationCleanupHost = hostId;
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
		assert.equal(calls.CrawlState.host_id, 'host-1');
		assert.equal(calls.GraphLink.host_id, 'host-1');
		assert.equal(calls.OAuthRefreshToken.host_id, 'host-1');
		assert.deepEqual(calls.UserPasskey.user.$in, ['user-1']);
		assert.deepEqual(calls.MagicLink.user.$in, ['user-1']);
		assert.deepEqual(calls.User._id.$in, ['user-1']);
		assert.equal(calls.Tenant, 'tenant-1');
		assert.deepEqual(unlinkedFiles, ['/tmp/streamient-export.zip']);
		assert.equal(deletedGitHost, 'host-1');
		assert.equal(conversationCleanupHost, 'host-1');
		assert.deepEqual(deletedCollections, getTenantTypesenseCollectionNames('host-1'));
		assert.equal(result.deleted, true);
		assert.equal(result.users, 1);
		assert.equal(result.export_files, 1);
		assert.equal(result.typesense_collections_deleted, 5);
	});
});
