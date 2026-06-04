import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// Vendor bundle: Bootstrap JS + SweetAlert2
await build({
	entryPoints: ['src/vendor.js'],
	bundle: true,
	outfile: 'public/js/vendor.js',
	format: 'esm',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: !isProd,
});
console.log('Vendor built → public/js/vendor.js');

// Bootstrap CSS
await build({
	entryPoints: ['src/vendor.css'],
	bundle: true,
	outfile: 'public/css/vendor.css',
	platform: 'browser',
	minify: isProd,
	sourcemap: !isProd,
	loader: {
		'.woff': 'file',
		'.woff2': 'file',
		'.ttf': 'file',
		'.eot': 'file',
		'.svg': 'file',
	},
});
console.log('Vendor CSS built → public/css/vendor.css');

// TipTap Editor
await build({
	entryPoints: ['src/editor/note_editor.js'],
	bundle: true,
	outfile: 'public/js/editor.js',
	format: 'esm',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: !isProd,
});
console.log('Editor built → public/js/editor.js');

// Cytoscape Graph (lazy-loaded on /graph page only)
await build({
	entryPoints: ['src/graph/graph_bundle.js'],
	bundle: true,
	outfile: 'public/js/graph_bundle.js',
	format: 'esm',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: !isProd,
});
console.log('Graph bundle built → public/js/graph_bundle.js');

// iframe-resizer parent/child bundles for sandboxed email HTML iframes
await build({
	entryPoints: ['src/iframe_resizer_parent.js'],
	bundle: true,
	outfile: 'public/js/iframe_resizer_parent.js',
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: false,
});
console.log('iframe-resizer parent built → public/js/iframe_resizer_parent.js');

await build({
	entryPoints: ['src/iframe_resizer_child.js'],
	bundle: true,
	outfile: 'public/js/iframe_resizer_child.js',
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: false,
});
console.log('iframe-resizer child built → public/js/iframe_resizer_child.js');

await build({
	entryPoints: ['src/email_dark_mode_child.js'],
	bundle: true,
	outfile: 'public/js/email_dark_mode_child.js',
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: false,
});
console.log('Email dark mode child built → public/js/email_dark_mode_child.js');

await build({
	entryPoints: ['src/email_quote_collapse_child.js'],
	bundle: true,
	outfile: 'public/js/email_quote_collapse_child.js',
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: false,
});
console.log('Email quote collapse child built → public/js/email_quote_collapse_child.js');

await build({
	entryPoints: ['src/email_iframe_renderer.js'],
	bundle: true,
	outfile: 'public/js/email_iframe_renderer.js',
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	minify: isProd,
	sourcemap: false,
});
console.log('Email iframe renderer built → public/js/email_iframe_renderer.js');

// Generate build ID from content hash of all static JS + CSS assets
const hash = createHash('md5');
for (const dir of ['public/js', 'public/css']) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isFile()) hash.update(readFileSync(join(dir, entry.name)));
    }
}
const buildId = hash.digest('hex').slice(0, 10);
writeFileSync(join(__dirname, 'public', 'build-id'), buildId);
console.log(`Build ID: ${buildId}`);

console.log('Build complete.');
