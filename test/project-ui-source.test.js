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
		formatLocaleDate(value, options) {
			return new Intl.DateTimeFormat('en-US', options).format(new Date(value));
		},
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

	it('renders the shared batch project picker as a Bootstrap modal', () => {
		const render = pug.compileFile(localPath(new URL('../views/ajax/batch_project_picker.pug', import.meta.url)));
		const html = render({
			action: 'move',
			projects: [
				{ _id: 'project-2', name: 'Project Two' },
			],
		});

		assert.match(html, /class="modal fade" id="batchProjectModal"/);
		assert.match(html, /class="modal-dialog modal-dialog-centered"/);
		assert.match(html, /id="batch-project-form"[^>]*data-batch-action="move"/);
		assert.match(html, /id="batchProjectModalLabel"[^>]*>Move to project</);
		assert.match(html, /id="batch-project-select"/);
		assert.match(html, /class="form-select form-select-sm"/);
		assert.match(html, /data-batch-project-cancel="data-batch-project-cancel"[^>]*>Cancel</);
		assert.match(html, /data-batch-project-submit="data-batch-project-submit"/);
		assert.match(html, /data-batch-project-spinner="data-batch-project-spinner"/);
		assert.doesNotMatch(html, /swal2|batch-operation-progress/);
	});

	it('renders Copy labels and disables submission without another project', () => {
		const render = pug.compileFile(localPath(new URL('../views/ajax/batch_project_picker.pug', import.meta.url)));
		const copyHtml = render({ action: 'copy', projects: [{ _id: 'project-2', name: 'Project Two' }] });
		const emptyHtml = render({ action: 'move', projects: [] });

		assert.match(copyHtml, /data-batch-action="copy"/);
		assert.match(copyHtml, />Copy to project</);
		assert.match(copyHtml, /data-batch-project-submit="data-batch-project-submit"[^>]*>[\s\S]*?<span>Copy<\/span><\/button>/);
		assert.match(emptyHtml, /id="batch-project-select"[^>]*disabled="disabled"/);
		assert.match(emptyHtml, /data-batch-project-submit="data-batch-project-submit"[^>]*disabled="disabled"/);
		assert.match(emptyHtml, /No other projects available\./);
	});

	it('runs batch project actions through the Bootstrap modal lifecycle', () => {
		const source = fs.readFileSync(new URL('../public/js/batch.js', import.meta.url), 'utf8');
		const picker = source.slice(source.indexOf('async function pickProject'), source.indexOf('\n\tfunction mount'));

		assert.ok(source.includes("fetch('/ajax/batch-project-picker?' + params)"));
		assert.match(picker, /ensureBootstrapModal\(\)/);
		assert.match(picker, /Modal\.getOrCreateInstance\(modalEl\)/);
		assert.match(picker, /form\.addEventListener\('submit', async function/);
		assert.match(picker, /form\.dataset\.busy === 'true'\) event\.preventDefault\(\)/);
		assert.match(picker, /setProjectPickerBusy\(form, true\)/);
		assert.match(picker, /root\.replaceChildren\(\)/);
		assert.match(picker, /applyBatchResult\(result, action\)/);
		assert.match(source, /window\.dispatchEvent\(new CustomEvent\('batch-done'\)\)/);
		assert.doesNotMatch(picker, /Swal|showLoaderOnConfirm|setBatchProgress/);
	});

	it('provides a persistent mount point for the dynamic batch modal', () => {
		const layout = fs.readFileSync(new URL('../views/layout.pug', import.meta.url), 'utf8');

		assert.match(layout, /#batch-project-modal-root/);
	});

	it('navigates dashboard after deleting a project', () => {
		const source = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');

		assert.ok(source.includes('await loadProjects();\n\t\tawait navigateTo(\'/dashboard\');'));
	});
});
