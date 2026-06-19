# MCP Tools Reference

All 44 tools available in the Kumbukum MCP server. Use `search_knowledge` first when you want the fastest path to relevant context across notes, memories, URLs, emails, and pages. Parameters marked with `*` are required.

## Notes

### `create_note`
Create a new note in a project.

| Parameter      | Type   | Required | Description                |
| -------------- | ------ | -------- | -------------------------- |
| `title`        | string | yes      | Note title                 |
| `content`      | string | no       | Rich HTML content          |
| `text_content` | string | no       | Plain text version         |
| `tags`         | array  | no       | List of tags               |
| `project_id`   | string | no       | Project ID (default: auto) |

### `read_note`
Read a note by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `update_note`
Update a note.

| Parameter      | Type   | Required |
| -------------- | ------ | -------- |
| `id`           | string | yes      |
| `title`        | string | no       |
| `content`      | string | no       |
| `text_content` | string | no       |
| `tags`         | array  | no       |

### `delete_note`
Delete a note by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `list_notes`
List notes, optionally filtered by project.

| Parameter    | Type   | Required |
| ------------ | ------ | -------- |
| `project_id` | string | no       |
| `page`       | number | no       |
| `limit`      | number | no       |

### `search_notes`
Search notes using semantic/text search. Use only for specs, docs, ADRs, structured write-ups, or when `search_knowledge` results point to notes.
Returns lean hits with metadata and a bounded `excerpt`; use `read_note` for full content.

| Parameter  | Type   | Required |
| ---------- | ------ | -------- |
| `query`    | string | yes      |
| `per_page` | number | no       |

## Memories

### `store_memory`
Store a new memory — persist conversation context, decisions, or learnings.

| Parameter    | Type   | Required | Description                   |
| ------------ | ------ | -------- | ----------------------------- |
| `title`      | string | yes      | Memory title                  |
| `content`    | string | yes      | Memory content                |
| `tags`       | array  | no       | List of tags                  |
| `source`     | string | no       | Source attribution             |
| `project_id` | string | no       | Project ID (default: auto)    |

### `recall_memory`
Search memories semantically for prior decisions, debugging history, user preferences, task outcomes, or agent-scoped learnings.
Returns lean hits with metadata and a bounded `excerpt`; use `read_memory` for full content.

| Parameter  | Type   | Required |
| ---------- | ------ | -------- |
| `query`    | string | yes      |
| `per_page` | number | no       |

### `search_memory`
Alias for `recall_memory`.

| Parameter  | Type   | Required |
| ---------- | ------ | -------- |
| `query`    | string | yes      |
| `per_page` | number | no       |

### `read_memory`
Read a specific memory by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `update_memory`
Update an existing memory.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |
| `title`   | string | no       |
| `content` | string | no       |
| `tags`    | array  | no       |

### `delete_memory`
Delete a memory by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `suggest_memory_tags`
Get suggested tags based on existing memory tags. No parameters.

### `search_knowledge`
Search across ALL data types (notes, memories, URLs, pages). **Default first retrieval tool.** Use a specific query with `per_page: 3`, then broaden or raise `per_page` only if results are weak.
Returns lean hits with metadata and bounded `excerpt` fields where searchable body text exists; use the matching read tool for full content.

| Parameter    | Type   | Required |
| ------------ | ------ | -------- |
| `query`      | string | yes      |
| `project_id` | string | no       |
| `per_page`   | number | no       |

### `chat`
AI chat with intent classification — search, create items, or analyze. Maintains context across messages.

The `/mcp/app` app profile hides this broad chat tool and exposes the explicit search/read/write tools instead.

| Parameter         | Type   | Required |
| ----------------- | ------ | -------- |
| `query`           | string | yes      |
| `conversation_id` | string | no       |
| `project_id`      | string | no       |

## URLs

### `save_url`
Save a URL with auto-extracted content. Set `crawl_enabled` for URL path crawling.

| Parameter       | Type    | Required | Description                     |
| --------------- | ------- | -------- | ------------------------------- |
| `url`           | string  | yes      | URL to save                     |
| `title`         | string  | no       | Title override                  |
| `description`   | string  | no       | Description override            |
| `crawl_enabled` | boolean | no       | Enable URL path crawling        |
| `project_id`    | string  | no       | Project ID (default: auto)      |

### `list_urls`
List saved URLs, optionally filtered by project.

| Parameter    | Type   | Required |
| ------------ | ------ | -------- |
| `project_id` | string | no       |
| `page`       | number | no       |
| `limit`      | number | no       |

### `search_urls`
Search saved URLs using semantic/text search.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `query`   | string | yes      |

### `read_url`
Read a saved URL by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `update_url`
Update a saved URL.

| Parameter       | Type    | Required |
| --------------- | ------- | -------- |
| `id`            | string  | yes      |
| `title`         | string  | no       |
| `description`   | string  | no       |
| `crawl_enabled` | boolean | no       |

### `delete_url`
Delete a saved URL by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

## Emails

### `ingest_email`
Ingest an email into the knowledge base from raw RFC822 content or a parsed email payload.

| Parameter      | Type   | Required | Description                     |
| -------------- | ------ | -------- | ------------------------------- |
| `project_id`   | string | no       | Project ID (default: auto)      |
| `raw_email`    | string | no       | Raw RFC822 email content        |
| `parsed_email` | object | no       | Pre-parsed email payload        |

### `read_email`
Read an email by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `list_emails`
List emails, optionally filtered by project.

| Parameter    | Type   | Required |
| ------------ | ------ | -------- |
| `project_id` | string | no       |
| `page`       | number | no       |
| `limit`      | number | no       |

### `search_emails`
Search emails using semantic/text search.
Returns lean hits with metadata and a bounded `excerpt`; use `read_email` for full email content.

| Parameter  | Type   | Required |
| ---------- | ------ | -------- |
| `query`    | string | yes      |
| `per_page` | number | no       |

### `get_email_thread`
Get the message thread linked by message IDs and references.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `delete_email`
Delete an email by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

## Projects

### `list_projects`
List all projects. No parameters.

### `get_project`
Get a project by ID.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `create_project`
Create a new project.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `name`    | string | yes      | Project name             |
| `color`   | string | no       | Project color (hex code) |

### `update_project`
Update a project.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `id`      | string | yes      | Project ID               |
| `name`    | string | no       | Project name             |
| `color`   | string | no       | Project color (hex code) |

### `delete_project`
Delete a project by ID (cannot delete the default project).

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `get_project_counts`
Get per-project document counts (notes, memories, URLs). No parameters.

## Knowledge Graph

Links connect any two items (notes, memories, URLs) in the knowledge graph. After creating an item with `create_note`, `store_memory`, or `save_url`, use `create_link` to connect it to related items. This is a two-step pattern: create the item first, then link it.

### `create_link`
Create a link between two items.

| Parameter     | Type   | Required | Values                    |
| ------------- | ------ | -------- | ------------------------- |
| `source_id`   | string | yes      |                           |
| `source_type` | enum   | yes      | notes, memory, urls       |
| `target_id`   | string | yes      |                           |
| `target_type` | enum   | yes      | notes, memory, urls       |
| `label`       | string | no       | Optional link label       |

### `get_links`
Get all links for a specific item.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `item_id` | string | yes      |

### `get_graph`
Get full knowledge graph with nodes and edges.

| Parameter            | Type    | Required | Description                        |
| -------------------- | ------- | -------- | ---------------------------------- |
| `project_id`         | string  | no       | Filter by project                  |
| `include_tags`       | boolean | no       | Include tag-based edges            |
| `include_semantic`   | boolean | no       | Include semantic similarity edges  |
| `semantic_threshold` | number  | no       | Similarity threshold (0-1)         |

### `traverse_graph`
Get item and all its direct connections in the knowledge graph.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `item_id` | string | yes      |

### `delete_link`
Delete a link between two items.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `link_id` | string | yes      |

## Git Sync

### `list_git_repos`
List git repos configured for a project.

| Parameter    | Type   | Required | Description                |
| ------------ | ------ | -------- | -------------------------- |
| `project_id` | string | no       | Project ID (default: auto) |

### `add_git_repo`
Add a git repository to sync with a project. Imports markdown files as notes/memories. Defaults to read-only — it never writes back to the repo unless `sync_mode` is `read_write`.

| Parameter       | Type   | Required | Description                                        |
| --------------- | ------ | -------- | -------------------------------------------------- |
| `repo_url`      | string | yes      | HTTPS git repo URL                                 |
| `name`          | string | no       | Friendly label for this repo                       |
| `branch`        | string | no       | Branch to sync (default: main)                     |
| `sync_mode`     | string | no       | `read_only` (default) imports only; `read_write` also exports notes/memories back to git |
| `auth_token`    | string | no       | Personal access token for private repos            |
| `notes_path`    | string | no       | Directory in repo mapped to notes (default: notes) |
| `memories_path` | string | no       | Directory in repo mapped to memories               |
| `sync_path`     | string | no       | Subfolder within repo to sync (default: /)         |
| `sync_interval` | number | no       | Sync interval in minutes (default: 10)             |
| `commit_sync_enabled` | boolean | no | Import git commits as memories (default: true)     |
| `commit_history_days` | number | no | Days of commit history to backfill (default: 90)   |
| `project_id`    | string | no       | Project ID (default: auto)                         |

### `update_git_repo`
Update settings of a configured git repo.

| Parameter        | Type    | Required |
| ---------------- | ------- | -------- |
| `id`             | string  | yes      |
| `name`           | string  | no       |
| `repo_url`       | string  | no       |
| `branch`         | string  | no       |
| `auth_token`     | string  | no       |
| `enabled`        | boolean | no       |
| `sync_mode`      | string  | no       |
| `notes_path`     | string  | no       |
| `memories_path`  | string  | no       |
| `sync_path`      | string  | no       |
| `sync_interval`  | number  | no       |
| `trash_on_delete` | boolean | no       |
| `commit_sync_enabled` | boolean | no |
| `commit_history_days` | number | no |

### `remove_git_repo`
Remove a git repo configuration and its local working copy.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `trigger_git_sync`
Manually trigger a sync for a git repo (pull from git; push to git only when `sync_mode` is `read_write`).

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |

### `git_sync_status`
Get the current sync status of a git repo.

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |
