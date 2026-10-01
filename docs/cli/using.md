---
title: Using the Streamient CLI
description: "Use Streamient CLI commands, live MCP schemas, JSON and file input, output modes, projects, confirmations, automation, and shell completion."
---

# Using the CLI

## Command help and live schemas

Top-level and group help works without connecting:

```fish
streamient-cli --help
streamient-cli memories --help
```

With `STREAMIENT_CLI_ACCESS_TOKEN` set, command help loads the current MCP schema and displays supported flags, required fields, types, and enum values:

```fish
streamient-cli notes create --help
streamient-cli tools describe create_note --pretty
```

Friendly flags use kebab case and are translated to MCP field names. Repeat array flags:

```fish
streamient-cli notes create --title 'Launch decision' --content '<p>Approved</p>' --tags decision --tags release
```

IDs and search queries accepted by friendly commands can be positional. Other MCP properties use flags.

## JSON, stdin, and files

Use literal JSON:

```fish
streamient-cli tools call search_knowledge --input '{"query":"renewal decision"}'
```

Read a JSON object from a file or stdin:

```fish
streamient-cli notes create --input @note.json
printf '%s' '{"query":"renewal decision"}' | streamient-cli tools call search_knowledge --input -
```

Load UTF-8 file contents into a named string field:

```fish
streamient-cli notes create --title 'Architecture' --file content=architecture.html
streamient-cli emails ingest --file raw_email=message.eml
```

When combined, `--input` supplies the base object, positional arguments apply next, and explicit flags apply last.

## Output

Successful commands print compact JSON to stdout by default. Diagnostics and structured errors go to stderr.

```fish
streamient-cli notes list --limit 3
streamient-cli notes list --limit 3 --pretty
streamient-cli notes list --limit 3 --table
```

This makes JSON safe to pipe into tools such as `jq`:

```fish
streamient-cli projects list | jq -r '.[].name'
```

## Account, server, and project selection

### Account tokens

Without a selector, commands use `STREAMIENT_CLI_ACCESS_TOKEN`. Select another account without placing its token in the command:

```fish
set -gx STREAMIENT_CLI_ACCESS_TOKEN_PERSONAL 'personal-token'
set -gx CUSTOMER_STREAMIENT_TOKEN 'customer-token'

streamient-cli projects list --account personal
streamient-cli projects list --token-env CUSTOMER_STREAMIENT_TOKEN
```

`--account personal` resolves `STREAMIENT_CLI_ACCESS_TOKEN_PERSONAL`. `--account` and `--token-env` are mutually exclusive. The selected token determines the authenticated Streamient login and account; the alias itself is never sent to the server.

Browser account switching uses browser sessions and does not apply to personal-token requests. Separate UI logins therefore need separate personal tokens. Raw `--token` values are rejected to keep secrets out of command history and process listings.

### Server and project

Use the complete HTTPS MCP endpoint for self-hosted Streamient:

```fish
streamient-cli projects list --server https://streamient.example.com/mcp
```

Combine `--server` with either token selector when accounts live on different Streamient installations.

Plain HTTP is accepted only for `localhost`, `127.0.0.1`, and `[::1]`. URLs containing credentials or query parameters are rejected.

Override the account's default project for a request:

```fish
streamient-cli notes list --project-id PROJECT_ID
```

When a tool accepts `project_id`, the same `--project-id` value is also passed as that explicit tool argument.

## Safety confirmation

Commands whose live MCP metadata marks them destructive require `--yes`. Adding a Git repository and triggering Git sync also require confirmation because they access or synchronize an external repository.

```fish
streamient-cli notes delete NOTE_ID --yes
streamient-cli graph unlink LINK_ID --yes
streamient-cli git add --repo-url https://github.com/example/knowledge.git --yes
streamient-cli git sync REPO_ID --yes
```

Inspect the selected item, project, link, or repository before confirming. `--yes` confirms the operation; it does not weaken server permissions or validation.

## Automation and CI

Provide the token through the CI secret store and keep JSON as the default output:

```fish
set -gx STREAMIENT_CLI_ACCESS_TOKEN "$CI_STREAMIENT_TOKEN"
streamient-cli knowledge search 'deployment failure' > streamient-results.json
```

Use `--timeout` to change the default 60-second MCP request timeout:

```fish
streamient-cli knowledge chat 'Summarize the release context' --timeout 120
```

Agents can discover the live catalog before executing:

```fish
streamient-cli tools list --pretty
streamient-cli tools describe store_memory --pretty
```

## Shell completion

Load completion for the current Fish session:

```fish
streamient-cli completion fish | source
```

Install it persistently for Fish:

```fish
streamient-cli completion fish > ~/.config/fish/completions/streamient-cli.fish
```

For Bash or Zsh, generate the corresponding script and source it from that shell's startup configuration.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Unexpected internal failure |
| `2` | Invalid command, argument, schema value, or missing confirmation |
| `3` | Missing or rejected access token |
| `4` | Network or timeout failure |
| `5` | MCP tool unavailable or tool execution failed |

## Search context

Search commands use the connected MCP server defaults: five results per collection on updated servers. Use `--per-page` for an explicit limit and `--page` where supported for pagination. Read relevant full records and linked decisions; refine weak results before choosing an implementation. See [Agent Configuration](../mcp/agents).
