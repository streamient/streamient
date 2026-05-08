const _falseValues = new Set(['false', '0', 'no', 'off']);

let _sentry = null;
let _loadPromise = null;

const _isFalse = function(value) {
	if (value === false) return true;
	if (typeof value !== 'string') return false;
	return _falseValues.has(value.trim().toLowerCase());
};

export const getSentryDsn = function() {
	return (process.env.SENTRY_DSN || '').trim();
};

export const isSentryDisabled = function() {
	return _isFalse(process.env.ENABLE_SENTRY) || _isFalse(process.env.SENTRY_ENABLED);
};

export const isSentryEnabled = function() {
	return !isSentryDisabled() && getSentryDsn().length > 0;
};

export const loadSentry = async function() {
	if (!isSentryEnabled()) return null;
	if (_sentry) return _sentry;

	if (!_loadPromise) {
		_loadPromise = import('@sentry/node').then((module) => {
			_sentry = module;
			return _sentry;
		});
	}

	return _loadPromise;
};

export const setupExpressErrorHandler = function(app) {
	if (!_sentry || typeof _sentry.setupExpressErrorHandler !== 'function') return false;
	_sentry.setupExpressErrorHandler(app);
	return true;
};
