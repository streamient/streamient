# Emails API

Streamient email APIs store and search project email records. Triage, drafts, replies, internal notes, outbound identities, and sync providers are Mailtwine features.

## Endpoints

```
GET    /api/v1/emails
GET    /api/v1/emails/ids
POST   /api/v1/emails
GET    /api/v1/emails/:id
GET    /api/v1/emails/:id/thread
PUT    /api/v1/emails/:id
DELETE /api/v1/emails/:id
POST   /api/v1/emails/search
POST   /import/email
```

## Ingest

`POST /api/v1/emails` accepts:

```json
{
	"project": "PROJECT_ID",
	"raw_email": "From: sender@example.com\nSubject: Hello\n\nBody"
}
```

or:

```json
{
	"project": "PROJECT_ID",
	"parsed_email": {
		"message_id": "<message@example.com>",
		"from": "sender@example.com",
		"to": "project@example.com",
		"subject": "Hello",
		"text": "Body"
	}
}
```

## Search

Use `POST /api/v1/emails/search` for Typesense search over subject, participants, body text, and attachment text.

## Forwarding

`POST /import/email` is the public forwarding endpoint. The recipient must be `PROJECT_ID@EMAIL_FORWARD_DOMAIN`. It stores matching email in the project and applies the project email filter as a trash rule.
