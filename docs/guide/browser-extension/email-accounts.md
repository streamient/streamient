# Email Accounts

The extension can extract emails purely from the web page using [Email Capture](/guide/browser-extension/email-capture), but for the most reliable experience you can also connect a mailbox directly. Once a connector is set up, Kumbukum can sync your inbox server‑side instead of relying on whatever happens to be rendered in the browser.

This is **optional** — basic email capture works without it.

## Connect a mailbox

Open the extension's **Options** page and scroll to **Email Connector (optional)**.

1. **Provider** — pick one of:
   - Fastmail (JMAP) *(recommended for Fastmail)*
   - Fastmail (IMAP)
   - Gmail (IMAP app password)
   - Outlook/365 (IMAP app password)
   - Generic IMAP
   - Generic JMAP
2. **Mailbox Email** — your full email address, e.g. `you@example.com`.
3. **App Password / Token** — provider‑specific. For Gmail and Outlook this is an **app password**, not your regular login password. For Fastmail JMAP it's an API token. For Generic IMAP/JMAP it's whatever your provider issues.
4. Click **Test Connector** to verify Kumbukum can reach your mailbox with the supplied credentials.
5. Click **Setup Connector** to encrypt and save the credentials on the Kumbukum side.

Credentials are encrypted in transit, stored on the Kumbukum backend, and **never persisted in the extension**.

## What changes after connecting

Once the connector is live:

- Emails sync into your **Email Project** (see [Setup](/guide/browser-extension/setup#optional-route-urls-and-email-to-separate-projects)) automatically, not only when you happen to be looking at them.
- In‑browser [Email Capture](/guide/browser-extension/email-capture) still works the same way — it just becomes a fallback for the cases where server‑side sync isn't ahead of you.
- Threading, attachments, and labels are populated from the server source, which is more accurate than DOM extraction.

## Per‑account

Like every other extension setting, this is per‑Kumbukum‑account. If you've added multiple Kumbukum accounts (see [Multiple Accounts](/guide/browser-extension/multiple-accounts)), each one can have its own mailbox connector — or none.

## Provider notes

- **Gmail** — you need to enable 2‑Step Verification and generate an [App Password](https://myaccount.google.com/apppasswords). Use that, not your Google login password.
- **Outlook / Microsoft 365** — same idea: turn on 2‑Step Verification and create an app password under your Microsoft account security settings.
- **Fastmail** — JMAP is more capable than IMAP. Create an API token under **Settings › Privacy & Security › Connected Apps & API Tokens** in Fastmail and use that here.

## Related

- [Email Capture](/guide/browser-extension/email-capture) — the in‑page extraction path that runs even without a connector.
- [Email › Forwarding](/guide/email/forwarding) — the per‑project forwarding address as a third ingest option.
- [Email › Parsing](/guide/email/parsing) — what Kumbukum does with the messages once they arrive.
