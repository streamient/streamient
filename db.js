import mongoose from './model/mongoose.js';
import config from './config.js';

let connection;

export async function connectDB() {
	if (connection) return connection;
	connection = await mongoose.connect(config.mongoUri);
	const hosts = mongoose.connection.client.topology?.s?.description?.servers;
	if (hosts && hosts.size > 1) {
		const nodes = [...hosts.values()].map((s) => `${s.address} (${s.type})`).join(', ');
		console.log(`MongoDB connected to replica set: ${nodes}`);
	} else {
		console.log(`MongoDB connected: ${mongoose.connection.host}:${mongoose.connection.port}`);
	}
	return connection;
}

export default mongoose;
