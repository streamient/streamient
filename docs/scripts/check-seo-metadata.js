import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import spec from '../.vitepress/data/openapi.json' with { type: 'json' };

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(docsRoot, '.vitepress', 'dist');
const fallbackDescription = 'Documentation for Streamient — Notes, Memory, URLs, AI Chat';
const docsOrigin = 'https://docs.streamient.com';

function findHtmlFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return findHtmlFiles(entryPath);
        return entry.name.endsWith('.html') ? [entryPath] : [];
    });
}

function duplicateValues(pages, field) {
    const groups = new Map();
    for (const page of pages) groups.set(page[field], [...(groups.get(page[field]) || []), page.file]);
    return [...groups.entries()].filter(([, files]) => files.length > 1);
}

function tagAttribute(tag, name) {
    return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] || '';
}

function decodeXml(value) {
    return value
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'");
}

const pages = findHtmlFiles(outputRoot)
    .filter(file => path.relative(outputRoot, file) !== '404.html')
    .map(file => {
        const html = fs.readFileSync(file, 'utf8');
        const canonicalTags = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)].map(match => match[0]);
        return {
            file: path.relative(outputRoot, file),
            title: html.match(/<title>(.*?)<\/title>/s)?.[1]?.trim() || '',
            description: html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim() || '',
            canonicals: canonicalTags.map(tag => tagAttribute(tag, 'href')),
        };
    });

const errors = [];
for (const definition of [spec, ...Object.values(spec.paths).flatMap(item => [item, ...Object.values(item)])]) {
    for (const server of definition?.servers || []) {
        if (!URL.canParse(server.url)) errors.push(`OpenAPI server URL must be absolute: ${server.url}`);
    }
}
for (const page of pages) {
    if (!page.title) errors.push(`${page.file}: missing title`);
    if (!page.description) errors.push(`${page.file}: missing meta description`);
    if (page.description === fallbackDescription) errors.push(`${page.file}: uses the site-wide fallback description`);
    if (page.description.length > 160) errors.push(`${page.file}: meta description exceeds 160 characters`);
    if (page.canonicals.length !== 1) errors.push(`${page.file}: expected one canonical, found ${page.canonicals.length}`);
    const expectedCanonical = new URL(page.file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, ''), docsOrigin + '/').href;
    if (page.canonicals[0] !== expectedCanonical) errors.push(`${page.file}: canonical must point to ${expectedCanonical}`);
    if (page.canonicals[0]) {
        try {
            const canonical = new URL(page.canonicals[0]);
            if (canonical.origin !== docsOrigin) errors.push(`${page.file}: canonical must use ${docsOrigin}`);
            if (canonical.search || canonical.hash) errors.push(`${page.file}: canonical must not contain a query or fragment`);
        } catch {
            errors.push(`${page.file}: canonical is not an absolute URL`);
        }
    }
}

for (const field of ['title', 'description']) {
    for (const [value, files] of duplicateValues(pages, field)) errors.push(`Duplicate ${field} ${JSON.stringify(value)}: ${files.join(', ')}`);
}

for (const [value, files] of duplicateValues(pages.map(page => ({ ...page, canonical: page.canonicals[0] || '' })), 'canonical')) {
    errors.push(`Duplicate canonical ${JSON.stringify(value)}: ${files.join(', ')}`);
}

const robotsPath = path.join(outputRoot, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
    errors.push('robots.txt: missing from build output');
} else {
    const robots = fs.readFileSync(robotsPath, 'utf8');
    if (/<(?:!doctype|html|head|body)\b/i.test(robots)) errors.push('robots.txt: contains HTML');
    if (!/^User-agent:\s*\*/mi.test(robots)) errors.push('robots.txt: missing wildcard user agent');
    if (!/^Allow:\s*\/$/mi.test(robots)) errors.push('robots.txt: missing Allow: /');
    if (!/^Sitemap:\s*https:\/\/docs\.streamient\.com\/sitemap\.xml$/mi.test(robots)) errors.push('robots.txt: missing canonical sitemap URL');
}

const sitemapPath = path.join(outputRoot, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
    errors.push('sitemap.xml: missing from build output');
} else {
    const sitemap = fs.readFileSync(sitemapPath, 'utf8');
    if (!/<urlset\b/i.test(sitemap)) errors.push('sitemap.xml: invalid XML sitemap');
    const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => decodeXml(match[1].trim()));
    const canonicalUrls = new Set(pages.flatMap(page => page.canonicals));

    if (!sitemapUrls.length) errors.push('sitemap.xml: contains no URLs');
    for (const sitemapUrl of sitemapUrls) {
        let parsed;
        try {
            parsed = new URL(sitemapUrl);
        } catch {
            errors.push(`sitemap.xml: invalid URL ${JSON.stringify(sitemapUrl)}`);
            continue;
        }
        if (parsed.origin !== docsOrigin) errors.push(`sitemap.xml: ${sitemapUrl} must use ${docsOrigin}`);
        if (!canonicalUrls.has(sitemapUrl)) errors.push(`sitemap.xml: ${sitemapUrl} has no matching canonical page`);
    }

    for (const canonicalUrl of canonicalUrls) {
        if (!sitemapUrls.includes(canonicalUrl)) errors.push(`sitemap.xml: missing canonical page ${canonicalUrl}`);
    }
}

if (errors.length) {
    console.error(`Documentation SEO metadata check failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
} else {
    console.log(`Verified robots, sitemap, canonicals, titles, and meta descriptions for ${pages.length} documentation pages.`);
}
