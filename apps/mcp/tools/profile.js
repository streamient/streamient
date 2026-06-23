export const MCP_TOOL_PROFILES = {
	FULL: 'full',
	APP: 'app',
};

export const PUBLIC_APP_ALLOWED_TOOLS = new Set([
	'create_note',
	'read_note',
	'list_notes',
	'search_notes',
	'store_memory',
	'recall_memory',
	'search_memory',
	'read_memory',
	'suggest_memory_tags',
	'list_projects',
	'get_project',
	'get_project_counts',
]);

export function applyPublicAppToolProfile(tools) {
	return Object.fromEntries(Object.entries(tools).filter(([name]) => PUBLIC_APP_ALLOWED_TOOLS.has(name)));
}

export function applyToolProfile(tools, profile = MCP_TOOL_PROFILES.FULL) {
	if (profile === MCP_TOOL_PROFILES.APP) return applyPublicAppToolProfile(tools);
	return tools;
}
