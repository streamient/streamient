# Email Parsing

Streamient parses email into a stored project record before indexing it.

## Accepted Input

- `raw_email`: full RFC822 source parsed with `mailparser`.
- `parsed_email`: provider JSON with fields like `from`, `to`, `subject`, `text`, and `html`.

## Stored Fields

- `message_id`, `references`, `in_reply_to`
- `from`, `to`, `cc`, `bcc`, `subject`
- `text_content`, sanitized `html_content`
- `attachment_text_content`
- `mailbox`, `labels`, `project`

## HTML

HTML is sanitized before storage. Remote image URLs are moved to `data-kk-remote-src` and `html_content_has_remote_images` is set so clients can choose whether to load them.

## Attachments

Attachments up to 50 MB are processed for text extraction when supported. Extracted text is stored on `attachment_text_content` and indexed for search.

## Deduplication And Threads

`Message-ID` is the primary dedupe key. Threads are reconstructed from `In-Reply-To` and `References`, and the thread can be read with `GET /api/v1/emails/:id/thread`.
