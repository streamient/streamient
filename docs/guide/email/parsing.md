# Email Parsing

When an email arrives — whether through your forwarding address or the API — Kumbukum parses it into a structured record before storing it. This page covers what happens between "an email shows up" and "the email is searchable in your project."

## What gets accepted

The ingest endpoint accepts two shapes:

- **`raw_email`** — the full RFC822 message as a string. Kumbukum hands it to [`mailparser`](https://nodemailer.com/extras/mailparser/) and extracts everything itself.
- **`parsed_email`** — a pre‑parsed JSON payload from your mail provider (Postmark, SendGrid, Cloudflare Email Routing, etc.) with fields like `from`, `to`, `subject`, `text`, and `html`.

Either way, the resulting record stores the same fields. See [Emails API › Ingest](/api/emails#ingest) for the exact JSON shape.

## What Kumbukum extracts

From every parsed message, Kumbukum captures:

- **Headers** — `from`, `to`, `cc`, `bcc`, `subject`, `date`, and the threading headers (`Message-ID`, `In-Reply-To`, `References`).
- **Body** — both plain text and HTML when available. If only one is present, the other is derived for indexing.
- **Attachments** — see [Attachments](#attachments) below.

## HTML sanitization

HTML bodies are sanitized before storage. Scripts, event handlers, and unsafe attributes are stripped; safe formatting (tables, lists, links, basic styles) is preserved so the email renders correctly in the [ECC](/guide/email/viewing).

### Remote images

Remote `<img src="…">` URLs would otherwise leak open/read tracking pixels to the sender. Kumbukum rewrites them so they don't load automatically:

- The original URL moves to `data-kk-remote-src`.
- The email record is flagged with `html_content_has_remote_images: true`.
- The ECC detail view shows a banner so you can opt in to loading them.

This rewrite happens at ingest time. Emails ingested before this feature was added won't be backfilled — you'd need to re‑ingest them to get the new behavior.

## Attachments

Each attachment up to **50 MB** is processed. For supported types (PDFs, images, common document formats), Kumbukum extracts the text content — including OCR for scanned PDFs and images — and stores it on the email as `attachment_text_content`. That text is indexed in Typesense alongside the body, so a search for a phrase inside an attached PDF will find the parent email.

## Deduplication

`Message-ID` is the unique key. If a message with the same `Message-ID` is ingested again (for example, because you forwarded the same message twice, or your provider retried a webhook), Kumbukum updates the existing record instead of creating a duplicate.

## Threading

Threads are reconstructed from the standard mail headers:

- `In-Reply-To` connects a reply to its parent.
- `References` links every ancestor in the conversation.

These relationships are stored as graph links labeled `thread`, which is what powers the thread view in the ECC and the `GET /api/v1/emails/:id/thread` endpoint. Threading works across projects too — if a reply lands in a different project than the original, they're still linked.

## Indexing

Once parsed, the email is indexed in Typesense with a vector embedding. From that point on it shows up in:

- [AI Chat](/guide/ai-chat) results
- [Email AI](/guide/email/viewing#right-panel-ai-and-internal-notes) summaries and suggested replies
- [MCP](/mcp/tools) search results
- The [Emails API](/api/emails)

## Related

- [Forwarding](/guide/email/forwarding) — get email into Kumbukum.
- [Emails API › Ingest](/api/emails#ingest) — exact request format and field reference.
