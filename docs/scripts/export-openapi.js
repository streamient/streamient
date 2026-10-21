import { copyFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const dataDir = resolve(__dirname, '..', '.vitepress', 'data');

const { default: swaggerSpec } = await import('../../swagger.js');

// Override relative server URL so vitepress-openapi can resolve it
swaggerSpec.servers = [
    { url: 'https://your-instance.example.com/api/v1', description: 'API v1' },
];

for (const pathItem of Object.values(swaggerSpec.paths || {})) {
    for (const operation of [pathItem, ...Object.values(pathItem)]) {
        if (!operation || typeof operation !== 'object' || !Array.isArray(operation.servers)) continue;
        operation.servers = operation.servers.map(server => ({
            ...server,
            url: URL.canParse(server.url) ? server.url : new URL(server.url, 'https://your-instance.example.com').href,
        }));
    }
}

const json = JSON.stringify(swaggerSpec, null, 2);

mkdirSync(publicDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });
writeFileSync(resolve(publicDir, 'openapi.json'), json);
writeFileSync(resolve(dataDir, 'openapi.json'), json);
copyFileSync(fileURLToPath(import.meta.resolve('vitepress-openapi/dist/style.css')), resolve(publicDir, 'vitepress-openapi.css'));

console.log('OpenAPI spec and route-scoped stylesheet written to docs assets.');
