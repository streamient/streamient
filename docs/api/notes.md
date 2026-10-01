---
title: Streamient Notes API
description: "Create, list, search, update, and delete rich-text notes with Streamient's REST API, including project filters, pagination, tags, and content fields."
---

# Notes API

## List Notes

```
GET /api/v1/notes?project_id=<id>&page=1&per_page=20
```

Returns paginated notes, optionally filtered by project.

## Create Note

```
POST /api/v1/notes
```

```json
{
    "title": "My Note",
    "content": "<p>Rich HTML content</p>",
    "text_content": "Plain text version",
    "tags": ["tag1", "tag2"],
    "project_id": "optional-project-id"
}
```

## Get Note

```
GET /api/v1/notes/:id
```

For synced notes, `GET /api/v1/notes/:id?include_markdown=true` also returns `note.markdown_content`, including original frontmatter.

## Update Note

```
PUT /api/v1/notes/:id
```

```json
{
    "title": "Updated Title",
    "content": "<p>Updated content</p>",
    "tags": ["updated-tag"]
}
```

For Obsidian-synced content, send `markdown_content` with the full Markdown read above, preserving unrelated frontmatter. Title/tag edits belong in the frontmatter when this field is supplied. HTML-only content updates return HTTP 409 with `code: "markdown_required"`. Metadata-only updates remain supported.

## Delete Note

```
DELETE /api/v1/notes/:id
```

## Search Notes

```
POST /api/v1/files/notes/search
```

```json
{
    "query": "search term",
    "workspace_id": "your-workspace-id"
}
```

Uses Typesense for full-text and semantic search with BM25 ranking.
