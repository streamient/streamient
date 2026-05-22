import { getSentryDsn, isSentryEnabled } from './modules/sentry_runtime.js';
import { readOpenObserveConfig } from './modules/openobserve_runtime.js';

function parseTypesenseConfig() {
	// Only override the connection timeout; let the client use its own sensible
	// defaults for numRetries / retryIntervalSeconds / healthcheckIntervalSeconds.
	const connectionTimeoutSeconds = Number(process.env.TYPESENSE_CONNECTION_TIMEOUT_SECONDS) || 30;
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
				connectionTimeoutSeconds,
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
		connectionTimeoutSeconds,
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

export function isHostedHostname(hostname) {
	if (!hostname) return false;
	const normalized = hostname.toLowerCase();
	return normalized === 'app.kumbukum.local' || normalized.endsWith('kumbukum.com');
}

export function isHostedAppUrl(appUrl) {
	try {
		return isHostedHostname(new URL(appUrl).hostname);
	} catch {
		return false;
	}
}

export function parseSmtpServersFromEnv(env = process.env) {
	const defaultFrom = env.SMTP_FROM || 'noreply@localhost';
	const serversEnv = (env.SMTP_SERVERS || '').trim();
	if (serversEnv) {
		try {
			const parsed = JSON.parse(serversEnv);
			if (!Array.isArray(parsed)) {
				throw new Error('SMTP_SERVERS must be a JSON array');
			}
			return parsed
				.map((server, index) => {
					if (!server.host) {
						throw new Error(`SMTP_SERVERS[${index}].host is required`);
					}
					const port = parseInt(server.port, 10) || 587;
					return {
						name: server.name || `smtp-${index + 1}`,
						host: server.host,
						port,
						secure: server.secure !== undefined ? Boolean(server.secure) : port === 465,
						user: server.user || '',
						pass: server.pass || '',
						from: server.from || defaultFrom,
					};
				})
				.filter((server) => server.host);
		} catch (err) {
			console.error('Invalid SMTP_SERVERS JSON:', err.message);
			console.error('SMTP_SERVERS raw value:', JSON.stringify(serversEnv));
			process.exit(1);
		}
	}

	if (!env.SMTP_HOST) return [];
	const port = parseInt(env.SMTP_PORT, 10) || 587;
	return [{
		name: 'smtp-1',
		host: env.SMTP_HOST,
		port,
		secure: port === 465,
		user: env.SMTP_USER || '',
		pass: env.SMTP_PASS || '',
		from: defaultFrom,
	}];
}

const smtpServers = parseSmtpServersFromEnv();
const primarySmtp = smtpServers[0] || {};
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const openobserveConfig = readOpenObserveConfig();

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
	appUrl,
	isHosted: isHostedAppUrl(appUrl),
	mcpBaseUrl: (process.env.MCP_BASE_URL || 'http://localhost:3002').replace(/\/$/, ''),
	wsUrl: process.env.WS_URL || '',

	typesense: parseTypesenseConfig(),

	smtp: {
		host: primarySmtp.host || '',
		port: primarySmtp.port || 587,
		user: primarySmtp.user || '',
		pass: primarySmtp.pass || '',
		from: primarySmtp.from || process.env.SMTP_FROM || 'noreply@localhost',
		servers: smtpServers,
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

	openobserve: {
		enabled: openobserveConfig.enabled,
		rumEnabled: openobserveConfig.rumEnabled,
		browserLogsEnabled: openobserveConfig.browserLogsEnabled,
		applicationId: openobserveConfig.applicationId,
		clientToken: openobserveConfig.clientToken,
		site: openobserveConfig.rumSite,
		organizationIdentifier: openobserveConfig.organization,
		service: openobserveConfig.service,
		env: openobserveConfig.env,
		version: openobserveConfig.version,
		apiVersion: openobserveConfig.apiVersion,
		insecureHTTP: openobserveConfig.insecureHttp,
		sessionReplayEnabled: openobserveConfig.sessionReplayEnabled,
		defaultPrivacyLevel: process.env.OPENOBSERVE_RUM_PRIVACY_LEVEL || 'mask-user-input',
	},

	sysadmin: {
		email: process.env.SYSADMIN_EMAIL || '',
		password: process.env.SYSADMIN_PASSWORD || '',
	},

	hyperdx: {
		enabled: !!process.env.HYPERDX_API_KEY,
		apiKey: process.env.HYPERDX_API_KEY || '',
		browserUrl: process.env.HYPERDX_BROWSER_URL || '',
		service: 'kumbukum',
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
