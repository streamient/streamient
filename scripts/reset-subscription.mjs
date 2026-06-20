// Dev utility: reset a user (and their tenant) back to the Free plan — clears any
// leftover no-card trial / subscription so you can test the Free experience.
//
// Usage (inside the app container):
//   docker compose exec app node scripts/reset-subscription.mjs <email>
import mongoose from 'mongoose';
import config from '../config.js';
import { User } from '../model/user.js';
import { Tenant } from '../modules/tenancy.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
	console.error('Usage: node scripts/reset-subscription.mjs <email>');
	process.exit(1);
}

await mongoose.connect(config.mongoUri);

const user = await User.findOne({ email }).select('host_id').lean();
if (!user) {
	console.error(`No user found for ${email}`);
	await mongoose.disconnect();
	process.exit(1);
}

await User.updateOne(
	{ email },
	{
		$set: { subscription_status: 'incomplete' },
		$unset: {
			trial_source: '',
			trial_ends_at: '',
			trial_locked_at: '',
			trial_reminder_3d_sent_at: '',
			trial_reminder_24h_sent_at: '',
			stripe_subscription_id: '',
		},
	},
);

if (user.host_id) {
	await Tenant.updateOne({ host_id: user.host_id }, { $set: { plan: 'free' } });
}

console.log(`Reset ${email} to Free (no trial). Tenant ${user.host_id} → plan: free.`);
await mongoose.disconnect();
process.exit(0);
