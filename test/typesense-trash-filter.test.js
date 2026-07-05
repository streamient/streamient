import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Typesense from 'typesense';

describe('Typesense trash filters', () => {
	it('filters active content by default and preserves explicit trash filters', async () => {
		const originalClient = Typesense.Client;
		const collectionSearchCalls = [];
		const multiSearchCalls = [];

		Typesense.Client = class FakeTypesenseClient {
			collections(name) {
				return {
					documents: () => ({
						search: async (params) => {
							collectionSearchCalls.push({ collection: name, params });
							return { found: 0, hits: [] };
						},
					}),
				};
			}

			multiSearch = {
				perform: async (searches, params) => {
					multiSearchCalls.push({ searches, params });
					return { results: searches.searches.map(() => ({ found: 0, hits: [] })) };
				},
			};
		};

		try {
			const typesense = await import(`../modules/typesense.js?trash-filter-test=${Date.now()}`);

			await typesense.searchCollection('host-1', 'notes', 'deploy', {
				filter_by: 'project_id:=`project-1`',
			});
			await typesense.listDocuments('host-1', 'urls', {
				perPage: 1,
				filter_by: 'in_trash:=true',
			});
			await typesense.searchAll('host-1', 'deploy', {
				projectId: 'project-1',
				perPage: 1,
			});

			assert.match(collectionSearchCalls[0].params.filter_by, /project_id:=`project-1`/);
			assert.match(collectionSearchCalls[0].params.filter_by, /in_trash:=false/);
			assert.equal(collectionSearchCalls[1].params.filter_by, 'in_trash:=true');

			const searches = multiSearchCalls[0].searches.searches;
			const filtersByCollection = new Map(searches.map((search) => [search.collection, search.filter_by || '']));
			for (const collection of ['st_notes_host-1', 'st_memory_host-1', 'st_urls_host-1', 'st_emails_host-1']) {
				assert.match(filtersByCollection.get(collection), /project_id:=`project-1`/);
				assert.match(filtersByCollection.get(collection), /in_trash:=false/);
			}
			assert.equal(filtersByCollection.get('st_pages_host-1'), 'project_id:=`project-1`');
		} finally {
			Typesense.Client = originalClient;
		}
	});
});
