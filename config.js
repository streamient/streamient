function parseTypesenseConfig() {
	// Only override the connection timeout; let the client use its own sensible
	// defaults for numRetries / retryIntervalSeconds / healthcheckIntervalSeconds.
	const connectionTimeoutSeconds = Number(process.env.TYPESENSE_CONNECTION_TIMEOUT_SECONDS) || 30;
	// Per-product collection prefix (st_/mt_/mg_) so multiple products can share
	// one Typesense cluster. Set TYPESENSE_COLLECTION_PREFIX="" to disable.
	const collectionPrefix = (process.env.TYPESENSE_COLLECTION_PREFIX ?? 'st').trim();
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
				collectionPrefix,
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
		apiKey: process.env.TYPESENSE_API_KEY || 'streamient-dev-key',
		connectionTimeoutSeconds,
		collectionPrefix,
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
	// Hosted (SaaS) hostnames. Local dev: app.s.lan = hosted edition, while bare
	// k.lan is the plain (self-hosted) dev. app.streamient.local is a legacy alias.
	return normalized === 'app.streamient.local'
		|| normalized === 'app.s.lan'
		|| normalized.endsWith('streamient.com');
}

export function isHostedAppUrl(appUrl) {
	try {
		return isHostedHostname(new URL(appUrl).hostname);
	} catch {
		return false;
	}
}

// Per-request hosted detection from the request's Host (or X-Forwarded-Host behind
// a proxy). Lets one dev instance serve a self-hosted host (k.lan) and a hosted
// host (app.s.lan). Falls back to the X-Forwarded-Host header when proxied.
export function resolveRequestHosted(req) {
	if (!req) return false;
	const forwarded = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
	const host = forwarded || req.headers?.host || req.hostname || '';
	const hostname = String(host).split(':')[0];
	return isHostedHostname(hostname);
}

// Integer limit from env with a default; an explicit "0" means unlimited/off,
// so `parseInt(x, 10) || fallback` would be wrong here.
function parseLimitEnv(value, fallback) {
	if (value === undefined || value === null || value === '') return fallback;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
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

function getAppUrlHostname(value) {
	try {
		return new URL(value).hostname;
	} catch {
		return '';
	}
}

const config = {
	env: process.env.NODE_ENV || 'development',
	port: parseInt(process.env.PORT, 10) || 3000,
	mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/streamient?replicaSet=rs0',
	redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
	redisOptions: parseRedisConfig(),
	socketRedis: process.env.SOCKET_REDIS !== 'false' && !!(process.env.REDIS_URL || process.env.REDIS_SENTINEL),
	socketEmitDelay: parseInt(process.env.SOCKET_EMIT_DELAY, 10) || 500,
	sessionSecret: process.env.SESSION_SECRET || 'change-me',
	jwtSecret: process.env.JWT_SECRET || 'change-me',
	appUrl,
	// Deployment-level default (used outside HTTP requests — schedulers, services).
	// Per-request hosted detection (req.isHosted) is derived from the Host header;
	// see resolveRequestHosted / the middleware in app.js.
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
	emailForwardDomain: process.env.EMAIL_FORWARD_DOMAIN || '',
	whiteLabel: {
		assetsDir: process.env.WHITE_LABEL_ASSETS_DIR || 'assets/white-label',
		cnameTarget: process.env.WHITE_LABEL_CNAME_TARGET || getAppUrlHostname(appUrl),
		enforceCustomDomains: process.env.WHITE_LABEL_ENFORCE_CUSTOM_DOMAINS
			? process.env.WHITE_LABEL_ENFORCE_CUSTOM_DOMAINS === 'true'
			: (process.env.NODE_ENV === 'production' && isHostedAppUrl(appUrl)),
		cloudflare: {
			apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
			zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
		},
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
		// Per-provider default model — the fallback when a purpose-specific model
		// (chat/nlSearch/tsConversation) is unset, and the model used for BYO key
		// verification and provider fallback. Override per deployment via env.
		openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
		googleModel: process.env.GOOGLE_MODEL || 'gemini-2.5-flash',
		// Managed (platform-key) model matrix per plan — applies to hosted
		// tenants without a BYO key. BYOK tenants and self-hosted installs keep
		// the deployment-global chatModel/nlSearchModel/tsConversationModel above.
		planModels: {
			free: {
				provider: process.env.FREE_AI_MODEL_PROVIDER || 'google',
				chat: process.env.FREE_CHAT_AI_MODEL || 'gemini-2.5-flash-lite',
				nlSearch: process.env.FREE_NL_SEARCH_MODEL || 'gemini-2.5-flash-lite',
				conversation: process.env.FREE_TS_CONVERSATION_MODEL || 'gemini-2.5-flash-lite',
			},
			pro: {
				provider: process.env.PRO_AI_MODEL_PROVIDER || 'google',
				chat: process.env.PRO_CHAT_AI_MODEL || 'gemini-3-flash',
				nlSearch: process.env.PRO_NL_SEARCH_MODEL || 'gemini-3-flash',
				conversation: process.env.PRO_TS_CONVERSATION_MODEL || 'gemini-3-flash',
			},
		},
	},

	// Daily managed-AI request cap per workspace. 0 = unlimited. Applies only
	// to hosted Free tenants on the platform key — BYOK, Pro, active trials,
	// and self-hosted installs are uncapped. See middleware/rate_limit.js.
	plans: {
		free: { aiDaily: parseLimitEnv(process.env.FREE_AI_DAILY_LIMIT, 50) },
		pro: { aiDaily: 0 },
	},

	// Hard resource limits per plan. 0 = unlimited.
	planLimits: {
		free: { projects: 1, users: 0 },
		pro: { projects: 0, users: 0 },
	},

	stripe: {
		secretKey: process.env.STRIPE_SECRET_KEY || '',
		webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
		proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
		freePriceId: process.env.STRIPE_FREE_PRICE_ID || '',
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

	hyperdx: {
		enabled: !!process.env.HYPERDX_API_KEY,
		apiKey: process.env.HYPERDX_API_KEY || '',
		browserUrl: process.env.HYPERDX_BROWSER_URL || '',
		service: 'streamient',
	},

	gitEncryptionKey: process.env.GIT_ENCRYPTION_KEY || '',

	screenshotUrl: process.env.SCREENSHOT_URL || '',
	screenshotSecret: process.env.SCREENSHOT_SECRET || 'change-me-screenshot-secret',
};

export default config;
