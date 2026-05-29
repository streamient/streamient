////////////////////////////////////////////////////////////////////////////////
// PINO TO OPENTELEMETRY LOG BRIDGE
////////////////////////////////////////////////////////////////////////////////

import util from 'node:util';
import * as OtelRuntime from './otel_runtime.js';

const PINO_LEVELS = {
	10: 'trace',
	20: 'debug',
	30: 'info',
	40: 'warn',
	50: 'error',
	60: 'fatal',
};

const _formatValue = function(value) {
	if (value instanceof Error) return value.stack || value.message || String(value);
	if (typeof value === 'string') return value;
	if (typeof value === 'object' && value !== null) {
		try {
			return JSON.stringify(value);
		} catch {
			return '[unserializable]';
		}
	}
	return String(value);
};

const _buildLogRecord = function(inputArgs = []) {
	if (!inputArgs.length) return { body: '', attributes: {} };

	const firstArg = inputArgs[0];

	if (firstArg && typeof firstArg === 'object' && !(firstArg instanceof Error)) {
		const messageArgs = inputArgs.slice(1);
		const body = messageArgs.length ? util.format(...messageArgs) : firstArg.msg || _formatValue(firstArg);
		return {
			body: String(body || ''),
			attributes: firstArg,
		};
	}

	return {
		body: util.format(...inputArgs.map(_formatValue)),
		attributes: {},
	};
};

// Find the first Error instance in the log arguments so it can be attached to the
// current span as an exception event. We walk both top-level args and shallow object
// properties because handlers commonly call `log.error('msg:', err)` or `log.error({ err })`.
const _findError = function(inputArgs = []) {
	for (const arg of inputArgs) {
		if (arg instanceof Error) return arg;
		if (arg && typeof arg === 'object') {
			for (const key of ['err', 'error', 'exception', 'cause']) {
				if (arg[key] instanceof Error) return arg[key];
			}
		}
	}
	return null;
};

export const emitFromPinoArgs = function(inputArgs = [], level, source = 'pino') {
	const pinoLevel = PINO_LEVELS[level] || 'info';

	// Promote error/fatal log calls to span exceptions so they appear in the
	// HyperDX/OpenObserve "Errors" view alongside framework-captured exceptions.
	// Without this, every `catch (err) { log.error(err) }` would only appear as a
	// log record, never as a recorded exception on the trace.
	if (pinoLevel === 'error' || pinoLevel === 'fatal') {
		const captured = _findError(inputArgs);
		if (captured) {
			OtelRuntime.recordException(captured);
		} else {
			const logRecord = _buildLogRecord(inputArgs);
			if (logRecord.body) {
				const syntheticError = new Error(logRecord.body);
				syntheticError.name = 'LoggedError';
				OtelRuntime.recordException(syntheticError);
			}
		}
	}

	if (!OtelRuntime.areLogsEnabled()) return false;

	const logRecord = _buildLogRecord(inputArgs);
	return OtelRuntime.emitLogRecord(pinoLevel, logRecord.body, {
		'log.source': source,
		...logRecord.attributes,
	});
};

export const buildPinoOtelHooks = function(source = 'pino') {
	return {
		logMethod(inputArgs, method, level) {
			emitFromPinoArgs(inputArgs, level, source);
			return method.apply(this, inputArgs);
		},
	};
};

export default {
	buildPinoOtelHooks,
	emitFromPinoArgs,
};
