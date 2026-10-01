import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createMockApi } from '../../../test/mcp/helpers/mock-api.js';
import { startTestServer } from '../../../test/mcp/helpers/test-server.js';
import { FIXTURES } from '../../../test/mcp/helpers/fixtures.js';
import { CliApplication } from '../lib/application.js';
import { EXIT_CODES } from '../lib/errors.js';

class CaptureStream {
	constructor() {
		this.value = '';
	}

	write(chunk) {
		this.value += chunk;
	}
}

describe('Streamient CLI over Streamable HTTP MCP', () => {
	let api;
	let server;

	before(async () => {
		api = createMockApi({
			get: async (path) => {
				if (path === '/notes/note-1') return { note: FIXTURES.note };
				if (path === '/notes/note-1?include_markdown=true') return { note: { ...FIXTURES.note, markdown_content: '---\ntitle: Original\n---\nBody' } };
				if (path === '/git-repos/repo-1/status') return { status: 'idle', id: 'repo-1' };
				if (path.startsWith('/graph?')) return { nodes: [], edges: [] };
				return {};
			},
			post: async (path, body) => {
				if (path === '/memories') return { memory: { ...FIXTURES.memory, title: body.title, content: body.content } };
				if (path === '/search/knowledge') return { results: { notes: [{ id: 'note-1', title: 'Release decision' }] } };
				if (path.endsWith('/git-repos')) return { repo: { _id: 'repo-1', repo_url: body.repo_url } };
				return {};
			},
			delete: async () => ({}),
			put: async (_path, body) => ({ note: { ...FIXTURES.note, ...body } }),
		});
		server = await startTestServer(api, { authorize: (req) => req.headers.authorization === 'Token valid-cli-token' });
	});

	after(async () => {
		await server?.close();
	});

	async function run(args) {
		const stdout = new CaptureStream();
		const stderr = new CaptureStream();
		const application = new CliApplication({ env: { STREAMIENT_CLI_ACCESS_TOKEN: 'valid-cli-token' }, stdout, stderr });
		const code = await application.run([...args, '--server', server.url]);
		return { code, stdout: stdout.value, stderr: stderr.value };
	}

	it('discovers the full catalog and runs note, memory, search, graph, and Git commands', async () => {
		const tools = await run(['tools', 'list']);
		assert.equal(tools.code, EXIT_CODES.SUCCESS);
		assert.equal(JSON.parse(tools.stdout).length, 44);

		const note = await run(['notes', 'read', 'note-1']);
		assert.equal(note.code, EXIT_CODES.SUCCESS);
		assert.equal(JSON.parse(note.stdout).title, FIXTURES.note.title);

		const memory = await run(['memories', 'store', '--title', 'Release choice', '--content', 'Ship the CLI']);
		assert.equal(memory.code, EXIT_CODES.SUCCESS);
		assert.equal(JSON.parse(memory.stdout).title, 'Release choice');

		const search = await run(['knowledge', 'search', 'release decision', '--per-page', '3']);
		assert.equal(search.code, EXIT_CODES.SUCCESS);
		assert.equal(JSON.parse(search.stdout).notes[0].title, 'Release decision');

		const graph = await run(['graph', 'show']);
		assert.equal(graph.code, EXIT_CODES.SUCCESS);
		assert.deepEqual(JSON.parse(graph.stdout), { nodes: [], edges: [] });

		const status = await run(['git', 'status', 'repo-1']);
		assert.equal(status.code, EXIT_CODES.SUCCESS);
		assert.deepEqual(JSON.parse(status.stdout), { status: 'idle', id: 'repo-1' });
	});

	it('enforces and then executes destructive and Git confirmation', async () => {
		const blockedDelete = await run(['notes', 'delete', 'note-1']);
		assert.equal(blockedDelete.code, EXIT_CODES.USAGE);
		assert.match(blockedDelete.stderr, /CONFIRMATION_REQUIRED/);

		const confirmedDelete = await run(['notes', 'delete', 'note-1', '--yes']);
		assert.equal(confirmedDelete.code, EXIT_CODES.SUCCESS);
		assert.deepEqual(JSON.parse(confirmedDelete.stdout), { message: 'Note deleted' });
		assert.ok(api.calls.some((call) => call.method === 'DELETE' && call.path === '/notes/note-1'));

		const blockedGit = await run(['git', 'add', '--repo-url', 'https://example.com/repo.git']);
		assert.equal(blockedGit.code, EXIT_CODES.USAGE);
		assert.match(blockedGit.stderr, /CONFIRMATION_REQUIRED/);

		const confirmedGit = await run(['git', 'add', '--repo-url', 'https://example.com/repo.git', '--yes']);
		assert.equal(confirmedGit.code, EXIT_CODES.SUCCESS);
		assert.equal(JSON.parse(confirmedGit.stdout).repo_url, 'https://example.com/repo.git');
	});

	it('reports rejected tokens without exposing them', async () => {
		const stdout = new CaptureStream();
		const stderr = new CaptureStream();
		const application = new CliApplication({ env: { STREAMIENT_CLI_ACCESS_TOKEN: 'rejected-cli-token' }, stdout, stderr });
		const code = await application.run(['tools', 'list', '--server', server.url]);
		assert.equal(code, EXIT_CODES.AUTH);
		assert.match(stderr.value, /AUTHENTICATION_FAILED/);
		assert.doesNotMatch(stderr.value, /rejected-cli-token/);
	});

	it('reads original Markdown and sends Markdown updates through discovered schemas', async () => {
		const read = await run(['notes', 'read', 'note-1']);
		assert.equal(read.code, EXIT_CODES.SUCCESS, read.stderr);
		assert.match(JSON.parse(read.stdout).markdown_content, /title: Original/);
		const markdown = '---\ntitle: Original\n---\nCorrected body';
		const update = await run(['notes', 'update', 'note-1', `--markdown-content=${markdown}`, '--yes']);
		assert.equal(update.code, EXIT_CODES.SUCCESS, update.stderr);
		assert.deepEqual(api.lastCall.body, { markdown_content: markdown });
	});

});
