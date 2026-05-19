import { getSentryDsn, isSentryEnabled, loadSentry } from './modules/sentry_runtime.js';
import { installOpenObserveConsoleForwarder } from './modules/openobserve_runtime.js';

if (isSentryEnabled()) {
	const [Sentry, { nodeProfilingIntegration }] = await Promise.all([
		loadSentry(),
		import('@sentry/profiling-node'),
	]);

	Sentry.init({
		dsn: getSentryDsn(),
		integrations: [
			nodeProfilingIntegration(),
			// send console.log, console.warn, and console.error calls as logs to Sentry
			Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
		],
		enableLogs: true,
		tracesSampleRate: 1.0,
		profileSessionSampleRate: 1.0,
		profileLifecycle: 'trace',
		sendDefaultPii: true,
	});
}

installOpenObserveConsoleForwarder({
	serviceApp: process.env.KUMBUKUM_APP || process.env.SERVER_MODE || 'web',
});
