import { z } from 'zod';
import { MCP_JSON_OUTPUT_SCHEMA, mcpJson } from './output.js';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_INTERNAL = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const OVERWRITE_INTERNAL = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

/**
 * MCP tool definitions: Projects
 */
export function projectTools(api) {
  return {
    list_projects: {
      description: 'List all projects',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {},
      handler: async () => {
        const { projects } = await api.get('/projects');
        return mcpJson(projects, { ephemeral: true });
      },
    },

    get_project: {
      description: 'Get a project by ID',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('Project ID'),
      },
      handler: async (args) => {
        const { project } = await api.get(`/projects/${args.id}`);
        return mcpJson(project);
      },
    },

    create_project: {
      description: 'Create a new project',
      annotations: WRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        name: z.string().describe('Project name'),
        color: z.string().optional().describe('Project color (hex code)'),
      },
      handler: async (args) => {
        const { project } = await api.post('/projects', args);
        return mcpJson(project);
      },
    },

    update_project: {
      description: 'Update a project',
      annotations: OVERWRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('Project ID'),
        name: z.string().optional().describe('Project name'),
        color: z.string().optional().describe('Project color (hex code)'),
      },
      handler: async (args) => {
        const { id, ...data } = args;
        const { project } = await api.put(`/projects/${id}`, data);
        return mcpJson(project);
      },
    },

    delete_project: {
      description: 'Delete a project by ID (cannot delete the default project)',
      annotations: OVERWRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('Project ID'),
      },
      handler: async (args) => {
        await api.delete(`/projects/${args.id}`);
        return mcpJson({ message: 'Project deleted' });
      },
    },

    get_project_counts: {
      description: 'Get per-project document counts (notes, memories, URLs)',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {},
      handler: async () => {
        const counts = await api.get('/counts');
        return mcpJson(counts, { ephemeral: true });
      },
    },
  };
}
