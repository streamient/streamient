const mcpConfig = {
	port: parseInt(process.env.PORT, 10) || 3002,
	apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
	mcpBaseUrl: (process.env.MCP_BASE_URL || 'http://localhost:3002').replace(/\/$/, ''),
};

export default mcpConfig;
