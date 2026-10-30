import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transform } from 'esbuild';

const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = readFileSync(new URL('../apps/mobile/src/App.tsx', import.meta.url), 'utf8');

test('canceled upload renders a file cleanup retry control', async () => {
 const code = (await transform(source.slice(source.indexOf('function UploadTray(')) + '\nexport { UploadTray };', { loader: 'tsx', format: 'cjs', jsx: 'automatic' })).code;
 const context = vm.createContext({ require, module: { exports: {} }, Sheet: ({ children }) => React.createElement('div', null, children), Icon: () => null });
 vm.runInContext(code, context);
 const html = renderToStaticMarkup(React.createElement(context.module.exports.UploadTray, { open: true, uploads: [{ localId: 'a', name: 'copy', session: { state: 'canceled', upload_length: 10, upload_offset: 2 } }] }));
 assert.match(html, /Retry file cleanup/);
 assert.match(html, /Canceled · cleanup pending/);
 assert.doesNotMatch(html, /Uploading/);
});
