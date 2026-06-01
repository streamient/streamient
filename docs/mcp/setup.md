# MCP Server Setup

Most MCP clients can be connected in about a minute. Use Cloud for the fastest path, or point a self-hosted client at your own Kumbukum instance.

## Prerequisites

- A running Kumbukum instance
- For stdio only: a personal access token (generate in **Settings → Access Tokens**)

## Authentication

Kumbukum supports two ways to authenticate. **OAuth 2.1 is recommended** — use a personal access token only for stdio setups, scripts, or clients that don't support OAuth.

| Method | Best for | What you do |
| --- | --- | --- |
| **OAuth 2.1** _(recommended)_ | Claude, Cursor, ChatGPT, VS Code, and most modern clients | Enter the MCP endpoint URL and approve access in your browser |
| **Access token** | stdio bridges, scripts, clients without OAuth | Generate a token in **Settings → Access Tokens** and send it as a Bearer credential |

With OAuth you only ever need the **MCP endpoint URL**. The client discovers Kumbukum's OAuth endpoints automatically, opens Kumbukum in your browser, and asks you to approve access — nothing to copy or store. See [HTTP Transport](#http-transport) for the OAuth path; the per-client sections below show the token-based stdio setup.

## Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

## HTTP Transport

For remote MCP access via Streamable HTTP, Kumbukum now supports standard OAuth 2.1 discovery for MCP clients. OAuth-capable clients should connect to the MCP endpoint directly and follow the `WWW-Authenticate` challenge + Protected Resource Metadata flow automatically.

When a client needs approval, Kumbukum shows a simple OAuth consent screen in the same Kumbukum theme as the rest of authentication. The screen shows the requesting app, the active Kumbukum account, the exact requested access, and a collapsed technical details section with the client ID, redirect URI, and MCP resource.

:::tabs
== Cloud
Point your client at the Cloud MCP endpoint — that's all an OAuth-capable client needs:

```
https://app.kumbukum.com/mcp
```

The client discovers Kumbukum's OAuth endpoints from this URL automatically, opens Kumbukum in your browser, and asks you to approve access. No issuer or token setup required.

> If a client ever asks for the authorization server manually, it's `https://app.kumbukum.com/oauth` — but you normally never need to enter it. See [ChatGPT field mapping](#chatgpt-field-mapping) for the full list of manual values.

== Self-Hosted
```bash
env 'ACCESS-TOKEN'=your-access-token API_BASE_URL=https://your-instance.com MCP_BASE_URL=https://mcp.your-instance.com \
node apps/mcp/server.js --transport http --port 3002
```

The server will listen at `http://localhost:3002/mcp` for Streamable HTTP connections and `http://localhost:3002/sse` for SSE connections.

Set `MCP_BASE_URL` to the public base URL that serves the MCP server so OAuth resource metadata and audience checks use the correct value.

Supported client registration approaches:

- Pre-registered OAuth clients (managed in **Settings → Access Tokens → OAuth**)
- Client ID Metadata Documents
- Dynamic Client Registration (`/oauth/register`)

Personal access tokens are still accepted for backward compatibility via `Authorization: Bearer ...`, `Authorization: Token ...`, and `access-token` headers.
:::

<a id="chatgpt-openai-connector"></a>

## ChatGPT / OpenAI connector setup

If ChatGPT or another OpenAI connector discovers OAuth automatically, you usually only need to enter the MCP server URL:

:::tabs
== Cloud
`https://app.kumbukum.com/mcp`
== Self-Hosted
`https://mcp.your-instance.com/mcp`
:::

The extra OAuth values are only needed when the client asks for them explicitly.

### What the registration methods mean

- **Pre-registration** — create the OAuth client in Kumbukum first, then paste its client ID and optional secret into the external tool
- **Dynamic Client Registration** — the client registers itself against Kumbukum using the registration endpoint
- **Client ID Metadata Documents** — only for clients that identify themselves with a client metadata document URL as the `client_id`; Kumbukum accepts public PKCE clients and `private_key_jwt` clients that publish `jwks` or `jwks_uri`

Dynamic registration accepts HTTPS redirect URIs, localhost HTTP redirect URIs, and reverse-domain private-use schemes for native clients, such as `com.example.app:/oauth/callback`.

These are capabilities, not clickable actions in Kumbukum.

### Recommended ChatGPT flow

For manual ChatGPT setup, start with **User-Defined OAuth Client**:

1. Copy the **Callback URL** shown by ChatGPT
2. In Kumbukum, open **Settings → Access Tokens → OAuth**
3. Create a **Pre-Registered OAuth Client**
4. Paste ChatGPT's callback URL into **Redirect URIs**
5. Choose:
    - `none` for a public PKCE client
    - `client_secret_post` only if you want ChatGPT to use a client secret
6. Copy the created **Client ID** back into ChatGPT
7. Copy the **Client Secret** too only if you created a confidential client

When ChatGPT redirects you to Kumbukum, review the consent screen and click **Allow access** only if the app name, account, and requested access look correct.

### ChatGPT field mapping

Use these values if ChatGPT asks for manual OAuth fields:

:::tabs
== Cloud
| ChatGPT field | Value |
| --- | --- |
| MCP Server URL | `https://app.kumbukum.com/mcp` |
| Auth URL | `https://app.kumbukum.com/oauth/authorize` |
| Token URL | `https://app.kumbukum.com/oauth/token` |
| Registration URL | `https://app.kumbukum.com/oauth/register` |
| Authorization server base | `https://app.kumbukum.com/oauth` |
| Resource | `https://app.kumbukum.com/mcp` or `https://app.kumbukum.com` |
| OIDC | Leave disabled unless the client explicitly requires it |

== Self-Hosted
| ChatGPT field | Value |
| --- | --- |
| MCP Server URL | `https://mcp.your-instance.com/mcp` |
| Auth URL | `https://your-instance.com/oauth/authorize` |
| Token URL | `https://your-instance.com/oauth/token` |
| Registration URL | `https://your-instance.com/oauth/register` |
| Authorization server base | `https://your-instance.com/oauth` |
| Resource | `https://mcp.your-instance.com` or `https://mcp.your-instance.com/mcp` |
| OIDC | Leave disabled unless the client explicitly requires it |
:::

### Notes for ChatGPT specifically

- The **Callback URL** comes from ChatGPT, not from Kumbukum
- The **OAuth Client ID** comes from the Kumbukum client you created
- The **OAuth Client Secret** is only used when you create a confidential client
- If ChatGPT offers Dynamic Client Registration and asks for a **Registration URL**, use the Kumbukum `/oauth/register` endpoint above
- If ChatGPT/OpenAI uses automatic Client ID Metadata Documents with `private_key_jwt`, no manual secret is needed; Kumbukum verifies the signed token request against the client's published JWKS

## Environment Variables

| Variable              | Description                           | Default                  |
| --------------------- | ------------------------------------- | ------------------------ |
| `ACCESS-TOKEN`        | Personal access token for stdio transport | —                    |
| `API_BASE_URL`        | Base URL of the Kumbukum instance     | `http://localhost:3000`  |
| `MCP_BASE_URL`        | Public base URL of the MCP server     | `http://localhost:3002`  |
| `PROJECT-ID`          | Override default project for stdio    | Auto-detected            |
| `PORT`                | HTTP transport port                   | `3002`                   |

::: tip Shell syntax note
`ACCESS-TOKEN` and `PROJECT-ID` contain hyphens because they are read directly by the MCP server. In shell commands, pass them with `env`, for example:

```bash
env 'ACCESS-TOKEN'=your-access-token 'PROJECT-ID'=your-project-id API_BASE_URL=https://your-instance.com node apps/mcp/server.js
```
:::

::: tip HTTP Transport Headers
When using the HTTP or SSE transport, pass your credentials as headers instead of environment variables:

- `Authorization: Bearer <oauth-access-token>` — recommended for MCP OAuth
- `Authorization: Bearer <access-token>` — personal access token compatibility mode
- `Authorization: Token <access-token>` — personal access token compatibility mode
- `access-token: <access-token>` — alternative (mirrors Razuna MCP)
- `X-Project-Id: <project-id>` — optional, overrides the default project
:::

## Default Project

On startup, the MCP server calls `GET /projects` and picks the project with `is_default: true`. All create tools (`create_note`, `store_memory`, `save_url`) fall back to this project when `project_id` is omitted.

Set `PROJECT-ID` (passed via `env` for stdio) or the `X-Project-Id` header (HTTP/SSE) to override this behavior.

## Cursor (IDE)

After the MCP server appears under **Cursor Settings → MCP**, configure **global User Rules** and optional **project rules** so Agent chats search and store memories consistently. See **[Cursor (IDE)](./cursor-ide)**.

## Claude Code

For Claude Code, add the MCP server to `~/.claude/settings.json` (same JSON block as Claude Desktop above), then configure **hooks** for automatic search-before-work and store-after-work behavior. See **[Claude Code](./claude-code)**.
