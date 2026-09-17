import { z } from 'zod';
import { MCP_JSON_OUTPUT_SCHEMA, mcpJson } from './output.js';
import { MCP_PER_PAGE_SCHEMA, MCP_SEARCH_FILTER_SCHEMA, mcpPerPage } from './retrieval.js';
import { slimSearchResults } from './search-results.js';

const MCP_URL_SEARCH_EXCLUDE_FIELDS = 'embedding';
const MCP_URL_SEARCH_INCLUDE_FIELDS = 'id,source_id,title,url,description,text_content,tags,project_id,created_at,updated_at';
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
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        url: z.string().describe('The URL to save'),
        title: z.string().optional().describe('Optional custom title'),
        description: z.string().optional().describe('Optional description'),
        tags: z.array(z.string()).optional().describe('Optional tags'),
        crawl_enabled: z.boolean().optional().describe('Enable full-site crawling'),
        project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
      },
      handler: async (args) => {
        const { project_id, ...rest } = args;
        const { url } = await api.post('/urls', { ...rest, project: project_id || defaultProjectId });
        return mcpJson(url);
      },
    },

    list_urls: {
      description: 'List saved URLs, optionally filtered by project',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
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
        return mcpJson(urls);
      },
    },

    search_urls: {
      description: 'Search saved URLs using semantic/text search. per_page defaults to 1; increase it only when needed.',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        ...MCP_SEARCH_FILTER_SCHEMA,
        query: z.string().describe('Search query'),
        project_id: z.string().optional().describe('Filter by project'),
        per_page: MCP_PER_PAGE_SCHEMA,
      },
      handler: async (args) => {
        const { results } = await api.post('/urls/search', {
          query: args.query,
          project_id: args.project_id,
          tags: args.tags,
          page: args.page,
          options: {
            perPage: mcpPerPage(args),
            include_fields: MCP_URL_SEARCH_INCLUDE_FIELDS,
            exclude_fields: MCP_URL_SEARCH_EXCLUDE_FIELDS,
          },
        });
        return mcpJson(slimSearchResults(results, { type: 'urls' }));
      },
    },

    read_url: {
      description: 'Read a saved URL by ID',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('URL ID'),
      },
      handler: async (args) => {
        const { url } = await api.get(`/urls/${args.id}`);
        return mcpJson(url);
      },
    },

    update_url: {
      description: 'Update a saved URL',
      annotations: OVERWRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('URL ID'),
        title: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        crawl_enabled: z.boolean().optional(),
      },
      handler: async (args) => {
        const { id, ...data } = args;
        const { url } = await api.put(`/urls/${id}`, data);
        return mcpJson(url);
      },
    },

    delete_url: {
      description: 'Delete a saved URL by ID',
      annotations: OVERWRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('URL ID'),
      },
      handler: async (args) => {
        await api.delete(`/urls/${args.id}`);
        return mcpJson({ message: 'URL deleted' });
      },
    },
  };
}
