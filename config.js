import { getSentryDsn, isSentryEnabled } from './modules/sentry_runtime.js';

function parseTypesenseConfig() {
	let nodesEnv = (process.env.TYPESENSE_NODES || '').trim();
	// Strip wrapping single or double quotes (some orchestrators add them)
	if ((nodesEnv.startsWith("'") && nodesEnv.endsWith("'")) || (nodesEnv.startsWith('"') && nodesEnv.endsWith('"') && nodesEnv[1] !== '{')) {
		nodesEnv = nodesEnv.slice(1, -1);
	}
	if (nodesEnv) {
		try {
			const parsed = JSON.parse(nodesEnv);
			if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
				throw new Error('TYPESENSE_NODES must include a "nodes" array');
			}
			return {
				connectionTimeoutSeconds: 900,
				healthcheckIntervalSeconds: 30,
				maxRetries: 2,
				retryIntervalSeconds: 10,
				...parsed,
			};
		} catch (err) {
			console.error('Invalid TYPESENSE_NODES JSON:', err.message);
			console.error('TYPESENSE_NODES raw value:', JSON.stringify(nodesEnv));
			process.exit(1);
		}
	}
	return {
		nodes: [
			{
				host: process.env.TYPESENSE_HOST || 'localhost',
				port: parseInt(process.env.TYPESENSE_PORT, 10) || 8108,
				protocol: 'http',
			},
		],
		apiKey: process.env.TYPESENSE_API_KEY || 'kumbukum-dev-key',
		connectionTimeoutSeconds: 900,
		healthcheckIntervalSeconds: 30,
		maxRetries: 2,
		retryIntervalSeconds: 10,
	};
}

function parseRedisConfig() {
	let sentinelEnv = (process.env.REDIS_SENTINEL || '').trim();
	// Strip wrapping quotes (some orchestrators add them)
	if ((sentinelEnv.startsWith("'") && sentinelEnv.endsWith("'")) || (sentinelEnv.startsWith('"') && sentinelEnv.endsWith('"') && sentinelEnv[1] !== '{')) {
		sentinelEnv = sentinelEnv.slice(1, -1);
	}
	if (sentinelEnv) {
		try {
			const parsed = JSON.parse(sentinelEnv);
			if (!parsed.sentinels || !parsed.name) {
				throw new Error('REDIS_SENTINEL must include "sentinels" and "name"');
			}
			return parsed;
		} catch (err) {
			console.error('Invalid REDIS_SENTINEL JSON:', err.message);
			console.error('REDIS_SENTINEL raw value:', JSON.stringify(sentinelEnv));
			process.exit(1);
		}
	}
	return process.env.REDIS_URL || 'redis://localhost:6379';
}

const config = {
	env: process.env.NODE_ENV || 'development',
	port: parseInt(process.env.PORT, 10) || 3000,
	mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/kumbukum?replicaSet=rs0',
	redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
	redisOptions: parseRedisConfig(),
	socketRedis: process.env.SOCKET_REDIS !== 'false' && !!(process.env.REDIS_URL || process.env.REDIS_SENTINEL),
	socketEmitDelay: parseInt(process.env.SOCKET_EMIT_DELAY, 10) || 500,
	sessionSecret: process.env.SESSION_SECRET || 'change-me',
	jwtSecret: process.env.JWT_SECRET || 'change-me',
	appUrl: process.env.APP_URL || 'http://localhost:3000',
	mcpBaseUrl: (process.env.MCP_BASE_URL || 'http://localhost:3002').replace(/\/$/, ''),
	wsUrl: process.env.WS_URL || '',

	typesense: parseTypesenseConfig(),

	smtp: {
		host: process.env.SMTP_HOST || '',
		port: parseInt(process.env.SMTP_PORT, 10) || 587,
		user: process.env.SMTP_USER || '',
		pass: process.env.SMTP_PASS || '',
		from: process.env.SMTP_FROM || 'noreply@localhost',
	},

	llm: {
		// Main conversational model (richer, for analysis & actions)
		chatModel: process.env.CHAT_AI_MODEL || '',
		chatProvider: process.env.CHAT_AI_MODEL_PROVIDER || 'google',
		// Lightweight model for intent classification & query extraction
		nlSearchModel: process.env.NL_SEARCH_MODEL || '',
		nlSearchProvider: process.env.NL_SEARCH_MODEL_PROVIDER || 'google',
		// Typesense conversation model
		tsConversationModel: process.env.TS_CONVERSATION_MODEL || '',
		tsConversationProvider: process.env.TS_CONVERSATION_MODEL_PROVIDER || 'google',
		// API keys per provider
		googleApiKey: process.env.GOOGLE_API_KEY || '',
		openaiApiKey: process.env.OPENAI_API_KEY || '',
	},

	plans: {
		starter: { apiRpm: 60, chatDaily: 50, mcpRpm: 120 },
		pro: { apiRpm: 0, chatDaily: 0, mcpRpm: 0 },
	},

	stripe: {
		secretKey: process.env.STRIPE_SECRET_KEY || '',
		webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
		priceId: process.env.STRIPE_PRICE_ID || '',
		starterPriceId: process.env.STRIPE_STARTER_PRICE_ID || '',
		proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
		portalConfigId: process.env.STRIPE_PORTAL_CONFIG_ID || '',
		trialDays: parseInt(process.env.STRIPE_TRIAL_DAYS, 10) || 7,
	},

	openpanel: {
		enabled: process.env.ENABLE_OPENPANEL === 'true',
		clientId: process.env.OPENPANEL_CLIENT_ID || '',
		clientSecret: process.env.OPENPANEL_CLIENT_SECRET || '',
		apiUrl: process.env.OPENPANEL_API_URL || '',
	},

	sysadmin: {
		email: process.env.SYSADMIN_EMAIL || '',
		password: process.env.SYSADMIN_PASSWORD || '',
	},

	sentry: {
		dsn: getSentryDsn(),
		clientEnabled: isSentryEnabled(),
	},

	gitEncryptionKey: process.env.GIT_ENCRYPTION_KEY || '',

	screenshotUrl: process.env.SCREENSHOT_URL || '',
	screenshotSecret: process.env.SCREENSHOT_SECRET || 'change-me-screenshot-secret',
};

export default config;
