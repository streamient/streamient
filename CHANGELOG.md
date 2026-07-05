# Changelog

Streamient uses date tags in `YYYYMMDDN` format. Use the latest dated section as the release notes source.

## Unreleased

- Reworked hosted plans: Free now includes built-in managed AI (Gemini 2.5 Flash-Lite, 50 AI requests per workspace per day) and unlimited users (still 1 project); Pro runs on Gemini 3 Flash with unlimited AI at $49/mo launch pricing (regularly $99). Bringing your own OpenAI/Gemini key is optional on every plan and removes the Free daily limit.
- Removed the BYOK onboarding gate — new hosted signups land directly on the dashboard, no API key required.
- Added a per-plan managed model matrix (`FREE_*`/`PRO_*` env overrides) and a Redis-backed daily AI limiter returning `429 AI_DAILY_LIMIT` on the chat endpoints (covers MCP and API).
- Removed remaining ECC (email triage) leftovers: dead ECC CSS, quick-search ECC open mode, unused email AI/triage config, and stale triage wording in MCP instructions and API docs. Email triage lives in Mailtwine; Streamient keeps email storage, import, and search.
- Fixed project settings API failing for Pro tenants due to a removed email identity service reference.
- Reindex button text now stays stable while reindex status updates.

## 2026-06-11

Tags: `202606111`, `202606112`, `202606113`, `202606114`, `202606115`

- Improved search reindex status UX.
- Added global trash infinite scroll.
- Refactored list pagination and infinite scroll.
- Backfilled Typesense trash fields and thread metadata.
- Batched email indexing and removal for Typesense.
- Reduced crawler lag with bulk indexing and crawl state docs.
- Stopped recrawling failed URLs.
- Limited MCP search fields and trimmed public app tools.
- Added MCP output schemas for delete and git sync tools.
- Aligned MCP OAuth scopes and app tool schemas.
- Added socket-first ECC action updates.
- Added Helpmonks and Fastmail email action sync.
- Fixed pnpm workspace updates for Vue and Sharp.

## 2026-06-07

Tags: `202606071`

- Archived BCC reply threads on import.

## 2026-06-05

Tags: `202606051`

- Fixed ECC latest-thread display.
- Fixed ForwardEmail BCC routing.

## 2026-06-04

Tags: `202606041`, `202606042`, `202606043`, `202606044`

- Added Spam Guard.
- Backfilled forwarded sent replies.
- Updated email docs.
- Added project email filter apply action.
- Archived related email threads on mailbox move.
- Fixed ECC threading and bulk list refresh.
- Added mailbox status to ECC detail header.
- Fixed email label display and dark theme label contrast.

## 2026-06-03

Tags: `202606031`, `202606032`

- Added top search bar.
- Added email thread and BCC parsing.
- Collapsed quoted emails.
- Added email subject filter.
- Added permanent spam deletion.
- Improved ECC reply tag contrast in light theme.
- Added waiting-label action menu.

## 2026-06-02

Tags: `202606021`, `202606022`, `202606023`, `202606024`, `202606025`

- Replaced team invites with direct member creation.
- Fixed team member sign-in.
- Added path-based MCP app profile and OAuth resource.
- Added MCP tool annotations.
- Sanitized MCP tool outputs.
- Simplified OAuth settings and registration display.

## 2026-06-01

Tags: `202606011`

- Sanitized MCP user responses and logs.
- Updated MCP docs.
- Updated dependencies.

## 2026-05-31

Tags: `202605311`, `202605312`

- Moved docs to `docs.streamient.com`.
- Improved MCP docs.
- Added email detail trash controls.
- Added email trash delete-all.
- Added chat history enhancements.
- Refactored `conversation_store` for Typesense.

## 2026-05-30

Tags: `202605301`

- Cleaned up Typesense.
- Polished UI details.
- Added git sync enhancements.
- Removed OpenObserve code.
- Improved logging and trace IDs.
- Raised indexing throughput.
- Improved range selection and select-all.
- Scoped URLs by project.

## 2026-05-29

Tags: `202605291`

- Fixed crawler protocol parsing.
- Added email filter.
- Fixed sending from draft.
- Fixed email address indexing for newly sent email.
- Added system SMTP sending.
- Decluttered ECC view header.

## 2026-05-28

Tags: `202605281`

- Added theme switch.
- Started the email command center.
- Added email triage status, backfill, AI endpoints, and socket updates.
- Added email composer, internal notes, signatures, drafts, reply suggestions, and retention cleanup.
- Added safe HTML email storage and iframe rendering.
- Refined ECC layout, labels, draft controls, inline replies, AI sidebar, and detail views.
- Added BYO AI.
- Added email forwarding ingest endpoint and forwarded-recipient handling.
- Updated docs for email parsing, Chrome extension auto-capture, and email sidepanel.
- Fixed release notes to include only issues closed since the previous release.

## 2026-05-24

Tags: `202605241`

- Added `project_id` filters to `recall_memory` and `search_notes`.
- Documented blocking Stop hook for guaranteed Streamient memory writes.
- Added small UI refinements.

## 2026-05-22

Tags: `202605221`, `202605222`, `202605223`, `202605224`

- Made MCP faster.
- Switched search to embedding-only retrieval with app-side `source_id` deduplication.
- Fixed Typesense retry behavior and reduced failover sleep.
- Simplified Typesense client config.
- Sanitized documents before Typesense indexing.
- Sanitized control characters at write time and in MCP search output.
- Raised MCP bootstrap cache TTL.
- Added Typesense diagnostic script.
- Updated to pnpm v11.

## 2026-05-20

Tags: `202605201`, `202605202`, `202605203`

- Fixed MCP scopes for OAuth sessions.
- Added OpenObserve observability support.
- Added optional Clickstack integration.
- Added dedicated Claude Code docs.
- Improved MCP naming and sessions.
- Updated dependencies.

## 2026-05-19

Tags: `202605191`, `202605192`

- Supported native redirect URIs.
- Omitted `private_key_jwt` assertion type where needed.
- Downgraded Tiptap lockfile specifiers.

## 2026-05-18

Tags: `202605181`, `202605182`

- Implemented `private_key_jwt` MCP OAuth support.
- Added OAuth redirect URI diagnostics.
- Added Sentry packages for enabled startup.
- Updated Sentry and OpenTelemetry dependencies.

## 2026-05-08

Tags: `202605081`, `202605082`, `202605083`, `202605084`, `202605085`, `202605086`

- Enhanced git sync with commit messages, background sync logs, and imported timestamp preservation.
- Added hosted trial signup notification email.
- Improved trial billing plan selection, trial end text, cancellation, and Stripe return URL.
- Added visit link to URL detail modal.
- Documented `SMTP_SERVERS` examples.
- Upgraded `archiver` and `rate-limit-redis`.
- Lazy-loaded Sentry when disabled.
- Restored OpenTelemetry tracing for Alloy.

## 2026-04-30

Tags: `202604301`

- Improved MCP returned data for AI.
- Added bounded MCP search excerpts.
- Optimized Redis usage.
- Removed direct OpenTelemetry dependencies and tracing bootstrap.
- Prevented duplicate URL saves.
- Deleted crawled pages when URL crawling is disabled.
- Added explicit Sentry gating to Streamient MCP.
- Added README intro video section.

## 2026-04-26

Tags: `202604261`

- Added GitHub issue templates and discussion URL config.
- Fixed nested modal backdrop cleanup.
- Enhanced search index for large content.
- Updated fonts, icons, and OAuth login UI.

## 2026-04-24

Tags: `202604241`, `202604242`, `202604244`, `202604245`

- Added release note and GitHub release automation.
- Generated release notes from closed issues.
- Expanded GitHub release notes with issue details.
- Slimmed MCP search payloads and excluded bulky fields.
- Restored MCP bearer token compatibility.
- Refined MCP retrieval routing and telemetry.
- Refined OAuth consent theme, consent flow docs, and grant handling.
- Added Bluesky posting when the `bsky` label is added to an issue.
- Added Playwright web crawling.
- Added drag-and-drop project file imports.
- Enhanced email ingestion.
- Fixed production font asset copying and Docker build dependencies.
- Polished Phosphor icons and settings layout.

## 2026-04-23

Tags: `202604231`

- Implemented magic link validation and improved auth security flow.
- Added automated GitHub release workflow.
- Added MCP `cache_control` to tools.
- Added Cursor rules and agent registration docs.
- Added Sentry tunnel.

## 2026-04-22

Tags: `202604221`

- Added project deletion.
- Updated vendors.
- Updated Typesense to 30.2.

## 2026-04-18

Tags: `202604181`, `202604182`, `202604183`, `202604184`, `202604185`

- Added new design.
- Added streaming chat.
- Updated OpenTelemetry and Sentry handling.
- Fixed signup.
- Updated account and Typesense behavior.
- Fixed dependency issue.

## 2026-04-17

Tags: `202604171`, `202604172`

- Initial public release history through first date tags.
- Added knowledge graph.
- Added notes, memories, URLs, file imports, and previews.
- Added AI chat, follow-up intents, and continuous chat fixes.
- Added MCP auth server, default project handling, server tooling, and project commands.
- Added screenshot service for URLs.
- Added bidirectional git sync.
- Added audit logs, export options, health routes, and passkey enhancements.
- Added AJAX frontend for faster loading.
- Optimized graph and Typesense queries.
- Improved Typesense reliability, indexing, reindexing, MongoDB streams, and embedding model.
- Added Socket.IO Redis/Valkey resilience and clustered WebSocket fixes.
- Added cache-busted build asset paths for CDN caching.
- Added Docker/GitHub publishing workflows and date-tag publishing.
