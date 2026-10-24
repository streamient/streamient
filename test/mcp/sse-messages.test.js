import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';
import { buildMcpServer } from './helpers/test-server.js';

const serverJsPath = new URL('../../apps/mcp/server.js', import.meta.url);

/**
 * Start a real Express server wiring the SSE transport the same way
 * apps/mcp/server.js does: express.json() consumes the request stream globally,
 * GET /sse establishes a per-session SSEServerTransport, and POST /messages
 * forwards the request to that session's transport. `passParsedBody` toggles
 * the exact regression under test — whether the already-parsed req.body is
 * handed to handlePostMessage.
 */
function startSseTestServer(api, { passParsedBody = true } = {}) {
	const app = express();
	app.use(express.json());

	const sessions = new Map();

	app.get('/sse', async (_req, res) => {
		const server = buildMcpServer(api);
		const transport = new SSEServerTransport('/messages', res);
		sessions.set(transport.sessionId, { server, transport });
		res.on('close', () => sessions.delete(transport.sessionId));
		await server.connect(transport);
	});

	app.post('/messages', async (req, res) => {
		const session = sessions.get(req.query.sessionId);
		if (!session) return res.status(404).json({ error: 'Session not found' });
		if (passParsedBody) {
			await session.transport.handlePostMessage(req, res, req.body);
		} else {
			await session.transport.handlePostMessage(req, res);
		}
	});

	return new Promise((resolve) => {
		const httpServer = app.listen(0, () => {
			const port = httpServer.address().port;
			resolve({
				sseUrl: `http://127.0.0.1:${port}/sse`,
				close: () => new Promise((r) => httpServer.close(r)),
			});
		});
	});
}

describe('MCP SSE transport — /messages parsed body', () => {
	describe('with the parsed body passed to handlePostMessage', () => {
		let server, client;
		const api = createMockApi({
			get: async () => ({ projects: [FIXTURES.project] }),
			post: async () => ({ note: FIXTURES.note }),
		});

		before(async () => {
			server = await startSseTestServer(api, { passParsedBody: true });
			client = new Client({ name: 'sse-test', version: '0.0.1' });
			await client.connect(new SSEClientTransport(new URL(server.sseUrl)));
		});

		after(async () => {
			try { await client?.close(); } catch {}
			await server?.close();
		});

		it('completes the initialize handshake over the SSE stream', () => {
			const info = client.getServerVersion();
			assert.equal(info.name, 'streamient-test');
			assert.equal(info.version, '0.0.1');
		});

		it('lists tools through a POST to /messages', async () => {
			const { tools } = await client.listTools();
			assert.equal(tools.length, 44);
		});

		it('runs a tool call through /messages', async () => {
			const result = await client.callTool({
				name: 'create_note',
				arguments: { title: 'SSE note' },
			});
			assert.deepEqual(result.content, []);
			assert.equal(result.structuredContent.data.id, FIXTURES.note._id);
		});
	});

	describe('when the parsed body is not passed (regression)', () => {
		let server;
		const api = createMockApi({
			get: async () => ({ projects: [FIXTURES.project] }),
			post: async () => ({ note: FIXTURES.note }),
		});

		before(async () => {
			server = await startSseTestServer(api, { passParsedBody: false });
		});

		after(async () => {
			await server?.close();
		});

		it('fails with "stream is not readable"', async () => {
			const client = new Client({ name: 'sse-test', version: '0.0.1' });
			const transport = new SSEClientTransport(new URL(server.sseUrl));
			await assert.rejects(
				() => client.connect(transport),
				/stream is not readable/,
			);
			try { await client.close(); } catch {}
		});
	});

	describe('actual server wiring', () => {
		it('/messages passes req.body to handlePostMessage', async () => {
			const source = await readFile(serverJsPath, 'utf8');
			assert.match(source, /handlePostMessage\(\s*req\s*,\s*res\s*,\s*req\.body\s*\)/, 'expected handlePostMessage(req, res, req.body)');
			assert.doesNotMatch(source, /handlePostMessage\(\s*req\s*,\s*res\s*\)\s*;/, 'expected no two-argument handlePostMessage(req, res)');
		});
	});
});