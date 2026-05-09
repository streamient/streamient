////////////////////////////////////////////////////////////////////////////////
// OPENTELEMETRY TRACING
////////////////////////////////////////////////////////////////////////////////

import * as OtelRuntime from '../../modules/otel_runtime.js';

OtelRuntime.initializeOpenTelemetry({
	serviceApp: process.env.KUMBUKUM_APP || 'mcp',
});

export const createCustomSpan = OtelRuntime.createCustomSpan;
export const createChildSpan = OtelRuntime.createChildSpan;
export const getCurrentTraceInfo = OtelRuntime.getCurrentTraceInfo;
export const recordException = OtelRuntime.recordException;
export const setupExpressErrorHandler = OtelRuntime.setupExpressErrorHandler;
export const shutdown = OtelRuntime.shutdown;

export default {
	createCustomSpan,
	createChildSpan,
	getCurrentTraceInfo,
	recordException,
	setupExpressErrorHandler,
	shutdown,
};
