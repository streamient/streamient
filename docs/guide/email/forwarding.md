# Forwarding Email

Forwarding is how email gets into Kumbukum. Each project has its own forwarding address — send a message to that address, and Kumbukum ingests it into the project.

## Find your forwarding address

1. Open the project you want email to land in.
2. Click **Settings**.
3. Scroll to the **Email forwarding** section.
4. Copy the address shown in the read‑only field (use the **Copy** button next to it).

The address looks like:

```
<project-id>@<email-forward-domain>
```

For example: `507f1f77bcf86cd799439011@email.kumbukum.com`.

Each project has a different address. Send the same email to two different project addresses and it'll be ingested into both projects independently.

## Point your mail at it

You have two common options:

### Server‑side forwarding rule

In your mailbox provider (Gmail, Fastmail, Outlook, etc.), set up a forwarding rule for the messages you want in Kumbukum and target your project address. Most providers require you to verify the destination address once before forwarding will work — Kumbukum receives the verification email and shows it in the project inbox.

### Plus‑addressing or aliases

If you want a stable, public‑facing address that ends up in Kumbukum, set up an alias at your provider (or an `address+suffix@…` style alias) that auto‑forwards to your project address. That way you can give out one address and route everything through it.

## Plan and configuration requirements

:::tabs
== Cloud
Email forwarding is available on the **Pro plan**. On lower plans the forwarding address is hidden and incoming forwards are silently rejected. The forwarding domain is preconfigured for Cloud — no setup needed on your end beyond pointing your mail at the address.
== Self-Hosted
You must set `EMAIL_FORWARD_DOMAIN` in your environment before forwarding will work. Until it's set, the project settings page shows a warning instead of an address. The domain you choose must be one where you control DNS — point its MX records at whatever mail receiver you use (Postmark inbound, Cloudflare Email Routing, a self‑hosted SMTP receiver, etc.) and have it `POST` parsed messages to `/import/email`.

There is no plan gate on self‑hosted — once `EMAIL_FORWARD_DOMAIN` is set, forwarding works for every project.
:::

## What happens after the email arrives

Once your mail provider hands the message to Kumbukum:

1. The recipient domain is checked against the configured forward domain.
2. The local part of the address is matched to a project ID.
3. The message is parsed and stored — see [Parsing](/guide/email/parsing) for the details.
4. If [automatic triage](/guide/email/settings#automation) is on, the email is queued for triage right away. Otherwise it sits in the project inbox until you trigger triage from the [ECC](/guide/email/viewing).

If the address matches a project that doesn't exist (or is inactive), the request is acknowledged but no email is stored — your mail provider won't see a bounce.

## Alternatives to forwarding

You don't have to use the forwarding address at all. Two other paths get email into Kumbukum:

- **Browser extension** — install the [Browser Extension](/guide/browser-extension/email-capture) and use **Add Email** in the side panel while you're reading the message in Gmail, Outlook, or Fastmail. No DNS, no provider setup, no Pro plan gate.
- **API** — `POST` directly to the [`/api/v1/emails` ingest endpoint](/api/emails#ingest) with an API token and an explicit `project` field. This is what external integrations use.

Forwarding, the extension, and the API can all coexist — pick whichever fits the moment.

## Related

- [Parsing](/guide/email/parsing) — what Kumbukum does with the message once it's accepted.
- [Settings](/guide/email/settings) — turn on auto‑triage.
- [Viewing](/guide/email/viewing) — find the forwarded email in the inbox.
- [Browser Extension](/guide/browser-extension/email-capture) — the no‑forwarding ingest option for in‑browser email clients.
