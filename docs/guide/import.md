# Import

Import existing documents into Streamient by dragging and dropping files onto the Notes page. Each file is converted into a new note with the extracted text content.

You can also import emails by forwarding JSON email payloads to Streamient. This is an alternative to using the email API directly.

## Supported File Types

| Format | Extensions |
| ------ | ---------- |
| PDF | `.pdf` |
| Microsoft Word | `.doc`, `.docx` |
| Plain text | `.txt`, `.md`, `.rtf`, and other text-based files |

## How to Import

1. Open the **Notes** page
2. Drag one or more files from your file manager onto the page
3. A drop overlay appears — release the files
4. Each file is uploaded, its text content extracted, and a new note is created automatically
5. The note title is set to the original filename

You can import multiple files at once. Each file becomes a separate note.

## What Happens During Import

- **PDF files** — Text is extracted from all pages using `pdfjs-parse`
- **Word documents** — Converted to HTML via `mammoth`, then plain text is extracted
- **Text files** — Read line by line, preserving paragraph structure

The extracted content is stored as both plain text (for search indexing) and HTML (for the note editor). All imported notes are indexed in Typesense for full-text and semantic search.

## Tips

- Large PDF files with scanned images (no selectable text) will result in empty notes — only text-based PDFs are supported
- Code files (`.js`, `.py`, `.sh`, etc.) are treated as plain text and imported as-is
- Imported notes are created in your currently selected project

## Email Forwarding

Configure your mail forwarder to post parsed email JSON to:

```text
POST /import/email
```

Forward emails to a project-specific address:

```text
PROJECT_ID@EMAIL_FORWARD_DOMAIN
```

For example, if `EMAIL_FORWARD_DOMAIN=email.streamient.com`, forward to:

```text
507f1f77bcf86cd799439011@email.streamient.com
```

The route accepts parsed email JSON with normal email fields:

```json
{
	"to": "507f1f77bcf86cd799439011@email.streamient.com",
	"from": "sender@example.com",
	"subject": "Project update",
	"text": "Email body text",
	"html": "<table><tr><td>Email body HTML</td></tr></table>",
	"message_id": "<message-id@example.com>",
	"references": "<previous-message@example.com>",
	"in_reply_to": "<previous-message@example.com>"
}
```

Streamient stores plain text for search and AI, and stores sanitized HTML separately for display. If a forwarded email has no plain text body, Streamient strips the HTML body and stores the resulting text fallback. Remote image URLs in stored HTML are blocked by default and can be loaded explicitly in the email viewer. Existing stored emails cannot be backfilled unless they are re-ingested because raw HTML was not stored before this feature. Attachments are ignored. Streamient rejects forwarded email unless the recipient domain exactly matches `EMAIL_FORWARD_DOMAIN`.
