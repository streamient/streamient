# Git Sync

Kumbukum can synchronize markdown files and read commit messages from Git repositories, keeping your notes, memories, and project history in sync with a version-controlled repo. Changes flow both ways: edits in the repo appear in Kumbukum, and edits in Kumbukum are pushed back as commits.

::: info Availability
Git Sync requires the **Pro** plan or a **self-hosted** (open-source) installation.
:::

## How It Works

1. Add one or more Git repos to a project
2. Kumbukum clones the repo and scans for `.md` files
3. Files in the **notes directory** become Notes; files in the **memories directory** become Memories
4. A scheduler re-syncs every 10 minutes (configurable per repo)
5. Items edited in Kumbukum are converted back to Markdown and pushed as commits
6. Git commits are imported as searchable Memories by default

### Conflict Resolution

Git Sync uses guarded conflict handling. If the same item changed in both Kumbukum and Git since the last sync, Kumbukum skips the overwrite and records a conflict in the sync summary.

### Deleted Files

When a previously synced Markdown file is deleted from Git, Kumbukum moves the linked Note or Memory to trash by default. If the Kumbukum item has newer local edits, the item is kept and a conflict is recorded.

### Commit Memories

Git Sync can import commit history as Memories. New repo connections import commits from the last 90 days by default, then continue importing new commits on later syncs.

Each commit Memory includes:

- Full commit message
- Author and committer details
- Authored and committed dates
- Branch and repository
- Changed files with Git status codes

## Directory Mapping

By default, the sync expects this structure in your repo:

```
repo-root/
├── notes/
│   ├── meeting-notes.md
│   └── ideas/
│       └── project-alpha.md
└── memories/
    ├── api-patterns.md
    └── debugging-tips.md
```

You can customize the directory names when adding a repo (e.g., `docs` instead of `notes`).

## Frontmatter

Each `.md` file can include YAML frontmatter to control how it's imported:

```markdown
---
title: My Note Title
tags:
  - project-alpha
  - meeting
type: note
---

The actual content starts here…
```

| Field   | Description                                                                 |
|---------|-----------------------------------------------------------------------------|
| `title` | Item title. Falls back to filename if omitted.                             |
| `tags`  | Array of tags applied to the item.                                         |
| `type`  | `note` or `memory`. Overrides directory-based detection.                   |

## Adding a Git Repo

### Via the UI

1. Open a project from the sidebar
2. Scroll to the **Git Sync** section
3. Click **Add Repo**
4. Enter the repo URL, branch, and optional access token
5. Adjust the notes/memories directory paths if needed

### Via the API

```bash
curl -X POST https://app.kumbukum.com/api/v1/projects/{project_id}/git-repos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_url": "https://github.com/user/my-notes.git",
    "branch": "main",
    "auth_token": "ghp_xxxx",
    "notes_path": "notes",
    "memories_path": "memories"
  }'
```

### Via MCP

Use the `add_git_repo` tool:

```
repo_url: https://github.com/user/my-notes.git
branch: main
auth_token: ghp_xxxx
```

## Configuration Options

| Option          | Default    | Description                                              |
|-----------------|------------|----------------------------------------------------------|
| `repo_url`      | —          | HTTPS URL of the Git repository (required)               |
| `branch`        | `main`     | Branch to sync                                           |
| `auth_token`    | —          | Personal access token for private repos (encrypted)      |
| `sync_interval` | `10`       | Minutes between automatic syncs (minimum 5)              |
| `notes_path`    | `notes`    | Directory in repo mapped to Notes                        |
| `memories_path` | `memories` | Directory in repo mapped to Memories                     |
| `sync_path`     | `/`        | Subfolder within the repo to sync (for monorepos)        |
| `trash_on_delete`| `true`    | Move items to trash when their `.md` file is deleted     |
| `commit_sync_enabled`| `true` | Import Git commits as searchable Memories                |
| `commit_history_days`| `90`   | Days of commit history to backfill on first sync         |
| `enabled`       | `true`     | Enable/disable automatic sync                            |

## Manual Sync

Trigger a sync at any time:

- **UI**: Click the sync button (↻) next to a repo
- **API**: `POST /api/v1/git-repos/{id}/sync`
- **MCP**: Use the `trigger_git_sync` tool

## Environment Variables

| Variable            | Description                                          |
|---------------------|------------------------------------------------------|
| `GIT_ENCRYPTION_KEY`| 32-byte key (or 64-char hex) for encrypting PAT tokens at rest. **Required** for Git Sync. |

Generate a key:

```bash
openssl rand -hex 32
```

## Security

- Access tokens are encrypted at rest using AES-256-GCM
- Tokens are never returned in API responses (masked as `••••••••`)
- Git operations use HTTPS only
- Repos are cloned into an isolated directory per tenant
