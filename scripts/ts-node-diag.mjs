// Self-contained Typesense driver/cluster diagnostic.
// Run INSIDE a live container (sees the same TYPESENSE_NODES env as the app):
//   docker exec -w /opt/streamient <container> node /tmp/ts-node-diag.mjs
// Tests the combined multi-node client AND each node individually, per collection,
// to find whether one node is slow/broken for a specific collection (e.g. notes).
import Typesense from 'typesense';

function parseNodes() {
	let raw = (process.env.TYPESENSE_NODES || '').trim();
	if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"') && raw[1] !== '{')) {
		raw = raw.slice(1, -1);
	}
	if (raw) {
		const parsed = JSON.parse(raw);
		return { nodes: parsed.nodes, apiKey: parsed.apiKey || process.env.TYPESENSE_API_KEY };
	}
	return {
		nodes: [{ host: process.env.TYPESENSE_HOST || 'localhost', port: parseInt(process.env.TYPESENSE_PORT, 10) || 8108, protocol: 'http' }],
		apiKey: process.env.TYPESENSE_API_KEY,
	};
}

const { nodes, apiKey } = parseNodes();
const TIMEOUT = 12; // seconds, short so a hanging node surfaces fast
const QUERY = process.argv[2] || 'Razuna DAM API connector';

function clientFor(nodeList) {
	return new Typesense.Client({ nodes: nodeList, apiKey, connectionTimeoutSeconds: TIMEOUT, numRetries: 0 });
}

async function timeSearch(client, collection) {
	const t0 = Date.now();
	try {
		const r = await client.collections(collection).documents().search({
			q: QUERY, query_by: 'embedding', per_page: 3, exclude_fields: 'embedding',
		});
		return `${Date.now() - t0}ms (found=${r.found})`;
	} catch (e) {
		return `ERROR after ${Date.now() - t0}ms — ${e.message}`;
	}
}

async function main() {
	console.log(`Nodes (${nodes.length}):`, nodes.map((n) => `${n.host}:${n.port}`).join(', '));

	// Discover host with most notes via the combined client.
	const combined = clientFor(nodes);
	const cols = await combined.collections().retrieve();
	const hosts = [...new Set(cols.map((c) => c.name.match(/^notes_(.+)$/)?.[1]).filter(Boolean))];
	let host = hosts[0], best = -1;
	for (const h of hosts) {
		const n = cols.find((x) => x.name === `notes_${h}`)?.num_documents || 0;
		if (n > best) { best = n; host = h; }
	}
	const notesCol = `notes_${host}`;
	const memCol = `memory_${host}`;
	console.log(`host=${host}  notes=${cols.find((c)=>c.name===notesCol)?.num_documents}  memory=${cols.find((c)=>c.name===memCol)?.num_documents}\n`);

	// Combined client, a few iterations (round-robin may hit different nodes).
	console.log('--- combined multi-node client (5 iterations) ---');
	for (let i = 0; i < 5; i++) {
		console.log(`  notes #${i + 1}: ${await timeSearch(combined, notesCol)}   memory #${i + 1}: ${await timeSearch(combined, memCol)}`);
	}

	// Each node individually.
	console.log('\n--- per-node (isolated single-node clients) ---');
	for (const node of nodes) {
		const c = clientFor([node]);
		const notes = await timeSearch(c, notesCol);
		const mem = await timeSearch(c, memCol);
		console.log(`  ${node.host}:${node.port}  notes=${notes}   memory=${mem}`);
	}
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
