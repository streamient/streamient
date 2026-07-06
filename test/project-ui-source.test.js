import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pug from 'pug';
import { fileURLToPath } from 'node:url';

function localPath(url) {
	return fileURLToPath(url);
}

function icon(name, classes = '') {
	return `<span class="st-icon ${classes}">${name}</span>`;
}

function renderProjectOverview(overrides = {}) {
	const render = pug.compileFile(localPath(new URL('../views/ajax/project_overview.pug', import.meta.url)));
	return render({
		project: {
			_id: 'project-1',
			name: 'Project One',
			color: '#6655ff',
			createdAt: '2026-07-06T12:00:00.000Z',
			is_default: false,
		},
		counts: {
			'project-1': { notes: 0, memory: 0, urls: 0, emails: 0 },
		},
		emailForwardDomain: '',
		emailViewEnabled: true,
		canManageProjectSettings: true,
		is_hosted: false,
		icon,
		...overrides,
	});
}

describe('project dashboard UI source', () => {
	it('shows delete as blocked with the exact blocker reason', () => {
		const html = renderProjectOverview({
			canDelete: false,
			deleteBlockers: ['1 git repo'],
		});

		assert.match(html, /data-project-delete-blocked/);
		assert.match(html, /data-delete-disabled-reason="Cannot delete project: has 1 git repo"/);
		assert.match(html, />Cannot delete project: has 1 git repo</);
	});

	it('shows active delete action for deletable projects', () => {
		const html = renderProjectOverview({
			canDelete: true,
			deleteBlockers: [],
		});

		assert.match(html, /data-project-delete="project-1"/);
		assert.doesNotMatch(html, /data-project-delete-blocked/);
	});

	it('renders batch project picker with visible progress markup', () => {
		const render = pug.compileFile(localPath(new URL('../views/ajax/batch_project_picker.pug', import.meta.url)));
		const html = render({
			action: 'move',
			projects: [
				{ _id: 'project-2', name: 'Project Two' },
			],
		});

		assert.match(html, /id="batch-project-select"/);
		assert.match(html, /class="form-select form-select-sm"/);
		assert.match(html, /id="batch-operation-progress"/);
		assert.match(html, /progress-bar-striped progress-bar-animated/);
		assert.match(html, /aria-label="Move progress"/);
	});

	it('keeps batch move modal open while async progress runs', () => {
		const source = fs.readFileSync(new URL('../public/js/batch.js', import.meta.url), 'utf8');

		assert.ok(source.includes("fetch('/ajax/batch-project-picker?' + params)"));
		assert.ok(source.includes('showLoaderOnConfirm: true'));
		assert.ok(source.includes('preConfirm: async function ()'));
		assert.ok(source.includes('setBatchProgressVisible(action, count)'));
		assert.ok(source.includes("window.dispatchEvent(new CustomEvent('batch-done'))"));
	});

	it('navigates dashboard after deleting a project', () => {
		const source = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');

		assert.ok(source.includes('await loadProjects();\n\t\tawait navigateTo(\'/dashboard\');'));
	});
});
