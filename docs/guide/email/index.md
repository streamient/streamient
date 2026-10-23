---
title: Streamient Email Storage and Search
description: "Store email as searchable Streamient project context through forwarding, browser capture, API, or MCP, with attachments, headers, labels, and thread metadata."
---

# Email Storage

Streamient stores emails as searchable project context alongside notes, memories, and URLs. It does not triage, draft, send replies, or manage outbound identities. Those workflows live in Mailtwine.

## Duplicate Messages

Message-ID duplicate detection is scoped to the active account. The same email can be stored independently in different accounts. Repeated delivery within one account updates its existing message instead of creating another copy.

## What Streamient Keeps

- Project-scoped email ingest by forwarding address, browser extension, API, or MCP.
- Sanitized email body, attachments text, headers, mailbox, labels, and threading metadata.
- Typesense search and AI Chat search context.
- `GET /api/v1/emails`, `/emails/search`, `/emails/:id/thread`, and storage CRUD.

## Mailtwine

Use Mailtwine for mail triage, summaries, reply suggestions, drafts, outbound send, labels, internal notes, sync providers, and mail-specific MCP tools. Mailtwine can store selected mail back in Streamient when a Streamient token is configured.

## Related

- [Parsing](/guide/email/parsing)
- [Forwarding](/guide/email/forwarding)
- [Emails API](/api/emails)
