////////////////////////////////////////////////////////////////////////////////
// OPENTELEMETRY TRACING
////////////////////////////////////////////////////////////////////////////////

import './modules/process_env.js';
import * as OtelRuntime from './modules/otel_runtime.js';

OtelRuntime.initializeOpenTelemetry({
	serviceApp: process.env.STREAMIENT_APP || process.env.KUMBUKUM_APP || process.env.SERVER_MODE || 'web',
});

export const createCustomSpan = OtelRuntime.createCustomSpan;
export const createChildSpan = OtelRuntime.createChildSpan;
export const getCurrentTraceInfo = OtelRuntime.getCurrentTraceInfo;
export const recordException = OtelRuntime.recordException;
export const shutdown = OtelRuntime.shutdown;

export default {
	createCustomSpan,
	createChildSpan,
	getCurrentTraceInfo,
	recordException,
	shutdown,
};
