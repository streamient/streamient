# Claude Code and Kumbukum MCP

Claude Code can use Kumbukum as a **persistent memory layer** via the Model Context Protocol. Configure two layers so every session follows the same workflow: **hooks** (enforced by the harness) and **`CLAUDE.md`** (project instructions).

## Why hooks?

Instructions in `CLAUDE.md` are "best effort" — Claude reads them at session start but can forget mid-task, especially in long sessions. Claude Code **hooks** are run by the harness itself, not by the model, so they fire reliably at specific lifecycle events.

There are two strengths of hook, and the difference matters:

- **Reminder hooks** (`echo '...'`) print a message at the event. At `SessionStart` this works well, because it fires *before* work begins and primes Claude for the whole session. At `Stop`, a plain `echo` is **best-effort only** — its output is shown in the transcript but is not injected as an instruction Claude must act on, and by the time `Stop` fires Claude has already decided it is done. So a `Stop` reminder is easy to skip, which is why you may find yourself manually nudging Claude to save.
- **Blocking hooks** can *prevent* Claude from finishing until a condition is met. A `Stop` hook that returns a `block` decision forces Claude to keep working — so you can require a memory write before every turn ends. This is the only way to make end-of-turn saving truly automatic.

Use the reminder hooks below for a lightweight setup, or add the [blocking Stop hook](#guaranteed-writes-the-blocking-stop-hook) for a guaranteed write on every turn.

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

::: warning The `Stop` reminder is best-effort
Because the `Stop` hook above is a plain `echo`, Claude can still finish without saving (see [Why hooks?](#why-hooks)). If you keep having to remind Claude to write to Kumbukum, replace it with the blocking hook below.
:::

### Guaranteed writes: the blocking Stop hook

This upgrade makes saving non-optional: a small script inspects the conversation transcript and **blocks Claude from finishing** until it sees a `store_memory` or `create_note` call since your last message. If none is found, Claude is told to save and forced to continue; once it saves, the next stop succeeds.

**Step 1 — create the script** at `~/.claude/hooks/kumbukum-stop.js`:

```js
#!/usr/bin/env node
// Kumbukum Stop hook: blocks Claude from stopping until it has written to
// Kumbukum (store_memory / create_note) since the last human turn.

const TOOL_RE = /(store_memory|create_note)/;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  });
}

// A human turn is a `user` entry whose content is not a tool_result.
function isHumanTurn(entry) {
  if (!entry || entry.type !== "user") return false;
  const content = entry.message && entry.message.content;
  if (typeof content === "string") return true;
  if (Array.isArray(content)) {
    return !content.some((b) => b && b.type === "tool_result");
  }
  return false;
}

// An assistant entry containing a tool_use whose name matches the Kumbukum tools.
function hasKumbukumWrite(entry) {
  if (!entry || entry.type !== "assistant") return false;
  const content = entry.message && entry.message.content;
  if (!Array.isArray(content)) return false;
  return content.some(
    (b) => b && b.type === "tool_use" && TOOL_RE.test(String(b.name || ""))
  );
}

function allow() {
  process.exit(0);
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

(async () => {
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    allow(); // can't parse payload — fail open, never wedge the session
    return;
  }

  // Already nudged once this stop cycle: let it go to avoid an infinite loop.
  if (payload.stop_hook_active) allow();

  const fs = require("fs");
  let lines;
  try {
    lines = fs.readFileSync(payload.transcript_path, "utf8").split("\n");
  } catch {
    allow(); // no readable transcript — fail open
    return;
  }

  const entries = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      entries.push(JSON.parse(t));
    } catch {
      /* skip malformed line */
    }
  }

  // Find the last human turn; only writes after it count for this turn.
  let lastHuman = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isHumanTurn(entries[i])) {
      lastHuman = i;
      break;
    }
  }

  for (let i = lastHuman + 1; i < entries.length; i++) {
    if (hasKumbukumWrite(entries[i])) allow();
  }

  block(
    "KUMBUKUM: You have not stored anything to Kumbukum this turn. Before " +
      "stopping, store the learnings, decisions, or insights from this task " +
      "using store_memory and/or create_note. Run suggest_memory_tags first " +
      "to reuse existing tags, and link related items with create_link. If — " +
      "and only if — nothing here is worth persisting (a trivial or purely " +
      "informational exchange), store a one-line memory noting that, so this " +
      "check passes. Do not ask the user; this is a standing instruction."
  );
})();
```

**Step 2 — point the `Stop` hook at the script.** Replace the `echo` command in the `Stop` block of `~/.claude/settings.json` with:

```json
"command": "node \"$HOME/.claude/hooks/kumbukum-stop.js\""
```

So the `Stop` block becomes:

```json
"Stop": [
    {
        "hooks": [
            { "command": "node \"$HOME/.claude/hooks/kumbukum-stop.js\"", "type": "command" }
        ],
        "matcher": ""
    }
]
```

#### How it behaves

| Situation | Result |
| --- | --- |
| A `store_memory` / `create_note` call happened since your last message | Allows the stop |
| No write yet | Returns a `block` decision; Claude is forced to continue and save, then stops on the next pass |
| Has already been nudged once this turn (`stop_hook_active`) | Allows the stop — one nudge per turn, never an infinite loop |
| Transcript or payload can't be read | Fails open (allows the stop) — never wedges a session |
| Trivial / informational chat | Claude can store a one-line "nothing worth persisting" memory to satisfy the check |

::: tip This is global and applies next session
Editing `~/.claude/settings.json` affects every project. Hook config is read at session start, so the change takes effect on your **next** Claude Code session, not the one you edit it in.
:::

#### Or just ask Claude to set it up

Instead of copying files by hand, paste this instruction to Claude Code (or any Claude with filesystem access) and it will do the whole setup:

```text
Set up a Kumbukum "guaranteed memory write" hook for Claude Code:

1. Create ~/.claude/hooks/kumbukum-stop.js — a Node script that reads the
   Stop-hook JSON payload from stdin (fields: transcript_path,
   stop_hook_active), parses the JSONL transcript, finds the last genuine
   human turn (a "user" entry whose content is NOT a tool_result), and scans
   the assistant entries after it for a tool_use whose name matches
   /store_memory|create_note/.
   - If such a write is found, exit 0 (allow the stop).
   - If not, print {"decision":"block","reason":"..."} to stdout and exit 0,
     where reason instructs Claude to store the turn's learnings via
     store_memory/create_note (use suggest_memory_tags first, link with
     create_link) before stopping, with a one-line "nothing worth persisting"
     escape hatch for trivial chats.
   - If stop_hook_active is true, exit 0 (one nudge per turn, no infinite loop).
   - On any parse/read error, exit 0 (fail open, never wedge the session).

2. In ~/.claude/settings.json, set the Stop hook command to:
   node "$HOME/.claude/hooks/kumbukum-stop.js"
   Preserve any existing hooks and other settings.

3. Verify the script with a couple of fake transcript fixtures: one with no
   Kumbukum write (should print the block JSON) and one with a store_memory
   tool_use (should output nothing and exit 0).
```

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
