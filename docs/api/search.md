---
title: Streamient Knowledge Search API
description: "Search notes, memories, URLs, emails, and crawled pages through Streamient's combined knowledge, semantic, and type-specific REST API endpoints."
---

# Search API

## Combined Knowledge Search

The recommended search endpoint searches across **all data types** in a single request.

```
POST /api/v1/search/knowledge
```

```json
{
    "query": "search term",
    "project_id": "optional-project-id",
    "tags": ["typerelay"],
    "page": 1,
    "per_page": 10
}
```

**Response:**

```json
{
    "success": true,
    "results": {
        "notes": { "found": 5, "page": 1, "hits": [] },
        "memory": { "found": 3, "page": 1, "hits": [] }
    },
    "total": 8,
    "page": 1
}
```

This endpoint searches notes, memories, URLs, emails, crawled pages, and vault files. Queries without tags or a page number retain semantic search. Paginated searches use text matching; tag-only searches read stored records, including records awaiting indexing.

- `project_id` limits results to one project. Omit it to search all projects in the current account.
- `tags` requires exact membership of every requested tag. A record tagged `typerelay`, `api`, and `debugging` matches `tags: ["typerelay"]`. Text mentions and similar tag names do not match.
- Tags apply to notes, memories, and URLs. Emails retain labels; pages and vault files retain their existing fields.
- Set `query` to `""` for tag-only searches, or use `tag:typerelay` and `tag:"public api"` syntax.
- `per_page` counts records **per collection**. With `page` or tags, the response includes `total`, `page`, and `pages`. Iterate through `pages` for every match.

## Selectable Results and Bulk Actions

The search modal's **View all results** opens the same results page used by AI search. Select individual records or use the single **Select all** checkbox for every matching record, including other pages. The standard floating action bar appears only while records are selected; its close button clears the selection. Selection persists across pagination and clears when applying different filters.

- `POST /api/v1/search/results`: filters, paginated records, counts, and server-rendered row fragments.
- `GET /api/v1/search/tags?project_id=...`: available tags for the project.
- `POST /api/v1/search/selection`: resolve every matching page into fixed signed record references.
- `POST /api/v1/search/actions`: apply `move`, `add_tags`, `remove_tags`, or `trash` to at most 50 selected references per request.
- `POST /api/v1/search/item`: reconcile one result after an update without replacing the surrounding list.

Use the exact item references returned by results or selection. Send `filters`, `items`, and `action`; moves also require the destination `project_id`, while tag actions require `tags`. Each item contains `id`, `type`, `version`, and `ticket`.

Tickets bind the account, record version, and filters. Records changed since selection fail individually and remain selected for review; successful records update immediately. Unsupported actions also fail individually. Trash is reversible; this API never permanently deletes records.

MCP `search_knowledge`, `search_notes`, `recall_memory`/`search_memory`, and `search_urls` accept `tags` and `page`. URL search also accepts `project_id`. Pass an empty query for tag-only retrieval. The CLI exposes the same fields through MCP schemas.

## Type-Specific Search

For searching within a single type:

| Type     | Endpoint                          |
| -------- | --------------------------------- |
| Notes    | `POST /api/v1/files/notes/search` |
| Memories | `POST /api/v1/memories/search`    |
| URLs     | via `search_urls` MCP tool        |
| Emails   | `POST /api/v1/emails/search`      |

## AI Chat

```
POST /api/v1/chat
```

```json
{
    "query": "What did I save about Redis caching?",
    "conversation_id": "optional-for-context",
    "project_id": "optional-project-filter"
}
```

Search requests return structured `search_filters` for the shared results page. For example, “show me all the records with the tag Typerelay” becomes an exact tag filter scoped to the selected project. The active app project initializes the AI project picker; changing it clears prior search context. Analysis and conversational answers continue using the configured AI provider.
