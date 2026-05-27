# Email

Kumbukum's email feature turns your inbox into searchable, AI‑triaged context that lives alongside your notes, memories, and URLs. Forward email into a project, and Kumbukum parses it, stores it, threads it, and (optionally) classifies it so you can focus on what actually needs a reply.

## What's in this section

- [Settings](/guide/email/settings) — turn on auto‑triage, customize AI instructions, add your own API keys, and configure outbound SMTP identities per project.
- [Parsing](/guide/email/parsing) — what Kumbukum does to an inbound email: extract headers and body, sanitize HTML, pull text out of attachments, dedupe, and thread.
- [Forwarding](/guide/email/forwarding) — the how‑to. Find your per‑project forwarding address and point your mail provider at it.
- [Viewing](/guide/email/viewing) — the Email Command Center (ECC), mailboxes, labels, thread view, drafts, and internal notes.
- [Triage](/guide/email/triage) — how the AI classifies emails, what context it uses, and what it does automatically.

::: tip Stay in your inbox
If you live in Gmail, Outlook, or Fastmail, the [Browser Extension](/guide/browser-extension/email-capture) is often the fastest way to use Kumbukum's email features — it auto‑detects the email you're reading and brings Summarize, Suggest reply, Internal notes, and one‑click ingest into a side panel without you ever leaving your mail client.
:::

## Project emails vs the Email Command Center

Every email in Kumbukum belongs to a [project](/guide/projects) — that's where it's stored, indexed, and searchable. The **Email Command Center** at `/ecc` is a global, cross‑project view of those same emails: one inbox, one triage workflow, one place to work through everything no matter which project it landed in.

In short:

- A **project email** is the underlying record (project‑scoped, searchable from AI Chat and MCP).
- The **ECC** is a viewing surface on top of those records. Filter by "All projects" to see everything, or pick a project from the dropdown to narrow down.

There aren't two kinds of email — just two ways of looking at the same data.

## How it fits with the rest of Kumbukum

Ingested emails are indexed in Typesense and become first‑class context: they show up in [AI Chat](/guide/ai-chat) answers, in the [Knowledge Graph](/guide/graph) alongside notes and memories, and through the [Emails API](/api/emails) and [MCP tools](/mcp/tools) for external clients.
