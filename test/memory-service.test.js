import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from '../model/mongoose.js';

import { listMemories, suggestMemoryTags } from '../services/memory_service.js';
import { Memory } from '../model/memory.js';

test('listMemories sorts commit memories by committed date', async () => {
	const originalAggregate = Memory.aggregate;
	const projectId = new mongoose.Types.ObjectId().toString();
	let pipeline;

	Memory.aggregate = async (value) => {
		pipeline = value;
		return [];
	};

	try {
		await listMemories('host-1', projectId, { page: 2, limit: 25 });
	} finally {
		Memory.aggregate = originalAggregate;
	}

	assert.equal(pipeline[0].$match.host_id, 'host-1');
	assert.equal(pipeline[0].$match.project.toString(), projectId);
	assert.deepEqual(pipeline[1], { $addFields: { list_date: { $ifNull: ['$git_commit.committed_at', '$updatedAt'] } } });
	assert.deepEqual(pipeline[2], { $sort: { list_date: -1, updatedAt: -1 } });
	assert.deepEqual(pipeline[3], { $skip: 25 });
	assert.deepEqual(pipeline[4], { $limit: 25 });
	assert.deepEqual(pipeline[5], { $project: { list_date: 0 } });
});

test('suggestMemoryTags builds bounded project-scoped prefix aggregation', async () => {
	const originalAggregate = Memory.aggregate;
	const projectId = new mongoose.Types.ObjectId().toString();
	let pipeline;

	Memory.aggregate = async (value) => {
		pipeline = value;
		return [{ tag: 'debugging' }, { tag: 'debug' }];
	};

	try {
		const tags = await suggestMemoryTags('host-1', { projectId, query: 'debug.', limit: 200 });
		assert.deepEqual(tags, ['debugging', 'debug']);
	} finally {
		Memory.aggregate = originalAggregate;
	}

	assert.equal(pipeline[0].$match.host_id, 'host-1');
	assert.equal(pipeline[0].$match.in_trash.$ne, true);
	assert.equal(pipeline[0].$match.project.toString(), projectId);
	assert.equal(pipeline[0].$match.tags.$regex, '^debug\\.');
	assert.equal(pipeline[0].$match.tags.$options, 'i');
	assert.equal(pipeline.find(stage => stage.$limit).$limit, 100);
	assert.ok(pipeline.find(stage => stage.$match?.$and)?.$match.$and.some(condition => condition.tag?.$not));
});

test('suggestMemoryTags defaults to a small limit', async () => {
	const originalAggregate = Memory.aggregate;
	let pipeline;

	Memory.aggregate = async (value) => {
		pipeline = value;
		return [];
	};

	try {
		await suggestMemoryTags('host-1', { limit: 'bad' });
	} finally {
		Memory.aggregate = originalAggregate;
	}

	assert.equal(pipeline[0].$match.host_id, 'host-1');
	assert.equal(pipeline[0].$match.tags, undefined);
	assert.equal(pipeline.find(stage => stage.$limit).$limit, 50);
});
