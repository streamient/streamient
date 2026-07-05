# Forwarding Email

Forwarding stores email in a Streamient project.

## Forwarding Address

Each project has an address:

```
<project-id>@<email-forward-domain>
```

Open the project settings page, copy the **Email forwarding** address, and point your mail provider or inbound email service at it.

## What Happens

1. Streamient checks the recipient domain against `EMAIL_FORWARD_DOMAIN`.
2. The local part is matched to a project ID.
3. The email is parsed, sanitized, stored, threaded, and indexed.
4. If the project email filter matches the sender or subject, the email is stored in trash.

Forwarding does not triage or reply. Use Mailtwine for mail workflows.

## Alternatives

- Browser extension: store the message you are viewing.
- API: `POST /api/v1/emails` with a project ID.
- MCP: `ingest_email`.
