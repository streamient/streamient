# Email Capture

The Kumbukum browser extension can store the email you are viewing into a project. It does not triage, summarize, suggest replies, create drafts, send mail, or manage internal notes. Use Mailtwine for those mail workflows.

## Supported Clients

- Gmail
- Outlook Web
- Fastmail
- Generic webmail fallback

## Action

- **Add Email** — extracts the message headers/body from the current page and stores it in Kumbukum.

The destination is your configured email project. The extension sends the extracted email to `POST /api/v1/emails`.

## Related

- [Email Storage](/guide/email/)
- [Forwarding Email](/guide/email/forwarding)
