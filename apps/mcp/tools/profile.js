export const MCP_TOOL_PROFILES = {
	FULL: 'full',
	APP: 'app',
};

export const PUBLIC_APP_EXCLUDED_TOOLS = new Set([
	'chat',
	'create_project',
	'delete_email',
	'delete_link',
	'delete_memory',
	'delete_note',
	'delete_project',
	'delete_url',
	'remove_git_repo',
	'trigger_git_sync',
	'update_git_repo',
	'update_memory',
	'update_note',
	'update_project',
	'update_url',
]);

export function applyPublicAppToolProfile(tools) {
	return Object.fromEntries(Object.entries(tools).filter(([name]) => !PUBLIC_APP_EXCLUDED_TOOLS.has(name)));
}

export function applyToolProfile(tools, profile = MCP_TOOL_PROFILES.FULL) {
	if (profile === MCP_TOOL_PROFILES.APP) return applyPublicAppToolProfile(tools);
	return tools;
}
