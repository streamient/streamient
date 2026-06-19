# URLs

Save links to articles, documentation, tools, or any webpage. Kumbukum automatically extracts the page content so you can search your bookmarks by what they say — not just their address.

## What You Can Do

### Save a URL

Click **New URL** or paste a link. Kumbukum fetches the page and extracts:

- **Title** and **description** from meta tags
- **Open Graph image** for a visual preview
- **Full text content** for search indexing

You can override the extracted title or description with your own if you prefer.

### Search

URLs are searchable across four fields: title, description, full text content, and vector embedding. This gives URLs the broadest search surface of all item types — you can find a saved link by anything that appeared on the page.

### Scheduled Crawling

Enable **crawl** on any URL to have Kumbukum periodically re-fetch and re-index the page content. This keeps your saved links up to date as web pages change over time. Crawling runs automatically on a daily schedule.

For pages you want to index more deeply, URL path crawling follows links under the saved URL path only.

### Project Assignment

Every URL belongs to a project. Filter by project in the sidebar to work with a focused set of bookmarks.

### Links

Connect a URL to related notes, memories, or other URLs. Open a URL, scroll to the **Links** section, and search for items to connect. Links appear as removable badges and show up in the [Knowledge Graph](/guide/graph).

### Batch Operations

Select multiple URLs with checkboxes to move them between projects or trash them in bulk.

### Browser Extension

Use the [Browser Extension](/guide/browser-extension/) to save the current page to Kumbukum without leaving your browser, or turn on [automatic capture](/guide/browser-extension/url-capture#automatic-capture) so pages you spend time on get saved on their own.

## How It Works

When you save a URL, the content extractor (Cheerio-based) fetches the page and pulls out structured data. The extracted content is stored in MongoDB and indexed in Typesense with a vector embedding. If extraction fails (e.g., the page blocks requests), the URL is still saved with whatever metadata you provided.

Crawl-enabled URLs are processed by a Playwright-based crawler that can navigate JavaScript-heavy pages and follow links under the saved URL path.
