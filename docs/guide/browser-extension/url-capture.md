# URL Capture

The extension can save URLs to Streamient two ways: explicitly from the toolbar popup, or automatically as you browse.

## From the popup

Click the **Streamient** icon in the toolbar to open the popup. You have three actions:

- **Save URL** — Bookmark the current page. The title, description, and full content are extracted automatically.
- **Create Note** — Write a quick note attached to the current page.
- **URL + Note** — Save the page as a URL and attach a note in one step.

Saved URLs land in your **URL Project** (or the Default Project if you haven't set one). See [Setup › Optional](/guide/browser-extension/setup#optional-route-urls-and-email-to-separate-projects).

## Automatic capture

When automatic capture is on, pages you actually spend time on are saved without you doing anything. Useful for building a passive bookmark trail of research, articles, and docs you read.

### Enable it

Open **Options** and scroll to **Automatic URL Capture (optional)**:

1. Check **Enable automatic URL capture for this account**.
2. Set **Capture after seconds** — how long you have to stay on a page before it qualifies. Minimum is 30 seconds; the default is 30.
3. Optionally check **Also capture after scrolling 50% of the page** — this bypasses the timer and saves as soon as you scroll halfway through.
4. Optionally add **Exclude sites** — one domain or path per line. Wildcards like `*.example.com` work. Email, search, AI, and private app sites are skipped by default, so you usually don't need to add anything here.

Captured URLs go to the account's **URL Project**. The Options page shows a live readout — "Capturing to project: …" — so it's always clear where things will land.

### What gets saved

When the timer fires (or the scroll trigger crosses 50%) the extension:

- Posts the URL, title, and extracted page content to Streamient.
- Attaches a screenshot of the page at capture time.
- Skips the page entirely if it matches an exclude rule or is on the default skip list.

Captures are de‑duplicated by URL, so revisiting the same page later doesn't create a second record.

### Multiple accounts

If you have several Streamient accounts in the extension and enable automatic capture on more than one of them, each URL is saved into every account that doesn't exclude it. See [Multiple Accounts](/guide/browser-extension/multiple-accounts).

## Related

- [Setup › Routing](/guide/browser-extension/setup#optional-route-urls-and-email-to-separate-projects) — pick a destination project.
- [URLs](/guide/urls) — what saved URLs look like inside Streamient.
- [Notes](/guide/notes) — what notes from the popup look like inside Streamient.
