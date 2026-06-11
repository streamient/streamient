import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeGroupedSearchResult, toTypesenseDocs, toIndexDocs } from '../modules/typesense.js';

describe('Typesense chunking', () => {
	it('splits large note text into overlapping source chunks', () => {
		const text = Array.from({ length: 6200 }, (_, i) => String(i % 10)).join('');
		const docs = toTypesenseDocs('notes', {
			_id: 'note-1',
			title: 'Large note',
			text_content: text,
			project: 'project-1',
			createdAt: new Date('2026-01-01T00:00:00Z'),
			updatedAt: new Date('2026-01-02T00:00:00Z'),
		});

		assert.equal(docs.length, 3);
		assert.deepEqual(docs.map((doc) => doc.id), ['note-1', 'note-1_chunk_1', 'note-1_chunk_2']);
		assert.ok(docs.every((doc) => doc.source_id === 'note-1'));
		assert.ok(docs.every((doc) => doc.chunk_count === 3));
		assert.ok(docs.every((doc) => doc.in_trash === false));
		assert.equal(docs[0].text_content, text.substring(0, 3000));
		assert.equal(docs[1].text_content, text.substring(2800, 5800));
		assert.equal(docs[2].text_content, text.substring(5600, 8600));
	});

	it('adds trash fields to trashed content documents', () => {
		const docs = toTypesenseDocs('notes', {
			_id: 'note-trash-1',
			title: 'Trashed note',
			text_content: 'trash body',
			project: 'project-1',
			in_trash: true,
			trashed_at: new Date('2026-06-05T12:27:00.000Z'),
		});

		assert.equal(docs.length, 1);
		assert.equal(docs[0].in_trash, true);
		assert.equal(docs[0].trashed_at, 1780662420);
	});

	it('keeps short memory items as one source document', () => {
		const docs = toTypesenseDocs('memory', {
			_id: 'mem-1',
			title: 'Short memory',
			content: 'small content',
			project: 'project-1',
		});

		assert.equal(docs.length, 1);
		assert.equal(docs[0].id, 'mem-1');
		assert.equal(docs[0].source_id, 'mem-1');
		assert.equal(docs[0].chunk_index, 0);
		assert.equal(docs[0].chunk_count, 1);
		assert.equal(docs[0].content, 'small content');
	});

	it('does not create empty email chunks for missing attachment text', () => {
		const docs = toTypesenseDocs('emails', {
			_id: 'email-1',
			subject: 'Email',
			text_content: 'body text',
			html_content: '<p>body text</p>',
			attachment_text_content: '',
			project: 'project-1',
			message_id: '<child@example.com>',
			in_reply_to: '<root@example.com>',
			references: ['<root@example.com>', '<parent@example.com>'],
		});

		assert.equal(docs.length, 1);
		assert.equal(docs[0].text_content, 'body text');
		assert.equal(docs[0].html_content, undefined);
		assert.equal(docs[0].attachment_text_content, '');
		assert.equal(docs[0].triaged, false);
		assert.equal(docs[0].in_trash, false);
		assert.equal(docs[0].thread_key, 'root@example.com');
		assert.deepEqual(docs[0].thread_identifiers, ['child@example.com', 'root@example.com', 'parent@example.com']);
		assert.equal(docs[0].in_reply_to, '<root@example.com>');
		assert.equal(docs[0].excerpt, 'body text');
	});

	it('normalizes grouped hits back to the source document id', () => {
		const result = normalizeGroupedSearchResult({
			found: 1,
			grouped_hits: [
				{
					group_key: ['note-1'],
					hits: [
						{
							document: {
								id: 'note-1_chunk_2',
								source_id: 'note-1',
								title: 'Large note',
							},
						},
					],
				},
			],
		});

		assert.equal(result.hits[0].document.id, 'note-1');
		assert.equal(result.hits[0].document.source_id, 'note-1');
	});

	it('maps project -> project_id when indexing a hydrated Mongoose-style email doc (has _id and id virtual)', () => {
		// Reproduces the immediate-index path: indexEmailNow passes a hydrated
		// Mongoose doc, which exposes both `_id` and an `id` virtual. It must still
		// be transformed so project_id is set (otherwise project-scoped counts break).
		const docs = toIndexDocs('emails', {
			_id: 'email-1',
			id: 'email-1',
			subject: 'Hi',
			text_content: 'body',
			project: 'project-9',
			mailbox: 'inbox',
		});

		assert.ok(docs.length >= 1);
		assert.ok(docs.every((doc) => doc.project_id === 'project-9'));
		assert.ok(docs.every((doc) => doc.source_id === 'email-1'));
		assert.equal(docs[0].id, 'email-1');
	});

	it('chunks an already-transformed Typesense doc (string id, no _id) without re-transforming', () => {
		const docs = toIndexDocs('emails', {
			id: 'email-2',
			source_id: 'email-2',
			project_id: 'project-7',
			subject: 'X',
			text_content: '',
		});

		assert.equal(docs.length, 1);
		assert.equal(docs[0].id, 'email-2');
		assert.equal(docs[0].project_id, 'project-7');
	});
});
