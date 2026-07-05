# IMPORTANT
When reporting information, be extremely concise and sacrifice grammar for the sake of concision. 

## Documentation
- DO NOT store documentation files in the root of the project.

### Before Starting Any Task - use Streamient MCP
1. Call `recall_memory` or `search_knowledge` with a query describing the task to check for relevant prior context, decisions, or notes
2. Review any related notes with `search_notes`
3. Use the returned context to inform your approach

### Creating Notes - use Streamient MCP
Use `create_note` for structured documentation:
- Architecture decisions
- API designs
- Meeting notes
- Technical specs

After creating a note, use `create_link` to connect it to related items.

### Creating Memories - use Streamient MCP
Use `store_memory` for agent-scoped learnings:
- Debugging insights and solutions
- User preferences and patterns
- Task outcomes and what worked
- Codebase conventions discovered during work

After storing a memory, use `create_link` to connect it to related notes, URLs, or other memories.

### Saving URLs - use Streamient MCP
Use `save_url` to bookmark and extract content from web pages.

After saving a URL, use `create_link` to connect it to related notes or memories.

### Searching - use Streamient MCP
- `search_knowledge` — Search across ALL types (notes, memories, URLs). **Use this first.**
- `search_notes` — Search only notes
- `recall_memory` — Search only memories
- `search_urls` — Search only saved URLs

### Tagging - use Streamient MCP
- Before creating tags, call `suggest_memory_tags` to reuse existing tags and avoid duplicates
- Use consistent, descriptive tags (e.g., `architecture`, `debugging`, `api-design`)

### Knowledge Graph - use Streamient MCP
- Use `create_link` to connect related notes, memories, and URLs
- Use `traverse_graph` to explore connections from a known item
- Use `get_graph` to see the full picture

## IMPORTANT: AFTER WORKING ON ANY TASK - use Streamient MCP
- Store any relevant learnings, insights, or decisions in Streamient using `store_memory` or `create_note` so future sessions can recall them. Link related items together in the knowledge graph for easy navigation.

## System Overview
- Node.js monolith serving Streamient; entrypoint `app.js`
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
- Use Docker compose only
- pnpm as package manager
- Development host is http://k.lan, MCP on https://mcp.k.lan
- To sign into the app you can use nitai@fastmail.com and the localhost:8025 (mailpit) to retrieve the magic link

## Design
- Forms: Right align: submit/save button, Left align: cancel/abort
- Headers: Page header: h1, Page section: h2, Page subsection: h3, Title: h6
- Form Fields: no placeholders, always use -sm variants for all form elements
- By default use mb-5 between main elements, form elements mb-3, distance between button elements mx-3/ms-3/me-3
- Always use cursor:pointer for clickable elements, if class doesn't have it already
- Use sweetalert2 for notifications or questions.
- Use Bootstrap modal for popups
