---
title: Streamient Obsidian Sync Guide
description: Synchronize notes, memories, saved URLs, Markdown, Canvas, Bases, documents, and attachments between an Obsidian vault and Streamient.
---

# Obsidian Sync

Streamient Sync is a first-party Obsidian plugin for scoped two-way synchronization between one vault and multiple Streamient projects. It runs inside Obsidian, connects to hosted or self-hosted Streamient, works on desktop and mobile, and supports multiple devices on each connection.

::: info Availability
Obsidian Sync requires the **Pro** plan or a **self-hosted** installation. The server must enable `OBSIDIAN_SYNC_ENABLED`.

[Streamient Sync is available in the Obsidian Community directory](https://community.obsidian.md/plugins/streamient-sync) for Obsidian 1.13.0 and newer.
:::

## What Syncs

- Markdown files become Streamient Notes by default.
- Markdown with `streamient_type: memory` becomes Streamient Memory.
- Saved URLs synchronize as Markdown under each project's `URLs` folder. URL, title, tags, and description round-trip; extracted and crawled page text stays server-managed.
- Canvas and Bases content is mirrored and indexed.
- Supported PDFs, Word documents, and text files are mirrored and text-indexed.
- Images, audio, video, and other attachments are mirrored and metadata-indexed.
- Each project defaults to `Streamient/<Project name>`; its project folder always synchronizes both ways.
- Extra vault content is Off by default. Per project, it can include selected folders/files or the unassigned remainder of the vault.
- A local path belongs to only one project. Managed project folders and explicit selections are excluded from another project's entire-vault scope.

The plugin excludes `.obsidian`, `.git`, `.trash`, other dot-folders, operating-system metadata, and temporary files.

A synchronized saved URL uses this format:

```markdown
---
title: Obsidian
streamient_type: url
url: https://obsidian.md/
tags:
  - reference
---
The free and flexible app for your private thoughts.
```

Edit the frontmatter to change the title, URL, or tags. Edit the body to change the saved description. Streamient's extracted page text and optional crawl results are not copied into the file and cannot be overwritten from Obsidian.

## Install the Plugin

Install the stable plugin from Obsidian Community Plugins:

1. Open **Settings → Community plugins** in Obsidian.
2. Select **Browse** and search for **Streamient Sync**.
3. Select **Install**, then **Enable**.

You can also open the [Streamient Sync Community listing](https://community.obsidian.md/plugins/streamient-sync) directly.

To test prerelease builds, install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat), add `https://github.com/streamient/streamient-obsidian`, and enable **Streamient Sync**. For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the [latest GitHub release](https://github.com/streamient/streamient-obsidian/releases) and place them in `<vault>/.obsidian/plugins/streamient-sync/`.

## Connect a Vault

1. Open **Settings → Streamient Sync**.
2. Enter the hosted or self-hosted Streamient URL.
3. Select **Sign in** and approve `vault:read` and `vault:write` access. This becomes the default account.
4. Add any active projects from that account. Use **Add account** to authorize another work or personal user; each OAuth refresh token remains separate in Obsidian SecretStorage.
5. Configure optional extra vault content for each project.
6. Review upload/download/trash counts and transfer bytes, then explicitly start the first sync.

Each device authorizes separately. OAuth refresh credentials use Obsidian SecretStorage and are never stored in the vault plugin configuration.

Large scoped manifests are uploaded in ordered batches of 500 entries. The preview pass is non-mutating and returns a compact summary; Streamient creates export files only after confirmation. Server-side Note, Memory, and URL exports are then materialized in resumable batches of 25 so large projects stay below proxy timeouts. Projects run sequentially so one large profile cannot start competing scans or uploads.

Changing **Project folder** moves existing synchronized files and history in resumable batches instead of disconnecting the old paths. The plugin removes source folders only when they are empty, preserves unrelated content, and requires a fresh review after the move.

Moving a Note, Memory, or saved URL to another Streamient project keeps the same record and content. Its old linked Markdown file becomes a protected trash entry. If the destination has an enabled Obsidian connection, the record is exported into that project's managed folder; otherwise it remains in the destination without a vault link and can be exported when a connection is enabled later. Existing files are preserved when names collide.

Late edits or restores from the old file cannot move the record back or overwrite its new copy. Uploaded offline edits are retained as recoverable conflict revisions. To move the record back, use Streamient's project move action rather than restoring the old vault file. Exporting current Streamient content to Markdown does not reimport it or reset the record's project, tags, or modification time.

## Abort and Resume

Select **Abort** on the active project to stop after the current request or upload chunk. An incomplete upload session is canceled and removed. Already completed changes remain synchronized; no rollback is attempted. The project stays paused until **Resume** is selected.

Removing selected content or a project profile stops further synchronization while retaining both local and Streamient copies. Re-adding it performs normal newest-wins reconciliation.

## Conflict Handling

Every file has a server revision. When both sides changed from the same older revision, the newest normalized modification time wins. Device times more than five minutes away from server time use the server receipt time; exact ties keep the current server version. The losing version remains recoverable for 30 days.

Project settings shows the conflict history. API responses include the losing revision identifier and authenticated download URL while that recovery snapshot is retained.

Duplicate operations, repeated file hashes, and changes relayed through Obsidian Sync are idempotent. Renaming onto an unrelated existing path creates a conflict-suffixed file instead of destroying either file.

## Trash and Disconnect

Deletes move the file and projected Streamient item to trash. Restoring on either side restores the other side. File bytes are removed after the 30-day retention period, while a lightweight tombstone prevents stale offline devices from silently resurrecting old data.

Signing out stops every profile on that device while retaining profile configuration and existing Streamient knowledge. Each profile can reconnect its own OAuth account later.

Project settings also offers **Remove connection**. This removes the encrypted vault mirror, attachments, revisions, and sync history while retaining projected Streamient Notes, Memories, and saved URLs as normal project content.

## Privacy

Vault content is sent over TLS in server-readable form because Streamient must read it for indexing, previews, extraction, and editing. Synchronized file chunks are encrypted at rest with AES-256-GCM. The Obsidian plugin contains no advertising, analytics, or telemetry.

## Server Configuration

| Variable | Description | Default |
|---|---|---|
| `OBSIDIAN_SYNC_ENABLED` | Enables the API and project settings UI | `false` |
| `OBSIDIAN_VAULTS_DIR` | Shared persistent encrypted blob directory | `assets/obsidian-vaults` |
| `OBSIDIAN_VAULT_ENCRYPTION_KEY` | Required 32-byte or 64-character hexadecimal AES key | — |
| `OBSIDIAN_SYNC_MAX_FILE_BYTES` | Maximum synchronized file size | `200000000` |
| `OBSIDIAN_SYNC_MAX_VAULT_BYTES` | Maximum stored bytes per connection | `10000000000` |
| `API_RATE_LIMIT_OBSIDIAN_PER_MINUTE` | Credential-scoped request ceiling for large vault synchronization | `3000` |

The web and scheduler replicas must see the same `OBSIDIAN_VAULTS_DIR`. Generate a key with `openssl rand -hex 32` and keep it in deployment secrets.
