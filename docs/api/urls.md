# URLs API

Save and manage bookmarked URLs with automatic content extraction.

## List URLs

```
GET /api/v1/urls?project_id=<id>&page=1&per_page=20
```

## Save URL

```
POST /api/v1/urls
```

```json
{
    "url": "https://example.com/article",
    "title": "Optional title override",
    "description": "Optional description",
    "crawl_enabled": false,
    "project_id": "optional-project-id"
}
```

When saved, Kumbukum auto-extracts the page title, description, Open Graph image, and text content using Cheerio.

If the account already has the same active URL saved, Kumbukum returns the existing URL with `duplicate: true` and does not create another record.

Set `crawl_enabled: true` to enable URL path crawling with Playwright. Crawled pages are re-indexed every 24 hours.

## Get URL

```
GET /api/v1/urls/:id
```

## Update URL

```
PUT /api/v1/urls/:id
```

```json
{
    "title": "Updated Title",
    "description": "Updated description",
    "crawl_enabled": true
}
```

Set `crawl_enabled: false` to stop URL path crawling and remove crawled pages for this URL from the pages index.

## Resync Crawled Pages

```
POST /api/v1/urls/:id/resync
```

Deletes existing crawled page documents for the URL, then starts URL path crawling in the background.

## Delete URL

```
DELETE /api/v1/urls/:id
```

## Search URLs

```
POST /api/v1/urls/search
```

```json
{
    "query": "search term"
}
```
