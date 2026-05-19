////////////////////////////////////////////////////////////////////////////////
// OPENOBSERVE RUNTIME
////////////////////////////////////////////////////////////////////////////////

const _isTrue = function(value) {
	return value === true || value === 'true' || value === '1';
};

const _isFalse = function(value) {
	return value === false || value === 'false' || value === '0';
};

const _trimSlash = function(value) {
	return String(value || '').replace(/\/+$/, '');
};

const _toRumSite = function(value) {
	return _trimSlash(value).replace(/^https?:\/\//, '');
};

const _buildBasicAuthHeader = function(env = process.env) {
	if (env.OPENOBSERVE_AUTH_HEADER) return env.OPENOBSERVE_AUTH_HEADER;
	if (env.OPENOBSERVE_TOKEN) {
		if (/^(basic|bearer)\s+/i.test(env.OPENOBSERVE_TOKEN)) return env.OPENOBSERVE_TOKEN;
		return `Basic ${env.OPENOBSERVE_TOKEN}`;
	}

	const user = env.OPENOBSERVE_USER || env.ZO_ROOT_USER_EMAIL || '';
	const pass = env.OPENOBSERVE_PASSWORD || env.ZO_ROOT_USER_PASSWORD || '';
	if (!user || !pass) return '';

	return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
};

const _parseHeaders = function(value) {
	if (!value || typeof value !== 'string') return {};

	return value.split(',').reduce((headers, pair) => {
		const index = pair.indexOf('=');
		if (index <= 0) return headers;
		const key = pair.slice(0, index).trim();
		const headerValue = decodeURIComponent(pair.slice(index + 1).trim());
		if (key) headers[key] = headerValue;
		return headers;
	}, {});
};

export const readOpenObserveConfig = function(env = process.env) {
	const enabled = _isTrue(env.ENABLE_OPENOBSERVE);
	const serverUrl = _trimSlash(env.OPENOBSERVE_URL || env.OPENOBSERVE_ENDPOINT || 'http://openobserve:5080');
	const publicUrl = _trimSlash(env.OPENOBSERVE_PUBLIC_URL || env.OPENOBSERVE_RUM_URL || serverUrl);
	const organization = env.OPENOBSERVE_ORGANIZATION || env.OPENOBSERVE_ORG || 'default';
	const service = env.OPENOBSERVE_SERVICE || env.OTEL_SERVICE_NAME || env.KUMBUKUM_APP || env.SERVER_MODE || 'web';
	const version = env.OPENOBSERVE_VERSION || env.APP_VERSION || '0';
	const authHeader = _buildBasicAuthHeader(env);
	const clientToken = env.OPENOBSERVE_CLIENT_TOKEN || env.OPENOBSERVE_RUM_CLIENT_TOKEN || '';

	return {
		enabled,
		serverUrl,
		publicUrl,
		organization,
		stream: env.OPENOBSERVE_LOG_STREAM || 'kumbukum_logs',
		service,
		env: env.OPENOBSERVE_ENV || env.NODE_ENV || 'development',
		version,
		apiVersion: env.OPENOBSERVE_API_VERSION || 'v1',
		authHeader,
		clientToken,
		applicationId: env.OPENOBSERVE_APPLICATION_ID || 'kumbukum-web',
		rumSite: _toRumSite(env.OPENOBSERVE_RUM_SITE || publicUrl),
		rumEnabled: enabled && !_isFalse(env.OPENOBSERVE_RUM_ENABLED) && !!clientToken,
		browserLogsEnabled: enabled && !_isFalse(env.OPENOBSERVE_BROWSER_LOGS_ENABLED) && !!clientToken,
		serverLogsEnabled: enabled && !_isFalse(env.OPENOBSERVE_SERVER_LOGS_ENABLED) && !!authHeader,
		sessionReplayEnabled: enabled && _isTrue(env.OPENOBSERVE_SESSION_REPLAY),
		insecureHttp: (env.OPENOBSERVE_INSECURE_HTTP !== undefined)
			? _isTrue(env.OPENOBSERVE_INSECURE_HTTP)
			: publicUrl.startsWith('http://'),
	};
};

export const configureOpenObserveEnvironment = function(options = {}, env = process.env) {
	const config = readOpenObserveConfig(env);
	if (!config.enabled) return config;

	const serviceApp = options.serviceApp || env.KUMBUKUM_APP || env.SERVER_MODE || 'web';
	env.ENABLE_OTEL = 'true';
	env.OTEL_TRACES_EXPORTER = env.OTEL_TRACES_EXPORTER || 'otlp';
	env.OTEL_EXPORTER_OTLP_PROTOCOL = env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http/protobuf';
	env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || `${config.serverUrl}/api/${config.organization}/traces`;
	env.OTEL_SERVICE_NAME = env.OTEL_SERVICE_NAME || config.service || serviceApp;

	if (config.authHeader && !env.OTEL_EXPORTER_OTLP_HEADERS) {
		env.OTEL_EXPORTER_OTLP_HEADERS = `Authorization=${encodeURIComponent(config.authHeader)}`;
	}

	return readOpenObserveConfig(env);
};

export const getOpenObserveOtelHeaders = function(env = process.env) {
	return _parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);
};

const _stringifyArg = function(arg) {
	if (arg instanceof Error) {
		return {
			name: arg.name,
			message: arg.message,
			stack: arg.stack,
		};
	}
	if (typeof arg === 'string') return arg;
	try {
		return JSON.stringify(arg);
	} catch {
		return String(arg);
	}
};

export const installOpenObserveConsoleForwarder = function(options = {}) {
	const config = readOpenObserveConfig();
	if (!config.serverLogsEnabled) return { enabled: false, reason: 'OpenObserve server logs disabled or missing auth' };

	const originalConsole = {
		log: console.log.bind(console),
		info: console.info.bind(console),
		warn: console.warn.bind(console),
		error: console.error.bind(console),
	};
	const queue = [];
	const maxQueue = parseInt(process.env.OPENOBSERVE_LOG_QUEUE_SIZE, 10) || 1000;
	const flushInterval = parseInt(process.env.OPENOBSERVE_LOG_FLUSH_INTERVAL, 10) || 5000;
	const serviceApp = options.serviceApp || process.env.KUMBUKUM_APP || process.env.SERVER_MODE || 'web';
	let flushing = false;

	const enqueue = function(level, args) {
		if (queue.length >= maxQueue) queue.shift();
		queue.push({
			_timestamp: new Date().toISOString(),
			level,
			message: args.map(_stringifyArg).join(' '),
			args: args.map(_stringifyArg),
			service: config.service,
			service_app: serviceApp,
			service_version: config.version,
			deployment_environment: `${process.env.APP_INSTANCE || 'kumbukum'}-${process.env.APP_LOCATION || process.env.KUMBUKUM_APP_LOCATION || 'us'}`,
			node_env: process.env.NODE_ENV || 'development',
			pid: process.pid,
		});
	};

	const flush = async function() {
		if (flushing || queue.length === 0) return;
		flushing = true;
		const batch = queue.splice(0, 100);
		try {
			const response = await fetch(`${config.serverUrl}/api/${config.organization}/${config.stream}/_json`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: config.authHeader,
				},
				body: JSON.stringify(batch),
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
		} catch (error) {
			queue.unshift(...batch);
			if (queue.length > maxQueue) queue.splice(0, queue.length - maxQueue);
			originalConsole.warn('[OpenObserve] log flush failed:', error.message || String(error));
		} finally {
			flushing = false;
		}
	};

	for (const level of Object.keys(originalConsole)) {
		console[level] = function(...args) {
			originalConsole[level](...args);
			enqueue(level, args);
		};
	}

	const timer = setInterval(flush, flushInterval);
	timer.unref?.();
	process.once('beforeExit', () => {
		if (queue.length > 0) flush();
	});

	originalConsole.log(`[OpenObserve] Console forwarding enabled stream=${config.stream}`);
	return { enabled: true, flush };
};
