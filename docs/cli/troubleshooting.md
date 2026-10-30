---
title: Streamient CLI Troubleshooting
description: "Resolve Streamient CLI token, account, endpoint, tool availability, confirmation, timeout, and Node.js errors."
---

# CLI Troubleshooting

## `ACCESS_TOKEN_REQUIRED`

Set the personal token in the current shell and rerun `doctor`:

```fish
set -gx STREAMIENT_CLI_ACCESS_TOKEN 'your-personal-access-token'
streamient-cli doctor
```

Create or replace tokens under **Settings → Access Tokens**. The CLI does not read browser sessions or MCP OAuth credentials.

For `--account work`, set `STREAMIENT_CLI_ACCESS_TOKEN_WORK`. For `--token-env WORK_TOKEN`, set `WORK_TOKEN`. Run `doctor` with the same selector to see the expected variable name without revealing its value:

```fish
streamient-cli doctor --account work
```

## `UNSAFE_TOKEN_OPTION`

The CLI deliberately rejects raw `--token` values because command arguments may appear in shell history and process listings. Store the token in an environment variable, then select its variable:

```fish
set -gx WORK_STREAMIENT_TOKEN 'your-personal-access-token'
streamient-cli notes list --token-env WORK_STREAMIENT_TOKEN
```

## `TOKEN_SELECTOR_CONFLICT`

Use either `--account` or `--token-env`, never both. Without either option, the CLI uses `STREAMIENT_CLI_ACCESS_TOKEN`.

## `AUTHENTICATION_FAILED`

Streamient rejected the configured token. Check that it belongs to the intended account and has not been deleted. The CLI redacts the configured token from errors.

## `TOOL_UNAVAILABLE`

The connected account, endpoint profile, or server did not advertise that tool. Email ingestion and Git sync can be disabled. The curated `/mcp/app` profile exposes 12 tools; the CLI should normally connect to the full `/mcp` endpoint.

Compare the live catalog:

```fish
streamient-cli tools list --pretty
```

## `CONFIRMATION_REQUIRED`

Review the operation, then repeat it with `--yes`. Confirmation is intentionally required in scripts as well as interactive shells.

## Server URL rejected

Pass the complete MCP endpoint, normally ending in `/mcp`. Remote servers require HTTPS, and credentials cannot appear in the URL:

```fish
streamient-cli doctor --server https://streamient.example.com/mcp
```

## Timeout or connection failure

Verify the endpoint and network, then increase the timeout if the operation legitimately needs longer:

```fish
streamient-cli doctor --timeout 120
```

## Command options changed

Streamient CLI reads schemas from the server. Use live help instead of relying on an older copied command:

```fish
streamient-cli memories store --help
streamient-cli tools describe store_memory --pretty
```

## Node.js version

The npm package requires Node.js 24 or newer:

```fish
node --version
streamient-cli --version
```

## Piping output

Commands exit quietly when a consumer such as `head` closes its input early. Other output errors still fail the command.
