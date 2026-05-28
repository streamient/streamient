# Notes

Notes are rich-text documents for capturing ideas, meeting notes, research, or anything you want to write down and find later.

## What You Can Do

### Create & Edit

Click **New Note** to open the editor. Notes support rich-text formatting — headings, lists, bold, italic, code blocks, and more. Give each note a title and start writing.

### Tags

Add tags to organize and group your notes. Tags are also used by the [Knowledge Graph](/guide/graph) to automatically discover connections between items that share the same tags.

### Project Assignment

Every note belongs to a project. Switch projects in the sidebar to filter your view, or reassign a note to a different project from the editor.

### Search

Notes are indexed in Typesense for both full-text and semantic search. Search by exact keywords or by meaning — asking "deployment strategies" will find notes about "CI/CD pipelines" even if those exact words aren't used.

### Import Files

Drag and drop PDFs, Word documents, or plain text files onto the Notes page to create notes from existing documents. See the [Import guide](/guide/import) for supported formats.

### Links

Connect a note to other items — memories, URLs, or other notes. Open a note, scroll to the **Links** section, and search for the item you want to connect. Links appear as badges that you can click to navigate between connected items.

These manual links show up in the [Knowledge Graph](/guide/graph) alongside tag-based and semantic connections.

### Batch Operations

Select multiple notes using the checkboxes to move them between projects or send them to trash in bulk.

### Browser Extension

Use the [Browser Extension](/guide/browser-extension/) to write a note from any webpage — or to save the current page as both a URL and a note in one click.

## How It Works

Notes store both HTML content (for the editor) and extracted plain text (for search indexing). When you create or update a note, it's indexed in Typesense with a vector embedding, making it searchable by meaning across the AI Chat, MCP tools, and the search bar.

All changes emit real-time events, so other open tabs or connected tools stay in sync.
