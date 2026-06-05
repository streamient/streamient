# Emails API

Email endpoints require the email feature and normal API authentication.

## Ingest

```http
POST /api/v1/emails
```

Send either `raw_email` or a mailparser-like `parsed_email`. HTML bodies are accepted from `html`, `html_content`, or `body_html`, sanitized before storage, and returned as `html_content`.

Remote image URLs in stored HTML are rewritten to `data-kk-remote-src` and flagged with `html_content_has_remote_images`. Existing emails cannot be backfilled unless they are re-ingested because raw HTML was not stored before this feature.

```json
{
	"project": "optional-project-id",
	"parsed_email": {
		"from": "sender@example.com",
		"to": "team@example.com",
		"subject": "Project update",
		"text": "Plain text fallback",
		"html": "<table><tr><td>HTML body</td></tr></table>"
	}
}
```

## Read

```http
GET /api/v1/emails
GET /api/v1/emails/:id
GET /api/v1/emails/:id/thread
GET /api/v1/emails/:id/internal-notes
POST /api/v1/emails/:id/internal-notes
PUT /api/v1/emails/:id/internal-notes/:noteId
DELETE /api/v1/emails/:id/internal-notes/:noteId
```

Email read responses include sanitized `html_content`, `html_content_has_remote_images`, and `excerpt`. The excerpt is derived from visible HTML when available and strips parser control lines such as reply-above markers. Mailbox lists, selection IDs, and mailbox/label counts return one latest email per connected `message_id` / `references` / `in_reply_to` thread. Updating an email `mailbox` applies to related non-sent, non-trash inbound thread emails so archived threads do not reappear as older replies after refresh. Realtime and update responses can include `thread_identifiers` and `thread_source_ids` for client-side thread reconciliation.

Public forwarding through `POST /import/email` accepts project mail at `PROJECT_ID@EMAIL_FORWARD_DOMAIN`. When that project address is the hidden delivery recipient, or appears in parsed `bcc`, and the sender matches a configured project outbound email identity, Kumbukum stores the message as a `sent` + triaged thread reply instead of Inbox mail. BCC copies from unknown senders stay normal inbound mail.

Internal notes are private team notes for the email thread. They are stored separately from email drafts and are never included in outbound email content. Notes can be threaded with `parent_note`, edited by tenant team members, and deleted only when they have no replies.

## Email AI

```http
POST /api/v1/emails/ai
POST /api/v1/emails/:id/ai
POST /api/v1/emails/:id/summarize
POST /api/v1/emails/:id/suggest-replies
POST /api/v1/emails/:id/draft-reply
```

Use `/emails/ai` for list-level ECC questions such as counts, sender lookups, mailbox summaries, and semantic searches. It uses Typesense first and accepts the current ECC view as `scope`. Summary requests search the scoped project first; if no scoped emails are found, they retry across all projects.

```json
{
	"query": "show emails from sender@example.com",
	"scope": {
		"project": "optional-project-id",
		"mailbox": "inbox",
		"label": "",
		"triaged": false
	}
}
```

Response:

```json
{
	"answer": "Showing 3 emails matching \"show emails from sender@example.com\".",
	"count": 3,
	"mode": "list",
	"context_scope": "project",
	"scope": {},
	"emails": []
}
```

Use `/emails/:id/ai` for questions about one selected email. It includes retrieved Kumbukum context by searching the selected email's project first, then all projects only when no project records are found. Use `/emails/:id/summarize` to generate and save `triage_summary`, `/emails/:id/suggest-replies` to return two structured reply choices with the same project-first context lookup, and `/emails/:id/draft-reply` to turn one choice into a draft.

Draft updates accept `from`, recipient arrays in `to`, `cc`, and `bcc`, plus `subject`, `body_text`, and sanitized `body_html`. `from` must match a configured outbound email identity for the email project when identities exist. `to`, `cc`, and `bcc` are limited to 10 addresses each. When the selected email is a sent reply, `/emails/:id/draft-reply` creates or updates the draft against the latest non-sent message in that thread.

Draft deletion uses `DELETE /api/v1/email-drafts/:id` and marks the draft as `discarded`, which removes it from active draft lists.

Compose clients can load safe outbound identity data with `GET /api/v1/projects/:id/email-identities/compose`. Recipient autocomplete can call `GET /api/v1/emails/from-addresses?q=partial&project=PROJECT_ID&limit=10`; it searches sender addresses in the project first, then falls back tenant-wide when no project results are found.

## Triage status

Use triage status endpoints when an external system only needs classification state, routing action, and optional embedded message/draft data.

```http
GET /api/v1/emails/triage-status
GET /api/v1/emails/:id/triage-status
```

Common query parameters:

| Parameter | Description |
| --- | --- |
| `ids` | Comma-separated Kumbukum email IDs. |
| `message_id` | Message-ID lookup. Angle brackets accepted. Comma-separated values accepted. |
| `project` | Project ID filter. |
| `mailbox` | `inbox`, `archived`, `sent`, `spam`, or `trash`. |
| `triaged` | `true` or `false`. |
| `status` | `pending`, `complete`, or `failed`. Comma-separated values accepted. |
| `primary_action` | `reply-required`, `human-do`, `waiting`, `no-action`, or `spam`. Comma-separated values accepted. |
| `run_id` | Triage run correlation ID. |
| `include` | Optional embedded payloads: `email`, `draft`, or `email,draft`. |

Example:

```bash
curl -H "Authorization: Token $KUMBUKUM_TOKEN" \
	"https://your-instance.com/api/v1/emails/triage-status?message_id=%3Cabc@example.com%3E&include=email,draft"
```

Response:

```json
{
	"statuses": [
		{
			"email_id": "664...",
			"message_id": "abc@example.com",
			"triaged": true,
			"triage_status": "complete",
			"triage_primary_action": "reply-required",
			"triage_summary": "Needs a setup reply",
			"triage_draft_id": "665...",
			"email": {},
			"draft": {}
		}
	]
}
```

## Run triage

```http
POST /api/v1/emails/triage-inbox
```

Body:

```json
{
	"project": "optional-project-id",
	"limit": 25,
	"run_id": "client-run-id"
}
```

Use the returned `run_id`, `email_id`, or original `message_id` with the triage status endpoints to poll completion from external systems.

Response is `202 Accepted` and returns immediately:

```json
{
	"run_id": "client-run-id",
	"status": "queued",
	"total": 24,
	"run": {
		"run_id": "client-run-id",
		"status": "queued",
		"processed": 0,
		"triaged": 0,
		"errors": []
	}
}
```

Poll run progress:

```http
GET /api/v1/emails/triage-runs/client-run-id
```

The run status is one of `queued`, `running`, `completed`, or `failed`. The UI also receives `email-triage:run-updated` socket events for live progress.

Triage-generated classifications and reply drafts use the same project-first context rule: search records in the email's project first, then retry across all projects only when no usable project context is found.
