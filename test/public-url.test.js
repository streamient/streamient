import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import { isPublicAddress, validatePublicUrl, publicLookup, getPublicUrl } from '../modules/public_url.js';
import { captureScreenshot } from '../modules/screenshot.js';

test('blocks private, mapped, special, IPv6 local and non-HTTP destinations', () => {
	for (const address of ['0.0.0.0', '127.0.0.1', '10.1.2.3', '100.64.0.1', '169.254.169.254', '172.31.0.1', '192.168.1.1', '198.18.1.1', '224.0.0.1', '::1', '::ffff:8.8.8.8', 'fd00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(isPublicAddress(address), false, address);
	for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
	for (const value of ['file:///etc/passwd', 'ftp://example.com', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]', 'https://user:pass@example.com']) assert.throws(() => validatePublicUrl(value));
});

test('socket lookup rejects mixed DNS answers and passes the actual checked address', async (t) => {
	const original = dns.lookup;
	t.after(() => { dns.lookup = original; });
	const lookup = (options = {}) => new Promise((resolve, reject) => publicLookup('rebind.example', options, (err, address, family) => err ? reject(err) : resolve({ address, family })));
	dns.lookup = (_host, _options, callback) => callback(null, [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
	await assert.rejects(lookup(), /non-public/);
	dns.lookup = (_host, _options, callback) => callback(null, [{ address: '8.8.8.8', family: 4 }]);
	assert.deepEqual(await lookup(), { address: '8.8.8.8', family: 4 });
	assert.deepEqual((await lookup({ all: true })).address, [{ address: '8.8.8.8', family: 4 }]);
});

test('private fetch never opens a socket and remote screenshot capture is disabled', async () => {
	await assert.rejects(getPublicUrl('http://127.0.0.1:12345'), /public HTTP/);
	assert.equal(await captureScreenshot('https://example.com'), null);
});

test('every redirect validates its URL and connection uses the guarded lookup', async () => {
	const response = await getPublicUrl('https://example.com', { adapter: async (config) => {
		assert.equal(config.proxy, false);
		assert.equal(config.httpAgent.options.lookup, publicLookup);
		assert.equal(config.httpsAgent.options.lookup, publicLookup);
		assert.throws(() => config.beforeRedirect({ protocol: 'http:', hostname: '169.254.169.254', path: '/' }), /public HTTP/);
		assert.throws(() => config.beforeRedirect({ protocol: 'http:', hostname: '[::1]', path: '/' }), /public HTTP/);
		return { data: 'ok', status: 200, headers: {}, config };
	} });
	assert.equal(response.data, 'ok');
});
