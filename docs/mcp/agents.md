# Agent Configuration

To get the most out of Kumbukum with AI coding agents (GitHub Copilot, Cursor, Windsurf, Claude Code, etc.), add an `AGENTS.md` file to the root of your project. This tells agents how to use Kumbukum as their persistent memory layer and shared knowledge store.

## Why?

Without instructions, AI agents don't know Kumbukum exists. An `AGENTS.md` file tells them to:

- **Search before acting** — Check Kumbukum for existing context before starting work
- **Store learnings** — Save decisions, patterns, and outcomes after completing tasks
- **Use notes for documentation** — Keep project knowledge in Kumbukum, not scattered in files
- **Connect knowledge** — Link related items so context compounds instead of resetting

## Recommended AGENTS.md

Copy the following into an `AGENTS.md` file at the root of your project:

````markdown
# Project Instructions

## Knowledge Management
This project uses Kumbukum as its knowledge store via MCP.

### Before Starting Any Task
1. Make one specific retrieval call before work:
   - Default: `search_knowledge` with a task-focused query and `per_page: 3`
   - Memory-only tasks: `recall_memory` with `per_page: 3` for prior decisions, debugging history, user preferences, task outcomes, or agent-scoped learnings
   - Notes/spec tasks: `search_notes` with `per_page: 3` only for specs, docs, ADRs, structured write-ups, or when the first search points to notes
2. Do not call `search_notes` after every `search_knowledge` call
3. Read only the top 1-2 exact items, then broaden the query or raise `per_page` only if results are weak
4. Use the returned context to inform your approach

### After Completing Significant Work
1. Call `store_memory` to save key decisions, outcomes, and context for future sessions
2. Use descriptive titles and tag memories for easy retrieval
3. Use `create_link` to connect newly created items to related notes, memories, or URLs in the knowledge graph

### Creating Notes
Use `create_note` for structured documentation:
- Architecture decisions
- API designs
- Meeting notes
- Technical specs

After creating a note, use `create_link` to connect it to related items.

### Creating Memories
Use `store_memory` for agent-scoped learnings:
- Debugging insights and solutions
- User preferences and patterns
- Task outcomes and what worked
- Codebase conventions discovered during work

After storing a memory, use `create_link` to connect it to related notes, URLs, or other memories.

### Saving URLs
Use `save_url` to bookmark and extract content from web pages.

After saving a URL, use `create_link` to connect it to related notes or memories.

### Searching
- `search_knowledge` — Search across ALL types (notes, memories, URLs). **Default first call; use `per_page: 3`.**
- `recall_memory` — Search only memories for prior decisions, debugging history, preferences, and task outcomes
- `search_notes` — Search only notes; use only for specs/docs/ADRs or when earlier results point to notes
- `search_urls` — Search only saved URLs

### Tagging
- Before creating tags, call `suggest_memory_tags` to reuse existing tags and avoid duplicates
- Use consistent, descriptive tags (e.g., `architecture`, `debugging`, `api-design`)

### Knowledge Graph
- Use `create_link` to connect related notes, memories, and URLs
- Use `traverse_graph` to explore connections from a known item
- Use `get_graph` to see the full picture
````

## Customizing

Adapt the template to your workflow. Common additions:

- **Project-specific tags** — Define standard tags for your domain (e.g., `frontend`, `backend`, `database`)
- **Team conventions** — Note which types of knowledge go into notes vs memories
- **Search-first rules** — Require agents to search before creating duplicates

## Where to Place It

| AI Client | File location |
| --- | --- |
| GitHub Copilot | `AGENTS.md` in repo root (or any directory) |
| Cursor | `AGENTS.md` **and/or** `.cursor/rules/*.mdc` (versioned project rules) **and/or** **User Rules** in Cursor Settings (global, all repos) |
| Windsurf | `.windsurfrules` file |
| Claude Code | `CLAUDE.md` in repo root **and** hooks in `~/.claude/settings.json` (recommended) |

The markdown template above is the same across clients; only where you paste it changes.

### Claude Code

See **[Claude Code](./claude-code)** for:

- **Hooks** that automatically remind Claude to search Kumbukum before work and store after work
- Why hooks are more reliable than `CLAUDE.md` alone
- MCP server configuration in `~/.claude/settings.json`

### Cursor-specific

See **[Cursor (IDE)](./cursor-ide)** for:

- Paste-ready **global User Rules** (every repository on your machine)
- How **`alwaysApply`** project rules complement `AGENTS.md`
- MCP server safety in Cursor (server name `kumbukum` on `https://mcp.kumbukum.com/mcp`, never localhost)
