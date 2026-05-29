import { Redis as Valkey } from 'iovalkey';
import Keyv from 'keyv';
import KeyvValkey from '@keyv/valkey';
import config from '../config.js';
import { buildRedisConnectionOptions, isRedisSentinelOptions, isTransientRedisError } from './redis_options.js';
import { createLogger } from './logger.js';

const log = createLogger('redis');

let _sharedClient = null;
let _keyv = null;

function createSharedClient() {
	if (_sharedClient) return _sharedClient;

	const opts = config.redisOptions;
	const isSentinel = isRedisSentinelOptions(opts);
	const connection = buildRedisConnectionOptions(opts, { lazyConnect: false });

	if (isSentinel) {
		log.info({ master: opts.name, sentinels: opts.sentinels.map(s => `${s.host}:${s.port}`).join(', ') }, 'Initializing SHARED Keyv Valkey SENTINEL client');

		_sharedClient = new Valkey(connection.options);

		_sharedClient.on('error', (err) => {
			if (err && !err.handled) {
				err.handled = true;
			}
			const errMsg = err?.message || '';
			if (!isTransientRedisError(errMsg)) {
				log.error({ err }, 'Keyv Valkey Sentinel client error');
			}
		});
	} else {
		const url = connection.url || `redis://${connection.options.host || 'localhost'}:${connection.options.port || 6379}`;
		log.info({ url }, 'Initializing SHARED Keyv Valkey client');

		_sharedClient = connection.url
			? new Valkey(connection.url, connection.options)
			: new Valkey(connection.options);

		_sharedClient.on('error', (err) => {
			if (err && !err.handled) {
				err.handled = true;
			}
			const errMsg = err?.message || '';
			if (!isTransientRedisError(errMsg)) {
				log.error({ err }, 'Keyv Valkey client error');
			}
		});

		_sharedClient.on('ready', () => {
			log.info('Keyv Valkey client connected and ready');
		});
	}

	log.info('Keyv Valkey shared client initializing...');

	if (_sharedClient && typeof _sharedClient.setMaxListeners === 'function') {
		_sharedClient.setMaxListeners(0);
	}

	return _sharedClient;
}

function createKeyv() {
	if (_keyv) return _keyv;

	const client = createSharedClient();

	const store = new KeyvValkey(client);

	store.on('error', (err) => {
		if (err && !err.handled) {
			err.handled = true;
		}
		const errMsg = err?.message || '';
		if (err && !isTransientRedisError(errMsg)) {
			log.error({ err }, 'KeyvValkey store error');
		}
	});

	_keyv = new Keyv({
		store,
		namespace: undefined,
		serialize: JSON.stringify,
		deserialize: JSON.parse,
	});

	_keyv.on('error', (err) => {
		if (err && !err.handled) {
			err.handled = true;
		}
		const errMsg = err?.message || '';
		if (err && !isTransientRedisError(errMsg)) {
			log.error({ err }, 'Keyv Valkey connection error');
		}
	});

	return _keyv;
}

/**
 * Returns the shared iovalkey client (API-compatible with ioredis).
 * Used by rate_limit, git_sync locks, health checks.
 */
export function getRedisClient() {
	return createSharedClient();
}

export async function cacheGet(key) {
	try {
		const keyv = createKeyv();
		const val = await keyv.get(key);
		return val ?? null;
	} catch {
		return null;
	}
}

export async function cacheSet(key, value, ttlSeconds = 300) {
	try {
		const keyv = createKeyv();
		await keyv.set(key, value, ttlSeconds * 1000);
	} catch {
		// silently ignore cache write failures
	}
}

export async function cacheInvalidate(pattern) {
	try {
		const client = createSharedClient();
		if (client.status !== 'ready') return;
		const keys = await client.keys(pattern);
		if (keys.length > 0) {
			await client.del(...keys);
		}
	} catch {
		// silently ignore cache invalidation failures
	}
}

export async function initRedis() {
	const client = createSharedClient();
	createKeyv();
	// Wait briefly for connection if not yet ready
	if (client.status !== 'ready') {
		await new Promise((resolve) => {
			const onReady = () => { cleanup(); resolve(); };
			const onError = () => { cleanup(); resolve(); };
			const timeout = setTimeout(() => { cleanup(); resolve(); }, 5000);
			function cleanup() {
				client.removeListener('ready', onReady);
				client.removeListener('error', onError);
				clearTimeout(timeout);
			}
			client.once('ready', onReady);
			client.once('error', onError);
		});
	}
	if (client.status === 'ready') {
		if (client.options?.sentinels) {
			const nodes = client.options.sentinels.map(s => `${s.host}:${s.port}`).join(', ');
			log.info({ master: client.options.name, nodes }, 'Redis connected via sentinel');
		} else {
			log.info({ host: client.options?.host || 'unknown', port: client.options?.port || 'unknown' }, 'Redis connected');
		}
	}
}
