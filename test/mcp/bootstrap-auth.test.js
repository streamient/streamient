import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../apps/mcp/server.js', import.meta.url), 'utf8');
const start = source.indexOf('async function resolveDefaultProjectId');
const end = source.indexOf('\nfunction logMcpRequest', start);
const context = vm.createContext({ bootstrapCache: new Map(), BOOTSTRAP_TTL_MS: 600000 });
vm.runInContext(source.slice(start, end), context);

test('bootstrap validates credentials even with project overrides and a warm cache', async () => {
    let rejected = false;
    const api = { get: async (path) => {
        assert.equal(path, '/features');
        if (rejected) throw Object.assign(new Error('invalid token'), { status: 401 });
        return { features: { email_ingest: false } };
    } };
    const options = { projectId: '507f1f77bcf86cd799439011', cacheKey: 'token' };
    const first = await context.resolveBootstrap(api, options);
    assert.equal(first.emailFeatureEnabled, false);
    assert.equal((await context.resolveBootstrap(api, options)).cacheHit, true);
    rejected = true;
    await assert.rejects(context.resolveBootstrap(api, options), { status: 401 });
    for (let i = 0; i < 3; i++) await assert.rejects(context.resolveBootstrap(api, { ...options, cacheKey: `invalid-${i}` }), { status: 401 });
});
