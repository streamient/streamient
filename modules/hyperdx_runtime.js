////////////////////////////////////////////////////////////////////////////////
// HYPERDX RUNTIME
////////////////////////////////////////////////////////////////////////////////

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let _hyperdx = null;

export const isHyperDXEnabled = function(env = process.env) {
	return !!env.HYPERDX_API_KEY;
};

export const initializeHyperDX = function(options = {}) {
	if (_hyperdx) return _hyperdx;

	const env = process.env;

	try {
		const HyperDX = require('@hyperdx/node-opentelemetry');

		const initOptions = {
			apiKey: env.HYPERDX_API_KEY,
			service: options.serviceName || env.OTEL_SERVICE_NAME || 'kumbukum',
		};

		const url = env.HYPERDX_API_URL || env.OTEL_EXPORTER_OTLP_ENDPOINT;
		if (url) initOptions.url = url;

		if (env.HDX_NODE_CONSOLE_CAPTURE === '0') {
			initOptions.consoleCapture = false;
		}

		HyperDX.init(initOptions);
		_hyperdx = HyperDX;
		console.log(`[HyperDX] Initialized service=${initOptions.service}`);
	} catch (error) {
		console.warn('[HyperDX] Failed to initialize:', error.message || String(error));
	}

	return _hyperdx;
};

export const getHyperDX = function() {
	return _hyperdx;
};

export const recordException = function(error) {
	if (!_hyperdx || typeof _hyperdx.recordException !== 'function') return false;
	_hyperdx.recordException(error);
	return true;
};

export const setupExpressErrorHandler = function(app) {
	if (!_hyperdx || typeof _hyperdx.setupExpressErrorHandler !== 'function') return false;
	_hyperdx.setupExpressErrorHandler(app);
	return true;
};

export const setTraceAttributes = function(attributes) {
	if (!_hyperdx || typeof _hyperdx.setTraceAttributes !== 'function') return false;
	_hyperdx.setTraceAttributes(attributes);
	return true;
};

export default {
	isHyperDXEnabled,
	initializeHyperDX,
	getHyperDX,
	recordException,
	setupExpressErrorHandler,
	setTraceAttributes,
};
