import Cloudflare from 'cloudflare';
import config from '../config.js';

function clean(value) {
	return String(value || '').trim();
}

export function isCloudflareConfigured() {
	return Boolean(clean(config.whiteLabel?.cloudflare?.apiToken) && clean(config.whiteLabel?.cloudflare?.zoneId));
}

function getCloudflareClient() {
	const apiToken = clean(config.whiteLabel?.cloudflare?.apiToken);
	const zoneId = clean(config.whiteLabel?.cloudflare?.zoneId);
	if (!apiToken || !zoneId) {
		const err = new Error('Cloudflare custom hostname provisioning is not configured');
		err.code = 'CLOUDFLARE_NOT_CONFIGURED';
		err.status = 400;
		throw err;
	}
	return {
		client: new Cloudflare({ apiToken }),
		zoneId,
	};
}

export async function createHostname(hostname, options = {}) {
	const { client, zoneId } = getCloudflareClient();
	const params = {
		zone_id: zoneId,
		hostname,
		ssl: {
			method: 'http',
			type: 'dv',
			settings: {
				min_tls_version: '1.2',
			},
		},
	};

	if (options.metadata && typeof options.metadata === 'object') {
		params.custom_metadata = Object.fromEntries(
			Object.entries(options.metadata).map(([key, value]) => [key, String(value)]),
		);
	}

	return client.customHostnames.create(params);
}

export async function getHostnameStatus(customHostnameId) {
	const { client, zoneId } = getCloudflareClient();
	return client.customHostnames.get(customHostnameId, { zone_id: zoneId });
}
