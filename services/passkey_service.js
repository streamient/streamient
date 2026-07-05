import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { hydratedQuery } from '../model/mongoose.js';
import { UserPasskey } from '../model/user_passkey.js';
import config from '../config.js';

const rpName = 'Streamient';
const rpID = new URL(config.appUrl).hostname;
const origin = config.appUrl;

export async function getRegistrationOptions(user) {
	const passkeys = await UserPasskey.find({ user: user._id });
	const excludeCredentials = passkeys.map((pk) => ({
		id: pk.credential_id,
		type: 'public-key',
		transports: pk.transports || [],
	}));

	return generateRegistrationOptions({
		rpName,
		rpID,
		userID: new TextEncoder().encode(user._id.toString()),
		userName: user.email,
		userDisplayName: user.name || user.email,
		excludeCredentials,
		attestationType: 'none',
		authenticatorSelection: {
			residentKey: 'preferred',
			userVerification: 'preferred',
			authenticatorAttachment: 'platform',
		},
		supportedAlgorithmIDs: [-7, -257],
	});
}

export async function verifyAndSaveRegistration(user, response, challenge, { name, browser_info } = {}) {
	const verification = await verifyRegistrationResponse({
		response,
		expectedChallenge: challenge,
		expectedOrigin: origin,
		expectedRPID: rpID,
		requireUserVerification: false,
	});

	if (!verification.verified || !verification.registrationInfo) {
		throw new Error('Passkey registration verification failed');
	}

	const { credential, credentialDeviceType, credentialBackedUp } =
		verification.registrationInfo;

	await UserPasskey.create({
		user: user._id,
		credential_id: credential.id,
		public_key: Buffer.from(credential.publicKey).toString('base64url'),
		counter: credential.counter,
		device_type: credentialDeviceType,
		backed_up: credentialBackedUp,
		transports: response.response?.transports || [],
		...(name && { name }),
		...(browser_info && { browser_info }),
	});

	return verification;
}

export async function getAuthenticationOptions() {
	return generateAuthenticationOptions({
		rpID,
		allowCredentials: [],
		userVerification: 'preferred',
	});
}

export async function verifyAuthentication(response, challenge) {
	const passkey = await hydratedQuery(UserPasskey.findOne({ credential_id: response.id }));
	if (!passkey) throw new Error('Passkey not found');

	const publicKeyBuffer = Buffer.from(passkey.public_key, 'base64url');

	const verification = await verifyAuthenticationResponse({
		response,
		expectedChallenge: challenge,
		expectedOrigin: origin,
		expectedRPID: rpID,
		credential: {
			id: passkey.credential_id,
			publicKey: publicKeyBuffer,
			counter: passkey.counter,
			transports: passkey.transports || [],
		},
		requireUserVerification: false,
	});

	if (verification.verified) {
		passkey.counter = verification.authenticationInfo.newCounter;
		await passkey.save();
	}

	return { verification, passkey };
}
