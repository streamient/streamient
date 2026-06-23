# Kumbukum MCP Server

Connect your AI tools to Kumbukum with the Model Context Protocol (MCP) — an open standard that lets AI assistants work directly with your notes, memories, saved URLs, emails, projects, and knowledge graph.

Instead of copying context between tools, your assistant reads and writes the same shared memory layer your team already trusts — across sessions, projects, and clients.

## What is MCP?

MCP is an open standard, developed by Anthropic, that creates a universal bridge between AI assistants and external tools. With the Kumbukum MCP server, your assistant can search and update your knowledge base directly — securely, and with your permission — without you leaving the chat.

## What you can do with it

With Kumbukum MCP, your AI assistant can:

- **Search across everything** — find relevant notes, memories, URLs, emails, and pages with one knowledge search
- **Remember decisions and learnings** — store memories so context persists across sessions
- **Create and update notes** — keep specs, docs, and meeting notes in one place
- **Save and read URLs** — bookmark pages with extracted content for later retrieval
- **Search and read emails** — retrieve email records, inspect threads, and keep email context available to AI clients
- **Connect related knowledge** — link items into a graph and traverse connections
- **Organize by project** — work within the right project automatically
- **Ask in natural language** — use AI chat to search, create, and analyze

The server exposes **44 tools** across notes, memories, URLs, emails, projects, graph, git sync, and search. See the [Tools reference](./tools) for the full list.

Public app submissions can use the curated `/mcp/app` endpoint on the same server. It exposes only private notes, memories, and project metadata tools; URL, email, git sync, graph, broad search, and chat orchestration tools remain available only on the full `/mcp` endpoint.

## How it works

1. **Connect once** — add the Kumbukum MCP server to your AI client.
2. **Authenticate** — sign in with OAuth (recommended) or a personal access token.
3. **Ask in natural language** — tell your assistant what you need ("save this decision", "what did we decide about auth?").
4. **Kumbukum runs the tool** — the request executes securely against your account, respecting your permissions.
5. **Get results back** — your assistant returns the answer and keeps the context for next time.

## Supported AI clients

Kumbukum MCP works with any MCP-compatible client, including:

- Claude Desktop & Claude.ai
- Claude Code
- Cursor
- VS Code (with Copilot)
- ChatGPT
- Windsurf
- Codex CLI

## Next steps

- **[Setup & Authentication](./setup)** — connect your client with OAuth or a token
- **[Tools](./tools)** — the full reference for all 44 tools
- **[Claude Code](./claude-code)** — hooks for automatic search-before-work and store-after-work
- **[Cursor (IDE)](./cursor-ide)** — global User Rules and project rules
- **[Agent configuration](./agents)** — the `AGENTS.md` / `CLAUDE.md` template
