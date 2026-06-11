import fs from 'node:fs';
import { User } from '../model/user.js';
import { Note } from '../model/note.js';
import { Memory } from '../model/memory.js';
import { Url } from '../model/url.js';
import { CrawlState } from '../model/crawl_state.js';
import { Email } from '../model/email.js';
import { EmailDraft } from '../model/email_draft.js';
import { EmailInternalNote } from '../model/email_internal_note.js';
import { EmailExternalSyncState } from '../model/email_external_sync_state.js';
import { EmailIdentity } from '../model/email_identity.js';
import { OutgoingEmail } from '../model/outgoing_email.js';
import { Project } from '../model/project.js';
import { GraphLink } from '../model/graph_link.js';
import { GitRepo } from '../model/git_repo.js';
import { OAuthAuthorizationCode } from '../model/oauth_authorization_code.js';
import { OAuthClient } from '../model/oauth_client.js';
import { OAuthConsent } from '../model/oauth_consent.js';
import { OAuthRefreshToken } from '../model/oauth_refresh_token.js';
import { TeamInvite } from '../model/team_invite.js';
import { TenantMember } from '../model/tenant_member.js';
import { UserPasskey } from '../model/user_passkey.js';
import { MagicLink } from '../model/magic_link.js';
import { Export } from '../model/export.js';
import { AuditLog } from '../model/audit_log.js';
import { Tenant } from '../modules/tenancy.js';
import { getTypesenseClient, deleteConversationDataForHost } from '../modules/typesense.js';
import { deleteGitRepoHostDirectory } from './git_sync_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('account-cleanup');

const TENANT_COLLECTION_TYPES = ['notes', 'memory', 'urls', 'emails', 'pages'];

async function deleteTypesenseCollection(collectionName) {
	const ts = getTypesenseClient();
	try {
		await ts.collections(collectionName).delete();
		return true;
	} catch (err) {
		if (err.httpStatus !== 404) {
			log.error({ err, collection: collectionName }, 'Failed to delete Typesense collection');
		}
		return false;
	}
}

export function getTenantTypesenseCollectionNames(hostId) {
	return TENANT_COLLECTION_TYPES.map((type) => `${type}_${hostId}`);
}

async function deleteExportFiles(hostId, exportModel = Export, unlink = fs.unlink) {
	const exports = await exportModel.find({ host_id: hostId }).select('file_path').lean();
	for (const doc of exports) {
		if (doc.file_path) {
			unlink(doc.file_path, () => {});
		}
	}
	return exports.length;
}

export async function deleteAccountDataForUser(userOrId) {
	const user = typeof userOrId === 'object' ? userOrId : await User.findById(userOrId);
	if (!user) return { deleted: false, reason: 'user_not_found' };
	return deleteTenantData(user.host_id, user.tenant);
}

export async function deleteTenantData(hostId, tenantId = null, deps = {}) {
	if (!hostId) return { deleted: false, reason: 'host_id_required' };

	const models = {
		User,
		Note,
		Memory,
		Url,
		CrawlState,
			Email,
			EmailDraft,
			EmailInternalNote,
			EmailExternalSyncState,
			EmailIdentity,
			OutgoingEmail,
			Project,
		GraphLink,
		GitRepo,
		OAuthAuthorizationCode,
		OAuthClient,
		OAuthConsent,
		OAuthRefreshToken,
		TeamInvite,
		TenantMember,
		UserPasskey,
		MagicLink,
		Export,
		AuditLog,
		Tenant,
		...(deps.models || {}),
	};
	const removeTypesenseCollection = deps.deleteTypesenseCollection || deleteTypesenseCollection;
	const removeGitRepoHostDirectory = deps.deleteGitRepoHostDirectory || deleteGitRepoHostDirectory;
	const removeConversationData = deps.deleteConversationDataForHost || deleteConversationDataForHost;
	const unlink = deps.unlink || fs.unlink;

	const tenant = tenantId ? await models.Tenant.findById(tenantId) : await models.Tenant.findOne({ host_id: hostId });
	const resolvedTenantId = tenant?._id || tenantId || null;
	const tenantUsers = await models.User.find({
		$or: [
			{ host_id: hostId },
			...(resolvedTenantId ? [{ tenant: resolvedTenantId }] : []),
		],
	}).select('_id email').lean();
	const tenantUserIds = tenantUsers.map((item) => item._id);

	const exportFiles = await deleteExportFiles(hostId, models.Export, unlink);

	await Promise.all([
		models.Note.deleteMany({ host_id: hostId }),
		models.Memory.deleteMany({ host_id: hostId }),
		models.Url.deleteMany({ host_id: hostId }),
		models.CrawlState.deleteMany({ host_id: hostId }),
			models.Email.deleteMany({ host_id: hostId }),
			models.EmailDraft.deleteMany({ host_id: hostId }),
			models.EmailInternalNote.deleteMany({ host_id: hostId }),
			models.EmailExternalSyncState.deleteMany({ host_id: hostId }),
			models.EmailIdentity.deleteMany({ host_id: hostId }),
			models.OutgoingEmail.deleteMany({ host_id: hostId }),
			models.Project.deleteMany({ host_id: hostId }),
		models.GraphLink.deleteMany({ host_id: hostId }),
		models.GitRepo.deleteMany({ host_id: hostId }),
		models.OAuthAuthorizationCode.deleteMany({ host_id: hostId }),
		models.OAuthClient.deleteMany({ host_id: hostId }),
		models.OAuthConsent.deleteMany({ host_id: hostId }),
		models.OAuthRefreshToken.deleteMany({ host_id: hostId }),
		models.TeamInvite.deleteMany({ host_id: hostId }),
		models.TenantMember.deleteMany({ host_id: hostId }),
		models.Export.deleteMany({ host_id: hostId }),
		models.AuditLog.deleteMany({ host_id: hostId }),
		tenantUserIds.length ? models.UserPasskey.deleteMany({ user: { $in: tenantUserIds } }) : Promise.resolve({ deletedCount: 0 }),
		tenantUserIds.length ? models.MagicLink.deleteMany({ user: { $in: tenantUserIds } }) : Promise.resolve({ deletedCount: 0 }),
	]);

	if (resolvedTenantId) {
		await models.Tenant.findByIdAndDelete(resolvedTenantId);
	}
	if (tenantUserIds.length) {
		await models.User.deleteMany({ _id: { $in: tenantUserIds } });
	}

	removeGitRepoHostDirectory(hostId);

	await removeConversationData(hostId, tenantUserIds.map((id) => id.toString()));

	const collectionNames = getTenantTypesenseCollectionNames(hostId);
	const typesenseDeleted = await Promise.all(collectionNames.map(removeTypesenseCollection));

	return {
		deleted: true,
		host_id: hostId,
		tenant_id: resolvedTenantId?.toString() || null,
		users: tenantUserIds.length,
		export_files: exportFiles,
		typesense_collections_deleted: typesenseDeleted.filter(Boolean).length,
	};
}
