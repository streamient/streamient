# Email Storage

Kumbukum stores emails as searchable project context alongside notes, memories, and URLs. It does not triage, draft, send replies, or manage outbound identities. Those workflows live in Mailtwine.

## What Kumbukum Keeps

- Project-scoped email ingest by forwarding address, browser extension, API, or MCP.
- Sanitized email body, attachments text, headers, mailbox, labels, and threading metadata.
- Typesense search and AI Chat search context.
- `GET /api/v1/emails`, `/emails/search`, `/emails/:id/thread`, and storage CRUD.

## Mailtwine

Use Mailtwine for mail triage, summaries, reply suggestions, drafts, outbound send, labels, internal notes, sync providers, and mail-specific MCP tools. Mailtwine can store selected mail back in Kumbukum when a Kumbukum token is configured.

## Related

- [Parsing](/guide/email/parsing)
- [Forwarding](/guide/email/forwarding)
- [Emails API](/api/emails)
