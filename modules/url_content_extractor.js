import axios from 'axios';
import * as cheerio from 'cheerio';

/**
* Extract content + metadata from a URL.
*/
export async function extractUrlContent(url) {
	const response = await axios.get(url, {
		timeout: 15000,
		maxRedirects: 5,
		headers: {
			'User-Agent': 'Streamient/1.0 (URL Content Extractor)',
			Accept: 'text/html,application/xhtml+xml',
		},
		// Limit response size to 5MB
		maxContentLength: 5 * 1024 * 1024,
	});

	const $ = cheerio.load(response.data);

	// Remove scripts, styles, nav, footer, etc.
	$('script, style, nav, footer, header, aside, iframe, noscript').remove();

	const title =
		$('meta[property="og:title"]').attr('content') ||
		$('title').text().trim() ||
		'';

	const description =
		$('meta[property="og:description"]').attr('content') ||
		$('meta[name="description"]').attr('content') ||
		'';

	const ogImage =
		$('meta[property="og:image"]').attr('content') || '';

	// Extract main text content
	const textContent = $('main, article, [role="main"], .content, #content, body')
		.first()
		.text()
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 50000); // Cap at 50k chars

	return {
		title,
		description,
		og_image: ogImage,
		text_content: textContent,
	};
}
