# Emails API

Email endpoints require the email feature and normal API authentication.

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
