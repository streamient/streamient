// Run against an authenticated development app with playwright-cli run-code --filename test/search-results.playwright.js.
// Creates and removes only uniquely named regression fixtures.
async (page) => {
	if (!/^https?:\/\/[^/]+\.lan(?:\/|$)/.test(page.url())) throw new Error('This regression creates fixtures; use a development .lan host.');
	const origin = page.url().match(/^https?:\/\/[^/]+/)[0];
	const stamp = Date.now();
	const tag = 'search-regression-' + stamp;
	const projects = [];
	const records = [];
	const failures = [];
	let mutation = false;
	const forbidden = [];
	const onRequest = (request) => {
		if (mutation && (/\/ajax\/section\//.test(request.url()) || /\/api\/v1\/search\/results(?:\?|$)/.test(request.url()) || request.isNavigationRequest())) forbidden.push(request.url());
	};
	page.on('request', onRequest);
	const call = async (method, path, data) => {
		const response = await page.request.fetch(origin + '/api/v1' + path, { method, data, ignoreHTTPSErrors: true });
		if (method === 'DELETE' && response.status() === 404) return {};
		if (!response.ok()) throw new Error(method + ' ' + path + ': ' + response.status() + ' ' + (await response.text()).slice(0, 200));
		return response.json();
	};
	try {
		for (const name of ['Source', 'Destination']) projects.push((await call('POST', '/projects', { name: 'Search regression ' + stamp + ' ' + name })).project._id);
		for (let index = 0; index < 14; index++) {
			const note = (await call('POST', '/notes', { title: 'Search regression ' + stamp + ' record ' + index, text_content: 'typerelay mention', tags: index === 12 ? ['unrelated'] : [tag, 'api'], project: index === 13 ? projects[1] : projects[0] })).note;
			records.push(note._id);
		}
		const filters = { query: '', tags: [tag], project_id: projects[0] };
		const response = await call('POST', '/chat', { query: 'show me all the records with the tag "' + tag + '"', project_id: projects[0] });
		if (response.search_filters?.project_id !== projects[0] || response.results.some((item) => !item.tags.includes(tag) || item.project_id !== projects[0])) throw new Error('AI scope or tags incorrect');
		await page.evaluate((project) => setActiveProject(project), projects[0]);
		await page.locator('#chat-input').fill('show me all the records with the tag "' + tag + '"');
		await page.locator('#chat-send').click();
		await page.waitForFunction(() => document.querySelector('#search-total')?.textContent === '12 matching records');
		if (await page.locator('#search-project').inputValue() !== projects[0]) throw new Error('AI UI lost the selected project');
		await page.locator('#st-global-search-trigger').click();
		await page.locator('#st-search-input').fill('tag:' + tag);
		const paletteResults = page.waitForResponse((response) => response.url().endsWith('/api/v1/search/results'));
		await page.locator('#st-search-view-all').click();
		await paletteResults;
		await page.waitForFunction(() => document.querySelector('#search-total')?.textContent === '12 matching records');
		if (await page.locator('.search-result').count() !== 10) throw new Error('First page should contain 10 records');
		await page.getByRole('button', { name: 'Select page', exact: true }).click();
		await page.getByRole('button', { name: 'Next', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-page-number')?.textContent === 'Page 2 of 2');
		if (await page.locator('#search-selected').textContent() !== '10 selected') throw new Error('Selection lost across pagination');
		await page.getByRole('button', { name: 'Select all 12 matching records', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-selected')?.textContent === '12 selected');
		mutation = true;
		await page.getByRole('button', { name: 'Add tags', exact: true }).click();
		await page.getByLabel('Tags, one per line', { exact: true }).fill('bulk-regression');
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-action-status')?.textContent === '12 updated; 0 failed.');
		await page.waitForFunction(() => !document.querySelector('#search-tags-modal')?.classList.contains('show'));
		if (await page.locator('#search-page-number').textContent() !== 'Page 2 of 2') throw new Error('Mutation changed pagination');
		if (await page.locator('.search-result').count() !== 2) throw new Error('Mutation replaced surrounding page');
		mutation = false;
		const afterTag = await call('POST', '/search/selection', filters);
		if (afterTag.items.length !== 12) throw new Error('All-matching action missed unloaded records');
		for (const id of records.slice(0, 12)) {
			const note = (await call('GET', '/notes/' + id)).note;
			if (!note.tags.includes('bulk-regression') || !note.tags.includes(tag) || !note.tags.includes('api')) throw new Error('Tag action lost or missed tags');
		}
		await page.getByRole('button', { name: 'Select all 12 matching records', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-selected')?.textContent === '12 selected');
		mutation = true;
		await page.getByRole('button', { name: 'Move project', exact: true }).click();
		await page.locator('#batch-project-select').selectOption(projects[1]);
		await page.locator('#batch-project-form').getByRole('button', { name: 'Move', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-total')?.textContent === '0 matching records');
		await page.waitForFunction(() => !document.querySelector('#batchProjectModal')?.classList.contains('show'));
		await page.evaluate((id) => {
			for (let i = 0; i < 3; i++) window.dispatchEvent(new CustomEvent('note:updated', { detail: { _id: id, updatedAt: '2000-01-01' } }));
		}, records[0]);
		if (await page.locator('.search-result').count()) throw new Error('Moved records reappeared');
		mutation = false;
		const destination = await call('POST', '/search/results', { ...filters, project_id: projects[1] });
		if (destination.total !== 13) throw new Error('Bulk move did not include all matching records');
		if ((await call('GET', '/notes/' + records[12])).note.project !== projects[0]) throw new Error('Text-only match was incorrectly moved');
		await page.locator('#search-project').selectOption(projects[1]);
		await page.locator('#search-submit').click();
		await page.waitForFunction(() => document.querySelector('#search-total')?.textContent === '13 matching records');
		await page.getByRole('button', { name: 'Select all 13 matching records', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-selected')?.textContent === '13 selected');
		mutation = true;
		await page.getByRole('button', { name: 'Remove tags', exact: true }).click();
		await page.getByLabel('Tags, one per line', { exact: true }).fill(tag);
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-total')?.textContent === '0 matching records');
		await page.waitForFunction(() => !document.querySelector('#search-tags-modal')?.classList.contains('show'));
		mutation = false;
		await page.locator('#search-form .ts-control .remove').click();
		await page.locator('#search-submit').click();
		await page.waitForFunction(() => document.querySelector('#search-total')?.textContent === '13 matching records');
		await page.locator('.search-select').first().check();
		mutation = true;
		await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
		await page.getByRole('button', { name: 'Yes, do it', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('#search-total')?.textContent === '12 matching records');
		if (forbidden.length) throw new Error('Mutation reloaded search/page: ' + forbidden.join(', '));
		return { passed: ['exact AI scope in REST and chat UI', 'search modal View all results', 'extra tags', 'all-page selection', 'bulk tag/move/remove/trash', 'immediate row updates', 'stale socket events', 'no page/section reloads'], forbiddenReloads: forbidden.length };
	} finally {
		mutation = false;
		page.off('request', onRequest);
		for (const id of records) {
			try { await call('DELETE', '/notes/' + id); await call('DELETE', '/trash/notes/' + id); } catch (error) { failures.push(error.message); }
		}
		for (const id of projects) {
			try { await call('DELETE', '/projects/' + id); } catch (error) { failures.push(error.message); }
		}
		if (failures.length) throw new Error('Fixture cleanup: ' + failures.join('\n'));
	}
}
