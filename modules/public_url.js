import dns from 'node:dns';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import axios from 'axios';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) blocked.addSubnet(address, prefix);
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]]) blocked.addSubnet(address, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export function isPublicAddress(address) {
	const family = isIP(address);
	return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export function validatePublicUrl(value) {
	const invalid = Object.assign(new Error('Only public HTTP(S) URLs are allowed'), { status: 400, code: 'invalid_url' });
	const url = URL.parse(value);
	if (!url) throw invalid;
	const hostname = url.hostname.replace(/^\[|\]$/g, '');
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !hostname || (isIP(hostname) && !isPublicAddress(hostname))) throw invalid;
	return url;
}

// The validated DNS answer is returned to the socket itself; a second lookup cannot rebind it.
export function publicLookup(hostname, options, callback) {
	dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
		if (err) return callback(err);
		if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) return callback(new Error('URL resolves to a non-public address'));
		const family = typeof options === 'number' ? options : options?.family;
		const candidates = family ? addresses.filter((entry) => entry.family === family) : addresses;
		if (!candidates.length) return callback(new Error('URL has no supported public address'));
		if (options?.all) return callback(null, candidates);
		callback(null, candidates[0].address, candidates[0].family);
	});
}

export async function assertPublicUrl(value) {
	const url = validatePublicUrl(value);
	await new Promise((resolve, reject) => publicLookup(url.hostname.replace(/^\[|\]$/g, ''), {}, (err) => err ? reject(err) : resolve()));
	return url;
}

export async function getPublicUrl(value, options = {}) {
	validatePublicUrl(value);
	return axios.get(value, {
		...options,
		proxy: false,
		httpAgent: new http.Agent({ lookup: publicLookup }),
		httpsAgent: new https.Agent({ lookup: publicLookup }),
		beforeRedirect: (request) => validatePublicUrl(`${request.protocol}//${request.hostname}:${request.port || (request.protocol === 'https:' ? 443 : 80)}${request.path}`),
	});
}
