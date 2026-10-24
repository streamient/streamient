import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import config from '../config.js';
import { createGitTransport } from '../services/git_sync_service.js';

const exec = promisify(execFile);
const git = (cwd, args) => exec('git', args, { cwd });
const localLookup = (_host, options, callback) => options?.all ? callback(null, [{ address: '127.0.0.1', family: 4 }]) : callback(null, '127.0.0.1', 4);

test('hosted Git rejects local/private transports, while self-hosted keeps local Git support', async (t) => {
	const hosted = config.isHosted;
	t.after(() => { config.isHosted = hosted; });
	config.isHosted = true;
	for (const url of ['/tmp/repo', 'file:///tmp/repo', 'git@github.com:org/repo', 'ssh://github.com/repo', 'git://github.com/repo', 'ext::command', 'http://127.0.0.1/repo', 'http://[::1]/repo', 'http://10.0.0.1/repo', 'http://169.254.169.254/repo']) await assert.rejects(createGitTransport(url), /public HTTP/);
	config.isHosted = false;
	const transport = await createGitTransport('/tmp/repo');
	assert.equal(typeof transport.git().clone, 'function');
	await transport.close();
});

test('actual Git clone, fetch and push use the guarded proxy despite NO_PROXY and global rewrites', async (t) => {
	const hosted = config.isHosted;
	config.isHosted = true;
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'git-transport-'));
	const original = { NO_PROXY: process.env.NO_PROXY, no_proxy: process.env.no_proxy, GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL };
	t.after(async () => { config.isHosted = hosted; for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } await fs.rm(root, { recursive: true, force: true }); });
	await git(root, ['init', '--bare', 'remote.git']);
	await git(path.join(root, 'remote.git'), ['config', 'http.receivepack', 'true']);
	await git(root, ['init', '-b', 'main', 'seed']);
	const seed = path.join(root, 'seed');
	await git(seed, ['config', 'user.email', 'test@example.com']);
	await git(seed, ['config', 'user.name', 'Test']);
	await fs.writeFile(path.join(seed, 'a.md'), '# Seed');
	await git(seed, ['add', '.']);
	await git(seed, ['commit', '-m', 'seed']);
	await git(seed, ['push', path.join(root, 'remote.git'), 'main']);
	const requests = [];
	let redirect = false;
	const server = http.createServer((req, res) => {
		requests.push(req.url);
		if (redirect) { res.writeHead(302, { location: `http://127.0.0.1:${server.address().port}/escape` }); res.end(); return; }
		const url = new URL(req.url, 'http://fixture.invalid');
		const child = spawn('git', ['http-backend'], { env: { ...process.env, GIT_PROJECT_ROOT: root, GIT_HTTP_EXPORT_ALL: '1', PATH_INFO: url.pathname, QUERY_STRING: url.search.slice(1), REQUEST_METHOD: req.method, CONTENT_TYPE: req.headers['content-type'] || '', REMOTE_USER: 'test', CONTENT_LENGTH: req.headers['content-length'] || '' } });
		const chunks = [];
		child.stdout.on('data', (data) => chunks.push(data));
		child.on('close', () => {
			const output = Buffer.concat(chunks);
			const split = output.indexOf('\r\n\r\n');
			if (split < 0) { res.writeHead(500); res.end(); return; }
			const headers = Object.fromEntries(output.subarray(0, split).toString().split('\r\n').map((line) => { const i = line.indexOf(':'); return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()]; }));
			const status = parseInt(headers.status, 10) || 200;
			delete headers.status;
			res.writeHead(status, headers);
			res.end(output.subarray(split + 4));
		});
		req.pipe(child.stdin);
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(() => server.close());
	const url = `http://fixture.invalid:${server.address().port}/remote.git`;
	process.env.NO_PROXY = '*';
	process.env.no_proxy = '*';
	process.env.GIT_CONFIG_GLOBAL = path.join(root, 'gitconfig');
	await fs.writeFile(process.env.GIT_CONFIG_GLOBAL, `[url "file:///should-not-be-read/"]\n\tinsteadOf = http://fixture.invalid/\n`);
	let lookups = 0;
	// Explicit internal fixture injection: only the test maps the public hostname to a local backend.
	const transport = await createGitTransport(url, undefined, { lookup: (...args) => { lookups++; localLookup(...args); } });
	t.after(() => transport.close());
	const clone = path.join(root, 'clone');
	await transport.git().clone(url, clone, ['--branch', 'main']);
	const client = transport.git(clone);
	assert.equal(await fs.readFile(path.join(clone, 'a.md'), 'utf8'), '# Seed');
	await client.fetch(url, 'main');
	await client.addConfig('user.email', 'test@example.com');
	await client.addConfig('user.name', 'Test');
	await fs.writeFile(path.join(clone, 'b.md'), '# Pushed');
	await client.add('.');
	await client.commit('push');
	await client.push(url, 'main');
	assert.equal((await git(root, ['--git-dir', 'remote.git', 'show', 'main:b.md'])).stdout, '# Pushed');
	assert.ok(requests.some((entry) => entry.endsWith('git-receive-pack')));
	assert.ok(lookups >= 3);
	redirect = true;
	await assert.rejects(client.fetch(url, 'main'));
	assert.equal(requests.some((entry) => entry.startsWith('/escape')), false);
	await assert.rejects(client.fetch(path.join(root, 'remote.git'), 'main'), /transport 'file' not allowed/);
});

test('HTTP and HTTPS Git connections reject a private DNS answer at socket creation', async (t) => {
	const hosted = config.isHosted;
	const lookup = dns.lookup;
	config.isHosted = true;
	t.after(() => { config.isHosted = hosted; dns.lookup = lookup; });
	let lookups = 0;
	dns.lookup = (host, options, callback) => {
		if (host !== 'rebind.invalid') return lookup(host, options, callback);
		lookups++;
		callback(null, [{ address: '127.0.0.1', family: 4 }]);
	};
	for (const protocol of ['http', 'https']) {
		const url = `${protocol}://rebind.invalid/repo.git`;
		const transport = await createGitTransport(url);
		try { await assert.rejects(transport.git().listRemote([url])); } finally { await transport.close(); }
	}
	assert.equal(lookups, 2);
});

test('lease cancellation closes an active Git connection and prevents the next command', async (t) => {
	const hosted = config.isHosted;
	config.isHosted = true;
	t.after(() => { config.isHosted = hosted; });
	const controller = new AbortController();
	let requests = 0;
	const server = http.createServer(() => { requests++; controller.abort(new Error('lease lost')); });
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(() => { server.closeAllConnections(); server.close(); });
	const url = `http://fixture.invalid:${server.address().port}/repo.git`;
	const transport = await createGitTransport(url, controller.signal, { lookup: localLookup });
	t.after(() => transport.close());
	await assert.rejects(transport.git().listRemote([url]));
	await assert.rejects(transport.git().listRemote([url]));
	assert.equal(requests, 1);
});
