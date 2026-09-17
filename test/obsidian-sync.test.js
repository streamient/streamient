import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import config from '../config.js';
import { getApiResourceUrl, OBSIDIAN_ALL_SCOPES, OBSIDIAN_CLIENT_ID, OBSIDIAN_REDIRECT_URI } from '../modules/oauth.js';
import { toTypesenseDocs } from '../modules/typesense.js';
import { ObsidianBlob } from '../model/obsidian_blob.js';
import { ObsidianChange } from '../model/obsidian_change.js';
import { ObsidianConnection } from '../model/obsidian_connection.js';
import { ObsidianFile } from '../model/obsidian_file.js';
import { ObsidianRevision } from '../model/obsidian_revision.js';
import { AuditLog } from '../model/audit_log.js';
import { Tenant } from '../modules/tenancy.js';
import { Project } from '../model/project.js';
import { requireObsidianAccess, requireProjectManager } from '../routes/obsidian_api.js';
import { __test as oauthRouteTest } from '../routes/oauth.js';
import { readBlob, storeBuffer } from '../services/obsidian_blob_service.js';
import { createConnection, normalizeVaultPath, isExcludedVaultPath, vaultFileKind, __test as syncTest } from '../services/obsidian_sync_service.js';
import { validateAuthorizationRequest } from '../services/oauth_service.js';

test('validates Obsidian vault paths and content kinds', () => {
	assert.equal(normalizeVaultPath('Notes\\Today.md'), 'Notes/Today.md');
	assert.equal(isExcludedVaultPath('.obsidian/plugins/x/data.json'), true);
	assert.equal(isExcludedVaultPath('Notes/.private/secret.md'), true);
	assert.equal(isExcludedVaultPath('Notes/Today.md'), false);
	assert.equal(vaultFileKind('Boards/Plan.canvas'), 'canvas');
	assert.equal(vaultFileKind('Files/Plan.pdf'), 'document');
	assert.throws(() => normalizeVaultPath('../../outside.md'));
});

test('normalizes scoped manifests and keeps the managed project folder active', () => {
	const scope = syncTest.normalizeSyncScope({
		vault_mode: 'selected',
		selected_paths: [{ path: 'Readwise', kind: 'folder' }, { path: 'Loose.md', kind: 'file' }],
		excluded_paths: [{ path: 'Readwise/Private', kind: 'folder' }],
	}, { streamient_folder: 'Streamient/Project' });
	assert.equal(syncTest.pathInSyncScope('Streamient/Project/Note.md', scope), true);
	assert.equal(syncTest.pathInSyncScope('Readwise/Article.md', scope), true);
	assert.equal(syncTest.pathInSyncScope('Readwise/Private/Secret.md', scope), false);
	assert.equal(syncTest.pathInSyncScope('Loose.md', scope), true);
	assert.equal(syncTest.pathInSyncScope('Loose.md.bak', scope), false);
	assert.equal(syncTest.pathInSyncScope('Anywhere.md', syncTest.normalizeSyncScope({ vault_mode: 'all' }, { streamient_folder: 'Streamient/Project' })), true);
	assert.equal(syncTest.pathInSyncScope('Anywhere.md', syncTest.normalizeSyncScope({ vault_mode: 'off' }, { streamient_folder: 'Streamient/Project' })), false);
	assert.equal(syncTest.pathInSyncScope('Anywhere.md', null), true);
	assert.throws(() => syncTest.normalizeSyncScope({ vault_mode: 'selected', selected_paths: [{ path: '.obsidian/data.json', kind: 'file' }] }, { streamient_folder: 'Streamient/Project' }));
	const mongoFilter = syncTest.scopeMongoFilter(scope);
	assert.equal(mongoFilter.$and[0].$or.length, 3);
	assert.equal(mongoFilter.$and[0].$or[0].path.$regex.test('Streamient/Project/Note.md'), true);
	assert.equal(mongoFilter.$and[0].$or[0].path.$regex.test('Streamient/Project-2/Note.md'), false);
	const legacyScope = syncTest.normalizeSyncScope({ vault_mode: 'off', excluded_paths: [{ path: 'Streamient/Work', kind: 'folder' }] }, { streamient_folder: 'Streamient' });
	assert.equal(syncTest.pathInSyncScope('Streamient/Own.md', legacyScope), true);
	assert.equal(syncTest.pathInSyncScope('Streamient/Work/Other.md', legacyScope), false);
	const legacyMongoFilter = syncTest.scopeMongoFilter(legacyScope);
	assert.equal(legacyMongoFilter.$and[0].$or[0].path.$regex.test('Streamient/Own.md'), true);
	assert.equal(legacyMongoFilter.$and[1].$nor[0].path.$regex.test('Streamient/Work/Other.md'), true);
});

test('summarizes scoped preview counts and transfer bytes', () => {
	assert.deepEqual(syncTest.summarizeActions([
		{ action: 'upload', size: 10 },
		{ action: 'download', size: 20 },
		{ action: 'download', size: 30 },
		{ action: 'noop', size: 40 },
	]), { total: 4, counts: { upload: 1, download: 2, trash: 0, noop: 1, ignore: 0 }, bytes: { upload: 10, download: 50 } });
});

test('bounds project export work and exposes resumable continuation routes', () => {
	const service = fs.readFileSync(new URL('../services/obsidian_sync_service.js', import.meta.url), 'utf8');
	const routes = fs.readFileSync(new URL('../routes/obsidian_api.js', import.meta.url), 'utf8');
	assert.match(service, /OBSIDIAN_EXPORT_BATCH_SIZE = 25/);
	assert.match(service, /exports_pending: exportsPending/);
	assert.match(routes, /connections\/:connectionId\/exports/);
	assert.match(routes, /connections\/:connectionId\/relocate/);
	assert.match(routes, /if \(!file\.blob\) return res\.status\(404\)/);
	assert.doesNotMatch(routes, /!file\.blob \|\| file\.in_trash/);
});

test('reconciles only managed and selected manifest paths', () => {
	const scope = syncTest.normalizeSyncScope({ vault_mode: 'selected', selected_paths: [{ path: 'Work', kind: 'folder' }], excluded_paths: [] }, { streamient_folder: 'Streamient/Project' });
	const remoteFiles = [
		{ _id: 'remote-managed', path: 'Streamient/Project/Remote.md', kind: 'markdown', size: 20, sha256: 'b'.repeat(64), revision: 1, modified_at: new Date(), in_trash: false },
		{ _id: 'remote-dormant', path: 'Personal/Dormant.md', kind: 'markdown', size: 30, sha256: 'c'.repeat(64), revision: 1, modified_at: new Date(), in_trash: false },
	];
	const actions = syncTest.reconcileManifestEntries([
		{ path: 'Work/Local.md', size: 10, sha256: 'a'.repeat(64), modified_at: new Date(), base_revision: 0, in_trash: false },
		{ path: 'Personal/Ignored.md', size: 40, sha256: 'd'.repeat(64), modified_at: new Date(), base_revision: 0, in_trash: false },
	], remoteFiles, scope);
	assert.deepEqual(actions.map((action) => [action.action, action.path]), [
		['upload', 'Work/Local.md'],
		['ignore', 'Personal/Ignored.md'],
		['download', 'Streamient/Project/Remote.md'],
	]);
});

test('registers a device on the connection already loaded by connection creation', async () => {
	let saves = 0;
	const connection = { devices: [], async save() { saves++; return this; } };
	await syncTest.registerDeviceOnConnection(connection, { device_id: 'device-1', device_name: 'Laptop', platform: 'desktop' });
	assert.equal(saves, 1);
	assert.equal(connection.devices[0].device_id, 'device-1');
	const source = fs.readFileSync(new URL('../services/obsidian_sync_service.js', import.meta.url), 'utf8');
	assert.match(source, /if \(data\.device_id\) await registerDeviceOnConnection\(connection, data\);\n\treturn publicConnection\(connection\);/);
});

test('returns the newly created connection after registering its first device', async (t) => {
	const originals = { projectFindOne: Project.findOne, connectionFindOne: ObsidianConnection.findOne, connectionCreate: ObsidianConnection.create, auditCreate: AuditLog.create };
	const connection = { _id: 'connection-1', project: 'project-1', host_id: 'host-1', name: 'Vault', streamient_folder: 'Streamient/Project', enabled: true, sequence: 0, devices: [], async save() { return this; } };
	Project.findOne = () => ({ select: () => ({ lean: async () => ({ _id: 'project-1' }) }) });
	ObsidianConnection.findOne = () => mockQuery(null);
	ObsidianConnection.create = async () => connection;
	AuditLog.create = async () => ({});
	t.after(() => {
		Project.findOne = originals.projectFindOne;
		ObsidianConnection.findOne = originals.connectionFindOne;
		ObsidianConnection.create = originals.connectionCreate;
		AuditLog.create = originals.auditCreate;
	});
	const result = await createConnection('user-1', 'host-1', { project_id: 'project-1', name: 'Vault', streamient_folder: 'Streamient/Project', device_id: 'device-1', device_name: 'Desktop', platform: 'desktop' });
	assert.equal(result.id, 'connection-1');
	assert.equal(result.devices[0].device_id, 'device-1');
});

test('keeps canonical Markdown and custom frontmatter intact', () => {
	const raw = '---\ntitle: Old\ntags: [one]\ncustom: keep\nstreamient_type: memory\n---\n\n![[Diagram.png]]\n> [!NOTE]\n> Keep this\n';
	const parsed = syncTest.parsedMarkdown(raw, 'Folder/Fallback.md');
	assert.equal(parsed.type, 'memory');
	assert.equal(parsed.frontmatter.custom, 'keep');
	assert.match(parsed.body, /!\[\[Diagram\.png\]\]/);

	const updated = syncTest.itemMarkdown('note', { title: 'New', tags: ['two'], content: '<p>ignored</p>' }, raw);
	assert.match(updated, /custom: keep/);
	assert.match(updated, /title: New/);
	assert.match(updated, /!\[\[Diagram\.png\]\]/);
	assert.match(updated, /> \[!NOTE\]/);
});

test('exports Markdown bodies beginning with a frontmatter delimiter without reparsing them as YAML', () => {
	const body = '---\n**ID:** 69c46f92970f3c6c828a6d1b\n**Source:** mcp\n';
	const raw = syncTest.itemMarkdown('memory', { title: 'Metadata record', tags: ['migration'], content: body });
	const parsed = syncTest.parsedMarkdown(raw, 'Metadata record.md');
	assert.equal(parsed.frontmatter.title, 'Metadata record');
	assert.equal(parsed.frontmatter.streamient_type, 'memory');
	assert.equal(parsed.body, body);
});

test('round-trips saved URL metadata without including crawler content', () => {
	const raw = syncTest.itemMarkdown('url', { title: 'Example', url: 'https://example.com/path', description: 'Saved description', tags: ['reference'], text_content: 'Crawler-owned page text' });
	const parsed = syncTest.parsedMarkdown(raw, 'Streamient/Project/URLs/Example.md');
	assert.equal(parsed.type, 'url');
	assert.equal(parsed.title, 'Example');
	assert.equal(parsed.url, 'https://example.com/path');
	assert.deepEqual(parsed.tags, ['reference']);
	assert.equal(parsed.body.trim(), 'Saved description');
	assert.doesNotMatch(raw, /Crawler-owned page text/);

	const updated = syncTest.itemMarkdown('url', { title: 'Updated', url: 'https://example.com/new', description: 'Updated description', tags: ['new'] }, `${raw}\n`);
	const parsedUpdate = syncTest.parsedMarkdown(updated, 'Example.md');
	assert.equal(parsedUpdate.url, 'https://example.com/new');
	assert.equal(parsedUpdate.body.trim(), 'Updated description');
	assert.throws(() => syncTest.parsedMarkdown('---\nstreamient_type: url\nurl: javascript:alert(1)\n---\n', 'Unsafe.md'), /HTTP or HTTPS/);
	assert.throws(() => syncTest.parsedMarkdown('---\nstreamient_type: url\n---\n', 'Missing.md'), /valid url field/);
});

test('uses primary reads throughout manifest reconciliation', () => {
	const source = fs.readFileSync(new URL('../services/obsidian_sync_service.js', import.meta.url), 'utf8');
	assert.match(source, /Note\.find\(query\)\.read\('primary'\)\.lean\(\)/);
	assert.match(source, /Memory\.find\(query\)\.read\('primary'\)\.lean\(\)/);
	assert.match(source, /Url\.find\(query\)\.read\('primary'\)\.lean\(\)/);
	assert.match(source, /ObsidianManifestBatch\.find\([\s\S]*?\.read\('primary'\)\.lean\(\)/);
	assert.match(source, /const batch = await ObsidianFile\.find\(query\)[\s\S]*?\.read\('primary'\)\.lean\(\)/);
	assert.doesNotMatch(source, /const remote = await ObsidianFile\.findOne\(\{ connection: connection\._id, host_id: hostId, path: filePath \}\)/);
});

test('sanitizes rendered canonical Markdown without changing stored source', () => {
	const html = syncTest.renderCanonicalMarkdown('[safe](/notes) <img src="/x.png" onerror="alert(1)"><script>alert(1)</script>');
	assert.match(html, /href="\/notes"/);
	assert.match(html, /src="\/x\.png"/);
	assert.doesNotMatch(html, /onerror|script|alert/);
});

test('clamps untrusted device clocks for newest-wins arbitration', () => {
	const now = new Date('2026-08-27T12:00:00.000Z');
	assert.equal(syncTest.normalizedModifiedAt('2030-01-01T00:00:00.000Z', now).toISOString(), now.toISOString());
	assert.equal(syncTest.normalizedModifiedAt('2026-08-27T12:03:00.000Z', now).toISOString(), '2026-08-27T12:03:00.000Z');
});

test('authorizes only the first-party Obsidian callback and vault scopes', async () => {
	const request = {
		client_id: OBSIDIAN_CLIENT_ID,
		redirect_uri: OBSIDIAN_REDIRECT_URI,
		response_type: 'code',
		scope: OBSIDIAN_ALL_SCOPES.join(' '),
		state: 'state',
		code_challenge: 'challenge',
		code_challenge_method: 'S256',
		resource: getApiResourceUrl(),
	};
	const result = await validateAuthorizationRequest(request, { host_id: 'host-1' });
	assert.equal(result.client.client_id, OBSIDIAN_CLIENT_ID);
	assert.deepEqual(result.scopes, OBSIDIAN_ALL_SCOPES.slice().sort());
	await assert.rejects(() => validateAuthorizationRequest({ ...request, redirect_uri: 'obsidian://other-action' }, { host_id: 'host-1' }));
	await assert.rejects(() => validateAuthorizationRequest({ ...request, scope: 'knowledge:read' }, { host_id: 'host-1' }));
});

test('forces a fresh OAuth login without losing the authorization request', () => {
	const req = { originalUrl: '/oauth/authorize?client_id=streamient-obsidian&state=state-1&prompt=login', session: { userId: 'user-1', tenantId: 'tenant-1', host_id: 'host-1', memberRole: 'owner', lastLoginRecordedAt: 'now' } };
	const res = { location: '', redirect(value) { this.location = value; return this; } };
	oauthRouteTest.redirectToAuthorizationLogin(req, res);
	assert.equal(res.location, '/login');
	assert.equal(req.session.userId, undefined);
	assert.equal(req.session.tenantId, undefined);
	assert.match(req.session.oauthLoginReturnTo, /prompt=consent/);
	assert.doesNotMatch(req.session.oauthLoginReturnTo, /prompt=login/);
});

test('exposes the authorized account identity to multi-account Obsidian clients', () => {
	const source = fs.readFileSync(new URL('../routes/obsidian_api.js', import.meta.url), 'utf8');
	assert.match(source, /router\.get\('\/account', requireOAuthScopes\('vault:read'\)/);
	assert.match(source, /User\.findById\(req\.userId\)\.select\('_id name email'\)/);
});

test('accepts Obsidian sync audit events', () => {
	assert.ok(AuditLog.schema.path('action').enumValues.includes('sync'));
	assert.ok(AuditLog.schema.path('resource').enumValues.includes('obsidian_connection'));
	assert.ok(AuditLog.schema.path('channel').enumValues.includes('obsidian'));
});

test('checks Git-parity plan access before Obsidian deployment readiness', async (t) => {
	const originalFindOne = Tenant.findOne;
	const previous = { enabled: config.obsidian.enabled, key: config.obsidian.encryptionKey };
	let plan = 'free';
	Tenant.findOne = () => ({ select: () => ({ lean: async () => ({ plan }) }) });
	t.after(() => {
		Tenant.findOne = originalFindOne;
		config.obsidian.enabled = previous.enabled;
		config.obsidian.encryptionKey = previous.key;
	});

	function response() {
		return {
			statusCode: 200,
			body: null,
			status(value) { this.statusCode = value; return this; },
			json(value) { this.body = value; return this; },
		};
	}

	config.obsidian.enabled = false;
	config.obsidian.encryptionKey = '';
	const free = response();
	await requireObsidianAccess({ host_id: 'host-1', isHosted: true, billingUser: { subscription_status: 'active' } }, free, () => {});
	assert.equal(free.statusCode, 403);
	assert.equal(free.body.code, 'pro_required');

	plan = 'pro';
	const disabled = response();
	await requireObsidianAccess({ host_id: 'host-1', isHosted: true, billingUser: null }, disabled, () => {});
	assert.equal(disabled.statusCode, 403);
	assert.equal(disabled.body.code, 'feature_disabled');

	config.obsidian.enabled = true;
	const unconfigured = response();
	await requireObsidianAccess({ host_id: 'host-1', isHosted: true, billingUser: null }, unconfigured, () => {});
	assert.equal(unconfigured.statusCode, 503);
	assert.equal(unconfigured.body.code, 'encryption_key_missing');

	plan = 'free';
	config.obsidian.encryptionKey = 'a'.repeat(64);
	let allowed = false;
	await requireObsidianAccess({ host_id: 'host-1', isHosted: false, billingUser: null }, response(), () => { allowed = true; });
	assert.equal(allowed, true);
});

test('allows only project owners and admins to configure Obsidian connections', () => {
	for (const role of ['owner', 'admin']) {
		let allowed = false;
		requireProjectManager({ memberRole: role }, {}, () => { allowed = true; });
		assert.equal(allowed, true);
	}
	const response = { statusCode: 200, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
	requireProjectManager({ memberRole: 'member' }, response, () => {});
	assert.equal(response.statusCode, 403);
	assert.equal(response.body.code, 'admin_required');
});

test('encrypts stored vault bytes and decrypts them for authorized reads', async (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'streamient-obsidian-'));
	const previous = { dir: config.obsidian.vaultsDir, key: config.obsidian.encryptionKey };
	const originalFindOne = ObsidianBlob.findOne;
	const originalCreate = ObsidianBlob.create;
	config.obsidian.vaultsDir = root;
	config.obsidian.encryptionKey = 'a'.repeat(64);
	ObsidianBlob.findOne = () => ({ read() { return this; }, lean: async () => null });
	ObsidianBlob.create = async (data) => ({ _id: 'blob-1', ...data });
	t.after(() => {
		config.obsidian.vaultsDir = previous.dir;
		config.obsidian.encryptionKey = previous.key;
		ObsidianBlob.findOne = originalFindOne;
		ObsidianBlob.create = originalCreate;
		fs.rmSync(root, { recursive: true, force: true });
	});

	const plain = Buffer.from('canonical [[Obsidian]] markdown');
	const blob = await storeBuffer('host-1', plain, 'text/markdown');
	const encrypted = fs.readFileSync(path.join(root, blob.storage_key, blob.chunks[0].file_name));
	assert.equal(encrypted.includes(plain), false);
	const chunks = [];
	for await (const chunk of readBlob(blob, 'host-1')) chunks.push(chunk);
	assert.equal(Buffer.concat(chunks).toString('utf8'), plain.toString('utf8'));
});

test('maps non-Markdown vault content into the dedicated search collection shape', () => {
	const docs = toTypesenseDocs('vault_files', {
		_id: 'file-1',
		project: 'project-1',
		connection: 'connection-1',
		path: 'Documents/Architecture.pdf',
		kind: 'document',
		mime_type: 'application/pdf',
		size: 42,
		text_content: 'Architecture decision',
		in_trash: false,
		createdAt: new Date('2026-08-27T00:00:00Z'),
		updatedAt: new Date('2026-08-27T00:00:00Z'),
	});
	assert.equal(docs[0].title, 'Architecture');
	assert.equal(docs[0].path, 'Documents/Architecture.pdf');
	assert.equal(docs[0].connection_id, 'connection-1');
	assert.equal(docs[0].source_id, 'file-1');
});

function mockQuery(value) {
	return {
		lean: async () => value,
		then(resolve, reject) {
			return Promise.resolve(value).then(resolve, reject);
		},
	};
}

test('applies newest-wins conflicts and keeps repeated operations idempotent', async (t) => {
	const originals = {
		changeFindOne: ObsidianChange.findOne,
		changeCreate: ObsidianChange.create,
		connectionFindOneAndUpdate: ObsidianConnection.findOneAndUpdate,
		connectionUpdateOne: ObsidianConnection.updateOne,
		fileFindOne: ObsidianFile.findOne,
		revisionCreate: ObsidianRevision.create,
	};
	const createdChanges = [];
	const connection = { _id: 'connection-1', project: 'project-1', owner: 'user-1', host_id: 'host-1', sequence: 0, storage_bytes: 1 };
	const currentTime = Date.now();
	const file = {
		_id: 'file-1', connection: connection._id, project: connection.project, host_id: connection.host_id, path: 'Files/A.bin', kind: 'other', mime_type: 'application/octet-stream', size: 1,
		sha256: 'a'.repeat(64), blob: null, revision: 2, modified_at: new Date(currentTime), last_source: 'streamient', last_device_id: '', note: null, memory: null, text_content: '', in_trash: false, trashed_at: null, is_indexed: true,
		async save() { return this; },
	};
	ObsidianChange.findOne = (query) => mockQuery(createdChanges.find((change) => change.operation_id === query.operation_id) || null);
	ObsidianChange.create = async (data) => {
		const change = { _id: `change-${createdChanges.length + 1}`, ...data };
		createdChanges.push(change);
		return change;
	};
	ObsidianConnection.findOneAndUpdate = async (_query, update) => ({ ...connection, sequence: connection.sequence += update.$inc.sequence });
	ObsidianConnection.updateOne = async () => ({ modifiedCount: 1 });
	ObsidianFile.findOne = (query) => mockQuery(query._id || query.path === file.path ? file : null);
	ObsidianRevision.create = async (data) => data;
	t.after(() => {
		ObsidianChange.findOne = originals.changeFindOne;
		ObsidianChange.create = originals.changeCreate;
		ObsidianConnection.findOneAndUpdate = originals.connectionFindOneAndUpdate;
		ObsidianConnection.updateOne = originals.connectionUpdateOne;
		ObsidianFile.findOne = originals.fileFindOne;
		ObsidianRevision.create = originals.revisionCreate;
	});

	const older = await syncTest.applyMutation(connection, 'user-1', { operation_id: 'older', operation: 'trash', file_id: file._id, path: file.path, base_revision: 1, modified_at: new Date(currentTime - 60_000), device_id: 'device-1' });
	assert.equal(older.accepted, false);
	assert.equal(older.conflict, true);
	assert.equal(file.in_trash, false);

	const duplicate = await syncTest.applyMutation(connection, 'user-1', { operation_id: 'older', operation: 'trash', file_id: file._id, path: file.path, base_revision: 1, modified_at: new Date(currentTime - 60_000), device_id: 'device-1' });
	assert.equal(duplicate.duplicate, true);
	assert.equal(createdChanges.length, 1);

	const newer = await syncTest.applyMutation(connection, 'user-1', { operation_id: 'newer', operation: 'trash', file_id: file._id, path: file.path, base_revision: 1, modified_at: new Date(currentTime + 60_000), device_id: 'device-2' });
	assert.equal(newer.accepted, true);
	assert.equal(newer.conflict, true);
	assert.equal(file.in_trash, true);
	assert.equal(file.revision, 3);
	assert.equal(createdChanges.length, 2);
});
