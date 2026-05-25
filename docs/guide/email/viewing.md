# Viewing Emails

The **Email Command Center** (ECC) at `/ecc` is where you read, triage, reply to, and organize email in Kumbukum. Click **Email** in the top navigation to open it.

::: tip In the browser, or in the app
If you spend your day in Gmail, Outlook, or Fastmail, the [Browser Extension](/guide/browser-extension/email-capture) brings most of the ECC actions — Summarize, Suggest reply, Internal notes, Show related, Email AI chat — into a side panel inside your mail client. Same Kumbukum data, no context switch.
:::

## Layout

The ECC has three panels.

### Left panel — mailboxes and labels

- **Project filter** — defaults to **All projects**. Pick a single project to narrow everything below to just that project's email.
- **Mailboxes** — Inbox, Drafts, Sent, Archived, Spam, Trash. Each shows an unread/item count.
- **Labels** — system labels (reply‑required, human‑do, waiting, no‑action, spam) and any custom labels you've created. Click a label to filter the list.

### Main panel — list and detail

The main panel switches between a list view and a detail view.

**List view** shows one row per email (or per thread, for the Sent mailbox, which collapses to the latest message per thread). Multi‑select rows with the checkbox to open the batch action bar — move, retriage, or trash all selected emails.

**Detail view** shows the open email with:

- Header (subject, sender, recipients, date)
- **Back to list** button
- **Move** dropdown — switch the email's mailbox (Inbox, Archived, Sent, Spam, or restore from Trash). The current mailbox is hidden from the menu.
- Body, with a toggle between rendered HTML and plain text
- A banner offering to load remote images if the email has any (see [Parsing › Remote images](/guide/email/parsing#remote-images))
- The full **thread** below — every prior message in the conversation, fetched from `GET /api/v1/emails/:id/thread`

### Right panel — AI and internal notes

- **Triage summary** — what the AI classified this email as, its confidence, and the action points it pulled out. See [Triage](/guide/email/triage) for the full output schema.
- **Internal notes** — private team notes attached to the email. Notes never appear in outbound replies. They support threaded replies (parent/child); a note can only be deleted once its replies are gone.
- **Suggested replies** — two AI‑drafted reply options based on the email and your [custom email instructions](/guide/email/settings#custom-email-instructions). Pick one to turn it into a draft.
- **Email AI chat** — ask questions about this specific email; answers pull context from the email's project first, then fall back to all projects if nothing is found there.

## Drafts and sending

Replying creates an `EmailDraft` you can edit. The draft editor supports rich text and gives you editable **To / Cc / Bcc / Subject / Body** fields. The **From** picker is limited to [outbound identities](/guide/email/settings#outbound-email-identities) configured for the email's project.

Drafts auto‑save while you type. You explicitly hit **Send** when you're ready — Kumbukum doesn't auto‑send today, even with the auto‑send setting enabled.

When a reply lands in the Sent mailbox, the thread updates everywhere. A "Reply" on an already‑sent email targets the latest non‑sent message in the same thread.

## Internal notes vs drafts vs replies

It's easy to mix these up:

- **Internal notes** — private to your team, never sent.
- **Drafts** — outbound emails being composed; visible in the Drafts mailbox until sent or discarded.
- **Replies** — sent drafts; appear in Sent and on the thread.

## ECC vs the legacy `/emails` view

The older `/emails` route still exists as a project‑centric view of email, but the ECC at `/ecc` is the canonical surface and gets all the new functionality (triage, drafts, internal notes, suggested replies). Use the ECC.

## Related

- [Triage](/guide/email/triage) — how the right‑panel summary is generated.
- [Settings](/guide/email/settings) — automation toggles and AI instructions that shape what you see here.
- [Browser Extension](/guide/browser-extension/email-capture) — the in‑inbox equivalent of this view.
- [Emails API](/api/emails) — programmatic equivalents for everything in this UI.
