import { z } from 'zod';

export const MCP_DEFAULT_PER_PAGE = 1;

export const MCP_SEARCH_FILTER_SCHEMA = {
	tags: z.array(z.string()).optional().describe('Exact required tags; a record may have additional tags. Multiple tags require all. Use query "" for tag-only retrieval.'),
	page: z.number().int().min(1).optional().describe('Page number; iterate pages to retrieve all matching records.'),
};

export const MCP_PER_PAGE_SCHEMA = z.number().int().min(1).default(MCP_DEFAULT_PER_PAGE).describe('Results per collection (default 1; increase only when needed)');

export function mcpPerPage(args = {}) {
	return args.per_page ?? MCP_DEFAULT_PER_PAGE;
}
