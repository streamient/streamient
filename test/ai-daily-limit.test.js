import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import config from '../config.js';
import { Tenant } from '../modules/tenancy.js';
import { createAiDailyLimiter } from '../middleware/rate_limit.js';

function createServer(decorate) {
	const app = express();
	app.use(express.json());
	app.use((req, res, next) => {
		decorate(req);
		next();
	});
	app.post('/chat', createAiDailyLimiter(), (req, res) => res.json({ ok: true }));
	return app.listen(0);
}

async function post(server) {
	const { port } = server.address();
	return fetch(`http://127.0.0.1:${port}/chat`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: '{}',
	});
}

function closeServer(server) {
	return new Promise((resolve) => server.close(resolve));
}

describe('daily AI limit', () => {
	const originalTenantFindOne = Tenant.findOne;
	const originalAiDaily = config.plans.free.aiDaily;
	const originalSocketRedis = config.socketRedis;
	let tenant;

	const hostedFree = (req) => {
		req.isHosted = true;
		req.host_id = 'host-1';
		req.billingUser = null;
	};

	beforeEach(() => {
		config.plans.free.aiDaily = 3;
		config.socketRedis = false; // in-memory rate-limit store
		tenant = {
			host_id: 'host-1',
			plan: 'free',
			settings: { byo_ai: { global: { openai_api_key: '', gemini_api_key: '' } } },
		};
		Tenant.findOne = () => ({ select: () => ({ lean: async () => tenant }) });
	});

	afterEach(() => {
		Tenant.findOne = originalTenantFindOne;
		config.plans.free.aiDaily = originalAiDaily;
		config.socketRedis = originalSocketRedis;
	});

	it('returns 429 AI_DAILY_LIMIT once a managed Free workspace hits the cap', async () => {
		const server = createServer(hostedFree);
		try {
			for (let i = 0; i < 3; i++) {
				assert.equal((await post(server)).status, 200);
			}
			const res = await post(server);
			assert.equal(res.status, 429);
			const json = await res.json();
			assert.equal(json.code, 'AI_DAILY_LIMIT');
			assert.equal(json.limit, 3);
			assert.equal(json.upgrade_url, '/settings/subscription');
			assert.match(json.error, /Daily AI limit/);
		} finally {
			await closeServer(server);
		}
	});

	it('skips Free tenants with their own BYO key', async () => {
		tenant.settings.byo_ai.global.gemini_api_key = 'encrypted-value';
		const server = createServer(hostedFree);
		try {
			for (let i = 0; i < 5; i++) {
				assert.equal((await post(server)).status, 200);
			}
		} finally {
			await closeServer(server);
		}
	});

	it('skips Pro tenants', async () => {
		tenant.plan = 'pro';
		const server = createServer(hostedFree);
		try {
			for (let i = 0; i < 5; i++) {
				assert.equal((await post(server)).status, 200);
			}
		} finally {
			await closeServer(server);
		}
	});

	it('skips active no-card trials', async () => {
		const server = createServer((req) => {
			hostedFree(req);
			req.billingUser = {
				subscription_status: 'trialing',
				trial_source: 'no_card',
				trial_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			};
		});
		try {
			for (let i = 0; i < 5; i++) {
				assert.equal((await post(server)).status, 200);
			}
		} finally {
			await closeServer(server);
		}
	});

	it('skips self-hosted requests', async () => {
		const server = createServer((req) => {
			req.isHosted = false;
			req.host_id = 'host-1';
		});
		try {
			for (let i = 0; i < 5; i++) {
				assert.equal((await post(server)).status, 200);
			}
		} finally {
			await closeServer(server);
		}
	});

	it('is a no-op when the cap is disabled (0)', async () => {
		config.plans.free.aiDaily = 0;
		const server = createServer(hostedFree);
		try {
			for (let i = 0; i < 5; i++) {
				assert.equal((await post(server)).status, 200);
			}
		} finally {
			await closeServer(server);
		}
	});
});
