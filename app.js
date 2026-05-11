import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './modules/process_env.js';
import config from './config.js';
import { connectDB } from './db.js';
import { setupSocketIO } from './modules/socket.js';
import { initTypesense } from './modules/typesense.js';
import { initRedis } from './modules/redis.js';
import { resolveTenant } from './modules/tenancy.js';
import { installIconLocals } from './modules/icons.js';

import { createApiLimiter } from './middleware/rate_limit.js';
import { verifyScreenshotSignature, resolveScreenshotPath } from './modules/screenshot.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import * as OtelRuntime from './modules/otel_runtime.js';
import { loadSentry, setupExpressErrorHandler as setupSentryExpressErrorHandler } from './modules/sentry_runtime.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import apiRoutes from './routes/api.js';
import webRoutes from './routes/web.js';
import adminRoutes from './routes/admin.js';
import billingRoutes from './routes/billing.js';
import healthRoutes from './routes/health.js';
import sentryTunnelRoutes from './routes/sentry_tunnel.js';
import importRoutes from './routes/import.js';
import { backfillEmailTriageState } from './services/email_ingest_service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_MODE = process.env.SERVER_MODE || 'app';
await loadSentry();

const app = express();

// Health check — mounted before everything so monitoring tools need no auth/session
app.use('/health', healthRoutes);

var _90_days_in_ms = 90 * 24 * 60 * 60 * 1000;

const sessionMiddleware = session({
	'secret': config.sessionSecret,
	'resave': true,
	'saveUninitialized': false,
	'proxy': process.env.NODE_ENV === 'production' ? true : false,
	'store': MongoStore.create({
		'mongoUrl': config.mongoUri,
		'collectionName': 'sessions',
		'ttl': _90_days_in_ms,
		'createTTLIndex': true,
	}),
	'cookie': {
		'maxAge': _90_days_in_ms,
		'sameSite': process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
		'secure': process.env.NODE_ENV === 'production' ? true : false 
	},
});

if (SERVER_MODE === 'app') {

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Make OpenPanel config available to all templates
app.locals.openpanel = config.openpanel;
app.locals.sentry = config.sentry;
installIconLocals(app);

// Cache-busting build ID — embedded in static asset paths: /static/v-{hash}/...
try {
    app.locals.v = fs.readFileSync(path.join(__dirname, 'public', 'build-id'), 'utf8').trim();
} catch {
    app.locals.v = Date.now().toString(36);
}

// Public import routes parse their own raw payloads before the global JSON middleware.
app.use('/import', importRoutes);

// Stripe webhook and Sentry tunnel need raw body — skip express.json() for these paths
app.use((req, res, next) => {
    if (req.originalUrl === '/billing/webhook' || req.originalUrl === '/sentun') return next();
    express.json({ limit: '25mb' })(req, res, next);
});
app.use((req, res, next) => {
    if (req.originalUrl === '/billing/webhook' || req.originalUrl === '/sentun') return next();
    express.urlencoded({ extended: true, limit: '25mb' })(req, res, next);
});

// Sentry envelope tunnel — mounted before session (no auth needed)
app.use('/sentun', sentryTunnelRoutes);
app.use(cookieParser());

// --- Static file cache control ---
var _font_extensions = /\.(woff|woff2|ttf|otf|eot)$/i;
var _static_cache_control = process.env.NODE_ENV === 'production'
    ? {
        index: false,
        maxAge: '7d',
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            if (_font_extensions.test(filePath)) {
                res.setHeader('Access-Control-Allow-Origin', '*');
            }
        },
    }
    : {
        index: false,
        maxAge: '0',
        etag: false,
        lastModified: false,
        setHeaders: (res, filePath) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            if (_font_extensions.test(filePath)) {
                res.setHeader('Access-Control-Allow-Origin', '*');
            }
        },
    };

// --- Docs site (VitePress built output) ---
var _docs_dist = path.join(__dirname, 'docs-dist');
if (fs.existsSync(_docs_dist)) {
    app.use('/docs', express.static(_docs_dist, { ..._static_cache_control, extensions: ['html'], index: 'index.html' }));
    app.use('/docs', (req, res) => {
        res.sendFile(path.join(_docs_dist, '404.html'));
    });
}

// Strip version segment from static paths: /static/v-abc123/js/app.js → /static/js/app.js
app.use('/static', (req, res, next) => {
    req.url = req.url.replace(/^\/v-[a-z0-9]+/i, '');
    next();
});
app.use('/static', express.static(path.join(__dirname, 'public'), _static_cache_control));

// No cache for dynamic content
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.set('Cloudflare-CDN-Cache-Control', 'no-store');
    res.set('CDN-Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.removeHeader('ETag');
    next();
});

app.use(sessionMiddleware);

app.use(resolveTenant);

// Auth routes mounted at root (/login, /signup, /logout, etc.)
app.use('/api/doc', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
	swaggerOptions: {
		persistAuthorization: true,
	},
}));

app.use('/', oauthRoutes);

// Screenshot serving — signed URLs, no auth middleware required
app.get('/api/v1/screenshots/:filename', (req, res) => {
	const { filename } = req.params;
	const { expires, sig } = req.query;

	if (!verifyScreenshotSignature(filename, expires, sig)) {
		return res.status(403).json({ error: 'Invalid or expired signature' });
	}

	const filePath = resolveScreenshotPath(filename);
	if (!filePath) return res.status(400).json({ error: 'Invalid filename' });

	res.sendFile(filePath, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=3600',
		},
	}, (err) => {
		if (err && !res.headersSent) res.status(404).json({ error: 'Screenshot not found' });
	});
});

app.use('/', authRoutes);
app.use('/', billingRoutes);
app.use('/admin', adminRoutes);
app.use('/api/v1', createApiLimiter(), apiRoutes);

app.get('/', (req, res) => {
	if (req.session?.userId) {
		return res.redirect('/dashboard');
	}
	res.redirect('/login');
});

app.use('/', webRoutes);

// Sentry error handler — after all controllers, before other error middleware
OtelRuntime.setupExpressErrorHandler(app);
setupSentryExpressErrorHandler(app);

} // end SERVER_MODE === 'app'

async function start() {
	await connectDB();
	await backfillEmailTriageState();
	await initRedis();
	await initTypesense();

	if (SERVER_MODE === 'scheduler') {
		const { startScheduler } = await import('./modules/scheduler.js');
		startScheduler();
		console.log(`Kumbukum scheduler running [${config.env}]`);
		return;
	}

	const server = app.listen(config.port, () => {
		console.log(`Kumbukum ${SERVER_MODE} running on port ${config.port} [${config.env}]`);
	});

	await setupSocketIO(server, sessionMiddleware);
}

process.on('unhandledRejection', (reason, promise) => {
	OtelRuntime.recordException(reason instanceof Error ? reason : new Error(String(reason)));
	console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
	OtelRuntime.recordException(err);
	console.error('Uncaught exception:', err);
});

start().catch((err) => {
	console.error('Failed to start:', err);
	process.exit(1);
});

export default app;
