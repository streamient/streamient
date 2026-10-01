---
title: Streamient CLI Command Reference
description: "Reference all 44 Streamient CLI commands for notes, memories, knowledge, URLs, emails, projects, graph links, and Git sync."
---

# CLI Command Reference

This reference is generated from the Streamient CLI alias registry. The 44 friendly commands map one-to-one to the complete MCP tool catalog.

Run `streamient-cli <group> <command> --help` with `STREAMIENT_CLI_ACCESS_TOKEN` set to load the current options, required fields, types, and enum values directly from the connected MCP server.

| Group | Command | MCP tool | Usage | Description |
| --- | --- | --- | --- | --- |
| `notes` | `create` | `create_note` | `streamient-cli notes create` | Create a note |
| `notes` | `read` | `read_note` | `streamient-cli notes read <id>` | Read one note |
| `notes` | `update` | `update_note` | `streamient-cli notes update <id>` | Update a note |
| `notes` | `delete` | `delete_note` | `streamient-cli notes delete <id>` | Delete a note |
| `notes` | `list` | `list_notes` | `streamient-cli notes list` | List notes |
| `notes` | `search` | `search_notes` | `streamient-cli notes search <query>` | Search notes |
| `memories` | `store` | `store_memory` | `streamient-cli memories store` | Store a memory |
| `memories` | `recall` | `recall_memory` | `streamient-cli memories recall <query>` | Recall relevant memories |
| `memories` | `search` | `search_memory` | `streamient-cli memories search <query>` | Search memories |
| `memories` | `read` | `read_memory` | `streamient-cli memories read <id>` | Read one memory |
| `memories` | `update` | `update_memory` | `streamient-cli memories update <id>` | Update a memory |
| `memories` | `delete` | `delete_memory` | `streamient-cli memories delete <id>` | Delete a memory |
| `memories` | `tags` | `suggest_memory_tags` | `streamient-cli memories tags` | Suggest existing memory tags |
| `knowledge` | `search` | `search_knowledge` | `streamient-cli knowledge search <query>` | Search across all knowledge |
| `knowledge` | `chat` | `chat` | `streamient-cli knowledge chat <query>` | Chat with Streamient |
| `urls` | `save` | `save_url` | `streamient-cli urls save` | Save and extract a URL |
| `urls` | `list` | `list_urls` | `streamient-cli urls list` | List saved URLs |
| `urls` | `search` | `search_urls` | `streamient-cli urls search <query>` | Search saved URLs |
| `urls` | `read` | `read_url` | `streamient-cli urls read <id>` | Read one saved URL |
| `urls` | `update` | `update_url` | `streamient-cli urls update <id>` | Update a saved URL |
| `urls` | `delete` | `delete_url` | `streamient-cli urls delete <id>` | Delete a saved URL |
| `emails` | `ingest` | `ingest_email` | `streamient-cli emails ingest` | Ingest raw or parsed email |
| `emails` | `read` | `read_email` | `streamient-cli emails read <id>` | Read one email |
| `emails` | `list` | `list_emails` | `streamient-cli emails list` | List emails |
| `emails` | `search` | `search_emails` | `streamient-cli emails search <query>` | Search emails |
| `emails` | `thread` | `get_email_thread` | `streamient-cli emails thread <id>` | Read a linked email thread |
| `emails` | `delete` | `delete_email` | `streamient-cli emails delete <id>` | Delete one email |
| `projects` | `list` | `list_projects` | `streamient-cli projects list` | List projects |
| `projects` | `get` | `get_project` | `streamient-cli projects get <id>` | Read one project |
| `projects` | `create` | `create_project` | `streamient-cli projects create` | Create a project |
| `projects` | `update` | `update_project` | `streamient-cli projects update <id>` | Update a project |
| `projects` | `delete` | `delete_project` | `streamient-cli projects delete <id>` | Delete a project |
| `projects` | `counts` | `get_project_counts` | `streamient-cli projects counts` | Get project content counts |
| `graph` | `link` | `create_link` | `streamient-cli graph link` | Link two knowledge items |
| `graph` | `links` | `get_links` | `streamient-cli graph links <item-id>` | List links for one item |
| `graph` | `show` | `get_graph` | `streamient-cli graph show` | Read the knowledge graph |
| `graph` | `traverse` | `traverse_graph` | `streamient-cli graph traverse <item-id>` | Traverse direct item connections |
| `graph` | `unlink` | `delete_link` | `streamient-cli graph unlink <link-id>` | Delete a knowledge graph link |
| `git` | `list` | `list_git_repos` | `streamient-cli git list` | List configured Git repositories |
| `git` | `add` | `add_git_repo` | `streamient-cli git add` | Add a Git repository |
| `git` | `update` | `update_git_repo` | `streamient-cli git update <id>` | Update Git repository settings |
| `git` | `remove` | `remove_git_repo` | `streamient-cli git remove <id>` | Remove a Git repository |
| `git` | `sync` | `trigger_git_sync` | `streamient-cli git sync <id>` | Trigger Git synchronization |
| `git` | `status` | `git_sync_status` | `streamient-cli git status <id>` | Read Git synchronization status |

Search commands default to five results per collection on updated servers. Use `--per-page` to override and `--page` where supported to paginate. Read relevant full records before deciding; see [Agent Configuration](../mcp/agents).

## Generic tool access

New MCP tools remain usable before a CLI alias release:

```fish
streamient-cli tools list
streamient-cli tools describe search_knowledge
streamient-cli tools call search_knowledge --input '{"query":"release decision"}'
```

See [Using the CLI](./using) for flags, JSON and file input, safety confirmation, output formats, and automation examples.
