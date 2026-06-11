import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMockApi } from './helpers/mock-api.js';
import { FIXTURES } from './helpers/fixtures.js';
import { projectTools } from '../../apps/mcp/tools/projects.js';

describe('MCP Tools — Projects', () => {
    let api, tools;

    beforeEach(() => {
        api = createMockApi({
            get: async (path) => {
                if (path === '/projects') return { projects: [FIXTURES.project] };
                return { project: FIXTURES.project };
            },
        });
        tools = projectTools(api);
    });

    it('list_projects — calls GET /projects', async () => {
        const result = await tools.list_projects.handler({});
        assert.equal(api.lastCall.method, 'GET');
        assert.equal(api.lastCall.path, '/projects');
        const parsed = JSON.parse(result.content[0].text);
        assert.ok(Array.isArray(parsed));
        assert.equal(parsed[0].name, 'Test Project');
    });

    it('get_project — calls GET /projects/:id', async () => {
        const result = await tools.get_project.handler({ id: FIXTURES.project._id });
        assert.equal(api.lastCall.method, 'GET');
        assert.ok(api.lastCall.path.includes(FIXTURES.project._id));
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.id, FIXTURES.project._id);
        assert.equal(parsed.host_id, undefined);
    });

    it('delete_project — calls DELETE /projects/:id', async () => {
        const result = await tools.delete_project.handler({ id: FIXTURES.project._id });
        assert.equal(api.lastCall.method, 'DELETE');
        assert.equal(api.lastCall.path, `/projects/${FIXTURES.project._id}`);
        const parsed = JSON.parse(result.content[0].text);
        assert.equal(parsed.message, 'Project deleted');
        assert.equal(result.structuredContent.data.message, 'Project deleted');
    });
});
