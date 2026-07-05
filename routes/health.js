import { Router } from 'express';
import mongoose from '../model/mongoose.js';
import { getRedisClient } from '../modules/redis.js';
import { getTypesenseClient } from '../modules/typesense.js';
import { getIO } from '../modules/socket.js';
import * as OtelRuntime from '../modules/otel_runtime.js';

const router = Router();

/**
 * GET /health
 * Quick liveness probe — returns 200 if the process is up.
 */
router.get('/', (_req, res) => {
    res.json({ status: 'ok' });
});

/**
 * GET /health/mongodb
 * Returns 200 if MongoDB connection is ready, 503 otherwise.
 */
router.get('/mongodb', (_req, res) => {
    const state = mongoose.connection.readyState;
    const ok = state === 1;
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable' });
});

/**
 * GET /health/redis
 * Returns 200 if Redis is reachable, 503 otherwise.
 */
router.get('/redis', async (_req, res) => {
    try {
        const redis = getRedisClient();
        if (redis && redis.status === 'ready') {
            await redis.ping();
            return res.json({ status: 'ok' });
        }
        res.status(503).json({ status: 'unavailable' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});

/**
 * GET /health/typesense
 * Returns 200 if Typesense is healthy, 503 otherwise.
 */
router.get('/typesense', async (_req, res) => {
    try {
        const ts = getTypesenseClient();
        const health = await ts.health.retrieve();
        const ok = health.ok;
        res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unhealthy' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});

/**
 * GET /health/websocket
 * Returns 200 if Socket.IO is initialized, 503 otherwise.
 */
router.get('/websocket', (_req, res) => {
    const io = getIO();
    const ok = !!io;
    res.status(ok ? 200 : 503).json({
        status: ok ? 'ok' : 'not_initialized',
        mode: process.env.SERVER_MODE || 'app',
        app: process.env.STREAMIENT_APP || 'web',
        otel_enabled: OtelRuntime.isEnabled(),
        clients: io?.engine?.clientsCount || 0,
    });
});

export default router;
