---
title: Streamient API Authentication
description: "Authenticate Streamient REST API requests with Cloud bearer tokens, self-hosted JWTs, OAuth sessions, or personal access tokens, with copy-ready examples."
---

# Authentication

Streamient supports multiple authentication methods.

## Bearer Token (JWT)

Obtain a JWT by logging in:

:::tabs
== Cloud
```bash
curl -X POST https://app.streamient.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}'
```
== Self-Hosted
```bash
curl -X POST https://your-instance.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}'
```
:::

Use the returned token in subsequent requests:

:::tabs
== Cloud
```bash
curl https://app.streamient.com/api/v1/notes \
  -H "Authorization: Bearer <jwt_token>"
```
== Self-Hosted
```bash
curl https://your-instance.com/api/v1/notes \
  -H "Authorization: Bearer <jwt_token>"
```
:::

JWT tokens expire after 7 days.

## Access Token (Personal Token)

Generate a personal access token in **Settings > Access Tokens** within the app. Use it as:

:::tabs
== Cloud
```bash
curl https://app.streamient.com/api/v1/notes \
  -H "Authorization: Token <access_token>"
```
== Self-Hosted
```bash
curl https://your-instance.com/api/v1/notes \
  -H "Authorization: Token <access_token>"
```
:::

Access tokens do not expire and are ideal for integrations and the MCP server.

The [Streamient CLI](/cli/) reads a personal token from `STREAMIENT_CLI_ACCESS_TOKEN` and sends it with the same `Authorization: Token` scheme. Additional accounts can be selected with `--account` or `--token-env`; token values remain in environment variables and are never stored by the CLI.

## Additional Auth Methods

The web interface also supports:

- **Magic Links** — passwordless login via email (15-min expiry, prefetch-safe two-step confirm)
- **Passkeys** — WebAuthn-based biometric/hardware key authentication
- **2FA (TOTP)** — Time-based one-time passwords via authenticator apps

## Magic Link Security Flow

Magic links are intentionally a two-step browser flow to prevent email-client preview/prefetch requests from consuming one-time tokens:

1. `GET /magic?token=...` only renders a confirmation page.
2. `POST /magic` is the only endpoint that redeems the token and creates a session.

This means link scanners that issue automatic `GET` requests cannot burn a login token before the user confirms.

## Password Reset

Password reset links expire after one hour. Opening the link shows a new password; selecting **Continue** applies it. Each link can confirm one reset only, even if it is opened in several browser sessions. Expired or already used links cannot change the password.
