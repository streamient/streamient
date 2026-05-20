# Claude Code and Kumbukum MCP

Claude Code can use Kumbukum as a **persistent memory layer** via the Model Context Protocol. Configure two layers so every session follows the same workflow: **hooks** (enforced by the harness) and **`CLAUDE.md`** (project instructions).

## Why hooks?

Instructions in `CLAUDE.md` are "best effort" — Claude reads them at session start but can forget mid-task, especially in long sessions. Claude Code **hooks** are enforced by the harness itself, not by the model. They fire at specific lifecycle events and inject reminders that Claude must act on. This makes Kumbukum integration reliable and automatic.

## 1. Hooks setup (recommended)

Hooks live in `~/.claude/settings.json` (user-level, all projects) or `.claude/settings.json` (per-project). User-level is recommended so Kumbukum works everywhere.

Add the following hooks to your `~/.claude/settings.json`:

```json
{
    "hooks": {
        "SessionStart": [
            {
                "hooks": [
                    {
                        "command": "echo 'KUMBUKUM: Before starting any task, search Kumbukum for relevant prior context using search_knowledge or recall_memory with a query describing the task. Also check search_notes for related documentation. Use the returned context to inform your approach.'",
                        "type": "command"
                    }
                ],
                "matcher": ""
            }
        ],
        "Stop": [
            {
                "hooks": [
                    {
                        "command": "echo 'KUMBUKUM REMINDER: Before finishing, store any learnings, decisions, or insights from this task to Kumbukum using store_memory and/or create_note. Link related items with create_link. Use suggest_memory_tags first to reuse existing tags. If you already stored to Kumbukum during this turn, or the task was trivial (no new learnings), you may skip this.'",
                        "type": "command"
                    }
                ],
                "matcher": ""
            }
        ]
    }
}
```

::: tip Merging with existing hooks
If you already have hooks in your settings, add the Kumbukum entries alongside them. Multiple hooks can share the same event — they run in order.
:::

### What each hook does

| Hook | Event | Purpose |
| --- | --- | --- |
| `SessionStart` | Fires when a new Claude Code session begins | Reminds Claude to search Kumbukum for prior context before starting work |
| `Stop` | Fires every time Claude is about to finish a response | Reminds Claude to store learnings, decisions, and insights before stopping |

The `Stop` hook includes a skip clause for trivial tasks or when Claude already stored during the current turn, so it does not create noise on simple questions.

## 2. `CLAUDE.md` in the repo root

In addition to hooks, add instructions to your project's `CLAUDE.md` so Claude knows the full Kumbukum workflow. Use the template on the [Agent configuration](./agents) page. Place it in the root of each repository where you want Kumbukum integration.

::: tip CLAUDE.md loads automatically
Claude Code reads `CLAUDE.md` from the working directory at session start. No extra configuration is needed.
:::

## 3. Connect the MCP server

Follow [MCP setup](./setup) to configure the Kumbukum MCP server. Claude Code reads MCP server definitions from `~/.claude/settings.json` or `.claude/settings.json`.

:::tabs
== Cloud
```json
{
    "mcpServers": {
        "kumbukum": {
            "command": "npx",
            "args": ["-y", "mcp-remote", "https://app.kumbukum.com/mcp"],
            "env": {
                "ACCESS-TOKEN": "your-access-token"
            }
        }
    }
}
```
== Self-Hosted
```json
{
    "mcpServers": {
        "kumbukum": {
            "command": "node",
            "args": ["/path/to/kumbukum/apps/mcp/server.js"],
            "env": {
                "ACCESS-TOKEN": "your-access-token",
                "API_BASE_URL": "https://your-instance.com"
            }
        }
    }
}
```
:::

## 4. Verify the integration

After configuring hooks and the MCP server, start a new Claude Code session and verify:

1. **Session start** — Claude should call `search_knowledge` or `recall_memory` before beginning work
2. **Task completion** — Claude should call `store_memory` or `create_note` before finishing a response
3. **Linking** — Claude should use `create_link` to connect related items in the knowledge graph

## 5. Related docs

| Topic | Link |
| --- | --- |
| MCP install and transports | [Setup](./setup) |
| Tool reference | [Tools](./tools) |
| `AGENTS.md` / `CLAUDE.md` template | [Agent configuration](./agents) |
| MCP overview | [MCP home](./) |
