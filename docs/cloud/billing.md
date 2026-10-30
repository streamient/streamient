---
title: Streamient Cloud Pricing and Billing
description: "Compare Streamient Cloud Free and Pro plans, understand billing and trial behavior, and manage upgrades, downgrades, cancellations, and invoices."
---

# Billing

## Plans

Streamient Cloud offers two plans:

| | Free | Pro |
|---|---|---|
| Price | $0 | $49/month launch pricing (regularly $99) — locked in while you stay subscribed |
| Projects | 1 | Unlimited |
| Users | Unlimited | Unlimited |
| AI | Built-in AI included, 50 AI requests per workspace per day — or bring your own OpenAI/Gemini key for unlimited use on your own quota | Advanced AI model, unlimited requests (own key optional) |
| Notes, memories, URLs, stored emails | Unlimited | Unlimited |
| MCP tools, API, browser extension | Included | Included |
| Email AI, Git sync, scoped tokens, white-labeling | — | Included |

Free is a permanent plan — no credit card and no API key required to get started.

## Managing Your Subscription

Manage your subscription at **Settings > Billing**:

- View current plan and usage
- Upgrade or downgrade your plan
- Update payment method

Billing management requires a signed-in browser session with the appropriate account role. Knowledge API tokens and connected AI apps do not grant access to the billing portal.

## Payment Methods

We accept:

- Credit and debit cards (Visa, Mastercard, American Express)

## Free Trial

Streamient Cloud includes a one-time 7-day Pro trial. You can start it any time from **Settings > Billing**, without entering a credit card.

Trial reminder emails are sent 3 days before the trial ends and again about 24 hours before the trial ends. When the trial ends without a subscription, the workspace returns to the Free plan — your data stays intact and Streamient sends a trial-expired email.

## Invoices

Invoices are generated automatically for each billing cycle. Download past invoices from **Settings > Billing > Invoices**.

## Cancellation

You can cancel your subscription at any time from **Settings > Billing**. Your data remains accessible until the end of the current billing period.

After your subscription ends, you can subscribe again from **Settings > Billing**. Streamient checks that the previous checkout subscription has ended before opening a new payment session.

After cancellation, you can export your data or move to a [self-hosted installation](/selfhosted/) without changing how Streamient works for your team.

## Subscription and access safeguards

Use the billing portal to manage an existing subscription, including overdue payments. Checkout cannot replace a different current paid subscription.

Email lists, counts, search results, and AI chat context require Pro or an active Pro trial on Cloud. Self-hosted access is unchanged. Concurrent project creation respects the account's stored project limit.

Repeated checkout requests reuse the account’s open payment session. If checkout cannot confirm its state, it stops instead of opening another payable session. Concurrent team additions respect the user limit; rejected additions do not create user accounts.

Trial reminders retry confirmed delivery failures. An interrupted send with an unknown delivery result is not retried automatically, to avoid duplicate messages.
