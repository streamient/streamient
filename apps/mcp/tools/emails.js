import { z } from 'zod';
import { MCP_JSON_OUTPUT_SCHEMA, mcpJson } from './output.js';
import { MCP_PER_PAGE_SCHEMA, mcpPerPage } from './retrieval.js';
import { slimSearchResults } from './search-results.js';

const MCP_EMAIL_SEARCH_EXCLUDE_FIELDS = 'embedding';
const MCP_EMAIL_SEARCH_INCLUDE_FIELDS = 'id,source_id,subject,from,to,cc,bcc,from_emails,to_emails,cc_emails,bcc_emails,participant_emails,mailbox,labels,text_content,attachment_text_content,project_id,created_at,updated_at';
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_INTERNAL = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const OVERWRITE_INTERNAL = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

/**
 * MCP tool definitions: Emails
 */
export function emailTools(api, defaultProjectId) {
	return {
		ingest_email: {
			description: 'Ingest an email into the knowledge base (raw RFC822 or parsed payload)',
			annotations: WRITE_INTERNAL,
			outputSchema: MCP_JSON_OUTPUT_SCHEMA,
			inputSchema: {
				project_id: z.string().optional().describe('Project ID (defaults to the default project)'),
				raw_email: z.string().optional().describe('Raw RFC822 email content'),
				parsed_email: z.any().optional().describe('Pre-parsed mailparser-like JSON payload'),
			},
			handler: async (args) => {
				const payload = {
					project: args.project_id || defaultProjectId,
				};
				if (args.raw_email) payload.raw_email = args.raw_email;
				if (args.parsed_email) payload.parsed_email = args.parsed_email;
				const { email } = await api.post('/emails', payload);
				return mcpJson(email);
			},
		},

		read_email: {
			description: 'Read an email by ID',
			annotations: READ_ONLY,
			outputSchema: MCP_JSON_OUTPUT_SCHEMA,
			inputSchema: {
				id: z.string().describe('Email ID'),
			},
			handler: async (args) => {
				const { email } = await api.get(`/emails/${args.id}`);
				return mcpJson(email);
			},
		},

		list_emails: {
			description: 'List emails, optionally filtered by project',
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
				const { emails } = await api.get(`/emails?${params}`);
				return mcpJson(emails);
			},
		},

		search_emails: {
			description: 'Search emails using semantic/text search. per_page defaults to 5; read relevant records and refine weak results.',
			annotations: READ_ONLY,
			outputSchema: MCP_JSON_OUTPUT_SCHEMA,
			inputSchema: {
				query: z.string().describe('Search query'),
				per_page: MCP_PER_PAGE_SCHEMA,
			},
			handler: async (args) => {
				const { results } = await api.post('/emails/search', {
					query: args.query,
					options: {
						perPage: mcpPerPage(args),
						include_fields: MCP_EMAIL_SEARCH_INCLUDE_FIELDS,
						exclude_fields: MCP_EMAIL_SEARCH_EXCLUDE_FIELDS,
					},
				});
				return mcpJson(slimSearchResults(results, { type: 'emails' }));
			},
		},

		get_email_thread: {
			description: 'Get the message thread linked by message_id/references',
			annotations: READ_ONLY,
			outputSchema: MCP_JSON_OUTPUT_SCHEMA,
			inputSchema: {
				id: z.string().describe('Email ID'),
			},
			handler: async (args) => {
				const { thread } = await api.get(`/emails/${args.id}/thread`);
				return mcpJson(thread);
			},
		},

		delete_email: {
			description: 'Delete an email by ID',
			annotations: OVERWRITE_INTERNAL,
			outputSchema: MCP_JSON_OUTPUT_SCHEMA,
			inputSchema: {
				id: z.string().describe('Email ID'),
			},
			handler: async (args) => {
				await api.delete(`/emails/${args.id}`);
				return mcpJson({ message: 'Email deleted' });
			},
		},
	};
}
