# Kumbukum Instructions

- When reporting information, be extremely concise and sacrifice grammar for the sake of concision. 

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
1. Call `store_memory` to save key decisions, outcomes, and context for future sessions; use `create_note` when the outcome is structured documentation (specs, ADRs)
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

## System Overview
- Node.js monolith serving Kumbukum; entrypoint `app.js`
- Environment variables are used and never checked into git
- Repo root hosts the main app;
- sub-app under `apps/`

## Architecture & Patterns
- HTTP stack = `routes/**` (Express routers) -> `services/**` (business logic) -> `model/**` (Mongoose schemas) with utilities in `modules/**`.
- Multi-tenant safety matters: `host_id` filtering stays intact. 
- When adding/editing API endpoints, always update the Swagger docs

## Implementation Conventions
- Before adding new dependencies, verify they are compatible with Node 24 and consider whether an existing custom module already covers the need.

## IMPORTANT: Code Formatting
- tab size: 4
- Indent code
- Never compress or “minify” code
- Log lines or variables are always writen in a single line
- PUG: Pug requires proper indendation with tabs and not spaces
- PUG: Do NOT use pipe words (|) but rather use "span" text, e.g., span.ps-1 Settings
- Do not write HTML directly into frontend JS files; use Pug templates in `views/ajax` instead.

## Development
- Use Docker compose only (Orbstack on macOS)
- pnpm as package manager
- To sign into the app you can use nitai@fastmail.com and the localhost:8025 (mailpit) to retrieve the magic link

## Design
- Forms: Right align: submit/save button, Left align: cancel/abort
- Headers: Page header: h1, Page section: h2, Page subsection: h3, Title: h6
- Form Fields: no placeholders, always use -sm variants for all form elements
- By default use mb-5 between main elements, form elements mb-3, distance between button elements mx-3/ms-3/me-3
- Always use cursor:pointer for clickable elements, if class doesn't have it already
- Use sweetalert2 for notifications or questions.
- Use Bootstrap modal for popups
