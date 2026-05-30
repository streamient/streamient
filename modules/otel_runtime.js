////////////////////////////////////////////////////////////////////////////////
// OPENTELEMETRY RUNTIME
////////////////////////////////////////////////////////////////////////////////

import { createRequire } from 'node:module';
import * as HyperDXRuntime from './hyperdx_runtime.js';

const require = createRequire(import.meta.url);
const noop = () => {};
const noOpSpan = { setAttribute: noop, setStatus: noop, end: noop, recordException: noop, addEvent: noop };

let _initialized = false;
let _initAttempted = false;
let _disabledReason = '';
let _sdk = null;
let _trace = null;
let _context = null;
let _serviceName = '';
let _useHyperDX = false;
let _loggerProvider = null;
let _otelLogger = null;
let _logsInitialized = false;
let _logsDisabledReason = '';

const _isTrue = function(value) {
	return value === true || value === 'true' || value === '1';
};

const _requirePackage = function(packageName) {
	return require(packageName);
};

const _parseOtlpHeaders = function(env = process.env) {
	const value = env.OTEL_EXPORTER_OTLP_HEADERS;
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

export const buildServiceName = function(options = {}) {
	if (process.env.OTEL_SERVICE_NAME) return process.env.OTEL_SERVICE_NAME;

	const serviceApp = options.serviceApp || process.env.KUMBUKUM_APP || process.env.SERVER_MODE || 'web';
	const appInstance = process.env.APP_INSTANCE || 'kumbukum';
	const appLocation = process.env.APP_LOCATION || process.env.KUMBUKUM_APP_LOCATION || 'us';
	const appVersion = process.env.APP_VERSION || '0';
	let serviceName = `${appInstance}-${appLocation}-${serviceApp}-${appVersion}`;

	if (process.env.IS_CUSTOMER === 'true' && process.env.CUSTOMER_NAME) {
		serviceName = `${process.env.CUSTOMER_NAME}-${serviceName}`;
	}

	return serviceName;
};

const _buildResourceAttributes = function(options = {}) {
	const serviceApp = options.serviceApp || process.env.KUMBUKUM_APP || process.env.SERVER_MODE || 'web';
	const appInstance = process.env.APP_INSTANCE || 'kumbukum';
	const appLocation = process.env.APP_LOCATION || process.env.KUMBUKUM_APP_LOCATION || 'us';
	const deploymentEnvironment = `${appInstance}-${appLocation}`;

	return {
		'service.name': _serviceName,
		'service.namespace': deploymentEnvironment,
		'service.version': process.env.OTEL_SERVICE_VERSION || process.env.APP_VERSION || '0',
		'service.location': appLocation,
		'service.app': serviceApp,
		'service.instance': appInstance,
		'service.is_customer': process.env.IS_CUSTOMER === 'true',
		'deployment.environment': deploymentEnvironment,
		...(process.env.IS_CUSTOMER === 'true' && process.env.CUSTOMER_NAME ? { 'service.customer_name': process.env.CUSTOMER_NAME } : {}),
	};
};

const _parseResourceAttributes = function(value) {
	if (!value || typeof value !== 'string') return {};

	return value.split(',').reduce((attributes, pair) => {
		const index = pair.indexOf('=');
		if (index <= 0) return attributes;

		const key = pair.slice(0, index).trim();
		const attributeValue = pair.slice(index + 1).trim();
		if (key) attributes[key] = attributeValue;
		return attributes;
	}, {});
};

const _getInstrumentations = function(getNodeAutoInstrumentations) {
	return [getNodeAutoInstrumentations({
		'@opentelemetry/instrumentation-dns': { enabled: false },
		'@opentelemetry/instrumentation-fs': { enabled: false },
		'@opentelemetry/instrumentation-router': { enabled: false },
	})];
};

const _buildTraceExporter = function() {
	const protocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL || '';
	const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';

	if (protocol === 'http/protobuf' || protocol === 'http/json') {
		const { OTLPTraceExporter } = _requirePackage('@opentelemetry/exporter-trace-otlp-http');
		const options = {};
		if (endpoint) options.url = endpoint;
		const headers = _parseOtlpHeaders();
		if (Object.keys(headers).length > 0) options.headers = headers;
		return new OTLPTraceExporter(options);
	}

	const { OTLPTraceExporter } = _requirePackage('@opentelemetry/exporter-trace-otlp-grpc');
	return new OTLPTraceExporter();
};

const _isFalse = function(value) {
	return value === false || value === 'false' || value === '0';
};

const _buildLogsEndpoint = function() {
	if (process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) return process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;

	const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '';
	if (tracesEndpoint) return tracesEndpoint.replace(/\/traces$/, '/logs');

	const generic = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
	if (generic) return `${generic.replace(/\/+$/, '')}/v1/logs`;

	return '';
};

const _buildResourceFromEnv = function(options = {}) {
	const resources = _requirePackage('@opentelemetry/resources');
	const resourceAttributes = {
		..._buildResourceAttributes(options),
		..._parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES),
	};
	return typeof resources.resourceFromAttributes === 'function'
		? resources.resourceFromAttributes(resourceAttributes)
		: new resources.Resource(resourceAttributes);
};

const _normalizeLogLevel = function(level) {
	const normalized = String(level || 'info').toLowerCase();
	const { SeverityNumber } = _requirePackage('@opentelemetry/api-logs');

	if (normalized === 'trace') return { severityText: 'TRACE', severityNumber: SeverityNumber.TRACE };
	if (normalized === 'debug') return { severityText: 'DEBUG', severityNumber: SeverityNumber.DEBUG };
	if (normalized === 'warn' || normalized === 'warning') return { severityText: 'WARN', severityNumber: SeverityNumber.WARN };
	if (normalized === 'error') return { severityText: 'ERROR', severityNumber: SeverityNumber.ERROR };
	if (normalized === 'fatal') return { severityText: 'FATAL', severityNumber: SeverityNumber.FATAL };
	return { severityText: 'INFO', severityNumber: SeverityNumber.INFO };
};

const _truncateLogValue = function(value) {
	const maxLength = parseInt(process.env.OTEL_LOG_ATTRIBUTE_MAX_LENGTH, 10) || 8192;
	const stringValue = typeof value === 'string' ? value : String(value);
	if (stringValue.length <= maxLength) return stringValue;
	return `${stringValue.slice(0, maxLength)}...`;
};

const _serializeLogAttribute = function(value) {
	if (value === undefined || value === null) return undefined;
	if (typeof value === 'string') return _truncateLogValue(value);
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (value instanceof Date) return value.toISOString();
	if (value instanceof Error) return _truncateLogValue(value.stack || value.message || String(value));

	if (Array.isArray(value)) {
		const values = value.map((item) => _serializeLogAttribute(item)).filter((item) => item !== undefined);
		const keep = values.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');
		return keep ? values : _truncateLogValue(JSON.stringify(values));
	}

	try {
		return _truncateLogValue(JSON.stringify(value));
	} catch {
		return '[unserializable]';
	}
};

const _sanitizeLogAttributes = function(attributes = {}) {
	const sanitized = {};
	Object.entries(attributes || {}).forEach(([key, value]) => {
		if (!key || value === undefined || value === null) return;
		const serialized = _serializeLogAttribute(value);
		if (serialized !== undefined) sanitized[key] = serialized;
	});
	return sanitized;
};

const _initializeLogExporter = function(resource) {
	if (_isFalse(process.env.ENABLE_OTEL_LOGS)) {
		_logsDisabledReason = 'ENABLE_OTEL_LOGS is false';
		return { enabled: false, reason: _logsDisabledReason };
	}

	const endpoint = _buildLogsEndpoint();
	if (!endpoint) {
		_logsDisabledReason = 'no OTLP logs endpoint configured';
		return { enabled: false, reason: _logsDisabledReason };
	}

	try {
		const { LoggerProvider, BatchLogRecordProcessor } = _requirePackage('@opentelemetry/sdk-logs');
		const { OTLPLogExporter } = _requirePackage('@opentelemetry/exporter-logs-otlp-http');
		const headers = _parseOtlpHeaders();
		const exporter = new OTLPLogExporter({
			url: endpoint,
			...(Object.keys(headers).length > 0 ? { headers } : {}),
		});

		_loggerProvider = new LoggerProvider({
			resource,
			processors: [new BatchLogRecordProcessor(exporter)],
		});
		_otelLogger = _loggerProvider.getLogger(_serviceName || 'kumbukum');
		_logsInitialized = true;
		console.log(`[OTEL] Logs initialized service=${_serviceName} endpoint=${endpoint}`);
		return { enabled: true, endpoint };
	} catch (error) {
		_logsDisabledReason = error.message || String(error);
		console.warn('[OTEL] Failed to initialize logs:', _logsDisabledReason);
		return { enabled: false, reason: _logsDisabledReason };
	}
};

export const initializeOpenTelemetry = function(options = {}) {
	if (_initAttempted) {
		return { enabled: _initialized, reason: _disabledReason, service: _serviceName };
	}

	_initAttempted = true;

	if (HyperDXRuntime.isHyperDXEnabled()) {
		process.env.ENABLE_OTEL = 'true';
	}

	if (!_isTrue(process.env.ENABLE_OTEL)) {
		_disabledReason = 'ENABLE_OTEL is not true';
		return { enabled: false, reason: _disabledReason };
	}

	_serviceName = buildServiceName(options);
	process.env.OTEL_SERVICE_NAME = _serviceName;

	try {
		if (HyperDXRuntime.isHyperDXEnabled()) {
			HyperDXRuntime.initializeHyperDX({ serviceName: _serviceName });
			_useHyperDX = !!HyperDXRuntime.getHyperDX();
		}

		const resource = _buildResourceFromEnv(options);

		if (!_useHyperDX) {
			const { NodeSDK } = _requirePackage('@opentelemetry/sdk-node');
			const { getNodeAutoInstrumentations } = _requirePackage('@opentelemetry/auto-instrumentations-node');

			_sdk = new NodeSDK({
				resource,
				traceExporter: _buildTraceExporter(),
				instrumentations: _getInstrumentations(getNodeAutoInstrumentations),
			});

			_sdk.start();
			console.log(`[OTEL] Initialized service=${_serviceName}`);

			// Own OTLP logs pipeline. HyperDX manages its own below.
			_initializeLogExporter(resource);
		}

		const otelApi = _requirePackage('@opentelemetry/api');
		_trace = otelApi.trace;
		_context = otelApi.context;

		// When HyperDX owns the SDK it registers a global LoggerProvider — bridge
		// pino log records to it via the global logs API.
		if (_useHyperDX && !_logsInitialized && !_isFalse(process.env.ENABLE_OTEL_LOGS)) {
			try {
				const logsApi = _requirePackage('@opentelemetry/api-logs');
				if (logsApi?.logs && typeof logsApi.logs.getLogger === 'function') {
					_otelLogger = logsApi.logs.getLogger(_serviceName || 'kumbukum');
					_logsInitialized = true;
					console.log(`[OTEL] Logs initialized via HyperDX logger provider service=${_serviceName}`);
				}
			} catch (error) {
				console.warn('[OTEL] HyperDX log bridge unavailable:', error.message || String(error));
			}
		}

		_initialized = true;
	} catch (error) {
		_disabledReason = error.message || String(error);
		console.warn('[OTEL] Failed to initialize:', _disabledReason);
	}

	return { enabled: _initialized, reason: _disabledReason, service: _serviceName };
};

export const isEnabled = function() {
	return _initialized;
};

export const areLogsEnabled = function() {
	return _logsInitialized;
};

export const emitLogRecord = function(level, body, attributes = {}) {
	if (!_logsInitialized || !_otelLogger) return false;

	try {
		const recordBody = _truncateLogValue(body || '');
		if (!recordBody.trim()) return false;

		const severity = _normalizeLogLevel(level);
		const traceInfo = getCurrentTraceInfo();
		const traceAttributes = {};
		if (traceInfo.traceId) traceAttributes.trace_id = traceInfo.traceId;
		if (traceInfo.spanId) traceAttributes.span_id = traceInfo.spanId;

		_otelLogger.emit({
			severityNumber: severity.severityNumber,
			severityText: severity.severityText,
			body: recordBody,
			attributes: _sanitizeLogAttributes({ ...traceAttributes, ...attributes }),
		});
		return true;
	} catch {
		return false;
	}
};

export const recordException = function(error) {
	if (_useHyperDX && HyperDXRuntime.recordException(error)) return true;

	if (!_trace || !_context) return false;

	const currentSpan = _trace.getSpan(_context.active());
	if (!currentSpan || typeof currentSpan.recordException !== 'function') return false;

	currentSpan.recordException(error);
	currentSpan.setStatus({ code: 2, message: error && error.message ? error.message : String(error) });
	return true;
};

export const setupExpressErrorHandler = function(app) {
	if (!app || typeof app.use !== 'function') return false;

	if (_useHyperDX && HyperDXRuntime.setupExpressErrorHandler(app)) return true;

	app.use(function(error, request, response, next) {
		recordException(error);
		next(error);
	});

	return true;
};

export const createCustomSpan = function(name, fn, attributes = {}) {
	if (!_trace || !_context) {
		return fn(noOpSpan);
	}

	const tracer = _trace.getTracer('kumbukum-custom');
	const span = tracer.startSpan(name, { attributes });
	const ctx = _trace.setSpan(_context.active(), span);

	try {
		const result = _context.with(ctx, () => fn(span));
		if (result && typeof result.then === 'function') {
			return result.then((value) => {
				span.setStatus({ code: 1 });
				span.end();
				return value;
			}).catch((error) => {
				span.recordException(error);
				span.setStatus({ code: 2, message: error.message });
				span.end();
				throw error;
			});
		}

		span.setStatus({ code: 1 });
		span.end();
		return result;
	} catch (error) {
		span.recordException(error);
		span.setStatus({ code: 2, message: error.message });
		span.end();
		throw error;
	}
};

export const getCurrentTraceInfo = function() {
	if (!_trace || !_context) return { traceId: null, spanId: null };

	const currentSpan = _trace.getSpan(_context.active());
	if (!currentSpan) return { traceId: null, spanId: null };

	const spanContext = currentSpan.spanContext();
	return { traceId: spanContext.traceId, spanId: spanContext.spanId };
};

export const setTraceAttributes = function(attributes) {
	if (_useHyperDX) return HyperDXRuntime.setTraceAttributes(attributes);

	if (!_trace || !_context) return false;
	const currentSpan = _trace.getSpan(_context.active());
	if (!currentSpan || typeof currentSpan.setAttributes !== 'function') return false;
	currentSpan.setAttributes(attributes);
	return true;
};

export const shutdown = function() {
	const tasks = [];
	if (_loggerProvider && typeof _loggerProvider.shutdown === 'function') {
		tasks.push(_loggerProvider.shutdown().catch((error) => {
			console.warn('[OTEL] Logs shutdown error:', error.message || String(error));
		}));
	}
	if (_sdk && typeof _sdk.shutdown === 'function') {
		tasks.push(_sdk.shutdown().catch((error) => {
			console.warn('[OTEL] Shutdown completed with exporter error:', error.message || String(error));
		}));
	}
	return Promise.all(tasks);
};

export const createChildSpan = createCustomSpan;

export default {
	buildServiceName,
	initializeOpenTelemetry,
	isEnabled,
	areLogsEnabled,
	emitLogRecord,
	setupExpressErrorHandler,
	recordException,
	createCustomSpan,
	createChildSpan,
	getCurrentTraceInfo,
	setTraceAttributes,
	shutdown,
};
