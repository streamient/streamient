# Email Settings

Email settings live in two places: **account‑level** settings under the gear icon (apply to all projects in the account) and **project‑level** settings on each project's settings page (apply only to that project).

## Account settings

Open **Settings > Email** to configure how email automation and the email AI behave for the whole account.

### Automation

- **Triage incoming emails automatically** — when on, every newly ingested email is queued for AI triage as soon as it arrives. When off, you trigger triage manually from the ECC.
- **Send draft emails automatically** — reserved for upcoming auto‑send behavior. Drafts are saved for later review today; toggling this on does not send emails yet.

### Custom email instructions

Two free‑form text areas let you shape how the AI behaves on emails:

- **Custom email instructions** — applies whenever the AI is acting on a single email (summaries, suggested replies, generated drafts). Use it to set tone, recurring policies, or what to ask when context is missing.
- **Custom email triage instructions** — applies during inbox triage. Use it to bias classification, e.g. keep invoices and security alerts in the inbox, mark newsletters as no‑action, escalate cancellation requests.

Both are merged with your global AI instructions, so anything you've already set globally still applies.

### Email AI provider keys

You can optionally bring your own provider keys that are used **only** when the prompt is scoped to emails:

- OpenAI API key
- Gemini API key

These keys live next to the global BYO AI keys but are isolated to the email scope, so you can route email AI traffic to a different provider or account than the rest of Kumbukum if you want to.

:::tabs
== Cloud
Bring‑your‑own AI keys (including the email scope) are available on the **Pro plan**.
== Self-Hosted
BYO AI keys are always available. If you don't set provider keys, email AI falls back to the model configured on the server via `EMAIL_TRIAGE_MODEL`, `EMAIL_AI_MODEL`, or the global `CHAT_AI_MODEL`.
:::

## Project settings

Each project has its own **Email** section in project settings — open a project, click **Settings**, and scroll to the email section.

### Forwarding address

Every project gets a unique forwarding address shown as a read‑only field with a **Copy** button. See [Forwarding](/guide/email/forwarding) for how to use it.

### Outbound email identities

Identities are the "From" addresses available when composing or sending a draft from this project. For each identity you configure:

- **Email address** and **display name**
- **Signature** appended to drafts
- **SMTP** host, port, username, password, and TLS/SSL options

Identities are scoped to the project, so different projects can send from different mailboxes. When you draft a reply, you pick which identity to send from; the picker only shows identities configured for that email's project.

If a project has no identities configured, you can still triage, draft, and review emails — you just can't send anything outbound from that project.

## Related

- [Settings overview](/guide/settings) — account‑wide settings (profile, security, access tokens).
- [Forwarding](/guide/email/forwarding) — point your mail provider at your project address.
- [Triage](/guide/email/triage) — what the AI does with your custom instructions.
