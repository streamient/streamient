import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { ApiClient } from '../../apps/mcp/lib/api-client.js';

describe('ApiClient', () => {
    let backend;
    let backendUrl;
    let requests;

    before(async () => {
        requests = [];
        const app = express();
        app.use(express.json());

        // Record all incoming requests and echo back a JSON response
        app.all('/api/v1/*any', (req, res) => {
            requests.push({
                method: req.method,
                path: req.path,
                headers: req.headers,
                body: req.body,
            });

            if (req.path.includes('/fail-404')) {
                return res.status(404).json({ error: 'Not found' });
            }
            if (req.path.includes('/fail-500')) {
                return res.status(500).send('Internal error');
            }

            res.json({ ok: true, method: req.method, path: req.path, body: req.body });
        });

        await new Promise((resolve) => {
            const srv = app.listen(0, () => {
                backendUrl = `http://127.0.0.1:${srv.address().port}`;
                backend = srv;
                resolve();
            });
        });
    });

    after(async () => {
        await new Promise((r) => backend.close(r));
    });

    it('sends Authorization: Token header', async () => {
        const api = new ApiClient(backendUrl, 'my-secret-token');
        await api.get('/test');
        const req = requests.at(-1);
        assert.equal(req.headers.authorization, 'Token my-secret-token');
    });

    it('supports Bearer auth objects', async () => {
        const api = new ApiClient(backendUrl, { scheme: 'Bearer', token: 'bridge-token' });
        await api.get('/test');
        const req = requests.at(-1);
        assert.equal(req.headers.authorization, 'Bearer bridge-token');
    });

    it('refreshes auth with setAuth for long-lived sessions', async () => {
        const api = new ApiClient(backendUrl, { scheme: 'Bearer', token: 'stale-bridge-token' });
        api.setAuth({ scheme: 'Bearer', token: 'fresh-bridge-token' });
        await api.get('/test');
        const req = requests.at(-1);
        assert.equal(req.headers.authorization, 'Bearer fresh-bridge-token');
    });

    it('strips trailing slash from baseUrl', () => {
        const api = new ApiClient('http://localhost:3000/', 'tok');
        assert.equal(api.baseUrl, 'http://localhost:3000');
    });

    it('GET — sends correct method and path', async () => {
        const api = new ApiClient(backendUrl, 'tok');
        const result = await api.get('/notes/123');
        assert.equal(result.method, 'GET');
        assert.equal(result.path, '/api/v1/notes/123');
    });

    it('POST — sends JSON body', async () => {
        const api = new ApiClient(backendUrl, 'tok');
        const result = await api.post('/notes', { title: 'Hello' });
        assert.equal(result.method, 'POST');
        assert.deepEqual(result.body, { title: 'Hello' });
    });

    it('PUT — sends JSON body', async () => {
        const api = new ApiClient(backendUrl, 'tok');
        const result = await api.put('/notes/123', { title: 'Updated' });
        assert.equal(result.method, 'PUT');
        assert.deepEqual(result.body, { title: 'Updated' });
    });

    it('DELETE — sends correct method', async () => {
        const api = new ApiClient(backendUrl, 'tok');
        const result = await api.delete('/notes/123');
        assert.equal(result.method, 'DELETE');
    });

    it('throws on non-OK response', async () => {
        const api = new ApiClient(backendUrl, 'tok');
        await assert.rejects(
            () => api.get('/fail-404'),
            (err) => {
                assert.ok(err.message.includes('404'));
                assert.ok(err.message.includes('API GET'));
                return true;
            },
        );
    });

    it('includes response body in error message', async () => {
        const api = new ApiClient(backendUrl, 'tok');
        await assert.rejects(
            () => api.get('/fail-500'),
            (err) => {
                assert.ok(err.message.includes('500'));
                assert.ok(err.message.includes('Internal error'));
                return true;
            },
        );
    });
});
