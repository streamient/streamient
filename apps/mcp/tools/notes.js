import { z } from 'zod';
import { slimSearchResults } from './search-results.js';

const MCP_NOTES_SEARCH_EXCLUDE_FIELDS = 'embedding';

/**
 * MCP tool definitions: Notes
 */
export function noteTools(api, defaultProjectId) {
  return {
    create_note: {
      description: 'Create a new note in a project',
      inputSchema: {
        title: z.string().describe('Note title'),
        content: z.string().optional().describe('Note content (HTML)'),
        text_content: z.string().optional().describe('Plain text content for search'),
        tags: z.array(z.string()).optional().describe('Tags'),
        project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
      },
      handler: async (args) => {
        const { project_id, ...rest } = args;
        const { note } = await api.post('/notes', { ...rest, project: project_id || defaultProjectId });
        return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
      },
    },

    read_note: {
      description: 'Read a note by ID',
      inputSchema: {
        id: z.string().describe('Note ID'),
      },
      handler: async (args) => {
        const { note } = await api.get(`/notes/${args.id}`);
        return { content: [{ type: 'text', text: JSON.stringify(note, null, 2), cache_control: { type: 'ephemeral' } }] };
      },
    },

    update_note: {
      description: 'Update a note',
      inputSchema: {
        id: z.string().describe('Note ID'),
        title: z.string().optional(),
        content: z.string().optional(),
        text_content: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
      handler: async (args) => {
        const { id, ...data } = args;
        const { note } = await api.put(`/notes/${id}`, data);
        return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
      },
    },

    delete_note: {
      description: 'Delete a note by ID',
      inputSchema: {
        id: z.string().describe('Note ID'),
      },
      handler: async (args) => {
        await api.delete(`/notes/${args.id}`);
        return { content: [{ type: 'text', text: 'Note deleted' }] };
      },
    },

    list_notes: {
      description: 'List notes, optionally filtered by project',
      inputSchema: {
        project_id: z.string().optional().describe('Project ID filter'),
        page: z.number().optional(),
        limit: z.number().optional(),
      },
      handler: async (args) => {
        const params = new URLSearchParams();
        if (args.project_id) params.set('project', args.project_id);
        if (args.page) params.set('page', args.page);
        if (args.limit) params.set('limit', args.limit);
        const { notes } = await api.get(`/notes?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(notes, null, 2), cache_control: { type: 'ephemeral' } }] };
      },
    },

    search_notes: {
      description: 'Search notes using semantic/text search. Use only for specs, docs, ADRs, structured write-ups, or when search_knowledge results point to notes. Use per_page: 3 for first focused retrieval. Omit project_id to search across all projects.',
      inputSchema: {
        query: z.string().describe('Search query'),
        project_id: z.string().optional().describe('Filter results to a specific project (optional; omit to search all projects)'),
        per_page: z.number().optional().describe('Results to return (recommended 3 for first retrieval)'),
      },
      handler: async (args) => {
        const { results } = await api.post('/notes/search', {
          query: args.query,
          project_id: args.project_id,
          options: {
            perPage: args.per_page,
            exclude_fields: MCP_NOTES_SEARCH_EXCLUDE_FIELDS,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(slimSearchResults(results, { type: 'notes' }), null, 2), cache_control: { type: 'ephemeral' } }] };
      },
    },
  };
}
