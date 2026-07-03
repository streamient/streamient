import { z } from 'zod';
import { MCP_JSON_OUTPUT_SCHEMA, mcpJson } from './output.js';
import { slimSearchResults } from './search-results.js';

const MCP_KNOWLEDGE_SEARCH_EXCLUDE_FIELDS = {
  notes: 'embedding',
  memory: 'embedding',
  urls: 'embedding',
  emails: 'embedding',
  pages: 'embedding',
};
const MCP_KNOWLEDGE_SEARCH_INCLUDE_FIELDS = {
  notes: 'id,source_id,title,text_content,tags,project_id,created_at,updated_at',
  memory: 'id,source_id,title,content,source,tags,project_id,created_at,updated_at',
  urls: 'id,source_id,title,url,description,text_content,project_id,created_at,updated_at',
  emails: 'id,source_id,subject,from,to,cc,bcc,from_emails,to_emails,cc_emails,bcc_emails,participant_emails,mailbox,labels,text_content,attachment_text_content,project_id,created_at,updated_at',
  pages: 'id,source_id,title,url,parent_url_id,text_content,project_id,crawled_at',
};
const MCP_MEMORY_SEARCH_EXCLUDE_FIELDS = 'embedding';
const MCP_MEMORY_SEARCH_INCLUDE_FIELDS = MCP_KNOWLEDGE_SEARCH_INCLUDE_FIELDS.memory;
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_INTERNAL = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const OVERWRITE_INTERNAL = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
const BROAD_CHAT_ACTION = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };

/**
 * MCP tool definitions: Memory
 */
export function memoryTools(api, defaultProjectId) {
  return {
    store_memory: {
      description: 'Store a new memory — use this to persist important conversation context, decisions, or learnings',
      annotations: WRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        title: z.string().describe('Memory title/subject'),
        content: z.string().describe('Memory content'),
        tags: z.array(z.string()).optional().describe('Tags for categorization'),
        source: z.string().optional().describe('Where this memory came from'),
        project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
      },
      handler: async (args) => {
        const { project_id, ...rest } = args;
        const { memory } = await api.post('/memories', { ...rest, project: project_id || defaultProjectId });
        return mcpJson(memory);
      },
    },

    recall_memory: {
      description: 'Search memories semantically for prior decisions, debugging history, user preferences, task outcomes, or agent-scoped learnings. Use per_page: 3 for the first focused retrieval. Omit project_id to search across all projects.',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        query: z.string().describe('What to search for'),
        project_id: z.string().optional().describe('Filter results to a specific project (optional; omit to search all projects)'),
        per_page: z.number().optional().describe('Results to return (recommended 3 for first retrieval)'),
      },
      handler: async (args) => {
        const { results } = await api.post('/memories/search', {
          query: args.query,
          project_id: args.project_id,
          options: {
            perPage: args.per_page,
            include_fields: MCP_MEMORY_SEARCH_INCLUDE_FIELDS,
            exclude_fields: MCP_MEMORY_SEARCH_EXCLUDE_FIELDS,
          },
        });
        return mcpJson(slimSearchResults(results, { type: 'memory' }), { ephemeral: true });
      },
    },

    search_memory: {
      description: 'Alias for recall_memory — search memories semantically for prior decisions, debugging history, user preferences, task outcomes, or agent-scoped learnings. Use per_page: 3 for the first focused retrieval. Omit project_id to search across all projects.',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        query: z.string().describe('What to search for'),
        project_id: z.string().optional().describe('Filter results to a specific project (optional; omit to search all projects)'),
        per_page: z.number().optional().describe('Results to return (recommended 3 for first retrieval)'),
      },
      handler: async (args) => {
        const { results } = await api.post('/memories/search', {
          query: args.query,
          project_id: args.project_id,
          options: {
            perPage: args.per_page,
            include_fields: MCP_MEMORY_SEARCH_INCLUDE_FIELDS,
            exclude_fields: MCP_MEMORY_SEARCH_EXCLUDE_FIELDS,
          },
        });
        return mcpJson(slimSearchResults(results, { type: 'memory' }), { ephemeral: true });
      },
    },

    read_memory: {
      description: 'Read a specific memory by ID',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('Memory ID'),
      },
      handler: async (args) => {
        const { memory } = await api.get(`/memories/${args.id}`);
        return mcpJson(memory, { ephemeral: true });
      },
    },

    update_memory: {
      description: 'Update an existing memory',
      annotations: OVERWRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('Memory ID'),
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
      handler: async (args) => {
        const { id, ...data } = args;
        const { memory } = await api.put(`/memories/${id}`, data);
        return mcpJson(memory);
      },
    },

    delete_memory: {
      description: 'Delete a memory by ID',
      annotations: OVERWRITE_INTERNAL,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        id: z.string().describe('Memory ID'),
      },
      handler: async (args) => {
        await api.delete(`/memories/${args.id}`);
        return mcpJson({ message: 'Memory deleted' });
      },
    },

    suggest_memory_tags: {
      description: 'Get a bounded list of existing memory tags for reuse. Use query for prefix matching and limit responses to avoid large payloads.',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        query: z.string().optional().describe('Tag prefix to match'),
        project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
        limit: z.number().optional().describe('Maximum tags to return (default 50, max 100)'),
      },
      handler: async (args = {}) => {
        const params = new URLSearchParams();
        const projectId = args.project_id || defaultProjectId;

        if (projectId) params.set('project', projectId);
        if (args.query) params.set('q', args.query);
        if (args.limit) params.set('limit', String(args.limit));

        const qs = params.toString();
        const { tags } = await api.get(`/memories/tags/suggest${qs ? `?${qs}` : ''}`);
        return mcpJson(tags, { ephemeral: true });
      },
    },

    search_knowledge: {
      description: 'Search across ALL data types (notes, memories, URLs, crawled pages) — default first retrieval tool. Use a specific query with per_page: 3, then broaden or raise per_page only if results are weak.',
      annotations: READ_ONLY,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        query: z.string().describe('Search query'),
        project_id: z.string().optional().describe('Filter results to a specific project (optional)'),
        per_page: z.number().optional().describe('Results per collection (default 5)'),
      },
      handler: async (args) => {
        const { results } = await api.post('/search/knowledge', {
          query: args.query,
          project_id: args.project_id,
          per_page: args.per_page,
          options: {
            include_fields: MCP_KNOWLEDGE_SEARCH_INCLUDE_FIELDS,
            exclude_fields: MCP_KNOWLEDGE_SEARCH_EXCLUDE_FIELDS,
          },
        });
        return mcpJson(slimSearchResults(results), { ephemeral: true });
      },
    },

    chat: {
      description: 'AI chat with intent classification — search, create items, or get analysis. Maintains conversation context across calls.',
      annotations: BROAD_CHAT_ACTION,
      outputSchema: MCP_JSON_OUTPUT_SCHEMA,
      inputSchema: {
        query: z.string().describe('User message, search query, or command (e.g. "create a note about X", "remember that Y", "find my notes about Z")'),
        conversation_id: z.string().optional().describe('Continue an existing conversation (optional)'),
        project_id: z.string().optional().describe('Scope search/actions to a project (optional)'),
      },
      handler: async (args) => {
        const res = await api.post('/chat', {
          query: args.query,
          conversation_id: args.conversation_id,
          project_id: args.project_id,
        });
        return mcpJson(res, { ephemeral: true });
      },
    },
  };
}
