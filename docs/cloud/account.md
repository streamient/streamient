# Account

## Signup, invites, and login

Create your Streamient Cloud account at [app.streamient.com](https://app.streamient.com). You can sign up with:

- **Email & Password** — Standard registration
- **Magic Link** — Passwordless login via email

After signup, you land in your first account and can create projects, store knowledge, and connect AI tools.

On Streamient Cloud, new accounts start with a 7-day free trial after email confirmation. No credit card is required to start the trial.

Account owners and admins can also invite teammates from **Settings > My Team**. Accepting an invite adds that user to the existing account — it does not create a separate copy of the workspace.

## Multiple accounts

One login can belong to more than one account.

- Use the account switcher in the top-right navbar to change the active account
- The active account determines which projects, notes, memories, URLs, and team you are viewing
- New content is saved into the currently active account

## Profile & Settings

Manage your personal settings at **Settings > Profile**, **Settings > Security**, and **Settings > Access Tokens**:

- Display name
- Email address
- Password reset
- Two-factor authentication (TOTP)
- Passkey registration (WebAuthn)
- Personal access tokens
- OAuth connected apps and client registration

## Roles and limited settings

Team roles control which account-level settings are visible.

- **Owners/Admins** can manage **My Team**, **Search Index**, **Export**, and **Activity Logs**
- **Members** can still use the core product plus **Profile**, **Security**, **Access Tokens**, and **Usage**

## API Tokens and OAuth

Generate personal access tokens at **Settings > Access Tokens**. The same page also includes an **OAuth** tab for connected apps and pre-registered OAuth clients.

Tokens are used for:

- REST API access (`Authorization: Token <access_token>`)
- MCP authentication for connected AI tools (`ACCESS-TOKEN` env var, `access-token`, or `Authorization: Bearer` header)

Tokens do not expire. You can revoke them at any time from the settings page.

For OAuth-capable MCP clients, Streamient asks for approval on a themed consent screen. Confirm the requesting app, account, and requested access before approving. Previously approved apps can be reviewed or revoked from the **OAuth** tab.

## Usage & Limits

View your current workspace usage at **Settings > Usage**:

- Notes count
- Memories count
- URLs count
- Storage used

Usage limits depend on your [billing plan](/cloud/billing).
