const emailTemplates = {
	verification: {
		subject: 'Confirm your Streamient account',
		html: `<p>Hi {{name}},</p>
<p>Thanks for signing up for Streamient! Please confirm your email address by clicking the link below:</p>
<p><a href="{{url}}">Confirm your account</a></p>
<p>This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'User name' },
			{ key: 'url', description: 'Verification URL' },
		],
	},
	password_reset: {
		subject: 'Reset your Streamient password',
		html: `<p>We received a request to reset your password.</p>
<p>Click the link below to choose a new password:</p>
<p><a href="{{url}}">Reset your password</a></p>
<p>This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
<p></p>`,
		variables: [
			{ key: 'url', description: 'Password reset URL' },
		],
	},
	welcome: {
		subject: 'Welcome to Streamient!',
		html: `<p>Hi {{name}},</p>
<p>Exciting times ahead! You now have access to a powerful shared knowledge layer for your team and your AI tools.</p>
<p>Here are great resources to get you started:</p>
<ul>
<li><a href="https://docs.streamient.com/guide/">What Streamient can do for you</a></li>
<li><a href="https://docs.streamient.com/mcp/">Use Streamient with Your AI Tools</a></li>
<li><a href="https://docs.streamient.com/guide/browser-extension">Collect knowledge with the Browser Extension</a></li>
</ul>
<p>Use the Streamient app to add your existing documents and knowledge. Once you add the Streamient MCP, you can also tell your AI tools to migrate everything for you automatically.</p>
<p></p>
<p><a href="{{loginUrl}}">Log in to Streamient now to get going</a></p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'User name' },
			{ key: 'loginUrl', description: 'Login page URL' },
		],
	},
	magic_link: {
		subject: 'Your Streamient login link',
		html: `<p>Click the link below to sign in to your account:</p>
<p><a href="{{url}}">Sign in to Streamient</a></p>
<p>This link expires in 15 minutes. If you did not request this link, you can safely ignore this email.</p>
<p></p>`,
		variables: [
			{ key: 'url', description: 'Magic link sign-in URL' },
		],
	},
	team_invite: {
		subject: '{{inviterName}} invited you to join {{tenantName}} on Streamient',
		html: `<p>Hi {{name}},</p>
<p>{{inviterName}} invited you to join <strong>{{tenantName}}</strong> on Streamient.</p>
<p><a href="{{url}}">Accept invitation</a></p>
<p>This invitation expires in 7 days.</p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'Invitee name' },
			{ key: 'inviterName', description: 'Inviter display name' },
			{ key: 'tenantName', description: 'Account / tenant name' },
			{ key: 'url', description: 'Invite acceptance URL' },
		],
	},
	team_member_added: {
		subject: 'You now have access to {{tenantName}} on Streamient',
		html: `<p>Hi {{name}},</p>
<p>You now have access to <strong>{{tenantName}}</strong> on Streamient.</p>
<p><a href="{{loginUrl}}">Log in to Streamient</a></p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'User name' },
			{ key: 'tenantName', description: 'Account / tenant name' },
			{ key: 'loginUrl', description: 'Login page URL' },
		],
	},
	trial_ending_3_days: {
		subject: 'Your Streamient trial ends in 3 days',
		html: `<p>Hi {{name}},</p>
<p>Your free trial ends on <strong>{{trialEndDate}}</strong>.</p>
<p>To keep using Streamient without interruption, add billing before your trial ends.</p>
<p><a href="{{subscriptionUrl}}">Manage your subscription</a></p>
<p>If you have any questions, just reply to this email.</p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'User name' },
			{ key: 'trialEndDate', description: 'Trial end date' },
			{ key: 'subscriptionUrl', description: 'Subscription settings URL' },
		],
	},
	trial_ending_24_hours: {
		subject: 'Your Streamient trial ends in 24 hours',
		html: `<p>Hi {{name}},</p>
<p>Your free trial ends on <strong>{{trialEndDate}}</strong>.</p>
<p>Add billing now to keep your Streamient account active. If the trial ends without billing, your account will be locked.</p>
<p><a href="{{subscriptionUrl}}">Add billing</a></p>
<p>Accounts without billing are deleted 3 days after the trial ends.</p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'User name' },
			{ key: 'trialEndDate', description: 'Trial end date' },
			{ key: 'subscriptionUrl', description: 'Subscription settings URL' },
		],
	},
	trial_expired: {
		subject: 'Your Streamient trial has ended',
		html: `<p>Hi {{name}},</p>
<p>Your Streamient free trial ended on <strong>{{trialEndDate}}</strong>, and your account is now locked.</p>
<p>Add billing to unlock your account and keep using Streamient.</p>
<p><a href="{{subscriptionUrl}}">Add billing</a></p>
<p>If billing is not added, this account and all workspace data will be deleted 3 days after the trial end date.</p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'User name' },
			{ key: 'trialEndDate', description: 'Trial end date' },
			{ key: 'subscriptionUrl', description: 'Subscription settings URL' },
		],
	},
	export_ready: {
		subject: 'Your Streamient export is ready',
		html: `<p>Hi {{name}},</p>
<p>Your data export is ready for download.</p>
<p><a href="{{downloadUrl}}">Download your export</a></p>
<p>This link expires in 24 hours. After that, you can request a new export from your settings.</p>
<p></p>`,
		variables: [
			{ key: 'name', description: 'User name' },
			{ key: 'downloadUrl', description: 'Export download URL' },
		],
	},
};

export default emailTemplates;
