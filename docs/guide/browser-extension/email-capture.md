# Email Capture

When the extension detects that you're looking at an email, the side panel switches into email mode and exposes most of the [Email Command Center](/guide/email/viewing) without you ever leaving your inbox.

## Supported clients

- **Gmail** — `mail.google.com`
- **Outlook Web** — `outlook.live.com`, `outlook.office.com`, `outlook.office365.com`
- **Fastmail** — `app.fastmail.com`
- **Generic fallback** — Yahoo Mail, Proton Mail, iCloud Mail, and most other webmail clients, using readability‑style text extraction. Detection still works; only the structured‑field accuracy varies.

For the most reliable extraction on Fastmail, Gmail, and Outlook, also set up an [Email Account connector](/guide/browser-extension/email-accounts) — the extension will use server‑side sync where it's available and fall back to in‑page extraction otherwise.

## Auto‑detection

A content script polls the open tab roughly every 1.5 seconds and re‑runs detection on tab switches, visibility changes, and URL changes. It tries the most accurate extraction first:

1. **Raw RFC 2822 source** when the client exposes the original message (Gmail's "Show original", Outlook's "View message source").
2. **Structured DOM extraction** with provider‑specific selectors.
3. **Page bridge** — for Fastmail and Outlook, a small script is injected into the page context to read React component state directly. This is what powers reliable subject/from/recipient extraction on those clients.

When an email is detected, the side panel shows an **AI** badge so you know it switched into email mode.

## Side panel actions

- **Add Email** — One‑click ingest into Kumbukum. The destination is your **Email Project** (see [Setup](/guide/browser-extension/setup#optional-route-urls-and-email-to-separate-projects)).
- **Summarize email** — Generates and stores the triage summary on the email.
- **Suggest a reply** — Returns two AI‑drafted reply options, each with a copy‑to‑clipboard button.
- **Internal notes** — Threaded private notes on the email, with edit, reply, and delete. These are the same internal notes you see in the app's right panel.
- **Show related** — Cross‑project knowledge search scoped to this email — surfaces related notes, memories, URLs, and other emails.
- **Email AI chat** — Ask questions about the open email, with preset prompts like "What is this asking?", "Sender context?", and "Draft reply".

The Summarize, Suggest reply, and Email AI chat actions all use your [custom email AI instructions](/guide/email/settings#custom-email-instructions), so anything you've tuned in account settings carries over.

## How ingest works

Add Email posts directly to `POST /api/v1/emails` with the extracted headers, body, the raw RFC 2822 source when available, a detection‑mode hint (`raw_source`, `structured_dom`, `fastmail_page_state`, `outlook_page_state`), and `source: 'browser-extension'`.

The extension is an **independent ingest path** — it doesn't need [Forwarding](/guide/email/forwarding) to be configured. Forwarding, the extension, and the [Email Account connector](/guide/browser-extension/email-accounts) can all coexist; use whichever fits the moment.

## Related

- [Email Accounts](/guide/browser-extension/email-accounts) — connect a mailbox for reliable, always‑on email sync.
- [Email › Forwarding](/guide/email/forwarding) — the per‑project forwarding address as an alternative ingest path.
- [Email › Viewing](/guide/email/viewing) — in‑app equivalents of the side panel actions.
- [Email › Triage](/guide/email/triage) — Summarize and Suggest reply share the same AI pipeline.
- [Email › Settings](/guide/email/settings) — custom email AI instructions also drive the extension's summaries and suggestions.
