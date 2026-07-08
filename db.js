import { setTimeout as sleep } from 'node:timers/promises';
import mongoose from './model/mongoose.js';
import config from './config.js';

let connection;
let connectionPromise;
let mongoEventsAttached = false;

const MONGO_CONNECT_RETRY_MIN_DELAY_MS = parsePositiveIntegerEnv('MONGO_CONNECT_RETRY_MIN_DELAY_MS', 1000);
const MONGO_CONNECT_RETRY_MAX_DELAY_MS = parsePositiveIntegerEnv('MONGO_CONNECT_RETRY_MAX_DELAY_MS', 10000);
const MONGO_SERVER_SELECTION_TIMEOUT_MS = parsePositiveIntegerEnv('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000);

function parsePositiveIntegerEnv(name, fallback) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getMongoConnectOptions() {
	return {
		serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
	};
}

function getMongoRetryDelayMs(attempt) {
	return Math.min(MONGO_CONNECT_RETRY_MIN_DELAY_MS * attempt, MONGO_CONNECT_RETRY_MAX_DELAY_MS);
}

function logMongoConnected() {
	const hosts = mongoose.connection.client.topology?.s?.description?.servers;
	if (hosts && hosts.size > 1) {
		const nodes = [...hosts.values()].map((s) => `${s.address} (${s.type})`).join(', ');
		console.log(`MongoDB connected to replica set: ${nodes}`);
	} else {
		console.log(`MongoDB connected: ${mongoose.connection.host}:${mongoose.connection.port}`);
	}
}

function attachMongoConnectionEvents() {
	if (mongoEventsAttached) return;
	mongoEventsAttached = true;
	mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected; driver will keep trying to reconnect'));
	mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
	mongoose.connection.on('error', (err) => console.error(`MongoDB connection error: ${err?.message || err}`));
}

export async function connectDB() {
	if (connection && mongoose.connection.readyState === 1) return connection;
	if (connectionPromise) return connectionPromise;

	attachMongoConnectionEvents();
	connectionPromise = (async () => {
		let attempt = 0;
		while (true) {
			attempt += 1;
			try {
				connection = await mongoose.connect(config.mongoUri, getMongoConnectOptions());
				logMongoConnected();
				return connection;
			} catch (err) {
				const delayMs = getMongoRetryDelayMs(attempt);
				console.error(`MongoDB connect failed (attempt ${attempt}); retrying in ${delayMs}ms: ${err?.message || err}`);
				await sleep(delayMs);
			}
		}
	})().finally(() => {
		connectionPromise = null;
	});

	return connectionPromise;
}

export default mongoose;
