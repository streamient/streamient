////////////////////////////////////////////////////////////////////////////////
// STRUCTURED LOGGER (pino) WITH OTEL TRACE CORRELATION
//
// One pino base logger. Human-readable (pino-pretty) in development, JSON in
// production. Every record is bridged into the OpenTelemetry Logs pipeline via
// the logMethod hook (see pino_otel_hook.js), which also promotes error/fatal
// logs to span exceptions and attaches the active trace_id/span_id.
//
// Usage:
//   import { createLogger } from '../modules/logger.js';
//   const log = createLogger('email-ingest');
//   log.info({ email_id: id, project_id: projectId }, 'ingested email');
//
// Mode control:
//   LOG_LEVEL        log level (default: info in production, debug otherwise)
//   PINO_DEV_LOGS    force pretty output
//   USE_PINO_LOGGER  set 'true' to force JSON output (e.g. in dev)
////////////////////////////////////////////////////////////////////////////////

import pino from 'pino';
import pinoHttp from 'pino-http';
import { buildServiceName, getCurrentTraceInfo } from './otel_runtime.js';
import { buildPinoOtelHooks } from './pino_otel_hook.js';

const isProduction = process.env.NODE_ENV === 'production';
const forceJson = process.env.USE_PINO_LOGGER === 'true';
const usePretty = process.env.PINO_DEV_LOGS === 'true' || (!isProduction && !forceJson);

const serviceApp = process.env.KUMBUKUM_APP || process.env.SERVER_MODE || 'web';
const appInstance = process.env.APP_INSTANCE || 'kumbukum';
const appLocation = process.env.APP_LOCATION || process.env.KUMBUKUM_APP_LOCATION || 'us';

const baseConfig = {
	level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
	base: {
		service: buildServiceName({ serviceApp }),
		service_app: serviceApp,
		deployment_environment: `${appInstance}-${appLocation}`,
		version: process.env.OTEL_SERVICE_VERSION || process.env.APP_VERSION || '0',
		instance: appInstance,
		location: appLocation,
		pid: process.pid,
	},
	hooks: buildPinoOtelHooks('pino'),
	// Stamp the active trace_id/span_id onto every stdout/stderr record so logs
	// scraped from container output (not just the OTLP log stream) are
	// trace-correlated. Returns {} when there is no active span (e.g. background
	// work not wrapped in a custom span), so the fields are simply omitted.
	mixin() {
		const { traceId, spanId } = getCurrentTraceInfo();
		return traceId ? { trace_id: traceId, span_id: spanId } : {};
	},
};

// The MCP server uses stdout as its stdio protocol channel — logging there would
// corrupt the protocol. Route its logs (and anything that opts in) to stderr.
const useStderr = process.env.LOG_STDERR === 'true' || serviceApp === 'mcp';
const STDERR_FD = 2;

let basePino;
if (usePretty) {
	basePino = pino(baseConfig, pino.transport({
		target: 'pino-pretty',
		options: {
			destination: useStderr ? STDERR_FD : 1,
			colorize: true,
			translateTime: 'HH:MM:ss.l',
			ignore: 'pid,hostname,service,service_app,deployment_environment,version,instance,location',
			singleLine: false,
			messageKey: 'msg',
		},
	}));
} else {
	basePino = pino(baseConfig, useStderr ? pino.destination(STDERR_FD) : undefined);
}

// Component-scoped child logger. The component name appears as a structured
// field on every record (and replaces the old `[PREFIX]` console convention).
export const createLogger = function(component) {
	return component ? basePino.child({ component }) : basePino;
};

// Express HTTP request logging via pino-http. Emits one structured record per
// request with method/route/status/duration; trace correlation is added by the
// OTEL hook at emit time. Static/health/socket paths are skipped to cut noise.
export const getPinoMiddleware = function() {
	return pinoHttp({
		logger: basePino.child({ component: 'http' }),
		autoLogging: {
			ignore: function(req) {
				const url = req.url || '';
				return url === '/favicon.ico'
					|| url.startsWith('/health')
					|| url.startsWith('/static')
					|| url.startsWith('/docs')
					|| url.startsWith('/socket.io/');
			},
		},
		customLogLevel: function(req, res, err) {
			if (err || res.statusCode >= 500) return 'error';
			if (res.statusCode >= 400) return 'warn';
			return 'info';
		},
		customProps: function(req) {
			const props = {};
			if (req.host_id) props.host_id = req.host_id;
			if (req.tenantId) props.tenant_id = req.tenantId;
			if (req.session?.userId) props.user_id = req.session.userId;
			return props;
		},
		serializers: {
			req: function(req) {
				return { method: req.method, url: req.url, host: req.headers?.host };
			},
			res: function(res) {
				return { statusCode: res.statusCode };
			},
		},
		customSuccessMessage: function(req, res) {
			return `${req.method} ${req.url} ${res.statusCode}`;
		},
		customErrorMessage: function(req, res, err) {
			return `${req.method} ${req.url} - ${err?.message || res.statusCode}`;
		},
	});
};

export const info = (...args) => basePino.info(...args);
export const warn = (...args) => basePino.warn(...args);
export const error = (...args) => basePino.error(...args);
export const debug = (...args) => basePino.debug(...args);

export const _pino = basePino;

export default {
	createLogger,
	getPinoMiddleware,
	info,
	warn,
	error,
	debug,
	_pino: basePino,
};
