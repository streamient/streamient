# Kumbukum

> Open source memory infrastructure for teams.  
> Turn scattered company knowledge into AI-ready context.

## Intro video

[![Watch the video](http://img.youtube.com/vi/DnNchFuE1Do/0.jpg)](http://www.youtube.com/watch?v=DnNchFuE1Do)

Stop reset loops. Give every AI tool trusted memory your team can inspect, control, and reuse.

Kumbukum is an open-source memory layer for AI-native teams and MCP-compatible tools. Store notes, memories, URLs, and relationships in one place, then let assistants retrieve the right context across sessions, projects, and clients.

[Website](https://kumbukum.com) · [Cloud](https://app.kumbukum.com) · [Docs](https://docs.kumbukum.com) · [Self-Hosted Guide](https://docs.kumbukum.com/selfhosted/) · [MCP Docs](https://docs.kumbukum.com/mcp/) · [API Reference](https://docs.kumbukum.com/api/)

![Kumbukum homepage preview](docs/assets/readme-hero.jpg)

## Why Kumbukum?

AI tools are great at reasoning and terrible at remembering.

Kumbukum gives you a shared, searchable, editable memory layer that sits between your team and your AI tools:

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
- **Browser Extension** — save notes and URLs from anywhere
- **Bidirectional Git Sync** — sync project knowledge to and from Git repositories

## How it works

1. **Capture knowledge** — add notes, store memories, save URLs, or import documents
2. **Connect your tools** — plug Kumbukum into Claude Desktop, Cursor, or another MCP client
3. **Retrieve the right context** — your assistant searches and reuses what matters, instead of starting from zero every time

## Cloud or self-hosted

Kumbukum Cloud and the self-hosted edition share the same product features. The difference is who runs the infrastructure.

| | Cloud | Self-Hosted |
| --- | --- | --- |
| Features | All | All |
| Hosting | Managed by us | You manage |
| Updates | Automatic | Manual |
| Backups | Included | You configure |
| Pricing | Subscription | Free (open source) |

## Quick start

### Kumbukum Cloud

1. Sign up at [app.kumbukum.com](https://app.kumbukum.com)
2. Create your first project
3. Generate a personal access token in **Settings → Tokens**
4. Add Kumbukum to your AI tool

Example Claude Desktop config on macOS:

```json
{
    "mcpServers": {
        "kumbukum": {
            "command": "npx",
            "args": ["-y", "mcp-remote", "https://mcp.kumbukum.com/mcp"],
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
- Redis 6+
- Typesense 31+

Grab the production Compose file and pass configuration as shell environment variables:

```bash
curl -O https://raw.githubusercontent.com/kumbukum/kumbukum/main/compose.prod.yml

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

For multiple outbound SMTP servers, set `SMTP_SERVERS` to a JSON array of server objects. Kumbukum sends through them round-robin.

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
		"from": "server@kumbukum.com"
	},
	{
		"name": "smtp-2",
		"host": "smtp2.example.com",
		"port": 465,
		"secure": true,
		"user": "smtp-user-2",
		"pass": "smtp-pass-2",
		"from": "server@kumbukum.com"
	}
]'
```

In Docker Compose YAML, quote it as a single JSON string:

```yaml
environment:
    SMTP_FROM: server@kumbukum.com
    SMTP_SERVERS: >-
        [{"name":"smtp-1","host":"smtp1.example.com","port":587,"secure":false,"user":"smtp-user-1","pass":"smtp-pass-1","from":"server@kumbukum.com"},{"name":"smtp-2","host":"smtp2.example.com","port":465,"secure":true,"user":"smtp-user-2","pass":"smtp-pass-2","from":"server@kumbukum.com"}]
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
| Redis | `6379` |
| Typesense | `8108` |

### Local development

For repository development, make sure MongoDB, Redis, and Typesense are available, then run:

```bash
git clone https://github.com/kumbukum/kumbukum.git
cd kumbukum
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

Kumbukum includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) server with:

- **44 tools** across notes, memories, URLs, projects, graph, search, and AI chat
- **Shared memory across tools** so Claude Desktop, Cursor, and others pull from the same context
- **Three transports** — stdio, SSE, and Streamable HTTP
- **Token-based auth** via `Authorization: Bearer`, `access-token`, or stdio env vars
- **Automatic default project selection** so tools work without extra setup

Self-hosted example:

```bash
env 'ACCESS-TOKEN'=your-access-token API_BASE_URL=https://your-instance.com node apps/mcp/server.js
```

## Architecture at a glance

- **Backend** — Node.js + Express
- **Database** — MongoDB
- **Search** — Typesense for full-text and semantic retrieval
- **Cache / real-time** — Redis + Socket.IO
- **Frontend** — Pug templates + vanilla JavaScript
- **MCP app** — `apps/mcp/` for agent integrations

## Documentation

- [Guide](https://docs.kumbukum.com/guide/)
- [Self-Hosted](https://docs.kumbukum.com/selfhosted/)
- [MCP Server](https://docs.kumbukum.com/mcp/)
- [API Reference](https://docs.kumbukum.com/api/)
- [Cloud](https://docs.kumbukum.com/cloud/)

## License

Licensed under [AGPL-3.0](LICENSE).
