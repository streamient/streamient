export const REDIS_HEARTBEAT_INTERVAL_MS = 30000;

export function startRedisHeartbeat(redisClient, intervalMs = REDIS_HEARTBEAT_INTERVAL_MS) {
	if (!redisClient || typeof redisClient.ping !== 'function') return null;
	if (redisClient._healthCheckInterval) return redisClient._healthCheckInterval;

	// Redis idle time counts commands; TCP keepalive packets do not reset it.
	const healthCheck = setInterval(async () => {
		try {
			if (redisClient.status === 'ready') {
				await redisClient.ping();
			}
		} catch {
			// Redis emits connection errors through its client error handler.
		}
	}, intervalMs);

	if (typeof healthCheck.unref === 'function') {
		healthCheck.unref();
	}

	redisClient._healthCheckInterval = healthCheck;
	redisClient.once('end', () => {
		if (!redisClient._healthCheckInterval) return;
		clearInterval(redisClient._healthCheckInterval);
		redisClient._healthCheckInterval = null;
	});

	return healthCheck;
}
