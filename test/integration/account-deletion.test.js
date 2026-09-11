import { io as connectSocket } from 'socket.io-client';
import { setupSocketIO } from '../../modules/socket.js';
import { generateSocketToken } from '../../middleware/auth.js';

import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from '../../model/mongoose.js';
import config from '../../config.js';
import { Tenant, acquireTenantWork, assertTenantAvailable, listAccessibleTenantsForUser } from '../../modules/tenancy.js';
import { User } from '../../model/user.js';
import { TenantMember } from '../../model/tenant_member.js';
import { HOST_SCOPED_MODELS, requestAccountDeletion, processAccountDeletion, previewAccountDeletion, recoverAccountDeletions, retryAccountDeletion, startAccountDeletionWorker, getTenantTypesenseCollectionNames } from '../../services/account_cleanup_service.js';
import { getTypesenseClient } from '../../modules/typesense.js';
import { MongoQueue, COLLECTION_NAME } from '../../modules/mongo_queue.js';
import { generateToken, requireAuth } from '../../middleware/auth.js';
import authRoutes from '../../routes/auth.js';
import { getWhiteLabelAssetsDir } from '../../services/white_label_service.js';
import { assertConversationCleanupOwnership } from '../../modules/typesense.js';

it('deletes a populated account through verified cleanup and the real worker while preserving other users/accounts', { skip: process.env.ACCOUNT_DELETION_INTEGRATION !== '1', timeout: 120000 }, async () => {
	await mongoose.connect(config.mongoUri);
	const hostId = new mongoose.Types.ObjectId().toString();
	const otherHost = new mongoose.Types.ObjectId().toString();
	const ownerId = new mongoose.Types.ObjectId();
	const exclusiveId = new mongoose.Types.ObjectId();
	const otherUserId = new mongoose.Types.ObjectId();
	const tenantId = new mongoose.Types.ObjectId();
	const otherTenantId = new mongoose.Types.ObjectId();
	const siteId = new mongoose.Types.ObjectId();
	const sessionId = 'deletion-test-' + crypto.randomUUID();
	const db = mongoose.connection.db;
	const namespace = 'deletion-test-' + hostId;
	const oldNamespace = process.env.STREAMIENT_QUEUE_APP;
	process.env.STREAMIENT_QUEUE_APP = namespace;
	const oldStripeKey = config.stripe.secretKey;
	config.stripe.secretKey = '';
	const ts = getTypesenseClient();
	const collection = getTenantTypesenseCollectionNames(hostId)[0];
	const otherCollection = getTenantTypesenseCollectionNames(otherHost)[0];
	const files = [];
	const historyId = crypto.randomUUID();
	let server;
	let io;
	const sockets = [];
	let release;
	let worker;
	
	try {
		await User.collection.insertMany([
			{ _id: ownerId, email: `delete-${hostId}@example.invalid`, name: 'Deletion fixture', host_id: hostId, tenant: tenantId, is_active: true, password: 'fixture' },
			{ _id: exclusiveId, email: `exclusive-${hostId}@example.invalid`, name: 'Exclusive fixture', host_id: hostId, tenant: tenantId, is_active: true, password: 'fixture' },
			{ _id: otherUserId, email: `keep-${otherHost}@example.invalid`, name: 'Preserved fixture', host_id: otherHost, tenant: otherTenantId, is_active: true, password: 'fixture' },
		]);
		await Tenant.collection.insertMany([{ _id: tenantId, host_id: hostId, name: 'Delete fixture', owner: ownerId, is_active: true }, { _id: otherTenantId, host_id: otherHost, name: 'Preserve fixture', owner: otherUserId, is_active: true }]);
		await TenantMember.create([{ user: ownerId, tenant: tenantId, host_id: hostId, role: 'owner' }, { user: exclusiveId, tenant: tenantId, host_id: hostId, role: 'member' }, { user: ownerId, tenant: otherTenantId, host_id: otherHost, role: 'member' }, { user: otherUserId, tenant: otherTenantId, host_id: otherHost, role: 'owner' }]);
		await db.collection('sessions').insertOne({ _id: sessionId, session: JSON.stringify({ userId: String(ownerId), host_id: hostId, tenantId: String(tenantId) }), expires: new Date(Date.now() + 60000) });
		for (const name of [collection, otherCollection]) await ts.collections().create({ name, fields: [{ name: 'text', type: 'string' }] });
		await ts.collections(collection).documents().create({ id: 'fixture', text: 'Delete me' });
		await ts.collections(otherCollection).documents().create({ id: 'fixture', text: 'Keep me' });
		try { await ts.collections('conversation_store').retrieve(); } catch (error) { if (error.httpStatus !== 404) throw error; await ts.collections().create({ name: 'conversation_store', fields: [{ name: 'conversation_id', type: 'string' }, { name: 'model_id', type: 'string' }, { name: 'timestamp', type: 'int32' }, { name: 'role', type: 'string', index: false }, { name: 'message', type: 'string', index: false }] }); }
		await ts.collections('conversation_store').documents().create({ id: historyId, conversation_id: crypto.randomUUID(), model_id: `convo-${hostId}-${new mongoose.Types.ObjectId()}`, timestamp: Math.floor(Date.now() / 1000), role: 'user', message: 'Former member history fixture' });
		const foreignCollection = 'mt_emails_' + hostId;
		await ts.collections().create({ name: foreignCollection, fields: [{ name: 'text', type: 'string' }] });
		try { await assert.rejects(assertConversationCleanupOwnership(hostId), { code: 'search_ownership_unknown' }); } finally { await ts.collections(foreignCollection).delete(); }
		const browserSession = { userId: String(ownerId), host_id: hostId, tenantId: String(tenantId), save: (callback) => callback(), destroy: (callback) => callback() };
		const app = express();
		app.use(express.json());
		app.use((req, res, next) => { req.session = browserSession; req.isHosted = true; next(); });
		app.use(authRoutes);
		server = app.listen(0, '127.0.0.1');
		await new Promise((resolve) => server.once('listening', resolve));
		const route = `http://127.0.0.1:${server.address().port}/api/v1/account/deletion?host_id=${hostId}`;
		io = await setupSocketIO(server);
		for (const [host, tenant] of [[hostId, tenantId], [otherHost, otherTenantId]]) {
			const socket = connectSocket(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], auth: { token: generateSocketToken(String(ownerId), host, String(tenant)) }, autoConnect: false });
			sockets.push(socket);
			await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
		}
		const disconnected = new Promise((resolve) => sockets[0].once('disconnect', resolve));

		const headers = { 'Content-Type': 'application/json' };
		browserSession.impersonating = true;
		assert.equal((await fetch(route)).status, 403);
		delete browserSession.impersonating;
		assert.equal((await fetch(route.replace(hostId, otherHost))).status, 403);
		const previewResponse = await fetch(route);
		assert.equal(previewResponse.status, 200, await previewResponse.clone().text());
		const preview = await previewResponse.json();
		assert.equal((await fetch(route, { method: 'POST', headers, body: JSON.stringify({ confirmation: 'DELETE', confirmation_token: 'wrong' }) })).status, 403);
		await assert.rejects(previewAccountDeletion(hostId, { userId: String(otherUserId) }), { status: 403 });
		await assert.rejects(requestAccountDeletion(hostId, { userId: String(ownerId) }, 'WRONG'), { status: 400 });
		release = await acquireTenantWork(hostId);
		const accepted = await requestAccountDeletion(hostId, { userId: String(ownerId) }, 'DELETE', { enqueueDeletion: async () => { throw new Error('Simulated enqueue outage'); } });
		assert.equal(accepted.host_id, hostId);
		await disconnected;
		assert.equal(sockets[1].connected, true);
		await recoverAccountDeletions({ hostId });
		const repeated = await requestAccountDeletion(hostId, { userId: String(ownerId) }, 'DELETE');
		assert.equal(repeated.deletion.job_id, accepted.deletion.job_id);
		assert.equal(await db.collection(COLLECTION_NAME).countDocuments({ app_instance: namespace, queue: 'account_deletion' }), 1);
		const acceptedHttp = await fetch(route, { method: 'POST', headers, body: JSON.stringify({ confirmation: 'DELETE', confirmation_token: preview.confirmation_token }) });
		assert.equal(acceptedHttp.status, 202, await acceptedHttp.clone().text());
		assert.equal((await User.findById(exclusiveId).read('primary').lean()).is_active, false);
		await assert.rejects(assertTenantAvailable(hostId), { code: 'account_unavailable' });
		await assert.rejects(MongoQueue.add('fixture-work', { host_id: hostId }), { code: 'account_unavailable' });
		assert.deepEqual(await processAccountDeletion({ host_id: hostId }), { pending: true });
		await release(); release = null;
		assert.equal(JSON.parse((await db.collection('sessions').findOne({ _id: sessionId })).session).host_id, otherHost);
		let status;
		await requireAuth({ headers: { authorization: 'Bearer ' + generateToken(String(ownerId), hostId, String(tenantId)) }, session: {}, method: 'GET', path: '/api/v1/counts', originalUrl: '/api/v1/counts', accepts: () => false }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('Deleted-host token accepted'));
		assert.equal(status, 401);
		// Populate each model only after the lock prevents ordinary producers
		// from acting on incomplete integration fixture rows.
		for (const [name, model] of Object.entries(HOST_SCOPED_MODELS)) {
			if (['TenantMember', 'Site'].includes(name)) continue;
			const id = new mongoose.Types.ObjectId();
			const row = { _id: id, host_id: hostId, owner: ownerId, user: ownerId, site: siteId, token: crypto.randomUUID(), token_hash: crypto.randomUUID(), client_id: crypto.randomUUID(), run_id: crypto.randomUUID(), email: `fixture-${crypto.randomUUID()}@example.invalid`, status: 'failed', state: 'failed', enabled: false, updatedAt: new Date(0), expires_at: new Date(Date.now() + 60000) };
			
			await model.collection.insertOne(row);

			if (name === 'NoteImportUpload') {
				const dir = path.resolve('assets/import/mobile', String(id));
				await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'chunk.part'), 'fixture'); files.push(dir);
				await db.collection(COLLECTION_NAME).insertOne({ app_instance: namespace, queue: 'legacy-import', status: 'pending', data: { upload_id: String(id) } });
			}

		}
		for (const dir of [path.resolve('assets/git-repos', hostId), path.join(getWhiteLabelAssetsDir(), hostId), ...['blobs','uploads','server','extract'].map((area) => path.resolve(config.obsidian.vaultsDir, area, hostId))]) {
			await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'fixture.bin'), 'fixture'); files.push(dir);
		}
		const exportFile = path.resolve(`assets/export/export-${hostId}-fixture.zip`);
		await fs.mkdir(path.dirname(exportFile), { recursive: true }); await fs.writeFile(exportFile, 'fixture'); files.push(exportFile);
		await HOST_SCOPED_MODELS.Note.collection.insertMany(Array.from({ length: 500 }, () => ({ _id: new mongoose.Types.ObjectId(), host_id: hostId, site: siteId })));
		await assert.rejects(processAccountDeletion({ host_id: hostId }, { cleanupResources: async () => { throw new Error('Simulated storage outage'); } }), /storage outage/);
		assert.equal((await Tenant.findById(tenantId).read('primary').lean()).deletion.stage, 'failed');
		await retryAccountDeletion(String(tenantId));
		assert.equal((await processAccountDeletion({ host_id: hostId })).pending, true);
		assert.equal(await HOST_SCOPED_MODELS.Note.countDocuments({ host_id: hostId }).read('primary'), 1);
		assert.equal((await processAccountDeletion({ host_id: hostId })).pending, true);
		for (const model of Object.values(HOST_SCOPED_MODELS)) assert.equal(await model.countDocuments({ host_id: hostId }).read('primary'), 0, model.modelName);
		await Tenant.updateOne({ _id: tenantId }, { $set: { 'deletion.clean_at': new Date(Date.now() - 6000) } });
		assert.equal((await processAccountDeletion({ host_id: hostId })).deleted, true);
		assert.equal(await Tenant.exists({ _id: tenantId }).read('primary'), null);
		assert.equal(await User.exists({ _id: exclusiveId }).read('primary'), null);
		assert.equal((await User.findById(ownerId).read('primary').lean()).host_id, otherHost);
		await listAccessibleTenantsForUser(String(ownerId));
		assert.equal((await TenantMember.findOne({ user: ownerId, host_id: otherHost }).lean()).role, 'member');
		await assert.rejects(ts.collections(collection).retrieve(), (error) => error.httpStatus === 404);
		assert.equal((await ts.collections(otherCollection).retrieve()).num_documents, 1);
		for (const file of files) await assert.rejects(fs.stat(file), { code: 'ENOENT' });
		assert.equal((await ts.collections('conversation_store').documents().search({ q: '*', filter_by: `model_id:=convo-${hostId}-*`, per_page: 1 })).found, 0);
		// Run a fresh unbilled fixture through the actual worker, not a direct
		// processor call. The poll simulates the existing recovery scheduler.
		await User.collection.insertOne({ _id: exclusiveId, email: `worker-${hostId}@example.invalid`, name: 'Worker fixture', host_id: hostId, tenant: tenantId, is_active: true, password: 'fixture' });
		await Tenant.collection.insertOne({ _id: tenantId, host_id: hostId, name: 'Worker fixture', owner: exclusiveId, is_active: true });
		await TenantMember.create({ user: exclusiveId, tenant: tenantId, host_id: hostId, role: 'owner' });
		await db.collection(COLLECTION_NAME).deleteMany({ app_instance: namespace });
		await requestAccountDeletion(hostId, { userId: String(exclusiveId) }, 'DELETE');
		worker = await startAccountDeletionWorker({ hostId, pollIntervalMs: 1000 });
		const deadline = Date.now() + 90000;
		while (await Tenant.exists({ _id: tenantId }).read('primary')) {
			assert.ok(Date.now() < deadline, 'Background deletion did not complete');
			await new Promise((resolve) => setTimeout(resolve, 250));
			await recoverAccountDeletions({ hostId });
		}
		assert.equal(await User.exists({ _id: exclusiveId }).read('primary'), null);
	} finally {
		if (worker) { await worker.stop(); const until = Date.now() + 5000; while ((worker.active || worker.activeCount) && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 20)); }
		if (release) await release();
		for (const socket of sockets) socket.disconnect();
		if (io) await new Promise((resolve) => io.close(resolve));
		if (server) await new Promise((resolve) => server.close(resolve));
		config.stripe.secretKey = oldStripeKey;
		for (const model of Object.values(HOST_SCOPED_MODELS)) await model.deleteMany({ host_id: { $in: [hostId, otherHost] } });
		await Tenant.deleteMany({ _id: { $in: [tenantId, otherTenantId] } });
		await User.deleteMany({ _id: { $in: [ownerId, exclusiveId, otherUserId] } });
		await db.collection('sessions').deleteOne({ _id: sessionId });
		await db.collection(COLLECTION_NAME).deleteMany({ app_instance: namespace });
		for (const name of [collection, otherCollection]) await ts.collections(name).delete().catch(() => {});
		for (const file of files) await fs.rm(file, { recursive: true, force: true });
		await ts.collections('conversation_store').documents(historyId).delete().catch(() => {});
		if (oldNamespace === undefined) delete process.env.STREAMIENT_QUEUE_APP; else process.env.STREAMIENT_QUEUE_APP = oldNamespace;
		await mongoose.disconnect();
	}
});
