# Getting Started

Streamient is a memory layer for AI-native teams. It's available as a managed cloud service or a self-hosted open-source application — both editions share the same product features.

## Choose Your Edition

:::tabs
== Cloud
**Streamient Cloud** — We handle hosting, updates, backups, and MCP infrastructure.

1. Sign up at [app.streamient.com](https://app.streamient.com) or accept a team invite
2. If you join an existing account, you land in that shared account instead of creating a separate workspace
3. Use the account switcher in the top-right nav if your login belongs to more than one account
4. Generate a personal access token in **Settings > Access Tokens** and connect your AI tools

[Cloud documentation →](/cloud/)

== Self-Hosted
**Self-Hosted** — Run Streamient on your own infrastructure.

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

To rotate outbound mail across several SMTP servers, set `SMTP_SERVERS` to a JSON array. When present, Streamient sends emails round-robin across those servers.

[Installation guide →](/selfhosted/installation)
:::

## Teams and accounts

- Each account has its own projects, notes, memories, URLs, exports, and members
- Owners and admins can invite teammates from **Settings > My Team**
- A single user can belong to multiple accounts and switch the active account from the navbar
- New projects and saved content go into the currently active account

## Next Steps

- [API Reference](/api/) — REST API for notes, memories, URLs, and search
- [MCP Server](/mcp/) — 44 tools for Claude Desktop and other LLM clients
- [Knowledge Graph](/guide/graph) — Connect your data with manual, tag-based, and semantic links
