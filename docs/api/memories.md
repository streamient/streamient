# Memories API

Memories are short-form context entries scoped to the authenticated user.

## List Memories

```
GET /api/v1/memories?page=1&per_page=20&document_tags=tag1
```

## Create Memory

```
POST /api/v1/memories
```

```json
{
    "title": "Architecture Decision",
    "content": "We chose Redis for caching because...",
    "document_tags": ["architecture", "decisions"],
    "related_file_ids": ["optional-file-id"]
}
```

## Get Memory

```
GET /api/v1/memories/:id
```

## Update Memory

```
PUT /api/v1/memories/:id
```

```json
{
    "title": "Updated Title",
    "content": "Updated content",
    "document_tags": ["updated-tag"]
}
```

## Delete Memory

```
DELETE /api/v1/memories/:id
```

## Search Memories

```
POST /api/v1/memories/search
```

```json
{
    "query": "search term",
    "document_tags": ["optional-filter"],
    "page": 1,
    "per_page": 10
}
```

Uses semantic/BM25 search. Returns results sorted by text match then recency.

## Tag Suggestions

```
GET /api/v1/memories/tags/suggest?q=prefix&project=project-id&limit=50
```

Returns bounded tag autocomplete suggestions based on existing memory tags. Default limit is 50, max is 100.
