////////////////////////////////////////////////////////////////////////////////
// DECLARE ENVIRONMENT VARS
// SOURCES INTO APP.JS
////////////////////////////////////////////////////////////////////////////////

// REMEMBER THAT VALUES ARE ALWAYS STRINGS !!!


console.log('--- Loading environment variables ---')

process.env.CRAWLEE_PERSIST_STORAGE = 'false';

// General warning when run in desktop mode
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
// AWS keepalive option without a custom agent library
process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = '1';

// OpenTelemetry
process.env.ENABLE_OTEL = process.env.ENABLE_OTEL === 'true' || process.env.ENABLE_OTEL === '1' ? 'true' : 'false';
process.env.HDX_STARTUP_LOGS = 'false';
