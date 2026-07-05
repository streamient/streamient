# Streamient Docs Instructions

- When reporting information, be extremely concise and sacrifice grammar for the sake of concision.

# Context

Streamient is not a note taking or second brain app. Refer to it as a "memory layer for AI-native teams" or "a place that turns scattered company knowledge into AI-ready context every assistant can use". Avoid calling it a "personal knowledge library" or "second brain".

## Documentation
- For **Cursor** + Streamient MCP (global User Rules, project rules): maintain [MCP → Cursor (IDE)](/mcp/cursor-ide) from `docs/mcp/cursor-ide.md`.
- IMPORTANT: BEFORE EXECUTING A REGEX SEARCH THROUGH OUR CODE BASE ALWAYS CHECK THE RAZUNA-MEMORY MCP SERVER FIRST
- IMPORTANT: For each fix, change, update, etc., create a new documentation note in the RAZUNA-MEMORY MCP server. You can create markdown notes or store and recall memory. Use both as needed.
- DO NOT store documentation files in the root of the project.
- Notes and memory should be tagged with "streamient-docs" for easy retrieval by agents.

## Project Overview
- VitePress 1.6.4 static docs site, deployed at `streamient.com/docs/`
- Config: `.vitepress/config.js`, theme: `.vitepress/theme/index.js`
- OpenAPI spec auto-generated via `scripts/export-openapi.js` from the root `swagger.js`
- Uses `vitepress-openapi` for interactive API reference and `vitepress-plugin-tabs` for Cloud/Self-Hosted content toggling

## Dual-Edition Structure
- **Cloud** (`app.streamient.com`): pages under `cloud/` — account, billing, support
- **Self-Hosted**: pages under `selfhosted/` — installation, configuration, upgrading
- **Shared pages** (API, MCP): use `:::tabs` blocks for URL/config differences between editions
- Tab choice persists in localStorage across pages — readers pick once
- Features are identical across editions; only hosting/setup/URLs differ

### Tab Syntax
```md
:::tabs
== Cloud
Cloud-specific content here
== Self-Hosted
Self-hosted content here
:::
```

## File Structure
```
docs/
├── index.md                 # Home page (layout: home)
├── getting-started.md       # Edition chooser with tabs
├── cloud/                   # Cloud-only pages
│   ├── index.md
│   ├── account.md
│   ├── billing.md
│   └── support.md
├── selfhosted/              # Self-hosted-only pages
│   ├── index.md
│   ├── installation.md
│   ├── configuration.md
│   └── upgrading.md
├── api/                     # Shared API docs (tabbed URLs)
│   ├── index.md
│   ├── authentication.md
│   ├── notes.md
│   ├── memories.md
│   ├── urls.md
│   ├── search.md
│   └── operations/          # Auto-generated OpenAPI pages
├── mcp/                     # Shared MCP docs (tabbed config)
│   ├── index.md
│   ├── setup.md
│   └── tools.md
└── .vitepress/
    ├── config.js            # VitePress config, sidebar, nav
    ├── theme/index.js       # Theme setup + plugin registration
    └── data/openapi.json    # Generated OpenAPI spec
```

## Conventions
- Cloud domain: `app.streamient.com`
- Self-hosted placeholder: `your-instance.com`
- When adding new pages, update sidebar config in `.vitepress/config.js`
- Edition-specific content goes in `cloud/` or `selfhosted/`; shared content uses `:::tabs` blocks
- Do not duplicate shared content across edition sections — use tabs instead

## Commands
- `pnpm dev` — Dev server at `localhost:5173` (hot reload)
- `pnpm build` — Export OpenAPI spec + build static site
- `pnpm preview` — Preview built site at `localhost:4173`

## IMPORTANT: Code Formatting
- tab size: 4
- Indent code
- Never compress or "minify" code
