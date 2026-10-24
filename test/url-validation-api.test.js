import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import api from '../routes/api.js';
import { Project } from '../model/project.js';
import { Url } from '../model/url.js';

test('URL create and update reject unsafe or malformed URLs with safe JSON and no writes', async (t) => {
	t.mock.method(Project, 'findOneAndUpdate', () => ({ select() { return this; }, read() { return this; }, lean: async () => ({ _id: 'project' }) }));
	t.mock.method(Url, 'findOne', () => ({ select() { return this; }, read() { return this; }, lean: async () => ({ _id: 'url', project: 'project', url: 'https://example.com' }) }));
	let writes = 0;
	t.mock.method(Url, 'create', () => { writes++; throw new Error('must not write'); });
	t.mock.method(Url, 'findOneAndUpdate', () => { writes++; throw new Error('must not write'); });
	const app = express();
	app.use(express.json());
	for (const [method, path] of [['post', '/urls'], ['put', '/urls/:id']]) {
		const handler = api.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
		app[method]('/api/v1' + path, (req, res, next) => { req.host_id = 'host'; req.userId = 'user'; Promise.resolve(handler(req, res, next)).catch(next); });
	}
	app.use(api.stack.find((layer) => layer.handle.length === 4).handle);
	const server = app.listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	for (const [method, path] of [['POST', '/urls'], ['PUT', '/urls/url']]) {
		for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/', 'file:///etc/passwd', 'not a URL']) {
			const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, project: 'project' }) });
			assert.equal(response.status, 400);
			assert.match(response.headers.get('content-type'), /application\/json/);
			const body = await response.json();
			assert.equal(body.code, 'invalid_url');
			assert.match(body.error, /public HTTP/);
			assert.doesNotMatch(JSON.stringify(body), /Error:|\/services\/|stack|file:\/\//);
		}
	}
	assert.equal(writes, 0);
});
