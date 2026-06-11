import { z } from 'zod';
import { MCP_JSON_OUTPUT_SCHEMA, mcpJson } from './output.js';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_INTERNAL = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const OVERWRITE_INTERNAL = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

/**
 * MCP tool definitions: Graph Links
 */
export function graphTools(api) {
    return {
        create_link: {
            description: 'Create a link between two items (notes, memories, URLs, or emails)',
            annotations: WRITE_INTERNAL,
            outputSchema: MCP_JSON_OUTPUT_SCHEMA,
            inputSchema: {
                source_id: z.string().describe('Source item ID'),
                source_type: z.enum(['notes', 'memory', 'urls', 'emails']).describe('Source item type'),
                target_id: z.string().describe('Target item ID'),
                target_type: z.enum(['notes', 'memory', 'urls', 'emails']).describe('Target item type'),
                label: z.string().optional().describe('Link label/description'),
            },
            handler: async (args) => {
                const { link } = await api.post('/links', args);
                return mcpJson(link);
            },
        },

        get_links: {
            description: 'Get all links for a specific item',
            annotations: READ_ONLY,
            outputSchema: MCP_JSON_OUTPUT_SCHEMA,
            inputSchema: {
                item_id: z.string().describe('Item ID to get links for'),
            },
            handler: async (args) => {
                const { links } = await api.get(`/links/${args.item_id}`);
                return mcpJson(links, { ephemeral: true });
            },
        },

        get_graph: {
            description: 'Get the full knowledge graph with nodes and edges. Includes manual links, tag-based connections, and optional semantic similarity edges.',
            annotations: READ_ONLY,
            outputSchema: MCP_JSON_OUTPUT_SCHEMA,
            inputSchema: {
                project_id: z.string().optional().describe('Filter by project ID'),
                include_tags: z.boolean().optional().describe('Include tag-based edges (default: true)'),
                include_semantic: z.boolean().optional().describe('Include semantic similarity edges (default: false)'),
                semantic_threshold: z.number().optional().describe('Semantic similarity threshold 0-1 (default: 0.7)'),
            },
            handler: async (args) => {
                const params = new URLSearchParams();
                if (args.project_id) params.set('project_id', args.project_id);
                if (args.include_tags !== undefined) params.set('include_tags', args.include_tags);
                if (args.include_semantic !== undefined) params.set('include_semantic', args.include_semantic);
                if (args.semantic_threshold !== undefined) params.set('semantic_threshold', args.semantic_threshold);
                const data = await api.get(`/graph?${params.toString()}`);
                return mcpJson(data, { ephemeral: true });
            },
        },

        traverse_graph: {
            description: 'Get an item and all its direct connections in the knowledge graph',
            annotations: READ_ONLY,
            outputSchema: MCP_JSON_OUTPUT_SCHEMA,
            inputSchema: {
                item_id: z.string().describe('Starting item ID'),
            },
            handler: async (args) => {
                const { links } = await api.get(`/links/${args.item_id}`);
                const connectedIds = new Set();
                for (const link of links) {
                    connectedIds.add(link.source_id.toString());
                    connectedIds.add(link.target_id.toString());
                }
                connectedIds.delete(args.item_id);
                return mcpJson({
                    item_id: args.item_id,
                    links,
                    connected_item_ids: [...connectedIds],
                }, { ephemeral: true });
            },
        },

        delete_link: {
            description: 'Delete a link between two items',
            annotations: OVERWRITE_INTERNAL,
            outputSchema: MCP_JSON_OUTPUT_SCHEMA,
            inputSchema: {
                link_id: z.string().describe('Link ID to delete'),
            },
            handler: async (args) => {
                await api.delete(`/links/${args.link_id}`);
                return mcpJson({ message: 'Link deleted' });
            },
        },
    };
}
