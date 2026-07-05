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
