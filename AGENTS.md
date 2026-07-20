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
- Never change Redis or MongoDB implementation

## Implementation Conventions
- Before adding new dependencies, verify they are compatible with Node 24 and consider whether an existing custom module already covers the need.

## Development
- Development host is http://s.lan, MCP on https://mcp.s.lan
- To sign into the app you can use nitai@fastmail.com and the localhost:8025 (mailpit) to retrieve the magic link

## Testing
- Before running full/integration tests, source:
  - DEV_STREAMIENT_MONGODB_URI
  - DEV_REDIS_URL
  - DEV_TYPESENSE_HOST
  - TYPESENSE_PORT=8108
  - DEV_TYPESENSE_KEY
