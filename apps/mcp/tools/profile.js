export const MCP_TOOL_PROFILES = {
	FULL: 'full',
	APP: 'app',
};

export const PUBLIC_APP_EXCLUDED_TOOLS = new Set([
	'chat',
]);

export function applyPublicAppToolProfile(tools) {
	return Object.fromEntries(Object.entries(tools).filter(([name]) => !PUBLIC_APP_EXCLUDED_TOOLS.has(name)));
}

export function applyToolProfile(tools, profile = MCP_TOOL_PROFILES.FULL) {
	if (profile === MCP_TOOL_PROFILES.APP) return applyPublicAppToolProfile(tools);
	return tools;
}
