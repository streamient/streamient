# Triage

Triage is Kumbukum's AI classification step for incoming email. It decides what each message needs — a reply, a manual action, a wait, nothing — and applies the matching labels and mailbox moves automatically so your inbox actually reflects what's pending.

## How triage runs

There are two ways triage runs:

- **Automatic** — when [Triage incoming emails automatically](/guide/email/settings#automation) is on, every newly ingested email is queued for triage as soon as it arrives.
- **Manual** — click **Triage Inbox** in the [ECC](/guide/email/viewing) to triage the currently visible inbox view (respects the project filter). The button submits a batch with a `run_id` that's used to track progress.

Each run gets a unique `run_id` so concurrent runs don't get tangled up.

## Context the AI sees

For every email, the triage prompt is assembled from:

- **Your AI instructions** — global instructions plus the [custom email triage instructions](/guide/email/settings#custom-email-instructions) you've set.
- **Thread history** — earlier messages in the same conversation (up to a handful of recent ones).
- **Knowledge from your projects** — Typesense semantic search across notes, memories, URLs, and other emails. The search runs against the email's project first and falls back to all projects only if there are no matches in scope.
- **Graph connections** — items already linked to the email via tags or manual links.
- **The email itself** — headers, body, and the extracted text content from attachments.

## What triage produces

The model returns a structured JSON object that's stored on the email record:

| Field | Meaning |
| --- | --- |
| `primary_action` | One of `reply-required`, `human-do`, `waiting`, `no-action`, `spam`. |
| `labels` | System label slugs to apply (always includes `primary_action` and `triaged`). |
| `summary` | Short description (up to ~500 chars) shown in the right panel. |
| `reason` | Why the AI picked this classification (up to ~1000 chars). |
| `confidence` | Float `0`–`1`. |
| `action_points` | Up to 10 actionable items, each with an optional due date. |
| `related_context` | Linked notes, memories, URLs, emails, or pages discovered while searching. |
| `draft_reply` | An AI‑written reply (to/cc/bcc/subject/body) — only when `primary_action` is `reply-required`. |
| `mailbox_action` | `keep-inbox`, `archive`, `spam`, or `none`. |

## Automatic side effects

Based on the result, Kumbukum updates the email and its surroundings without asking:

- **Marks the email as triaged**, stores all of the fields above, and sets `triage_status` to `complete`.
- **Moves the email** per `mailbox_action`: `no-action` → archived, `spam` → spam, everything else stays in the inbox.
- **Applies labels** — merges the AI's label list with whatever was already on the email (deduped).
- **Creates a draft** when `primary_action` is `reply-required` — a new `EmailDraft` is created (or an existing triage‑generated one is updated) using the AI's `draft_reply`. The draft is marked `generated_by_triage: true` so you can tell it apart from drafts you wrote yourself.
- **Creates graph links** labeled `triage-context` between the email and each item in `related_context`, so the connection shows up in the [Knowledge Graph](/guide/graph).
- **Reindexes** the email in Typesense so the new summary, labels, and triage fields are searchable.
- **Emits a real‑time `email:updated` event** so any open ECC tab refreshes the row instantly.

## Live progress modal

Manual runs open a non‑dismissable progress modal in the ECC that updates in real time:

- Processed / total / triaged / errors counts
- A progress bar
- The first error encountered (if any)

The modal uses the `run_id` from the API response and listens for `email-triage:run-updated` plus matching `email:updated` socket events. It also polls the run endpoint as a fallback, so long AI batches keep reporting progress even if the original request or socket drops.

## System labels

Triage uses a fixed set of system labels stored as `EmailLabel` records with `is_system: true`:

- `reply-required`
- `human-do`
- `waiting`
- `no-action`
- `spam`
- `triaged` (hidden in the UI; used as a marker, not a label you filter on)

You can create your own custom labels for organization, but the AI only emits system labels — custom labels are yours to apply manually.

## Which AI model is used

Triage uses the first configured option, in this order:

1. `EMAIL_TRIAGE_MODEL` / `EMAIL_TRIAGE_MODEL_PROVIDER`
2. `EMAIL_AI_MODEL` / `EMAIL_AI_MODEL_PROVIDER`
3. `CHAT_AI_MODEL` / `CHAT_AI_MODEL_PROVIDER`
4. Default provider `google`

If you've added [BYO email AI keys](/guide/email/settings#email-ai-provider-keys), those override the server credentials for the email scope.

## Polling triage status from outside

External systems that ingest emails via the API can poll triage results without holding a websocket connection:

```http
GET /api/v1/emails/triage-status
GET /api/v1/emails/:id/triage-status
```

Both accept filters like `run_id`, `message_id`, `project`, `mailbox`, `primary_action`, and `status` (`pending`, `complete`, `failed`), plus an `include` parameter to embed the email or draft in the response. See [Emails API › Triage status](/api/emails#triage-status) for the full reference.

## Related

- [Settings › Automation](/guide/email/settings#automation) — turn auto‑triage on or off.
- [Settings › Custom email triage instructions](/guide/email/settings#custom-email-instructions) — bias classification toward your priorities.
- [Viewing](/guide/email/viewing) — where triage results show up in the UI.
- [Emails API › Run triage](/api/emails#run-triage) — kick triage off programmatically.
