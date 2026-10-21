# Streamient

> Open source memory infrastructure for teams.  
> Turn scattered company knowledge into AI-ready context.

## Intro video

[![Watch the video](http://img.youtube.com/vi/DnNchFuE1Do/0.jpg)](http://www.youtube.com/watch?v=DnNchFuE1Do)

Stop reset loops. Give every AI tool trusted memory your team can inspect, control, and reuse.

Streamient is an open-source memory layer for AI-native teams and MCP-compatible tools. Store notes, memories, URLs, and relationships in one place, then let assistants retrieve the right context across sessions, projects, and clients.

[Website](https://streamient.com) · [Cloud](https://app.streamient.com) · [Docs](https://docs.streamient.com) · [CLI](https://docs.streamient.com/cli/) · [Obsidian Sync](https://docs.streamient.com/guide/obsidian-sync) · [Self-Hosted Guide](https://docs.streamient.com/selfhosted/) · [MCP Docs](https://docs.streamient.com/mcp/) · [API Reference](https://docs.streamient.com/api/)

![Streamient homepage preview](docs/assets/readme-hero.jpg)

## Why Streamient?

AI tools are great at reasoning and terrible at remembering.

Streamient gives you a shared, searchable, editable memory layer that sits between your team and your AI tools:

- **Persistent context** — keep preferences, decisions, docs, and bookmarks across sessions
- **Works across tools** — use the same memory store with Claude Desktop, Cursor, and other MCP clients
- **Open and inspectable** — your memory is not trapped in a black box
- **Built for teams** — organize knowledge by project, connect related items, and make it reusable

## What’s included

- **Notes** — rich-text documents with full-text and semantic search
- **Memories** — short-form context for preferences, decisions, and learnings
- **URLs** — saved pages with extracted content and optional full-site crawling
- **Knowledge Graph** — manual, tag-based, and semantic links between items
- **AI Chat** — search and manage knowledge with natural language
- **MCP Server** — 44 tools for notes, memories, URLs, projects, graph, and search
- **CLI** — composable terminal access to the complete MCP tool catalog
- **Browser Extension** — save notes and URLs from anywhere
- **Obsidian Sync** — scoped two-way sync for multiple projects and accounts in one vault
- **Bidirectional Git Sync** — sync project knowledge to and from Git repositories

## How it works

1. **Capture knowledge** — add notes, store memories, save URLs, or import documents
2. **Connect your tools** — plug Streamient into Claude Desktop, Cursor, or another MCP client
3. **Retrieve the right context** — your assistant searches and reuses what matters, instead of starting from zero every time

## Cloud or self-hosted

Streamient Cloud and the self-hosted edition share the same product features. The difference is who runs the infrastructure.

| | Cloud | Self-Hosted |
| --- | --- | --- |
| Features | All | All |
| Hosting | Managed by us | You manage |
| Updates | Automatic | Manual |
| Backups | Included | You configure |
| Pricing | Subscription | Free (open source) |

## Quick start

### Streamient Cloud

1. Sign up at [app.streamient.com](https://app.streamient.com)
2. Create your first project
3. Generate a personal access token in **Settings → Tokens**
4. Add Streamient to your AI tool

Example Claude Desktop config on macOS:

```json
{
    "mcpServers": {
        "streamient": {
            "command": "npx",
            "args": ["-y", "mcp-remote", "https://mcp.streamient.com/mcp"],
            "env": {
                "ACCESS-TOKEN": "your-access-token"
            }
        }
    }
}
```

### Self-hosted

#### Production with Docker Compose

Requirements:

- Node.js >= 24
- Docker & Docker Compose
- pnpm 10+ (for local development)
- MongoDB 6+
- Memcached 1.6+
- Typesense 31+

Grab the production Compose file and pass configuration as shell environment variables:

```bash
curl -O https://raw.githubusercontent.com/streamient/streamient/main/compose.prod.yml

APP_URL=https://your-instance.com \
SESSION_SECRET=your-session-secret \
JWT_SECRET=your-jwt-secret \
TYPESENSE_API_KEY=your-typesense-key \
SMTP_HOST=smtp.example.com \
SMTP_USER=you@example.com \
SMTP_PASS=your-smtp-password \
SMTP_FROM=noreply@example.com \
GOOGLE_API_KEY=your-google-api-key \
docker compose -f compose.prod.yml up -d
```

For multiple outbound SMTP servers, set `SMTP_SERVERS` to a JSON array of server objects. Streamient sends through them round-robin.

Example:

```bash
SMTP_SERVERS='[
	{
		"name": "smtp-1",
		"host": "smtp1.example.com",
		"port": 587,
		"secure": false,
		"user": "smtp-user-1",
		"pass": "smtp-pass-1",
		"from": "server@streamient.com"
	},
	{
		"name": "smtp-2",
		"host": "smtp2.example.com",
		"port": 465,
		"secure": true,
		"user": "smtp-user-2",
		"pass": "smtp-pass-2",
		"from": "server@streamient.com"
	}
]'
```

In Docker Compose YAML, quote it as a single JSON string:

```yaml
environment:
    SMTP_FROM: server@streamient.com
    SMTP_SERVERS: >-
        [{"name":"smtp-1","host":"smtp1.example.com","port":587,"secure":false,"user":"smtp-user-1","pass":"smtp-pass-1","from":"server@streamient.com"},{"name":"smtp-2","host":"smtp2.example.com","port":465,"secure":true,"user":"smtp-user-2","pass":"smtp-pass-2","from":"server@streamient.com"}]
```

Only `host` is required per server. `port` defaults to `587`, `secure` defaults to `true` only for port `465`, and `from` falls back to `SMTP_FROM`.

No `.env` file is required for this setup.

Default service ports:

| Service | Port |
| --- | --- |
| App | `3000` |
| WebSocket | `3001` |
| MCP Server | `3002` |
| MongoDB | `27017` |
| Memcached | `11211` |
| Typesense | `8108` |

### Local development

Read the [contribution guide](.github/CONTRIBUTING.md) before changing the repository. Base contribution branches and pull requests on `develop`; `main` is reserved for authorized releases.

For repository development, make sure MongoDB, Memcached, and Typesense are available, then run:

```bash
git clone https://github.com/streamient/streamient.git
cd streamient
pnpm install
pnpm dev
```

Useful scripts:

- `pnpm dev` — run the app with auto-reload
- `pnpm build` — build frontend assets
- `pnpm test` — run the test suite
- `pnpm test:mcp` — run MCP-specific tests
- `pnpm docs:dev` — run the docs site locally

## MCP server

Streamient includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) server with:

- **44 tools** across notes, memories, URLs, projects, graph, search, and AI chat
- **Shared memory across tools** so Claude Desktop, Cursor, and others pull from the same context
- **Three transports** — stdio, SSE, and Streamable HTTP
- **Token-based auth** via `Authorization: Bearer`, `access-token`, or stdio env vars
- **Automatic default project selection** so tools work without extra setup

Self-hosted example:

```bash
env 'ACCESS-TOKEN'=your-access-token API_BASE_URL=https://your-instance.com node apps/mcp/server.js
```

## CLI

The [`@streamient/cli`](https://www.npmjs.com/package/@streamient/cli) package exposes Streamient's complete MCP tool catalog to people, shell scripts, CI jobs, and coding agents. It supports multiple account aliases and discovers command schemas from the connected server.

```fish
pnpm add --global @streamient/cli
set -gx STREAMIENT_CLI_ACCESS_TOKEN 'your-personal-access-token'
streamient-cli doctor
```

[Install and configure the CLI](https://docs.streamient.com/cli/) · [Browse all commands](https://docs.streamient.com/cli/commands)

## Obsidian Sync

Streamient Sync keeps one Obsidian vault synchronized with multiple Streamient projects and OAuth accounts. Each project has its own managed folder and optional extra-vault scope, with first-sync review, sequential processing, cooperative abort/resume, and newest-wins conflict recovery. Notes, Memories, and saved URLs round-trip as Markdown; Canvas, Bases, documents, and attachments are also mirrored.

[Read the Obsidian Sync guide](https://docs.streamient.com/guide/obsidian-sync) · [Install Streamient Sync from Obsidian Community Plugins](https://obsidian.md/plugins?id=streamient-sync) · [View the plugin source](https://github.com/streamient/streamient-obsidian)

## Architecture at a glance

- **Backend** — Node.js + Express
- **Database** — MongoDB
- **Search** — Typesense for full-text and semantic retrieval
- **Cache / real-time** — Memcached cache + Socket.IO with MongoDB clustering
- **Frontend** — Pug templates + vanilla JavaScript
- **MCP app** — `apps/mcp/` for agent integrations

## Documentation

- [Guide](https://docs.streamient.com/guide/)
- [Self-Hosted](https://docs.streamient.com/selfhosted/)
- [MCP Server](https://docs.streamient.com/mcp/)
- [CLI](https://docs.streamient.com/cli/)
- [Obsidian Sync](https://docs.streamient.com/guide/obsidian-sync)
- [API Reference](https://docs.streamient.com/api/)
- [Cloud](https://docs.streamient.com/cloud/)

## License

Licensed under [AGPL-3.0](LICENSE).
