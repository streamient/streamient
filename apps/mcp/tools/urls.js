import { z } from 'zod';
import { slimSearchResults } from './search-results.js';

const MCP_URL_SEARCH_EXCLUDE_FIELDS = 'embedding';
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_INTERNAL = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const OVERWRITE_INTERNAL = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
const FETCH_EXTERNAL = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

/**
 * MCP tool definitions: URLs
 */
export function urlTools(api, defaultProjectId) {
  return {
    save_url: {
      description: 'Save a URL — extracts content automatically. Set crawl_enabled to true for full-site crawling.',
      annotations: FETCH_EXTERNAL,
      inputSchema: {
        url: z.string().describe('The URL to save'),
        title: z.string().optional().describe('Optional custom title'),
        description: z.string().optional().describe('Optional description'),
        crawl_enabled: z.boolean().optional().describe('Enable full-site crawling'),
        project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
      },
      handler: async (args) => {
        const { project_id, ...rest } = args;
        const { url } = await api.post('/urls', { ...rest, project: project_id || defaultProjectId });
        return { content: [{ type: 'text', text: JSON.stringify(url, null, 2) }] };
      },
    },

    list_urls: {
      description: 'List saved URLs, optionally filtered by project',
      annotations: READ_ONLY,
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
        const { urls } = await api.get(`/urls?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(urls, null, 2), cache_control: { type: 'ephemeral' } }] };
      },
    },

    search_urls: {
      description: 'Search saved URLs using semantic/text search',
      annotations: READ_ONLY,
      inputSchema: {
        query: z.string().describe('Search query'),
        per_page: z.number().optional().describe('Results to return (recommended 3 for first retrieval)'),
      },
      handler: async (args) => {
        const { results } = await api.post('/urls/search', {
          query: args.query,
          options: {
            perPage: args.per_page,
            exclude_fields: MCP_URL_SEARCH_EXCLUDE_FIELDS,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(slimSearchResults(results, { type: 'urls' }), null, 2), cache_control: { type: 'ephemeral' } }] };
      },
    },

    read_url: {
      description: 'Read a saved URL by ID',
      annotations: READ_ONLY,
      inputSchema: {
        id: z.string().describe('URL ID'),
      },
      handler: async (args) => {
        const { url } = await api.get(`/urls/${args.id}`);
        return { content: [{ type: 'text', text: JSON.stringify(url, null, 2), cache_control: { type: 'ephemeral' } }] };
      },
    },

    update_url: {
      description: 'Update a saved URL',
      annotations: OVERWRITE_INTERNAL,
      inputSchema: {
        id: z.string().describe('URL ID'),
        title: z.string().optional(),
        description: z.string().optional(),
        crawl_enabled: z.boolean().optional(),
      },
      handler: async (args) => {
        const { id, ...data } = args;
        const { url } = await api.put(`/urls/${id}`, data);
        return { content: [{ type: 'text', text: JSON.stringify(url, null, 2) }] };
      },
    },

    delete_url: {
      description: 'Delete a saved URL by ID',
      annotations: OVERWRITE_INTERNAL,
      inputSchema: {
        id: z.string().describe('URL ID'),
      },
      handler: async (args) => {
        await api.delete(`/urls/${args.id}`);
        return { content: [{ type: 'text', text: 'URL deleted' }] };
      },
    },
  };
}
