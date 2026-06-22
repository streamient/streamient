import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from '../model/mongoose.js';

import { listMemories } from '../services/memory_service.js';
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
