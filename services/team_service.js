import { User } from '../model/user.js';
import { TeamInvite } from '../model/team_invite.js';
import { TenantMember, TEAM_MEMBER_ROLE_RANK } from '../model/tenant_member.js';
import { Tenant } from '../modules/tenancy.js';
import { sendWelcomeEmail } from './email_service.js';
import * as audit from './audit_service.js';
import { createLogger } from '../modules/logger.js';

const log = createLogger('team');

export function canManageTeam(role) {
	return role === 'owner' || role === 'admin';
}

export function canManageMembership(actorRole, targetRole, nextRole = null) {
	if (!canManageTeam(actorRole)) return false;
	if (targetRole === 'owner') return actorRole === 'owner';
	if (nextRole === 'owner') return false;
	if (actorRole === 'owner') return true;
	return targetRole === 'member';
}

function formatTeamMember(member) {
	return {
		_id: member._id.toString(),
		role: member.role,
		joined_at: member.joined_at,
		user: member.user
			? {
				_id: member.user._id.toString(),
				name: member.user.name,
				email: member.user.email,
				last_login: member.user.last_login,
				createdAt: member.user.createdAt,
			}
			: null,
	};
}

export async function listTeamMembers(host_id) {
	const members = await TenantMember.find({ host_id })
		.populate('user', 'name email last_login createdAt')
		.sort({ createdAt: 1 })
		.lean();

	return members.map(formatTeamMember).sort(sortTeamMembers);
}

export async function createTeamMember(userId, host_id, data, ctx = {}) {
	const tenant = await Tenant.findOne({ host_id, is_active: true });
	if (!tenant) throw new Error('Tenant not found');

	const name = typeof data.name === 'string' ? data.name.trim() : '';
	if (!name) throw new Error('Name is required');

	const email = String(data.email || '').trim().toLowerCase();
	if (!email) throw new Error('Email is required');

	const password = typeof data.password === 'string' ? data.password : '';
	if (password.length < 8) throw new Error('Password must be at least 8 characters');

	const existingUser = await User.findOne({ email }).lean();
	if (existingUser) {
		const existingMembership = await TenantMember.findOne({ tenant: tenant._id, user: existingUser._id }).lean();
		if (existingMembership) throw new Error('User is already a member of this account');
		throw new Error('Email already has a Kumbukum account');
	}

	const user = await User.create({
		email,
		password,
		name,
		is_verified: true,
		is_active: true,
	});

	const membership = await TenantMember.create({
		tenant: tenant._id,
		user: user._id,
		host_id,
		role: 'member',
		invited_by: userId,
		joined_at: new Date(),
	});

	await TeamInvite.deleteMany({
		tenant: tenant._id,
		email,
		accepted_at: null,
	});

	if (data.send_welcome_email === true) {
		sendWelcomeEmail(user.email, user.name).catch((err) =>
			log.warn({ err, email: user.email }, 'Team member welcome email failed'),
		);
	}

	audit.log({
		action: 'create',
		resource: 'team_member',
		resource_id: membership._id.toString(),
		user_id: userId,
		host_id,
		details: { member_email: email, role: membership.role, created_directly: true, welcome_email_sent: data.send_welcome_email === true },
		...ctx,
	});

	await membership.populate('user', 'name email last_login createdAt');
	return formatTeamMember(membership);
}

export async function updateTeamMemberRole(host_id, membershipId, actor, nextRole, ctx = {}) {
	const membership = await TenantMember.findOne({ _id: membershipId, host_id }).populate('user', 'name email');
	if (!membership) throw new Error('Member not found');
	if (!['admin', 'member'].includes(nextRole)) throw new Error('Invalid role');
	if (!canManageMembership(actor.role, membership.role, nextRole)) throw new Error('You do not have permission to change this role');
	if (String(membership.user._id) === String(actor.userId)) throw new Error('You cannot change your own role here');

	const beforeRole = membership.role;
	membership.role = nextRole;
	await membership.save();

	audit.log({
		action: 'update',
		resource: 'team_member',
		resource_id: membership._id.toString(),
		user_id: actor.userId,
		host_id,
		details: { before_role: beforeRole, after_role: nextRole, member_email: membership.user.email },
		...ctx,
	});

	return membership;
}

export async function removeTeamMember(host_id, membershipId, actor, ctx = {}) {
	const membership = await TenantMember.findOne({ _id: membershipId, host_id }).populate('user', 'name email');
	if (!membership) throw new Error('Member not found');
	if (!canManageMembership(actor.role, membership.role)) throw new Error('You do not have permission to remove this member');
	if (String(membership.user._id) === String(actor.userId)) throw new Error('You cannot remove yourself here');
	if (membership.role === 'owner') throw new Error('The account owner cannot be removed');

	await TenantMember.deleteOne({ _id: membership._id });

	audit.log({
		action: 'delete',
		resource: 'team_member',
		resource_id: membership._id.toString(),
		user_id: actor.userId,
		host_id,
		details: { member_email: membership.user.email, role: membership.role },
		...ctx,
	});

	return membership;
}

export async function getMembershipByUserAndHost(userId, host_id) {
	return TenantMember.findOne({ user: userId, host_id }).populate('tenant', 'name host_id');
}

export function sortTeamMembers(a, b) {
	return (TEAM_MEMBER_ROLE_RANK[b.role] || 0) - (TEAM_MEMBER_ROLE_RANK[a.role] || 0);
}
