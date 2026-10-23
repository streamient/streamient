---
title: Upgrade Streamient Self-Hosted
description: "Upgrade self-hosted Streamient safely by backing up data, pulling releases, rebuilding containers, applying migrations, and verifying service health."
---

# Upgrading

## Upgrade Process

1. **Backup your data** before upgrading (see below)
2. Pull the latest changes:

```bash
cd streamient
git pull origin main
```

3. Rebuild and restart:

```bash
docker compose down
docker compose up -d --build
```

## Backup

### MongoDB

```bash
docker compose exec mongodb mongodump --out /dump
docker compose cp mongodb:/dump ./backup-$(date +%Y%m%d)
```

### Full Data Export

Export all data through the app at **Settings > Export** (owners/admins), or via the API:

```bash
# Export notes
curl https://your-instance.com/api/v1/notes \
    -H "Authorization: Token <access_token>" > notes.json

# Export memories
curl https://your-instance.com/api/v1/memories \
    -H "Authorization: Token <access_token>" > memories.json

# Export URLs
curl https://your-instance.com/api/v1/urls \
    -H "Authorization: Token <access_token>" > urls.json
```

## Migration Notes

Breaking changes, if any, are documented in the [GitHub releases](https://github.com/streamient/streamient/releases). Check the release notes before upgrading to a new major version.

### Account-scoped email Message-IDs

After every app and worker replica runs the new release, preview the email index migration:

```bash
docker compose exec app node scripts/migrate-email-message-id-index.mjs
```

Apply it only after the preview identifies the expected legacy global Message-ID index:

```bash
docker compose exec app node scripts/migrate-email-message-id-index.mjs --apply --confirm-all-replicas-upgraded
```

The migration builds the account-scoped unique index before removing the old global unique index. It does not remove email records. If duplicate records prevent index creation, it stops and keeps the existing index; resolve those records before retrying.

### Typesense-backed Trash retention

After every app and scheduler replica runs the new release:

1. Verify every Typesense follower is healthy, has no material Raft applied gap, and is not restarting.
2. Preview and then remove only the obsolete `trashed_at_1` MongoDB indexes:

```bash
docker compose exec app pnpm trash:migrate-ttl
docker compose exec app pnpm trash:migrate-ttl --apply --confirm-all-replicas-upgraded
```

3. Preview targeted reconciliation for the affected tenant, then apply it:

```bash
docker compose exec app pnpm trash:reconcile --host-id <host_id>
docker compose exec app pnpm trash:reconcile --host-id <host_id> --apply --confirm-typesense-healthy
```

4. Set `SCHEDULER_TRASH_RECONCILIATION_ENABLED=true` to enable nightly reconciliation.
