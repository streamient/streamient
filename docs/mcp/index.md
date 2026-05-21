# MCP Server

Kumbukum includes a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes 28 tools for Claude Desktop, Cursor, and other MCP-compatible clients.

Connect once, then let every compatible AI tool retrieve trusted notes, memories, URLs, and links from the same shared memory layer.

## Features

- **28 tools** across notes, memories, URLs, projects, graph, search, and AI chat
- **Shared memory across tools** — capture once, retrieve everywhere
- **Fast setup** — connect most MCP clients in about a minute
- **Automatic default project** — tools work without specifying a project
- **Three transports**: stdio (default), SSE, and Streamable HTTP
- **Token-based auth** via `Authorization: Bearer`, `access-token`, or stdio env vars

## Quick Start

```bash
# Run with stdio transport (default)
env 'ACCESS-TOKEN'=your-access-token API_BASE_URL=https://your-instance.com node apps/mcp/server.js

# Run with HTTP transport
node apps/mcp/server.js --transport http --port 3002
```

See [Setup](./setup) for Claude Desktop configuration and [Tools](./tools) for the full tool reference.

For **Claude Code** (hooks for automatic search-before-work and store-after-work), see [Claude Code](./claude-code).

For **Cursor** (global User Rules, project `.cursor/rules`, and MCP server naming), see [Cursor (IDE)](./cursor-ide).

## Tool Categories

| Category | Tools | Description |
| -------- | ----- | ----------- |
| Notes    | 6     | Create, read, update, delete, list, search notes |
| Memories | 9     | Store, recall, search, CRUD memories + tags + knowledge search + AI chat |
| URLs     | 6     | Save, list, search, read, update, delete URLs |
| Projects | 2     | List and get projects |
| Graph    | 5     | Create/delete links, get graph, traverse connections |
