////////////////////////////////////////////////////////////////////////////////
// OPENTELEMETRY RUNTIME
////////////////////////////////////////////////////////////////////////////////

import { createRequire } from 'node:module';
import { configureOpenObserveEnvironment, getOpenObserveOtelHeaders } from './openobserve_runtime.js';
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

const _isTrue = function(value) {
	return value === true || value === 'true' || value === '1';
};

const _requirePackage = function(packageName) {
	return require(packageName);
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
		const headers = getOpenObserveOtelHeaders();
		if (Object.keys(headers).length > 0) options.headers = headers;
		return new OTLPTraceExporter(options);
	}

	const { OTLPTraceExporter } = _requirePackage('@opentelemetry/exporter-trace-otlp-grpc');
	return new OTLPTraceExporter();
};

export const initializeOpenTelemetry = function(options = {}) {
	if (_initAttempted) {
		return { enabled: _initialized, reason: _disabledReason, service: _serviceName };
	}

	_initAttempted = true;
	configureOpenObserveEnvironment(options);

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

		if (!_useHyperDX) {
			const { NodeSDK } = _requirePackage('@opentelemetry/sdk-node');
			const { getNodeAutoInstrumentations } = _requirePackage('@opentelemetry/auto-instrumentations-node');
			const resources = _requirePackage('@opentelemetry/resources');
			const resourceAttributes = {
				..._buildResourceAttributes(options),
				..._parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES),
			};
			const resource = typeof resources.resourceFromAttributes === 'function' ? resources.resourceFromAttributes(resourceAttributes) : new resources.Resource(resourceAttributes);

			_sdk = new NodeSDK({
				resource,
				traceExporter: _buildTraceExporter(),
				instrumentations: _getInstrumentations(getNodeAutoInstrumentations),
			});

			_sdk.start();
			console.log(`[OTEL] Initialized service=${_serviceName}`);
		}

		const otelApi = _requirePackage('@opentelemetry/api');
		_trace = otelApi.trace;
		_context = otelApi.context;
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
	if (!_sdk || typeof _sdk.shutdown !== 'function') return Promise.resolve();
	return _sdk.shutdown().catch((error) => {
		console.warn('[OTEL] Shutdown completed with exporter error:', error.message || String(error));
	});
};

export const createChildSpan = createCustomSpan;

export default {
	buildServiceName,
	initializeOpenTelemetry,
	isEnabled,
	setupExpressErrorHandler,
	recordException,
	createCustomSpan,
	createChildSpan,
	getCurrentTraceInfo,
	setTraceAttributes,
	shutdown,
};
