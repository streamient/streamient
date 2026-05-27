import { installOpenObserveConsoleForwarder } from './modules/openobserve_runtime.js';

installOpenObserveConsoleForwarder({
	serviceApp: process.env.KUMBUKUM_APP || process.env.SERVER_MODE || 'web',
});
