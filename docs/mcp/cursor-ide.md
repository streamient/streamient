# Cursor (IDE) and Streamient MCP

Cursor can use Streamient as a **persistent memory layer** for Agent (Chat) via the Model Context Protocol. Configure three layers so every session follows the same workflow: **global User Rules** (all repos on your machine), **project rules** (per repository), and optionally **`AGENTS.md`**.

## 1. Global User Rules (recommended)

User Rules apply to **every project** in Cursor Agent (Chat). They are **not** stored in a Git repo; they live in Cursor Settings.

1. Open **Cursor Settings** → **Rules, Commands** (or **General** → **Rules for AI**, depending on your Cursor version).
2. Find **User Rules** (global).
3. Paste the block below (or keep it in a file and copy when onboarding a new machine).

### Paste this into User Rules

```markdown
## Streamient MCP (all projects)

When Streamient MCP is enabled in Cursor for this profile:

**Before non-trivial work** (features, debugging, multi-file changes): call `search_knowledge` or `recall_memory` with a short task query; use `search_notes` for written specs. Use returned context to inform the approach.

**After completing meaningful work**: call `store_memory` (title + content + tags) for outcomes and learnings; use `create_note` for structured specs or ADRs when appropriate. Use `suggest_memory_tags` before inventing new tags. Use `create_link` to connect related items when useful.

**MCP server + endpoint safety**: invoke tools on the server whose name is `streamient` (its tool id may appear as `user-streamient` in Cursor) and ensure it targets `https://mcp.streamient.com/mcp`. Do not write via localhost/127.0.0.1 MCP endpoints. If the `streamient` server is not available, stop writes and fix **Cursor Settings → MCP** first.

If Streamient MCP is unavailable, continue work and say so in the reply so the user can fix MCP or capture notes manually.

Respect each repository’s own **AGENTS.md** and **`.cursor/rules/`** for stack-specific conventions; this block is only for shared memory hygiene.
```

::: tip Team rollout
For **organization-wide** enforcement, Cursor **Team Rules** (dashboard) can carry the same text so members cannot disable them.
:::

## 2. Project rules (`.cursor/rules/`)

For repositories you control, add versioned rules so teammates get the same behavior without touching each laptop:

- Create **`.cursor/rules/*.mdc`** with YAML frontmatter.
- Set **`alwaysApply: true`** when the workflow should run on every Agent chat in that repo.

Example for a product monorepo: duplicate the workflow above into `.cursor/rules/streamient-mcp-workflow.mdc` and commit it.

## 3. `AGENTS.md` in the repo root

Cursor loads **`AGENTS.md`** as a simple alternative to `.cursor/rules`. Use the template on the [Agent configuration](./agents) page. It matches the User Rules content; keeping both avoids gaps when one source is missing.

## 4. Connect the MCP server

Follow [MCP setup](./setup) (token, URL or stdio). After adding the server in **Cursor Settings → MCP**, confirm tools appear for server name **`streamient`** (often shown with a `user-` prefix in tool ids) and verify the URL is **`https://mcp.streamient.com/mcp`**.

## 5. Related docs

| Topic | Link |
| --- | --- |
| MCP install & transports | [Setup](./setup) |
| Tool reference | [Tools](./tools) |
| `AGENTS.md` template | [Agent configuration](./agents) |
| MCP overview | [MCP home](./) |
