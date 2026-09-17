import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const configuration = source.slice(source.indexOf('var _90_days_in_ms'), source.indexOf("if (SERVER_MODE === 'app')"));

function fixture() {
	const rows = new Map();
	const writes = [];
	let failure = false;
	const collection = {
		createIndex: async () => {},
		findOne: async ({ _id }) => {
			if (failure) throw new Error('database unavailable');
			const row = rows.get(_id);
			return row && row.expires > new Date() ? structuredClone(row) : null;
		},
		updateOne: async (filter, update, options = {}) => {
			if (failure) throw new Error('database unavailable');
			writes.push({ filter, update: structuredClone(update), options });
			let row = rows.get(filter._id);
			if (!row && !options.upsert) return { matchedCount: 0 };
			const inserted = !row;
			row ||= { _id: filter._id };
			Object.assign(row, structuredClone(update.$set || {}));
			for (const [key, value] of Object.entries(update.$max || {})) if (!row[key] || value > row[key]) row[key] = value;
			rows.set(row._id, row);
			return { matchedCount: 1, upsertedCount: Number(inserted) };
		},
		deleteOne: async ({ _id }) => { rows.delete(_id); },
	};
	const stores = [];
	let options;
	const middleware = new Function('session', 'MongoStore', 'config', 'process', `${configuration}; return sessionMiddleware;`)((settings) => { options = settings; return session(settings); }, { create: (settings) => {
		const store = MongoStore.create({ ...settings, mongoUrl: undefined, client: { db: () => ({ collection: () => collection }) } });
		stores.push(store);
		return store;
	} }, { sessionSecret: 'session-regression-secret', mongoUri: 'unused' }, { env: { NODE_ENV: 'test' } });
	return { rows, writes, stores, options, middleware, collection, fail: () => { failure = true; } };
}

function call(store, method, ...args) {
	return new Promise((resolve, reject) => store[method](...args, (err, result) => err ? reject(err) : resolve(result)));
}

test('real HTTP middleware skips unchanged writes, saves changes/explicit saves, preserves cookie policy and logout', async (t) => {
	const f = fixture();
	const app = express();
	app.use(f.middleware);
	app.get('/login', (req, res) => { req.session.userId = 'user'; req.session.memberRole = 'owner'; res.end('ok'); });
	app.get('/read', (req, res) => { req.session.memberRole = 'owner'; res.end('ok'); });
	app.get('/change', (req, res) => { req.session.tenantId = 'other'; res.end('ok'); });
	app.get('/save', (req, res, next) => req.session.save((err) => err ? next(err) : res.end('ok')));
	app.get('/logout', (req, res) => req.session.destroy(() => res.end('ok')));
	app.use((err, req, res, next) => res.status(503).end(err.message));
	const server = app.listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));
	t.after(() => { server.closeAllConnections(); server.close(); });
	const url = `http://127.0.0.1:${server.address().port}`;
	const login = await fetch(`${url}/login`);
	const cookie = login.headers.get('set-cookie').split(';')[0];
	assert.match(login.headers.get('set-cookie'), /HttpOnly/);
	assert.match(login.headers.get('set-cookie'), /SameSite=Lax/i);
	const get = (path) => fetch(`${url}${path}`, { headers: { cookie } });
	assert.equal(f.writes.length, 1);
	for (const response of await Promise.all([get('/read'), get('/read'), get('/read')])) assert.equal(response.headers.get('set-cookie'), null);
	assert.equal(f.writes.length, 1);
	const [row] = f.rows.values();
	row.lastModified = new Date(Date.now() - 61000);
	const touched = await get('/read');
	assert.equal(touched.headers.get('set-cookie'), null);
	assert.equal(f.writes.length, 2);
	assert.ok(f.writes[1].update.$max.expires);
	assert.equal(f.writes[1].update.$set, undefined);
	assert.ok((await get('/change')).headers.get('set-cookie'));
	assert.equal(JSON.parse(row.session).tenantId, 'other');
	const beforeSave = f.writes.filter((w) => w.options.upsert).length;
	await get('/save');
	assert.ok(f.writes.filter((w) => w.options.upsert).length > beforeSave);
	await get('/logout');
	assert.equal(f.rows.size, 0);
	f.fail();
	assert.equal((await get('/read')).status, 503);
});

test('store uses seconds fallback; stale replica touches never overwrite auth, shorten expiry or resurrect logout', async () => {
	const f = fixture();
	const store = f.stores[0];
	const replica = MongoStore.create({ client: { db: () => ({ collection: () => f.collection }) }, autoRemove: 'disabled', ttl: store.options.ttl, touchAfter: store.options.touchAfter });
	assert.equal(store.options.ttl, 90 * 86400);
	assert.equal(store.options.touchAfter, 60);
	assert.equal(f.options.resave, false);
	assert.equal(f.options.rolling, undefined);
	assert.equal(f.options.cookie.maxAge, 90 * 86400000);
	const now = Date.now();
	await call(store, 'set', 'sid', { userId: 'user', memberRole: 'owner', cookie: {} });
	const row = f.rows.get('sid');
	assert.ok(row.expires.getTime() >= now + 90 * 86400000);
	assert.ok(row.expires.getTime() <= Date.now() + 90 * 86400000);
	row.lastModified = new Date(now - 61000);
	const stale = await call(replica, 'get', 'sid');
	const newerExpiry = new Date(now + 91 * 86400000);
	await call(store, 'set', 'sid', { userId: 'user', memberRole: 'member', cookie: { expires: newerExpiry } });
	stale.cookie.expires = new Date(now + 1000);
	await Promise.all([call(replica, 'touch', 'sid', stale), call(store, 'touch', 'sid', stale)]);
	assert.equal(row.expires.getTime(), newerExpiry.getTime());
	assert.equal(JSON.parse(row.session).memberRole, 'member');
	await call(store, 'destroy', 'sid');
	await assert.rejects(call(replica, 'touch', 'sid', stale), /Unable to find/);
	assert.equal(f.rows.size, 0);
	f.fail();
	await assert.rejects(call(store, 'set', 'other', { cookie: {} }), /database unavailable/);
	await assert.rejects(call(store, 'touch', 'sid', stale), /database unavailable/);
});

test('legacy sessions acquire throttle metadata and cookie expiry overrides TTL', async () => {
	const f = fixture();
	const store = f.stores[0];
	const expiry = new Date(Date.now() + 600000);
	await call(store, 'set', 'legacy', { cookie: { expires: expiry }, userId: 'user' });
	const row = f.rows.get('legacy');
	assert.equal(row.expires.getTime(), expiry.getTime());
	delete row.lastModified;
	await call(store, 'touch', 'legacy', await call(store, 'get', 'legacy'));
	assert.ok(row.lastModified instanceof Date);
	const count = f.writes.length;
	await call(store, 'touch', 'legacy', await call(store, 'get', 'legacy'));
	assert.equal(f.writes.length, count);
});
