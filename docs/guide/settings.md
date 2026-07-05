# Settings

Access settings from the gear icon in the navigation bar. Each section is described below.

## Profile

Edit your personal information:

- **Name** — Your display name, shown in the navigation bar and chat avatars
- **Email** — Your account email address
- **Timezone** — Select your timezone for date/time display throughout the app

## Accounts and teams

Streamient supports multi-account membership.

- Owners and admins can invite teammates from **Settings > My Team**
- Accepting an invite adds you to that shared account
- If your login belongs to multiple accounts, use the account switcher in the navbar to change the active account
- Projects, saved content, usage, exports, and team management all follow the active account

## Security

Manage your account security with three options:

### Reset Password

Generate a new random password. Copy it before closing the dialog — it cannot be retrieved afterwards.

### Two-Factor Authentication (2FA)

Enable or disable TOTP-based two-factor authentication. When enabled, you'll need an authenticator app (like Google Authenticator or Authy) to sign in.

### Passkeys

Register WebAuthn passkeys for passwordless authentication. You can add multiple passkeys (hardware keys, biometrics, etc.) and remove them individually.

## Access Tokens

Create and manage API access tokens. The Access Tokens screen now includes two tabs:

- **Access Tokens** — Personal API tokens for the REST API and MCP setups
- **OAuth** — OAuth client registration and connected-app management for HTTP MCP clients

Tokens are used to authenticate with:

- The **REST API** for programmatic access
- The **MCP Server** for connecting LLM clients like Claude Desktop

To create a token:

1. Enter a descriptive name (e.g., "MCP Server", "CI Pipeline")
2. Click Create
3. Copy the generated token — it is shown only once

Existing tokens are listed with their names and creation dates. You can revoke any token at any time.

## OAuth

Use the **OAuth** tab under **Settings > Access Tokens** to:

- Review authorized apps connected to your account
- Revoke previously authorized apps
- Create and manage pre-registered OAuth clients for MCP HTTP integrations

When an MCP client asks for OAuth access, Streamient presents a consent screen before issuing tokens. Review the app name, the active account, and the requested access before choosing **Allow access**. Technical OAuth values such as the client ID, redirect URI, and MCP resource are available under **App details** on the consent screen.

## Role-based visibility

Some settings are available only to account owners and admins.

- **Visible to all members:** Profile, Security, Access Tokens, Usage
- **Visible to owners/admins only:** My Team, Search Index, Export, Activity Logs

Members can still create and manage projects, notes, memories, URLs, and MCP/API credentials inside the accounts they belong to.

## Search Index

Owners and admins can rebuild the search index from this section.

Rebuild your search indexes. Click **Reindex All Data** to rebuild all search collections (notes, memories, URLs) from the database.

Use this if search results seem incomplete or out of sync. Requires confirmation before executing.

## Export

Owners and admins can start full account exports from **Settings > Export**.

## Usage

View your storage usage dashboard showing total counts of:

- Notes
- Memories
- URLs
- Projects

:::tabs
== Cloud
## Subscription

Manage your plan from **Settings > Subscription**. See the [Billing](/cloud/billing) guide for plans, trials, and invoices.

== Self-Hosted
The Subscription section is not available on self-hosted installations.
:::
