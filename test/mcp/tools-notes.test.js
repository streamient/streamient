import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';
import { noteTools } from '../../apps/mcp/tools/notes.js';

describe('MCP Tools — Notes', () => {
    let api, tools;

    beforeEach(() => {
        api = createMockApi({
            get: async (path) => {
                if (path.includes('?')) return { notes: [FIXTURES.note] };
                return { note: FIXTURES.note };
            },
            post: async (path, body) => {
                if (path === '/notes/search') return { results: [FIXTURES.note] };
                return { note: { ...FIXTURES.note, ...body } };
            },
            put: async (_path, body) => ({ note: { ...FIXTURES.note, ...body } }),
            delete: async () => ({}),
        });
        tools = noteTools(api, FIXTURES.project._id);
    });

    // ── create_note ───────────────────────────────────────────────

    it('create_note — calls POST /notes with args', async () => {
        const result = await tools.create_note.handler({
            title: 'Test Note',
            project_id: FIXTURES.project._id,
        });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/notes');
        assert.equal(api.lastCall.body.title, 'Test Note');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(parsed.title);
    });

    it('create_note — passes optional content and tags', async () => {
        await tools.create_note.handler({
            title: 'Full Note',
            content: '<p>Hello</p>',
            text_content: 'Hello',
            tags: ['test'],
            project_id: FIXTURES.project._id,
        });
        assert.equal(api.lastCall.body.content, '<p>Hello</p>');
        assert.deepEqual(api.lastCall.body.tags, ['test']);
    });

    it('create_note — defaults to default project when no project_id', async () => {
        await tools.create_note.handler({ title: 'No Project' });
        assert.equal(api.lastCall.body.project, FIXTURES.project._id);
    });

    // ── read_note ─────────────────────────────────────────────────

    it('read_note — calls GET /notes/:id', async () => {
        const result = await tools.read_note.handler({ id: FIXTURES.note._id });
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes(FIXTURES.note._id));
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.id, FIXTURES.note._id);
        assert.equal(parsed.host_id, undefined);
    });

    // ── update_note ───────────────────────────────────────────────

    it('update_note — calls PUT /notes/:id and strips id from body', async () => {
        const result = await tools.update_note.handler({
            id: FIXTURES.note._id,
            title: 'Updated Title',
        });
        assert.equal(api.lastCall.method, 'PUT');
        assert.ok(api.lastCall.path.includes(FIXTURES.note._id));
        assert.equal(api.lastCall.body.title, 'Updated Title');
        assert.equal(api.lastCall.body.id, undefined);
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.title, 'Updated Title');
    });

    // ── delete_note ───────────────────────────────────────────────

    it('delete_note — calls DELETE /notes/:id', async () => {
        const result = await tools.delete_note.handler({ id: FIXTURES.note._id });
        assert.equal(api.lastCall.method, 'DELETE');
        assert.ok(api.lastCall.path.includes(FIXTURES.note._id));
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.message, 'Note deleted');
        assert.equal(result.structuredContent.data.message, 'Note deleted');
    });

    // ── list_notes ────────────────────────────────────────────────

    it('list_notes — passes query params', async () => {
        const result = await tools.list_notes.handler({
            project_id: FIXTURES.project._id,
            page: 1,
            limit: 5,
        });
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes('project='));
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
    });

    it('list_notes — works with no filter', async () => {
        await tools.list_notes.handler({});
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.startsWith('/notes'));
    });

    // ── search_notes ──────────────────────────────────────────────

    it('search_notes — calls POST /notes/search', async () => {
        const result = await tools.search_notes.handler({ query: 'hello' });
        assert.equal(api.lastCall.method, 'POST');
        assert.equal(api.lastCall.path, '/notes/search');
        assert.equal(api.lastCall.body.query, 'hello');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
    });

    it('search_notes — passes optional per_page as options.perPage', async () => {
        await tools.search_notes.handler({ query: 'hello', per_page: 3 });
        assert.equal(api.lastCall.body.options.perPage, 3);
    });

    it('search_notes — requests lean searchable body fields for excerpts', async () => {
        await tools.search_notes.handler({ query: 'hello' });
        assert.equal(api.lastCall.body.options.include_fields, 'id,source_id,title,text_content,tags,project_id,created_at,updated_at');
        assert.equal(api.lastCall.body.options.exclude_fields, 'embedding');
    });
});
