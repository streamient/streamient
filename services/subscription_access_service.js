export function hasProductAccess(user, now = new Date()) {
	if (!user) return false;
	const status = user.subscription_status || 'incomplete';
	if (status === 'active') return true;
	if (status !== 'trialing') return false;
	if (user.trial_source !== 'no_card') return true;
	if (!user.trial_ends_at) return true;
	return new Date(user.trial_ends_at).getTime() > now.getTime();
}
